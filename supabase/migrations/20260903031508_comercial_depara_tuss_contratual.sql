create table if not exists public.contrato_depara_tuss (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.credenciamento_contratos(id) on delete cascade,
  fonte_id uuid not null references public.tabelas_comerciais_fontes(id) on delete cascade,
  codigo_origem text not null,
  descricao_origem text,
  codigo_tuss text not null,
  descricao_tuss text,
  tabela_tiss_codigo text,
  vigencia_inicio date not null,
  vigencia_fim date,
  ativo boolean not null default true,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  constraint contrato_depara_tuss_codigo_origem_check check (btrim(codigo_origem) <> ''),
  constraint contrato_depara_tuss_codigo_tuss_check check (btrim(codigo_tuss) <> ''),
  constraint contrato_depara_tuss_tabela_tiss_check check (tabela_tiss_codigo is null or tabela_tiss_codigo ~ '^[0-9]{2}$'),
  constraint contrato_depara_tuss_vigencia_check check (vigencia_fim is null or vigencia_fim >= vigencia_inicio)
);

create index if not exists idx_contrato_depara_tuss_resolucao
  on public.contrato_depara_tuss(contrato_id, fonte_id, codigo_origem, ativo, vigencia_inicio desc);
create index if not exists idx_contrato_depara_tuss_reverso
  on public.contrato_depara_tuss(contrato_id, fonte_id, codigo_tuss, ativo, vigencia_inicio desc);

alter table public.contrato_depara_tuss enable row level security;
alter table public.contrato_depara_tuss force row level security;

revoke all on table public.contrato_depara_tuss from public, anon, authenticated;
grant select on table public.contrato_depara_tuss to authenticated;

drop policy if exists contrato_depara_tuss_read on public.contrato_depara_tuss;
create policy contrato_depara_tuss_read on public.contrato_depara_tuss
for select to authenticated
using (
  exists (
    select 1
      from public.credenciamento_contratos c
     where c.id = contrato_depara_tuss.contrato_id
       and public.comercial_pode_visualizar(c.empresa_id, c.unidade_id)
  )
);

create or replace function public.resolver_depara_tuss_contrato_internal(
  p_contrato_id uuid,
  p_fonte_id uuid,
  p_codigo text,
  p_data date
)
returns table(
  forward_id uuid,
  codigo_tuss text,
  reverse_id uuid,
  codigo_fonte text,
  tabela_tiss_codigo text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_data date := coalesce(p_data, current_date);
begin
  return query
  with forward_map as (
    select d.id, d.codigo_tuss, d.tabela_tiss_codigo
      from public.contrato_depara_tuss d
     where d.contrato_id = p_contrato_id
       and d.fonte_id = p_fonte_id
       and d.ativo
       and d.codigo_origem = p_codigo
       and d.vigencia_inicio <= v_data
       and (d.vigencia_fim is null or d.vigencia_fim >= v_data)
     order by d.vigencia_inicio desc, d.updated_at desc, d.id
     limit 1
  ), reverse_map as (
    select d.id, d.codigo_origem, d.tabela_tiss_codigo
      from public.contrato_depara_tuss d
     where d.contrato_id = p_contrato_id
       and d.fonte_id = p_fonte_id
       and d.ativo
       and d.codigo_tuss = p_codigo
       and d.vigencia_inicio <= v_data
       and (d.vigencia_fim is null or d.vigencia_fim >= v_data)
     order by d.vigencia_inicio desc, d.updated_at desc, d.id
     limit 1
  )
  select f.id,
         f.codigo_tuss,
         r.id,
         r.codigo_origem,
         coalesce(f.tabela_tiss_codigo, r.tabela_tiss_codigo)
    from (select 1) x
    left join forward_map f on true
    left join reverse_map r on true;
end;
$$;

revoke all on function public.resolver_depara_tuss_contrato_internal(uuid,uuid,text,date) from public, anon, authenticated;
grant execute on function public.resolver_depara_tuss_contrato_internal(uuid,uuid,text,date) to postgres;

create or replace function public.comercial_salvar_depara_tuss(
  p_id uuid,
  p_contrato_id uuid,
  p_fonte_id uuid,
  p_codigo_origem text,
  p_descricao_origem text,
  p_codigo_tuss text,
  p_descricao_tuss text,
  p_tabela_tiss_codigo text,
  p_vigencia_inicio date,
  p_vigencia_fim date,
  p_ativo boolean,
  p_observacoes text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_empresa uuid;
  v_unidade uuid;
  v_id uuid;
  v_codigo_origem text := nullif(btrim(p_codigo_origem), '');
  v_codigo_tuss text := nullif(btrim(p_codigo_tuss), '');
  v_tabela text := nullif(btrim(p_tabela_tiss_codigo), '');
begin
  select c.empresa_id, c.unidade_id
    into v_empresa, v_unidade
    from public.credenciamento_contratos c
   where c.id = p_contrato_id;
  if not found then
    raise exception 'Contrato comercial não encontrado.';
  end if;
  if not public.comercial_pode_editar(v_empresa, v_unidade) then
    raise exception 'Usuário sem permissão para editar este contrato.';
  end if;
  if not exists (
    select 1 from public.tabelas_comerciais_fontes f
     where f.id = p_fonte_id and f.empresa_id = v_empresa and f.ativo
  ) then
    raise exception 'Fonte comercial inválida para a empresa do contrato.';
  end if;
  if not exists (
    select 1 from public.contrato_tabelas_comerciais v
     where v.contrato_id = p_contrato_id and v.fonte_id = p_fonte_id and v.ativo
  ) then
    raise exception 'A fonte precisa estar vinculada e ativa no contrato antes do DePara.';
  end if;
  if v_codigo_origem is null or v_codigo_tuss is null then
    raise exception 'Código de origem e código TUSS são obrigatórios.';
  end if;
  if p_vigencia_inicio is null then
    raise exception 'A vigência inicial do DePara é obrigatória.';
  end if;
  if p_vigencia_fim is not null and p_vigencia_fim < p_vigencia_inicio then
    raise exception 'Vigência final anterior à vigência inicial.';
  end if;
  if v_tabela is not null and v_tabela !~ '^[0-9]{2}$' then
    raise exception 'Tabela TISS deve possuir dois dígitos.';
  end if;
  if p_id is not null and not exists (
    select 1 from public.contrato_depara_tuss d where d.id = p_id and d.contrato_id = p_contrato_id
  ) then
    raise exception 'DePara não pertence ao contrato informado.';
  end if;
  if coalesce(p_ativo, true) and exists (
    select 1
      from public.contrato_depara_tuss d
     where d.contrato_id = p_contrato_id
       and d.fonte_id = p_fonte_id
       and d.codigo_origem = v_codigo_origem
       and d.ativo
       and (p_id is null or d.id <> p_id)
       and d.vigencia_inicio <= coalesce(p_vigencia_fim, 'infinity'::date)
       and coalesce(d.vigencia_fim, 'infinity'::date) >= p_vigencia_inicio
  ) then
    raise exception 'Já existe DePara ativo para este código/fonte com vigência sobreposta.';
  end if;

  if p_id is null then
    insert into public.contrato_depara_tuss(
      contrato_id, fonte_id, codigo_origem, descricao_origem, codigo_tuss, descricao_tuss,
      tabela_tiss_codigo, vigencia_inicio, vigencia_fim, ativo, observacoes, created_by, updated_by
    ) values (
      p_contrato_id, p_fonte_id, v_codigo_origem, nullif(btrim(p_descricao_origem), ''),
      v_codigo_tuss, nullif(btrim(p_descricao_tuss), ''), v_tabela,
      p_vigencia_inicio, p_vigencia_fim, coalesce(p_ativo, true), nullif(btrim(p_observacoes), ''),
      auth.uid(), auth.uid()
    ) returning id into v_id;
  else
    update public.contrato_depara_tuss d
       set fonte_id = p_fonte_id,
           codigo_origem = v_codigo_origem,
           descricao_origem = nullif(btrim(p_descricao_origem), ''),
           codigo_tuss = v_codigo_tuss,
           descricao_tuss = nullif(btrim(p_descricao_tuss), ''),
           tabela_tiss_codigo = v_tabela,
           vigencia_inicio = p_vigencia_inicio,
           vigencia_fim = p_vigencia_fim,
           ativo = coalesce(p_ativo, true),
           observacoes = nullif(btrim(p_observacoes), ''),
           updated_at = now(),
           updated_by = auth.uid()
     where d.id = p_id
     returning d.id into v_id;
  end if;
  return v_id;
end;
$$;

revoke all on function public.comercial_salvar_depara_tuss(uuid,uuid,uuid,text,text,text,text,text,date,date,boolean,text) from public, anon;
grant execute on function public.comercial_salvar_depara_tuss(uuid,uuid,uuid,text,text,text,text,text,date,date,boolean,text) to authenticated, postgres;

create or replace function public.audit_contrato_depara_tuss()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ref jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_empresa uuid;
  v_unidade uuid;
  v_contrato uuid := (v_ref->>'contrato_id')::uuid;
begin
  select c.empresa_id, c.unidade_id into v_empresa, v_unidade
    from public.credenciamento_contratos c where c.id = v_contrato;
  if v_empresa is not null then
    insert into public.comercial_eventos(
      empresa_id, unidade_id, entidade_tipo, entidade_id, acao, antes, depois, usuario_id,
      contexto_contrato_id, contexto_edicao_id
    ) values (
      v_empresa, v_unidade, 'contrato_depara_tuss', (v_ref->>'id')::uuid, lower(tg_op),
      case when tg_op <> 'INSERT' then to_jsonb(old) else null end,
      case when tg_op <> 'DELETE' then to_jsonb(new) else null end,
      auth.uid(), v_contrato, null
    );
  end if;
  return coalesce(new, old);
end;
$$;

revoke all on function public.audit_contrato_depara_tuss() from public, anon, authenticated;
grant execute on function public.audit_contrato_depara_tuss() to postgres;

drop trigger if exists trg_audit_contrato_depara_tuss on public.contrato_depara_tuss;
create trigger trg_audit_contrato_depara_tuss
after insert or update or delete on public.contrato_depara_tuss
for each row execute function public.audit_contrato_depara_tuss();

comment on table public.contrato_depara_tuss is 'DePara TUSS explícito por contrato, fonte e vigência. Não cria equivalências implícitas.';
comment on function public.comercial_salvar_depara_tuss(uuid,uuid,uuid,text,text,text,text,text,date,date,boolean,text) is 'Única mutação autenticada do DePara contratual, com validação de escopo, fonte vinculada e sobreposição de vigência.';
