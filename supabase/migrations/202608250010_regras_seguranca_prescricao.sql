create table if not exists public.prescricao_regras_seguranca (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid null references public.empresas on delete cascade,
  codigo text not null,
  principio_ativo_match text not null,
  apresentacao_match text null,
  via_match text null,
  max_administracoes_24h smallint null check (max_administracoes_24h is null or max_administracoes_24h > 0),
  intervalo_minimo_horas numeric(6,2) null check (intervalo_minimo_horas is null or intervalo_minimo_horas > 0),
  dose_maxima_24h numeric(14,4) null check (dose_maxima_24h is null or dose_maxima_24h > 0),
  unidade_dose text null,
  severidade text not null default 'alerta' check (severidade in ('informativa','alerta','bloqueante')),
  mensagem text not null,
  fonte_tipo text not null check (fonte_tipo in ('anvisa_bula','protocolo_institucional','fabricante','outra')),
  fonte_referencia text null,
  fonte_url text null,
  vigencia_inicio date null,
  vigencia_fim date null,
  ativo boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users,
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users,
  unique nulls not distinct (empresa_id, codigo),
  check (vigencia_fim is null or vigencia_inicio is null or vigencia_fim >= vigencia_inicio)
);

create index if not exists prescricao_regras_seguranca_match_idx
  on public.prescricao_regras_seguranca (empresa_id, principio_ativo_match, ativo);

alter table public.prescricao_regras_seguranca enable row level security;
alter table public.prescricao_regras_seguranca force row level security;

drop policy if exists prescricao_regras_select on public.prescricao_regras_seguranca;
create policy prescricao_regras_select on public.prescricao_regras_seguranca
for select using (
  empresa_id is null
  or (public.tem_empresa(empresa_id) and public.tem_permissao(empresa_id, null, 'prescricao.visualizar'))
);

drop policy if exists prescricao_regras_insert on public.prescricao_regras_seguranca;
create policy prescricao_regras_insert on public.prescricao_regras_seguranca
for insert with check (
  empresa_id is not null
  and public.tem_empresa(empresa_id)
  and public.tem_permissao(empresa_id, null, 'configuracoes.administrar')
  and created_by = auth.uid()
);

drop policy if exists prescricao_regras_update on public.prescricao_regras_seguranca;
create policy prescricao_regras_update on public.prescricao_regras_seguranca
for update using (
  empresa_id is not null
  and public.tem_empresa(empresa_id)
  and public.tem_permissao(empresa_id, null, 'configuracoes.administrar')
) with check (
  empresa_id is not null
  and public.tem_empresa(empresa_id)
  and public.tem_permissao(empresa_id, null, 'configuracoes.administrar')
  and updated_by = auth.uid()
);

revoke delete, truncate on public.prescricao_regras_seguranca from anon, authenticated;

insert into public.prescricao_regras_seguranca (
  empresa_id, codigo, principio_ativo_match, max_administracoes_24h, severidade,
  mensagem, fonte_tipo, fonte_referencia, fonte_url, vigencia_inicio, metadata
) values (
  null,
  'ANVISA-DIPIRONA-MAX-4-24H',
  'dipirona',
  4,
  'bloqueante',
  'Dipirona/Novalgina: a programação informada ultrapassa 4 administrações em 24 horas. Revise frequência, apresentação e dose antes de prescrever.',
  'anvisa_bula',
  'Bulário Eletrônico / rotulagem aprovada pela Anvisa. Regra inicial de frequência; dose máxima deve considerar a apresentação específica.',
  'https://www.gov.br/anvisa/pt-br/sistemas/bulario-eletronico',
  current_date,
  jsonb_build_object('origem','ANVISA','escopo','frequencia','revisao_obrigatoria_por_apresentacao',true)
)
on conflict (empresa_id, codigo) do update set
  principio_ativo_match = excluded.principio_ativo_match,
  max_administracoes_24h = excluded.max_administracoes_24h,
  severidade = excluded.severidade,
  mensagem = excluded.mensagem,
  fonte_tipo = excluded.fonte_tipo,
  fonte_referencia = excluded.fonte_referencia,
  fonte_url = excluded.fonte_url,
  metadata = excluded.metadata,
  ativo = true,
  updated_at = now();

create or replace function public.prescricao_administracoes_planejadas(
  p_frequencia text,
  p_horarios text[]
) returns integer
language plpgsql
immutable
set search_path = public
as $$
declare
  v_intervalo numeric;
  v_vezes integer;
  v_match text[];
begin
  if coalesce(array_length(p_horarios, 1), 0) > 0 then
    return array_length(p_horarios, 1);
  end if;

  if nullif(btrim(coalesce(p_frequencia, '')), '') is null then
    return 0;
  end if;

  v_match := regexp_match(lower(p_frequencia), '([0-9]{1,2})\s*/\s*([0-9]{1,2})\s*h');
  if v_match is not null then
    v_intervalo := nullif(v_match[2], '')::numeric;
    if v_intervalo > 0 then
      return ceil(24 / v_intervalo)::integer;
    end if;
  end if;

  v_match := regexp_match(lower(p_frequencia), '([0-9]{1,2})\s*x\s*(ao\s*)?dia');
  if v_match is not null then
    v_vezes := nullif(v_match[1], '')::integer;
    return coalesce(v_vezes, 0);
  end if;

  v_match := regexp_match(lower(p_frequencia), 'a\s*cada\s*([0-9]{1,2})\s*h');
  if v_match is not null then
    v_intervalo := nullif(v_match[1], '')::numeric;
    if v_intervalo > 0 then
      return ceil(24 / v_intervalo)::integer;
    end if;
  end if;

  return 0;
end;
$$;

create or replace function public.validar_regras_seguranca_prescricao()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item record;
  v_regra record;
  v_administracoes integer;
  v_principio text;
  v_descricao text;
begin
  if new.tipo <> 'medicamento' or new.item_assistencial_id is null then
    return new;
  end if;

  select ia.principio_ativo, ia.descricao, ia.apresentacao
    into v_item
  from public.itens_assistenciais ia
  where ia.id = new.item_assistencial_id
    and ia.empresa_id = new.empresa_id
    and ia.ativo = true;

  if not found then
    raise exception using errcode = 'P0001', message = 'REGRA_PRESCRICAO: medicamento não encontrado ou inativo no catálogo assistencial.';
  end if;

  v_principio := lower(unaccent(coalesce(v_item.principio_ativo, v_item.descricao, '')));
  v_descricao := lower(unaccent(coalesce(v_item.descricao, '')));
  v_administracoes := public.prescricao_administracoes_planejadas(new.frequencia, new.horarios);

  for v_regra in
    select r.*
    from public.prescricao_regras_seguranca r
    where r.ativo = true
      and (r.empresa_id is null or r.empresa_id = new.empresa_id)
      and (r.vigencia_inicio is null or r.vigencia_inicio <= current_date)
      and (r.vigencia_fim is null or r.vigencia_fim >= current_date)
      and (
        v_principio like '%' || lower(unaccent(r.principio_ativo_match)) || '%'
        or v_descricao like '%' || lower(unaccent(r.principio_ativo_match)) || '%'
      )
      and (r.apresentacao_match is null or lower(unaccent(coalesce(v_item.apresentacao, ''))) like '%' || lower(unaccent(r.apresentacao_match)) || '%')
      and (r.via_match is null or lower(unaccent(coalesce(new.via, ''))) like '%' || lower(unaccent(r.via_match)) || '%')
    order by case when r.empresa_id is not null then 0 else 1 end, r.created_at desc
  loop
    if v_regra.max_administracoes_24h is not null
       and v_administracoes > v_regra.max_administracoes_24h
       and v_regra.severidade = 'bloqueante' then
      raise exception using
        errcode = 'P0001',
        message = 'REGRA_PRESCRICAO: ' || v_regra.mensagem,
        detail = coalesce(v_regra.fonte_referencia, v_regra.fonte_tipo),
        hint = coalesce(v_regra.fonte_url, 'Revise a regra clínica cadastrada.');
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_validar_regras_seguranca_prescricao on public.prescricoes;
create trigger trg_validar_regras_seguranca_prescricao
before insert or update of item_assistencial_id, frequencia, horarios, via, tipo
on public.prescricoes
for each row execute function public.validar_regras_seguranca_prescricao();

revoke all on function public.validar_regras_seguranca_prescricao() from public, anon, authenticated;
grant execute on function public.prescricao_administracoes_planejadas(text, text[]) to authenticated;
