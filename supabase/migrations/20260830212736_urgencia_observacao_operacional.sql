create table if not exists public.emergencia_observacoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete restrict,
  unidade_id uuid not null references public.unidades(id) on delete restrict,
  emergencia_id uuid not null references public.emergencia_registros(id) on delete restrict,
  atendimento_id uuid not null references public.atendimentos(id) on delete restrict,
  paciente_id uuid not null references public.pacientes(id) on delete restrict,
  profissional_inicio_id uuid null references public.profissionais(id) on delete set null,
  profissional_fim_id uuid null references public.profissionais(id) on delete set null,
  status text not null default 'ativa' check (status in ('ativa','encerrada')),
  motivo text null,
  local_observacao text null,
  iniciado_em timestamptz not null default now(),
  encerrado_em timestamptz null,
  destino_final text null check (destino_final is null or destino_final in ('alta','internacao','uti','centro_cirurgico','transferencia')),
  observacoes_inicio text null,
  observacoes_fim text null,
  created_at timestamptz not null default now(),
  created_by uuid null,
  updated_at timestamptz not null default now(),
  updated_by uuid null,
  constraint emergencia_observacoes_encerramento_ck check (
    (status = 'ativa' and encerrado_em is null and destino_final is null)
    or (status = 'encerrada' and encerrado_em is not null and destino_final is not null and encerrado_em >= iniciado_em)
  )
);

create unique index if not exists emergencia_observacoes_emergencia_ativa_uidx
  on public.emergencia_observacoes(emergencia_id)
  where status = 'ativa';
create unique index if not exists emergencia_observacoes_atendimento_ativa_uidx
  on public.emergencia_observacoes(atendimento_id)
  where status = 'ativa';
create index if not exists emergencia_observacoes_unidade_status_idx
  on public.emergencia_observacoes(empresa_id, unidade_id, status, iniciado_em desc);

alter table public.emergencia_observacoes enable row level security;
alter table public.emergencia_observacoes force row level security;

drop policy if exists emergencia_observacoes_select on public.emergencia_observacoes;
create policy emergencia_observacoes_select
on public.emergencia_observacoes
for select
to authenticated
using (
  public.tem_unidade(empresa_id, unidade_id)
  and (
    public.tem_permissao(empresa_id, unidade_id, 'emergencia.visualizar')
    or public.tem_permissao(empresa_id, unidade_id, 'emergencia.gerenciar')
    or public.tem_permissao(empresa_id, unidade_id, 'emergencia.reavaliar')
  )
);

revoke all on public.emergencia_observacoes from anon, authenticated;
grant select on public.emergencia_observacoes to authenticated;

-- As mutações da Urgência já passam por RPCs. Remove o DML direto legado para
-- preservar a mesma fronteira transacional usada pelos pacotes recentes.
drop policy if exists emergencia_registros_insert on public.emergencia_registros;
drop policy if exists emergencia_registros_update on public.emergencia_registros;
drop policy if exists emergencia_reavaliacoes_insert on public.emergencia_reavaliacoes;
drop policy if exists emergencia_reavaliacoes_update on public.emergencia_reavaliacoes;
revoke insert, update, delete on public.emergencia_registros from authenticated;
revoke insert, update, delete on public.emergencia_reavaliacoes from authenticated;

create or replace function public.iniciar_observacao_emergencia_operacional(
  p_emergencia_id uuid,
  p_motivo text default null,
  p_local_observacao text default null,
  p_observacoes text default null,
  p_proxima_reavaliacao_em timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $function$
declare
  v_registro public.emergencia_registros%rowtype;
  v_observacao_id uuid;
  v_profissional_id uuid;
begin
  if auth.uid() is null then
    raise exception 'EMERGENCIA_NAO_AUTENTICADO' using errcode='42501';
  end if;

  select * into v_registro
  from public.emergencia_registros
  where id = p_emergencia_id
  for update;

  if v_registro.id is null or v_registro.status = 'encerrado' then
    raise exception 'EMERGENCIA_REGISTRO_INDISPONIVEL' using errcode='P0002';
  end if;

  if not public.tem_unidade(v_registro.empresa_id, v_registro.unidade_id)
     or not public.tem_permissao(v_registro.empresa_id, v_registro.unidade_id, 'emergencia.gerenciar') then
    raise exception 'EMERGENCIA_SEM_PERMISSAO_GERENCIAR' using errcode='42501';
  end if;

  select id into v_observacao_id
  from public.emergencia_observacoes
  where emergencia_id = v_registro.id and status = 'ativa'
  for update;

  if v_observacao_id is not null then
    return v_observacao_id;
  end if;

  v_profissional_id := public.profissional_logado(v_registro.empresa_id);

  insert into public.emergencia_observacoes(
    empresa_id, unidade_id, emergencia_id, atendimento_id, paciente_id,
    profissional_inicio_id, status, motivo, local_observacao,
    observacoes_inicio, created_by, updated_by
  ) values (
    v_registro.empresa_id, v_registro.unidade_id, v_registro.id,
    v_registro.atendimento_id, v_registro.paciente_id,
    v_profissional_id, 'ativa', nullif(trim(p_motivo),''),
    nullif(trim(p_local_observacao),''), nullif(trim(p_observacoes),''),
    auth.uid(), auth.uid()
  ) returning id into v_observacao_id;

  update public.emergencia_registros
  set destino = 'observacao',
      reavaliacao_em = coalesce(p_proxima_reavaliacao_em, reavaliacao_em),
      updated_at = now(),
      updated_by = auth.uid()
  where id = v_registro.id;

  perform public.registrar_integracao_evento_internal(
    v_registro.empresa_id,
    v_registro.unidade_id,
    v_registro.atendimento_id,
    v_registro.paciente_id,
    'emergencia.observacao_iniciada',
    'emergencia_observacoes',
    v_observacao_id,
    now(),
    jsonb_strip_nulls(jsonb_build_object(
      'emergencia_id', v_registro.id,
      'motivo', nullif(trim(p_motivo),''),
      'local_observacao', nullif(trim(p_local_observacao),'')
    ))
  );

  return v_observacao_id;
end;
$function$;

create or replace function public.encerrar_observacao_emergencia_operacional(
  p_observacao_id uuid,
  p_destino_final text,
  p_observacoes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $function$
declare
  v_observacao public.emergencia_observacoes%rowtype;
  v_registro public.emergencia_registros%rowtype;
  v_profissional_id uuid;
  v_destino text;
begin
  if auth.uid() is null then
    raise exception 'EMERGENCIA_NAO_AUTENTICADO' using errcode='42501';
  end if;

  v_destino := lower(nullif(trim(p_destino_final),''));
  if v_destino is null or v_destino not in ('alta','internacao','uti','centro_cirurgico','transferencia') then
    raise exception 'EMERGENCIA_DESTINO_INVALIDO' using errcode='22023';
  end if;

  select * into v_observacao
  from public.emergencia_observacoes
  where id = p_observacao_id
  for update;

  if v_observacao.id is null or v_observacao.status <> 'ativa' then
    raise exception 'EMERGENCIA_OBSERVACAO_INDISPONIVEL' using errcode='P0002';
  end if;

  select * into v_registro
  from public.emergencia_registros
  where id = v_observacao.emergencia_id
  for update;

  if v_registro.id is null or v_registro.status = 'encerrado' then
    raise exception 'EMERGENCIA_REGISTRO_INDISPONIVEL' using errcode='P0002';
  end if;

  if not public.tem_unidade(v_observacao.empresa_id, v_observacao.unidade_id)
     or not public.tem_permissao(v_observacao.empresa_id, v_observacao.unidade_id, 'emergencia.gerenciar') then
    raise exception 'EMERGENCIA_SEM_PERMISSAO_GERENCIAR' using errcode='42501';
  end if;

  v_profissional_id := public.profissional_logado(v_observacao.empresa_id);

  update public.emergencia_observacoes
  set status = 'encerrada',
      destino_final = v_destino,
      observacoes_fim = nullif(trim(p_observacoes),''),
      profissional_fim_id = v_profissional_id,
      encerrado_em = now(),
      updated_at = now(),
      updated_by = auth.uid()
  where id = v_observacao.id;

  update public.emergencia_registros
  set destino = v_destino,
      status = 'encerrado',
      observacoes = coalesce(nullif(trim(p_observacoes),''), observacoes),
      reavaliacao_em = null,
      encerrado_em = now(),
      encerrado_por = auth.uid(),
      updated_at = now(),
      updated_by = auth.uid()
  where id = v_registro.id;

  perform public.registrar_integracao_evento_internal(
    v_observacao.empresa_id,
    v_observacao.unidade_id,
    v_observacao.atendimento_id,
    v_observacao.paciente_id,
    'emergencia.observacao_encerrada',
    'emergencia_observacoes',
    v_observacao.id,
    now(),
    jsonb_build_object(
      'emergencia_id', v_observacao.emergencia_id,
      'destino_final', v_destino
    )
  );

  return v_observacao.atendimento_id;
end;
$function$;

create or replace function public.bloquear_encerramento_emergencia_com_observacao_internal()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $function$
begin
  if new.status = 'encerrado'
     and old.status is distinct from 'encerrado'
     and exists (
       select 1
       from public.emergencia_observacoes o
       where o.emergencia_id = old.id
         and o.status = 'ativa'
     ) then
    raise exception 'EMERGENCIA_OBSERVACAO_ATIVA' using errcode='23514';
  end if;
  return new;
end;
$function$;

drop trigger if exists emergencia_bloquear_encerramento_com_observacao on public.emergencia_registros;
create trigger emergencia_bloquear_encerramento_com_observacao
before update of status on public.emergencia_registros
for each row execute function public.bloquear_encerramento_emergencia_com_observacao_internal();

revoke all on function public.iniciar_observacao_emergencia_operacional(uuid,text,text,text,timestamptz) from public, anon;
grant execute on function public.iniciar_observacao_emergencia_operacional(uuid,text,text,text,timestamptz) to authenticated;
revoke all on function public.encerrar_observacao_emergencia_operacional(uuid,text,text) from public, anon;
grant execute on function public.encerrar_observacao_emergencia_operacional(uuid,text,text) to authenticated;
revoke all on function public.bloquear_encerramento_emergencia_com_observacao_internal() from public, anon, authenticated;
