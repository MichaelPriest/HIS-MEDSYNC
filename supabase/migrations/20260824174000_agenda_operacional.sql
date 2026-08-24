-- Evolução operacional da Agenda.
-- Agendamentos ambulatoriais não dependem de senha/totem.
-- Cirurgia eletiva é apenas sinalizada aqui e segue posteriormente para o fluxo cirúrgico/pré-admissão.

create extension if not exists btree_gist with schema extensions;

alter table public.agendamentos
  add column if not exists plano_id uuid references public.convenio_planos(id),
  add column if not exists especialidade text,
  add column if not exists estrutura_fisica_id uuid references public.estruturas_fisicas(id),
  add column if not exists cirurgia_eletiva boolean not null default false,
  add column if not exists encaixe boolean not null default false,
  add column if not exists retorno boolean not null default false,
  add column if not exists motivo_agendamento text,
  add column if not exists confirmado_em timestamptz,
  add column if not exists checkin_em timestamptz,
  add column if not exists atendido_em timestamptz,
  add column if not exists cancelado_em timestamptz,
  add column if not exists falta_registrada_em timestamptz,
  add column if not exists motivo_cancelamento text;

create index if not exists agendamentos_unidade_status_inicio_idx
  on public.agendamentos (unidade_id, status, inicio);

create index if not exists agendamentos_profissional_inicio_idx
  on public.agendamentos (unidade_id, profissional_id, inicio)
  where profissional_id is not null;

create index if not exists agendamentos_estrutura_inicio_idx
  on public.agendamentos (unidade_id, estrutura_fisica_id, inicio)
  where estrutura_fisica_id is not null;

-- Impede sobreposição real para o mesmo profissional. Cancelamentos/faltas liberam o horário.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'agendamentos_profissional_sem_sobreposicao'
  ) then
    alter table public.agendamentos
      add constraint agendamentos_profissional_sem_sobreposicao
      exclude using gist (
        profissional_id with =,
        tstzrange(inicio, fim, '[)') with &&
      )
      where (profissional_id is not null and status not in ('cancelado','faltou'));
  end if;
end;
$$;

-- O mesmo local físico não pode receber dois agendamentos simultâneos.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'agendamentos_local_sem_sobreposicao'
  ) then
    alter table public.agendamentos
      add constraint agendamentos_local_sem_sobreposicao
      exclude using gist (
        estrutura_fisica_id with =,
        tstzrange(inicio, fim, '[)') with &&
      )
      where (estrutura_fisica_id is not null and status not in ('cancelado','faltou'));
  end if;
end;
$$;

create or replace function public.criar_agendamento_operacional(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := auth.uid();
  v_empresa uuid;
  v_unidade uuid;
  v_paciente uuid;
  v_profissional uuid;
  v_convenio uuid;
  v_plano uuid;
  v_estrutura uuid;
  v_inicio timestamptz;
  v_fim timestamptz;
  v_id uuid;
begin
  if v_usuario is null then
    raise exception 'AGENDA_NAO_AUTENTICADA' using errcode = '42501';
  end if;

  begin
    v_empresa := nullif(p_payload ->> 'empresa_id','')::uuid;
    v_unidade := nullif(p_payload ->> 'unidade_id','')::uuid;
    v_paciente := nullif(p_payload ->> 'paciente_id','')::uuid;
    v_profissional := nullif(p_payload ->> 'profissional_id','')::uuid;
    v_convenio := nullif(p_payload ->> 'convenio_id','')::uuid;
    v_plano := nullif(p_payload ->> 'plano_id','')::uuid;
    v_estrutura := nullif(p_payload ->> 'estrutura_fisica_id','')::uuid;
    v_inicio := nullif(p_payload ->> 'inicio','')::timestamptz;
    v_fim := nullif(p_payload ->> 'fim','')::timestamptz;
  exception when others then
    raise exception 'AGENDA_DADOS_INVALIDOS' using errcode = 'P0001';
  end;

  if v_empresa is null or v_unidade is null or v_paciente is null or v_inicio is null or v_fim is null or v_fim <= v_inicio then
    raise exception 'AGENDA_CAMPOS_OBRIGATORIOS' using errcode = 'P0001';
  end if;

  if not public.tem_unidade(v_empresa, v_unidade)
     or not public.tem_permissao(v_empresa, v_unidade, 'agenda.criar') then
    raise exception 'AGENDA_SEM_PERMISSAO' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.pacientes p
    where p.id = v_paciente and p.empresa_id = v_empresa and p.ativo
  ) then
    raise exception 'AGENDA_PACIENTE_INVALIDO' using errcode = 'P0001';
  end if;

  if v_profissional is not null and not exists (
    select 1 from public.profissionais p
    where p.id = v_profissional and p.empresa_id = v_empresa and p.ativo
  ) then
    raise exception 'AGENDA_PROFISSIONAL_INVALIDO' using errcode = 'P0001';
  end if;

  if v_convenio is not null and not exists (
    select 1 from public.convenios c
    where c.id = v_convenio and c.empresa_id = v_empresa and c.ativo
  ) then
    raise exception 'AGENDA_CONVENIO_INVALIDO' using errcode = 'P0001';
  end if;

  if v_plano is not null and (
    v_convenio is null or not exists (
      select 1 from public.convenio_planos cp
      where cp.id = v_plano
        and cp.empresa_id = v_empresa
        and cp.convenio_id = v_convenio
        and cp.ativo
    )
  ) then
    raise exception 'AGENDA_PLANO_INVALIDO' using errcode = 'P0001';
  end if;

  if v_estrutura is not null and not exists (
    select 1 from public.estruturas_fisicas ef
    where ef.id = v_estrutura
      and ef.empresa_id = v_empresa
      and ef.unidade_id = v_unidade
      and ef.ativo
      and ef.permite_atendimento
  ) then
    raise exception 'AGENDA_LOCAL_INVALIDO' using errcode = 'P0001';
  end if;

  insert into public.agendamentos (
    empresa_id, unidade_id, paciente_id, profissional_id, convenio_id, plano_id,
    inicio, fim, tipo_atendimento, especialidade, estrutura_fisica_id,
    cirurgia_eletiva, encaixe, retorno, motivo_agendamento, observacoes,
    created_by, updated_by
  ) values (
    v_empresa, v_unidade, v_paciente, v_profissional, v_convenio, v_plano,
    v_inicio, v_fim,
    nullif(trim(coalesce(p_payload ->> 'tipo_atendimento','')), ''),
    nullif(trim(coalesce(p_payload ->> 'especialidade','')), ''),
    v_estrutura,
    coalesce((p_payload ->> 'cirurgia_eletiva')::boolean, false),
    coalesce((p_payload ->> 'encaixe')::boolean, false),
    coalesce((p_payload ->> 'retorno')::boolean, false),
    nullif(trim(coalesce(p_payload ->> 'motivo_agendamento','')), ''),
    nullif(trim(coalesce(p_payload ->> 'observacoes','')), ''),
    v_usuario, v_usuario
  ) returning id into v_id;

  return v_id;
exception
  when exclusion_violation then
    raise exception 'AGENDA_CONFLITO_HORARIO' using errcode = 'P0001';
end;
$$;

create or replace function public.atualizar_status_agendamento(
  p_agendamento uuid,
  p_status text,
  p_motivo text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := auth.uid();
  v_ag public.agendamentos%rowtype;
  v_destino public.status_agendamento;
  v_now timestamptz := now();
begin
  if v_usuario is null then
    raise exception 'AGENDA_NAO_AUTENTICADA' using errcode = '42501';
  end if;

  select * into v_ag
  from public.agendamentos
  where id = p_agendamento
  for update;

  if not found then
    raise exception 'AGENDA_NAO_ENCONTRADA' using errcode = 'P0001';
  end if;

  if not public.tem_unidade(v_ag.empresa_id, v_ag.unidade_id)
     or not public.tem_permissao(v_ag.empresa_id, v_ag.unidade_id, 'agenda.editar') then
    raise exception 'AGENDA_SEM_PERMISSAO' using errcode = '42501';
  end if;

  begin
    v_destino := p_status::public.status_agendamento;
  exception when invalid_text_representation then
    raise exception 'AGENDA_STATUS_INVALIDO' using errcode = 'P0001';
  end;

  if v_ag.status = 'agendado' and v_destino not in ('confirmado','checkin','cancelado','faltou') then
    raise exception 'AGENDA_TRANSICAO_INVALIDA' using errcode = 'P0001';
  elsif v_ag.status = 'confirmado' and v_destino not in ('checkin','cancelado','faltou') then
    raise exception 'AGENDA_TRANSICAO_INVALIDA' using errcode = 'P0001';
  elsif v_ag.status = 'checkin' and v_destino not in ('atendido','cancelado') then
    raise exception 'AGENDA_TRANSICAO_INVALIDA' using errcode = 'P0001';
  elsif v_ag.status in ('atendido','faltou','cancelado') then
    raise exception 'AGENDA_STATUS_FINAL' using errcode = 'P0001';
  end if;

  if v_destino = 'cancelado' and nullif(trim(coalesce(p_motivo,'')), '') is null then
    raise exception 'AGENDA_MOTIVO_CANCELAMENTO_OBRIGATORIO' using errcode = 'P0001';
  end if;

  update public.agendamentos
  set status = v_destino,
      confirmado_em = case when v_destino='confirmado' then v_now else confirmado_em end,
      checkin_em = case when v_destino='checkin' then v_now else checkin_em end,
      atendido_em = case when v_destino='atendido' then v_now else atendido_em end,
      cancelado_em = case when v_destino='cancelado' then v_now else cancelado_em end,
      falta_registrada_em = case when v_destino='faltou' then v_now else falta_registrada_em end,
      motivo_cancelamento = case when v_destino='cancelado' then trim(p_motivo) else motivo_cancelamento end,
      updated_at = v_now,
      updated_by = v_usuario
  where id = p_agendamento;
end;
$$;

revoke all on function public.criar_agendamento_operacional(jsonb) from public;
revoke all on function public.criar_agendamento_operacional(jsonb) from anon;
grant execute on function public.criar_agendamento_operacional(jsonb) to authenticated;
grant execute on function public.criar_agendamento_operacional(jsonb) to service_role;

revoke all on function public.atualizar_status_agendamento(uuid,text,text) from public;
revoke all on function public.atualizar_status_agendamento(uuid,text,text) from anon;
grant execute on function public.atualizar_status_agendamento(uuid,text,text) to authenticated;
grant execute on function public.atualizar_status_agendamento(uuid,text,text) to service_role;

comment on function public.criar_agendamento_operacional(jsonb) is
  'Cria agendamento validando paciente, profissional, convênio/plano, local e conflitos de horário.';
comment on function public.atualizar_status_agendamento(uuid,text,text) is
  'Executa transições operacionais da agenda com timestamps e motivo obrigatório de cancelamento.';
