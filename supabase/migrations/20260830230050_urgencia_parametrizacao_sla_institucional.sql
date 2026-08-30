create table if not exists public.emergencia_sla_configuracoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  unidade_id uuid not null references public.unidades(id),
  classificacao_risco text not null,
  sla_minutos integer not null,
  referencia_institucional text null,
  observacoes text null,
  ativo boolean not null default true,
  vigente_desde timestamptz not null default now(),
  vigente_ate timestamptz null,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id),
  constraint emergencia_sla_configuracoes_classificacao_check
    check (classificacao_risco in ('vermelho','laranja','amarelo','verde','azul')),
  constraint emergencia_sla_configuracoes_sla_check check (sla_minutos > 0),
  constraint emergencia_sla_configuracoes_vigencia_check check (
    (ativo = true and vigente_ate is null)
    or (ativo = false and vigente_ate is not null and vigente_ate >= vigente_desde)
  )
);

create unique index if not exists emergencia_sla_configuracoes_ativa_uk
  on public.emergencia_sla_configuracoes (empresa_id, unidade_id, classificacao_risco)
  where ativo = true;

create index if not exists emergencia_sla_configuracoes_historico_idx
  on public.emergencia_sla_configuracoes (empresa_id, unidade_id, classificacao_risco, vigente_desde desc);

alter table public.emergencia_sla_configuracoes enable row level security;
alter table public.emergencia_sla_configuracoes force row level security;

drop policy if exists emergencia_sla_configuracoes_select on public.emergencia_sla_configuracoes;
create policy emergencia_sla_configuracoes_select
on public.emergencia_sla_configuracoes
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

revoke all on public.emergencia_sla_configuracoes from public, anon, authenticated;
grant select on public.emergencia_sla_configuracoes to authenticated;

create table if not exists public.emergencia_sla_aplicacoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  unidade_id uuid not null references public.unidades(id),
  emergencia_id uuid not null references public.emergencia_registros(id),
  atendimento_id uuid not null references public.atendimentos(id),
  paciente_id uuid not null references public.pacientes(id),
  configuracao_id uuid not null references public.emergencia_sla_configuracoes(id),
  sla_anterior_minutos integer null,
  sla_aplicado_minutos integer not null,
  aplicado_em timestamptz not null default now(),
  aplicado_por uuid null references auth.users(id),
  constraint emergencia_sla_aplicacoes_sla_anterior_check check (sla_anterior_minutos is null or sla_anterior_minutos > 0),
  constraint emergencia_sla_aplicacoes_sla_aplicado_check check (sla_aplicado_minutos > 0)
);

create index if not exists emergencia_sla_aplicacoes_emergencia_idx
  on public.emergencia_sla_aplicacoes (empresa_id, unidade_id, emergencia_id, aplicado_em desc);

alter table public.emergencia_sla_aplicacoes enable row level security;
alter table public.emergencia_sla_aplicacoes force row level security;

drop policy if exists emergencia_sla_aplicacoes_select on public.emergencia_sla_aplicacoes;
create policy emergencia_sla_aplicacoes_select
on public.emergencia_sla_aplicacoes
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

revoke all on public.emergencia_sla_aplicacoes from public, anon, authenticated;
grant select on public.emergencia_sla_aplicacoes to authenticated;

create or replace function public.salvar_configuracao_sla_emergencia_operacional(
  p_empresa_id uuid,
  p_unidade_id uuid,
  p_classificacao_risco text,
  p_sla_minutos integer,
  p_referencia_institucional text default null,
  p_observacoes text default null
) returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_classificacao text;
  v_configuracao_id uuid;
begin
  if auth.uid() is null then
    raise exception 'EMERGENCIA_NAO_AUTENTICADO' using errcode='42501';
  end if;

  if p_empresa_id is null or p_unidade_id is null
     or not public.tem_unidade(p_empresa_id, p_unidade_id)
     or not public.tem_permissao(p_empresa_id, p_unidade_id, 'emergencia.gerenciar') then
    raise exception 'EMERGENCIA_SEM_PERMISSAO_GERENCIAR' using errcode='42501';
  end if;

  perform 1
  from public.unidades
  where id = p_unidade_id and empresa_id = p_empresa_id and ativo = true
  for update;
  if not found then
    raise exception 'EMERGENCIA_UNIDADE_INDISPONIVEL' using errcode='P0002';
  end if;

  v_classificacao := lower(nullif(trim(p_classificacao_risco),''));
  if v_classificacao is null or v_classificacao not in ('vermelho','laranja','amarelo','verde','azul') then
    raise exception 'EMERGENCIA_CLASSIFICACAO_INVALIDA' using errcode='22023';
  end if;
  if p_sla_minutos is null or p_sla_minutos <= 0 then
    raise exception 'EMERGENCIA_SLA_INVALIDO' using errcode='22023';
  end if;

  update public.emergencia_sla_configuracoes
  set ativo = false,
      vigente_ate = now(),
      updated_at = now(),
      updated_by = auth.uid()
  where empresa_id = p_empresa_id
    and unidade_id = p_unidade_id
    and classificacao_risco = v_classificacao
    and ativo = true;

  insert into public.emergencia_sla_configuracoes (
    empresa_id, unidade_id, classificacao_risco, sla_minutos,
    referencia_institucional, observacoes, created_by, updated_by
  ) values (
    p_empresa_id, p_unidade_id, v_classificacao, p_sla_minutos,
    nullif(trim(p_referencia_institucional),''), nullif(trim(p_observacoes),''), auth.uid(), auth.uid()
  ) returning id into v_configuracao_id;

  return v_configuracao_id;
end;
$$;

revoke all on function public.salvar_configuracao_sla_emergencia_operacional(uuid,uuid,text,integer,text,text) from public, anon;
grant execute on function public.salvar_configuracao_sla_emergencia_operacional(uuid,uuid,text,integer,text,text) to authenticated;

create or replace function public.desativar_configuracao_sla_emergencia_operacional(
  p_configuracao_id uuid
) returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_config public.emergencia_sla_configuracoes%rowtype;
begin
  if auth.uid() is null then
    raise exception 'EMERGENCIA_NAO_AUTENTICADO' using errcode='42501';
  end if;

  select * into v_config
  from public.emergencia_sla_configuracoes
  where id = p_configuracao_id
  for update;

  if v_config.id is null or v_config.ativo = false then
    raise exception 'EMERGENCIA_SLA_CONFIGURACAO_INDISPONIVEL' using errcode='P0002';
  end if;

  if not public.tem_unidade(v_config.empresa_id, v_config.unidade_id)
     or not public.tem_permissao(v_config.empresa_id, v_config.unidade_id, 'emergencia.gerenciar') then
    raise exception 'EMERGENCIA_SEM_PERMISSAO_GERENCIAR' using errcode='42501';
  end if;

  update public.emergencia_sla_configuracoes
  set ativo = false,
      vigente_ate = now(),
      updated_at = now(),
      updated_by = auth.uid()
  where id = v_config.id;
end;
$$;

revoke all on function public.desativar_configuracao_sla_emergencia_operacional(uuid) from public, anon;
grant execute on function public.desativar_configuracao_sla_emergencia_operacional(uuid) to authenticated;

create or replace function public.aplicar_sla_institucional_emergencia_operacional(
  p_emergencia_id uuid
) returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_registro public.emergencia_registros%rowtype;
  v_config public.emergencia_sla_configuracoes%rowtype;
  v_sla_anterior integer;
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

  if v_registro.classificacao_risco is null then
    raise exception 'EMERGENCIA_CLASSIFICACAO_NAO_INFORMADA' using errcode='22023';
  end if;

  select * into v_config
  from public.emergencia_sla_configuracoes
  where empresa_id = v_registro.empresa_id
    and unidade_id = v_registro.unidade_id
    and classificacao_risco = lower(v_registro.classificacao_risco)
    and ativo = true
  order by vigente_desde desc
  limit 1;

  if v_config.id is null then
    raise exception 'EMERGENCIA_SLA_CONFIGURACAO_NAO_ENCONTRADA' using errcode='P0002';
  end if;

  v_sla_anterior := v_registro.sla_minutos;

  update public.emergencia_registros
  set sla_minutos = v_config.sla_minutos,
      updated_at = now(),
      updated_by = auth.uid()
  where id = v_registro.id;

  insert into public.emergencia_sla_aplicacoes (
    empresa_id, unidade_id, emergencia_id, atendimento_id, paciente_id,
    configuracao_id, sla_anterior_minutos, sla_aplicado_minutos, aplicado_por
  ) values (
    v_registro.empresa_id, v_registro.unidade_id, v_registro.id, v_registro.atendimento_id, v_registro.paciente_id,
    v_config.id, v_sla_anterior, v_config.sla_minutos, auth.uid()
  );

  return v_config.sla_minutos;
end;
$$;

revoke all on function public.aplicar_sla_institucional_emergencia_operacional(uuid) from public, anon;
grant execute on function public.aplicar_sla_institucional_emergencia_operacional(uuid) to authenticated;
