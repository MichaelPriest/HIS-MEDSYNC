alter table public.administracoes_medicamentos
  add column if not exists medicamento_confirmacao_modo text not null default 'leitura',
  add column if not exists medicamento_confirmacao_motivo text;

alter table public.administracoes_medicamentos
  drop constraint if exists administracoes_medicamentos_confirmacao_modo_check;

alter table public.administracoes_medicamentos
  add constraint administracoes_medicamentos_confirmacao_modo_check
  check (medicamento_confirmacao_modo in ('leitura','manual_contingencia'));

create or replace function public.registrar_administracao_beira_leito(
  p_aprazamento_id uuid,
  p_dispensacao_id uuid,
  p_codigo_paciente text,
  p_codigo_medicamento text,
  p_status text default 'administrado',
  p_justificativa text default null,
  p_dose text default null,
  p_via text default null,
  p_dupla_checagem boolean default false,
  p_segundo_profissional_id uuid default null
) returns uuid
language plpgsql
security invoker
set search_path=public,pg_catalog
as $$
declare
  v_ap public.prescricao_aprazamentos%rowtype;
  v_p public.prescricoes%rowtype;
  v_pac public.pacientes%rowtype;
  v_disp public.dispensacoes_medicamentos%rowtype;
  v_prod public.estoque_produtos%rowtype;
  v_prof uuid;
  v_admin uuid;
  v_paciente_ok boolean := false;
  v_medicamento_ok boolean := false;
  v_manual_medicamento boolean := false;
  v_codigo text := btrim(coalesce(p_codigo_paciente,''));
  v_cod_med text := btrim(coalesce(p_codigo_medicamento,''));
  v_atraso integer;
begin
  if p_status not in ('administrado','recusado','omitido') then raise exception 'STATUS_INVALIDO'; end if;
  select * into v_ap from public.prescricao_aprazamentos where id=p_aprazamento_id for update;
  if not found then raise exception 'APRAZAMENTO_NAO_ENCONTRADO'; end if;
  if v_ap.status <> 'pendente' then raise exception 'APRAZAMENTO_JA_CHECADO'; end if;
  if not (public.tem_permissao(v_ap.empresa_id,v_ap.unidade_id,'medicamentos.checar_beira_leito') or public.tem_permissao(v_ap.empresa_id,v_ap.unidade_id,'medicamentos.administrar')) then raise exception 'SEM_PERMISSAO'; end if;

  select * into v_p from public.prescricoes where id=v_ap.prescricao_id;
  if v_p.assinado_em is null or v_p.status <> 'ativa' then raise exception 'PRESCRICAO_NAO_ATIVA_ASSINADA'; end if;
  if v_p.requer_validacao_farmaceutica and not exists(
    select 1 from public.validacoes_farmaceuticas vf
    where vf.prescricao_id=v_p.id and vf.status in ('validada','validada_com_ressalva')
  ) then raise exception 'VALIDACAO_FARMACEUTICA_PENDENTE'; end if;

  select * into v_pac from public.pacientes where id=v_ap.paciente_id;
  v_paciente_ok := v_codigo<>'' and (
    v_codigo=v_pac.id::text
    or v_codigo=coalesce(v_pac.ra,'')
    or v_codigo=coalesce(v_pac.numero_registro::text,'')
    or v_codigo=coalesce(v_pac.cns,'')
    or regexp_replace(v_codigo,'\D','','g')=regexp_replace(coalesce(v_pac.cpf,''),'\D','','g')
  );
  if not v_paciente_ok then raise exception 'PACIENTE_DIVERGENTE'; end if;

  select id into v_prof from public.profissionais
  where usuario_id=auth.uid() and empresa_id=v_ap.empresa_id and ativo
  limit 1;
  if v_prof is null then raise exception 'USUARIO_SEM_PROFISSIONAL'; end if;

  if p_status='administrado' then
    select * into v_disp from public.dispensacoes_medicamentos where id=p_dispensacao_id;
    if not found or v_disp.prescricao_id is distinct from v_p.id or v_disp.status not in ('dispensado','parcial') then
      raise exception 'DISPENSACAO_INVALIDA';
    end if;
    if v_disp.estoque_lote_id is null then raise exception 'DISPENSACAO_SEM_LOTE'; end if;

    select * into v_prod from public.estoque_produtos where id=coalesce(v_disp.produto_id,v_p.produto_id);
    if not found then raise exception 'PRODUTO_NAO_LOCALIZADO'; end if;

    v_manual_medicamento := v_cod_med='__MANUAL_SEM_ETIQUETA__';
    if v_manual_medicamento then
      if coalesce(btrim(p_justificativa),'')='' then raise exception 'MOTIVO_CONTINGENCIA_OBRIGATORIO'; end if;
      v_medicamento_ok := true;
    else
      v_medicamento_ok := v_cod_med<>'' and (
        v_cod_med=v_prod.id::text
        or v_cod_med=coalesce(v_prod.codigo,'')
        or v_cod_med=coalesce(v_prod.codigo_barras,'')
      );
      if not v_medicamento_ok then raise exception 'MEDICAMENTO_DIVERGENTE'; end if;
    end if;
  else
    if coalesce(btrim(p_justificativa),'')='' then raise exception 'JUSTIFICATIVA_OBRIGATORIA'; end if;
  end if;

  if p_dupla_checagem and (p_segundo_profissional_id is null or p_segundo_profissional_id=v_prof) then
    raise exception 'SEGUNDO_PROFISSIONAL_INVALIDO';
  end if;

  v_atraso := floor(extract(epoch from (now()-v_ap.programado_em))/60)::integer;

  insert into public.administracoes_medicamentos(
    empresa_id,unidade_id,atendimento_id,prescricao_id,paciente_id,profissional_id,
    administrado_em,status,dose_administrada,via,lote,dupla_checagem,segundo_profissional_id,
    justificativa,created_by,dispensacao_id,produto_id,estoque_lote_id,codigo_barras_paciente,
    codigo_barras_medicamento,paciente_confirmado,medicamento_confirmado,dose_confirmada,
    via_confirmada,horario_confirmado,atraso_minutos,aprazamento_id,
    medicamento_confirmacao_modo,medicamento_confirmacao_motivo
  ) values (
    v_ap.empresa_id,v_ap.unidade_id,v_ap.atendimento_id,v_p.id,v_ap.paciente_id,v_prof,
    case when p_status='administrado' then now() else null end,p_status,coalesce(p_dose,v_p.dose),
    coalesce(p_via,v_p.via),v_disp.lote,p_dupla_checagem,p_segundo_profissional_id,p_justificativa,
    auth.uid(),case when p_status='administrado' then v_disp.id else null end,
    case when p_status='administrado' then v_prod.id else v_p.produto_id end,
    case when p_status='administrado' then v_disp.estoque_lote_id else null end,
    p_codigo_paciente,
    case when v_manual_medicamento then null else nullif(p_codigo_medicamento,'') end,
    true,case when p_status='administrado' then true else false end,true,true,
    abs(v_atraso)<=v_ap.tolerancia_minutos,v_atraso,v_ap.id,
    case when v_manual_medicamento then 'manual_contingencia' else 'leitura' end,
    case when v_manual_medicamento then p_justificativa else null end
  ) returning id into v_admin;

  update public.prescricao_aprazamentos
  set status=p_status,administracao_id=v_admin,checado_em=now(),justificativa=p_justificativa,
      updated_at=now(),updated_by=auth.uid()
  where id=v_ap.id;

  insert into public.prescricao_eventos(
    empresa_id,unidade_id,prescricao_id,atendimento_id,evento,detalhe,profissional_id,usuario_id
  ) values (
    v_ap.empresa_id,v_ap.unidade_id,v_p.id,v_ap.atendimento_id,'administracao',
    jsonb_build_object(
      'administracao_id',v_admin,
      'status',p_status,
      'dose',coalesce(p_dose,v_p.dose),
      'via',coalesce(p_via,v_p.via),
      'lote',case when p_status='administrado' then v_disp.lote else null end,
      'confirmacao_medicamento',case when v_manual_medicamento then 'manual_contingencia' else 'leitura' end
    ),
    v_prof,auth.uid()
  );

  return v_admin;
end;
$$;

revoke all on function public.registrar_administracao_beira_leito(uuid,uuid,text,text,text,text,text,text,boolean,uuid) from public,anon;
grant execute on function public.registrar_administracao_beira_leito(uuid,uuid,text,text,text,text,text,text,boolean,uuid) to authenticated;
