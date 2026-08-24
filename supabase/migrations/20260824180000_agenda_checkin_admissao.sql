-- Integra o check-in da Agenda à abertura de atendimento sem Totem/senha.

alter table public.atendimentos
  add column if not exists agendamento_id uuid references public.agendamentos(id) on delete restrict;

create unique index if not exists atendimentos_agendamento_unique
  on public.atendimentos (agendamento_id)
  where agendamento_id is not null;

create or replace function public.abrir_atendimento_por_agendamento(
  p_agendamento_id uuid,
  p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := auth.uid();
  v_ag public.agendamentos%rowtype;
  v_atendimento_id uuid;
  v_paciente_id uuid;
  v_profissional_id uuid;
  v_convenio_id uuid;
  v_plano_id uuid;
  v_tipo_atendimento text;
  v_cobertura text;
  v_carteirinha text;
  v_atendimento_rn boolean;
  v_nome text;
  v_nascimento date;
  v_telefone text;
  v_endereco text;
  v_numero text;
  v_bairro text;
  v_cidade text;
  v_estado text;
  v_now timestamptz := now();
begin
  if v_usuario is null then
    raise exception 'ADMISSAO_NAO_AUTENTICADA' using errcode = '42501';
  end if;

  select * into v_ag
  from public.agendamentos
  where id = p_agendamento_id
  for update;

  if not found or v_ag.status::text <> 'checkin' then
    raise exception 'ADMISSAO_AGENDAMENTO_INVALIDO' using errcode = 'P0001';
  end if;

  if v_ag.cirurgia_eletiva then
    raise exception 'ADMISSAO_AGENDAMENTO_CIRURGICO' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.atendimentos a where a.agendamento_id = p_agendamento_id) then
    raise exception 'ADMISSAO_AGENDAMENTO_JA_UTILIZADO' using errcode = 'P0001';
  end if;

  if not public.tem_unidade(v_ag.empresa_id, v_ag.unidade_id)
     or not public.tem_permissao(v_ag.empresa_id, v_ag.unidade_id, 'atendimentos.abrir') then
    raise exception 'ADMISSAO_SEM_PERMISSAO' using errcode = '42501';
  end if;

  begin
    v_paciente_id := nullif(p_payload ->> 'paciente_id', '')::uuid;
    v_profissional_id := coalesce(nullif(p_payload ->> 'profissional_id', '')::uuid, v_ag.profissional_id);
    v_convenio_id := coalesce(nullif(p_payload ->> 'convenio_id', '')::uuid, v_ag.convenio_id);
    v_plano_id := coalesce(nullif(p_payload ->> 'plano_id', '')::uuid, v_ag.plano_id);
    v_nascimento := nullif(p_payload ->> 'paciente_data_nascimento', '')::date;
  exception when invalid_text_representation or datetime_field_overflow then
    raise exception 'ADMISSAO_DADOS_INVALIDOS' using errcode = 'P0001';
  end;

  if v_paciente_id is distinct from v_ag.paciente_id then
    raise exception 'ADMISSAO_PACIENTE_DIVERGENTE' using errcode = 'P0001';
  end if;

  v_tipo_atendimento := trim(coalesce(nullif(p_payload ->> 'tipo_atendimento', ''), v_ag.tipo_atendimento, 'ambulatorial'));
  v_cobertura := trim(coalesce(nullif(p_payload ->> 'cobertura', ''), case when v_ag.convenio_id is null then 'particular' else 'convenio' end));
  v_carteirinha := nullif(trim(coalesce(p_payload ->> 'numero_carteirinha', '')), '');
  v_atendimento_rn := coalesce((p_payload ->> 'atendimento_rn')::boolean, false);
  v_nome := trim(coalesce(p_payload ->> 'paciente_nome', ''));
  v_telefone := trim(coalesce(p_payload ->> 'paciente_telefone', ''));
  v_endereco := trim(coalesce(p_payload ->> 'paciente_endereco', ''));
  v_numero := trim(coalesce(p_payload ->> 'paciente_numero', ''));
  v_bairro := trim(coalesce(p_payload ->> 'paciente_bairro', ''));
  v_cidade := trim(coalesce(p_payload ->> 'paciente_cidade', ''));
  v_estado := upper(trim(coalesce(p_payload ->> 'paciente_estado', '')));

  if v_paciente_id is null or v_tipo_atendimento = '' or v_nome = '' or v_nascimento is null
     or v_telefone = '' or v_endereco = '' or v_numero = '' or v_bairro = ''
     or v_cidade = '' or char_length(v_estado) <> 2 then
    raise exception 'ADMISSAO_CAMPOS_OBRIGATORIOS' using errcode = 'P0001';
  end if;

  if v_cobertura not in ('particular','convenio') then
    raise exception 'ADMISSAO_COBERTURA_INVALIDA' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.pacientes p
    where p.id=v_paciente_id and p.empresa_id=v_ag.empresa_id and p.ativo
  ) then
    raise exception 'ADMISSAO_PACIENTE_INVALIDO' using errcode = 'P0001';
  end if;

  if v_profissional_id is not null and not exists (
    select 1 from public.profissionais p
    where p.id=v_profissional_id and p.empresa_id=v_ag.empresa_id and p.ativo
  ) then
    raise exception 'ADMISSAO_PROFISSIONAL_INVALIDO' using errcode = 'P0001';
  end if;

  if v_cobertura='convenio' then
    if v_convenio_id is null or v_plano_id is null or v_carteirinha is null then
      raise exception 'ADMISSAO_COBERTURA_INCOMPLETA' using errcode = 'P0001';
    end if;
    if not exists (
      select 1 from public.convenios c
      where c.id=v_convenio_id and c.empresa_id=v_ag.empresa_id and c.ativo
    ) or not exists (
      select 1 from public.convenio_planos cp
      where cp.id=v_plano_id and cp.empresa_id=v_ag.empresa_id
        and cp.convenio_id=v_convenio_id and cp.ativo
    ) then
      raise exception 'ADMISSAO_PLANO_INVALIDO' using errcode = 'P0001';
    end if;
  else
    v_convenio_id := null;
    v_plano_id := null;
    v_carteirinha := null;
    v_atendimento_rn := false;
  end if;

  insert into public.atendimentos (
    empresa_id,unidade_id,agendamento_id,paciente_id,profissional_id,tipo_atendimento,
    origem,observacoes,cobertura,convenio_id,plano_id,numero_carteirinha,atendimento_rn,
    validade_carteirinha,numero_autorizacao,senha_autorizacao,
    paciente_nome,paciente_cpf,paciente_rg,paciente_cns,paciente_data_nascimento,
    paciente_nacionalidade,paciente_estado_civil,paciente_sexo,paciente_telefone,paciente_email,
    paciente_cep,paciente_endereco,paciente_numero,paciente_complemento,paciente_bairro,
    paciente_cidade,paciente_estado,especialidade_destino,setor_atual,ultima_movimentacao_em,
    created_by,updated_by
  ) values (
    v_ag.empresa_id,v_ag.unidade_id,p_agendamento_id,v_paciente_id,v_profissional_id,v_tipo_atendimento,
    'agenda',nullif(trim(coalesce(p_payload ->> 'observacoes','')),''),v_cobertura::public.tipo_cobertura_atendimento,
    v_convenio_id,v_plano_id,v_carteirinha,v_atendimento_rn,
    case when v_cobertura='convenio' then nullif(p_payload ->> 'validade_carteirinha','')::date else null end,
    case when v_cobertura='convenio' then nullif(trim(coalesce(p_payload ->> 'numero_autorizacao','')),'') else null end,
    case when v_cobertura='convenio' then nullif(trim(coalesce(p_payload ->> 'senha_autorizacao','')),'') else null end,
    v_nome,
    nullif(regexp_replace(coalesce(p_payload ->> 'paciente_cpf',''),'\\D','','g'),''),
    nullif(trim(coalesce(p_payload ->> 'paciente_rg','')),''),
    nullif(regexp_replace(coalesce(p_payload ->> 'paciente_cns',''),'\\D','','g'),''),
    v_nascimento,
    nullif(trim(coalesce(p_payload ->> 'paciente_nacionalidade','')),''),
    nullif(trim(coalesce(p_payload ->> 'paciente_estado_civil','')),''),
    nullif(trim(coalesce(p_payload ->> 'paciente_sexo','')),''),
    v_telefone,nullif(trim(coalesce(p_payload ->> 'paciente_email','')),''),
    nullif(regexp_replace(coalesce(p_payload ->> 'paciente_cep',''),'\\D','','g'),''),
    v_endereco,v_numero,nullif(trim(coalesce(p_payload ->> 'paciente_complemento','')),''),
    v_bairro,v_cidade,v_estado,v_ag.especialidade,'triagem',v_now,v_usuario,v_usuario
  ) returning id into v_atendimento_id;

  insert into public.filas_setoriais (
    empresa_id,unidade_id,atendimento_id,paciente_id,setor_codigo,origem,motivo,prioridade,status,created_by,updated_by
  ) values (
    v_ag.empresa_id,v_ag.unidade_id,v_atendimento_id,v_paciente_id,'triagem','agenda','Triagem inicial','normal','aguardando',v_usuario,v_usuario
  );

  if v_cobertura='convenio' then
    insert into public.autorizacoes_atendimento (
      empresa_id,unidade_id,atendimento_id,paciente_id,convenio_id,plano_id,
      numero_guia_operadora,senha_autorizacao,status,created_by,updated_by
    ) values (
      v_ag.empresa_id,v_ag.unidade_id,v_atendimento_id,v_paciente_id,v_convenio_id,v_plano_id,
      nullif(trim(coalesce(p_payload ->> 'numero_autorizacao','')),''),
      nullif(trim(coalesce(p_payload ->> 'senha_autorizacao','')),''),
      case when nullif(trim(coalesce(p_payload ->> 'numero_autorizacao','')),'') is not null then 'solicitada' else 'pendente' end,
      v_usuario,v_usuario
    );
  end if;

  return v_atendimento_id;
exception
  when unique_violation then
    raise exception 'ADMISSAO_AGENDAMENTO_JA_UTILIZADO' using errcode = 'P0001';
end;
$$;

revoke all on function public.abrir_atendimento_por_agendamento(uuid,jsonb) from public;
revoke all on function public.abrir_atendimento_por_agendamento(uuid,jsonb) from anon;
grant execute on function public.abrir_atendimento_por_agendamento(uuid,jsonb) to authenticated;
grant execute on function public.abrir_atendimento_por_agendamento(uuid,jsonb) to service_role;

comment on function public.abrir_atendimento_por_agendamento(uuid,jsonb) is
  'Abre atendimento transacional a partir de agendamento em check-in, sem senha/totem, preservando paciente e vínculo único com a agenda.';
