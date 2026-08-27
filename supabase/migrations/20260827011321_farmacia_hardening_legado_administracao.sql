create or replace function public.dispensar_medicamento_prescricao(
  p_prescricao_id uuid,
  p_estoque_lote_id uuid,
  p_quantidade numeric
) returns uuid
language plpgsql
security definer
set search_path=public,pg_catalog
as $$
declare
  v_p record;
  v_l record;
  v_prof uuid;
  v_id uuid;
  v_val text;
begin
  if p_quantidade is null or p_quantidade<=0 then raise exception 'FARMACIA_QUANTIDADE_INVALIDA'; end if;
  select p.*,a.paciente_id into v_p from public.prescricoes p join public.atendimentos a on a.id=p.atendimento_id where p.id=p_prescricao_id;
  if not found then raise exception 'FARMACIA_PRESCRICAO_NAO_LOCALIZADA'; end if;
  if v_p.assinado_em is null or v_p.status<>'ativa' then raise exception 'FARMACIA_PRESCRICAO_NAO_ASSINADA_ATIVA'; end if;
  if not public.tem_permissao(v_p.empresa_id,v_p.unidade_id,'farmacia.dispensar') then raise exception 'FARMACIA_SEM_PERMISSAO' using errcode='42501'; end if;
  if v_p.requer_validacao_farmaceutica then
    select status into v_val from public.validacoes_farmaceuticas where prescricao_id=v_p.id;
    if coalesce(v_val,'pendente') not in ('validada','validada_com_ressalva') then raise exception 'FARMACIA_VALIDACAO_FARMACEUTICA_PENDENTE'; end if;
  end if;
  v_prof:=public.profissional_logado(v_p.empresa_id);
  if v_prof is null then raise exception 'FARMACIA_USUARIO_SEM_PROFISSIONAL'; end if;

  select l.*,ep.descricao,ep.unidade_medida,el.ativo as local_ativo,el.eh_farmacia
    into v_l
  from public.estoque_lotes l
  join public.estoque_produtos ep on ep.id=l.produto_id
  join public.estoque_locais el on el.id=l.local_id
  where l.id=p_estoque_lote_id
  for update of l;
  if not found then raise exception 'FARMACIA_LOTE_NAO_LOCALIZADO'; end if;
  if v_l.empresa_id<>v_p.empresa_id or v_l.unidade_id<>v_p.unidade_id then raise exception 'FARMACIA_LOTE_FORA_ESCOPO'; end if;
  if v_p.produto_id is not null and v_p.produto_id<>v_l.produto_id then raise exception 'FARMACIA_PRODUTO_DIVERGENTE_DA_PRESCRICAO'; end if;
  if not v_l.local_ativo or not v_l.eh_farmacia then raise exception 'FARMACIA_LOCAL_INVALIDO'; end if;
  if v_l.status<>'disponivel' then raise exception 'FARMACIA_LOTE_BLOQUEADO'; end if;
  if v_l.validade is null or v_l.validade<current_date then raise exception 'FARMACIA_LOTE_VENCIDO'; end if;
  if not exists(select 1 from public.farmacia_catalogo_local fcl where fcl.local_id=v_l.local_id and fcl.produto_id=v_l.produto_id and fcl.empresa_id=v_p.empresa_id and fcl.unidade_id=v_p.unidade_id and fcl.ativo and fcl.permite_dispensacao) then
    raise exception 'FARMACIA_PRODUTO_SEM_LOCAL_DISPENSACAO';
  end if;
  if v_l.quantidade<p_quantidade then raise exception 'FARMACIA_ESTOQUE_INSUFICIENTE'; end if;

  update public.estoque_lotes set quantidade=quantidade-p_quantidade,updated_at=now() where id=p_estoque_lote_id;
  insert into public.dispensacoes_medicamentos(
    empresa_id,unidade_id,atendimento_id,prescricao_id,paciente_id,item,lote,validade,quantidade,unidade_medida,
    dispensado_por,dispensado_em,status,produto_id,estoque_lote_id,quantidade_atendida,farmacia_local_id,selecao_lote,
    created_by,updated_by
  ) values(
    v_p.empresa_id,v_p.unidade_id,v_p.atendimento_id,v_p.id,v_p.paciente_id,coalesce(v_p.item,v_l.descricao),v_l.numero_lote,
    v_l.validade,p_quantidade,v_l.unidade_medida,v_prof,now(),'dispensado',v_l.produto_id,p_estoque_lote_id,p_quantidade,v_l.local_id,
    'manual',auth.uid(),auth.uid()
  ) returning id into v_id;

  insert into public.estoque_movimentos(
    empresa_id,unidade_id,produto_id,lote_id,local_origem_id,atendimento_id,prescricao_id,tipo,quantidade,custo_unitario,motivo,created_by
  ) values(
    v_p.empresa_id,v_p.unidade_id,v_l.produto_id,v_l.id,v_l.local_id,v_p.atendimento_id,v_p.id,'consumo_paciente',p_quantidade,
    v_l.custo_unitario,'Dispensação manual para prescrição',auth.uid()
  );

  insert into public.prescricao_eventos(empresa_id,unidade_id,prescricao_id,atendimento_id,evento,detalhe,profissional_id,usuario_id)
  values(v_p.empresa_id,v_p.unidade_id,v_p.id,v_p.atendimento_id,'dispensacao',jsonb_build_object('dispensacao_id',v_id,'estoque_lote_id',p_estoque_lote_id,'quantidade',p_quantidade,'selecao_lote','manual'),v_prof,auth.uid());
  return v_id;
end;
$$;

create or replace function public.dispensar_componente_prescricao(
  p_prescricao_componente_id uuid,
  p_estoque_lote_id uuid,
  p_quantidade numeric
) returns uuid
language plpgsql
security definer
set search_path=public,pg_catalog
as $$
declare
  v_c record;
  v_p record;
  v_l record;
  v_prod record;
  v_prof uuid;
  v_id uuid;
  v_val text;
begin
  if p_quantidade is null or p_quantidade<=0 then raise exception 'FARMACIA_QUANTIDADE_INVALIDA'; end if;
  select c.*,ia.descricao as item_descricao into v_c from public.prescricao_componentes c join public.itens_assistenciais ia on ia.id=c.item_assistencial_id where c.id=p_prescricao_componente_id;
  if not found then raise exception 'FARMACIA_COMPONENTE_NAO_LOCALIZADO'; end if;
  select p.*,a.paciente_id into v_p from public.prescricoes p join public.atendimentos a on a.id=p.atendimento_id where p.id=v_c.prescricao_id;
  if not found then raise exception 'FARMACIA_PRESCRICAO_NAO_LOCALIZADA'; end if;
  if v_p.assinado_em is null or v_p.status<>'ativa' then raise exception 'FARMACIA_PRESCRICAO_NAO_ASSINADA_ATIVA'; end if;
  if v_c.empresa_id<>v_p.empresa_id or v_c.unidade_id<>v_p.unidade_id or v_c.atendimento_id<>v_p.atendimento_id then raise exception 'FARMACIA_COMPONENTE_FORA_ESCOPO'; end if;
  if not public.tem_permissao(v_p.empresa_id,v_p.unidade_id,'farmacia.dispensar') then raise exception 'FARMACIA_SEM_PERMISSAO' using errcode='42501'; end if;
  if v_p.requer_validacao_farmaceutica then
    select status into v_val from public.validacoes_farmaceuticas where prescricao_id=v_p.id;
    if coalesce(v_val,'pendente') not in ('validada','validada_com_ressalva') then raise exception 'FARMACIA_VALIDACAO_FARMACEUTICA_PENDENTE'; end if;
  end if;
  v_prof:=public.profissional_logado(v_p.empresa_id);
  if v_prof is null then raise exception 'FARMACIA_USUARIO_SEM_PROFISSIONAL'; end if;
  select ep.* into v_prod from public.estoque_produtos ep where ep.empresa_id=v_p.empresa_id and ep.item_assistencial_id=v_c.item_assistencial_id and ep.ativo order by ep.updated_at desc,ep.id limit 1;
  if not found then raise exception 'FARMACIA_COMPONENTE_SEM_PRODUTO_ESTOQUE'; end if;

  select l.*,ep.descricao,ep.unidade_medida,el.ativo as local_ativo,el.eh_farmacia into v_l
  from public.estoque_lotes l join public.estoque_produtos ep on ep.id=l.produto_id join public.estoque_locais el on el.id=l.local_id
  where l.id=p_estoque_lote_id for update of l;
  if not found then raise exception 'FARMACIA_LOTE_NAO_LOCALIZADO'; end if;
  if v_l.empresa_id<>v_p.empresa_id or v_l.unidade_id<>v_p.unidade_id then raise exception 'FARMACIA_LOTE_FORA_ESCOPO'; end if;
  if v_l.produto_id<>v_prod.id then raise exception 'FARMACIA_PRODUTO_DIVERGENTE_DO_COMPONENTE'; end if;
  if not v_l.local_ativo or not v_l.eh_farmacia then raise exception 'FARMACIA_LOCAL_INVALIDO'; end if;
  if v_l.status<>'disponivel' then raise exception 'FARMACIA_LOTE_BLOQUEADO'; end if;
  if v_l.validade is null or v_l.validade<current_date then raise exception 'FARMACIA_LOTE_VENCIDO'; end if;
  if not exists(select 1 from public.farmacia_catalogo_local fcl where fcl.local_id=v_l.local_id and fcl.produto_id=v_l.produto_id and fcl.empresa_id=v_p.empresa_id and fcl.unidade_id=v_p.unidade_id and fcl.ativo and fcl.permite_dispensacao) then raise exception 'FARMACIA_PRODUTO_SEM_LOCAL_DISPENSACAO'; end if;
  if v_l.quantidade<p_quantidade then raise exception 'FARMACIA_ESTOQUE_INSUFICIENTE'; end if;

  update public.estoque_lotes set quantidade=quantidade-p_quantidade,updated_at=now() where id=p_estoque_lote_id;
  insert into public.dispensacoes_medicamentos(
    empresa_id,unidade_id,atendimento_id,prescricao_id,prescricao_componente_id,paciente_id,item,lote,validade,quantidade,
    unidade_medida,dispensado_por,dispensado_em,status,produto_id,estoque_lote_id,quantidade_atendida,farmacia_local_id,selecao_lote,
    created_by,updated_by
  ) values(
    v_p.empresa_id,v_p.unidade_id,v_p.atendimento_id,v_p.id,v_c.id,v_p.paciente_id,coalesce(v_c.item_descricao,v_l.descricao),v_l.numero_lote,
    v_l.validade,p_quantidade,v_l.unidade_medida,v_prof,now(),'dispensado',v_l.produto_id,p_estoque_lote_id,p_quantidade,v_l.local_id,'manual',
    auth.uid(),auth.uid()
  ) returning id into v_id;

  insert into public.estoque_movimentos(
    empresa_id,unidade_id,produto_id,lote_id,local_origem_id,atendimento_id,prescricao_id,tipo,quantidade,custo_unitario,motivo,created_by
  ) values(
    v_p.empresa_id,v_p.unidade_id,v_l.produto_id,v_l.id,v_l.local_id,v_p.atendimento_id,v_p.id,'consumo_paciente',p_quantidade,
    v_l.custo_unitario,'Dispensação manual de componente da prescrição',auth.uid()
  );

  insert into public.prescricao_eventos(empresa_id,unidade_id,prescricao_id,atendimento_id,evento,detalhe,profissional_id,usuario_id)
  values(v_p.empresa_id,v_p.unidade_id,v_p.id,v_p.atendimento_id,'dispensacao_componente',jsonb_build_object('dispensacao_id',v_id,'prescricao_componente_id',v_c.id,'estoque_lote_id',p_estoque_lote_id,'quantidade',p_quantidade,'selecao_lote','manual'),v_prof,auth.uid());
  return v_id;
end;
$$;

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
set search_path=public,pg_catalog
as $$
declare
  v_ap public.prescricao_aprazamentos%rowtype;
  v_p public.prescricoes%rowtype;
  v_pac public.pacientes%rowtype;
  v_disp public.dispensacoes_medicamentos%rowtype;
  v_prod public.estoque_produtos%rowtype;
  v_lote public.estoque_lotes%rowtype;
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
  if v_ap.status<>'pendente' then raise exception 'APRAZAMENTO_JA_CHECADO'; end if;
  if not (public.tem_permissao(v_ap.empresa_id,v_ap.unidade_id,'medicamentos.checar_beira_leito') or public.tem_permissao(v_ap.empresa_id,v_ap.unidade_id,'medicamentos.administrar')) then raise exception 'SEM_PERMISSAO'; end if;

  select * into v_p from public.prescricoes where id=v_ap.prescricao_id;
  if v_p.assinado_em is null or v_p.status<>'ativa' then raise exception 'PRESCRICAO_NAO_ATIVA_ASSINADA'; end if;
  if v_p.requer_validacao_farmaceutica and not exists(select 1 from public.validacoes_farmaceuticas vf where vf.prescricao_id=v_p.id and vf.status in ('validada','validada_com_ressalva')) then raise exception 'VALIDACAO_FARMACEUTICA_PENDENTE'; end if;

  select * into v_pac from public.pacientes where id=v_ap.paciente_id;
  v_paciente_ok:=v_codigo<>'' and (
    v_codigo=v_pac.id::text or v_codigo=coalesce(v_pac.ra,'') or v_codigo=coalesce(v_pac.numero_registro::text,'') or
    v_codigo=coalesce(v_pac.cns,'') or regexp_replace(v_codigo,'\D','','g')=regexp_replace(coalesce(v_pac.cpf,''),'\D','','g')
  );
  if not v_paciente_ok then raise exception 'PACIENTE_DIVERGENTE'; end if;

  select id into v_prof from public.profissionais where usuario_id=auth.uid() and empresa_id=v_ap.empresa_id and ativo limit 1;
  if v_prof is null then raise exception 'USUARIO_SEM_PROFISSIONAL'; end if;

  if p_status='administrado' then
    select * into v_disp from public.dispensacoes_medicamentos where id=p_dispensacao_id;
    if not found or v_disp.prescricao_id is distinct from v_p.id or v_disp.status not in ('dispensado','parcial') then raise exception 'DISPENSACAO_INVALIDA'; end if;
    if v_disp.estoque_lote_id is null then raise exception 'DISPENSACAO_SEM_LOTE'; end if;
    if coalesce(v_disp.quantidade_devolvida,0)>=v_disp.quantidade then raise exception 'DISPENSACAO_SEM_SALDO'; end if;
    if v_disp.validade is null or v_disp.validade<current_date then raise exception 'DISPENSACAO_LOTE_VENCIDO'; end if;

    select * into v_lote from public.estoque_lotes where id=v_disp.estoque_lote_id;
    if not found then raise exception 'DISPENSACAO_SEM_LOTE'; end if;
    if v_lote.status<>'disponivel' then raise exception 'DISPENSACAO_LOTE_BLOQUEADO'; end if;

    select * into v_prod from public.estoque_produtos where id=coalesce(v_disp.produto_id,v_p.produto_id);
    if not found then raise exception 'PRODUTO_NAO_LOCALIZADO'; end if;

    v_manual_medicamento:=v_cod_med='__MANUAL_SEM_ETIQUETA__';
    if v_manual_medicamento then
      if coalesce(btrim(p_justificativa),'')='' then raise exception 'MOTIVO_CONTINGENCIA_OBRIGATORIO'; end if;
      v_medicamento_ok:=true;
    else
      v_medicamento_ok:=v_cod_med<>'' and (v_cod_med=v_prod.id::text or v_cod_med=coalesce(v_prod.codigo,'') or v_cod_med=coalesce(v_prod.codigo_barras,''));
      if not v_medicamento_ok then raise exception 'MEDICAMENTO_DIVERGENTE'; end if;
    end if;
  else
    if coalesce(btrim(p_justificativa),'')='' then raise exception 'JUSTIFICATIVA_OBRIGATORIA'; end if;
  end if;

  if p_dupla_checagem and (p_segundo_profissional_id is null or p_segundo_profissional_id=v_prof) then raise exception 'SEGUNDO_PROFISSIONAL_INVALIDO'; end if;
  v_atraso:=floor(extract(epoch from (now()-v_ap.programado_em))/60)::integer;

  insert into public.administracoes_medicamentos(
    empresa_id,unidade_id,atendimento_id,prescricao_id,paciente_id,profissional_id,administrado_em,status,dose_administrada,via,lote,
    dupla_checagem,segundo_profissional_id,justificativa,created_by,dispensacao_id,produto_id,estoque_lote_id,codigo_barras_paciente,
    codigo_barras_medicamento,paciente_confirmado,medicamento_confirmado,dose_confirmada,via_confirmada,horario_confirmado,atraso_minutos,
    aprazamento_id,medicamento_confirmacao_modo,medicamento_confirmacao_motivo
  ) values(
    v_ap.empresa_id,v_ap.unidade_id,v_ap.atendimento_id,v_p.id,v_ap.paciente_id,v_prof,
    case when p_status='administrado' then now() else null end,p_status,coalesce(p_dose,v_p.dose),coalesce(p_via,v_p.via),v_disp.lote,
    p_dupla_checagem,p_segundo_profissional_id,p_justificativa,auth.uid(),case when p_status='administrado' then v_disp.id else null end,
    case when p_status='administrado' then v_prod.id else v_p.produto_id end,case when p_status='administrado' then v_disp.estoque_lote_id else null end,
    p_codigo_paciente,case when v_manual_medicamento then null else nullif(p_codigo_medicamento,'') end,true,
    case when p_status='administrado' then true else false end,true,true,abs(v_atraso)<=v_ap.tolerancia_minutos,v_atraso,v_ap.id,
    case when v_manual_medicamento then 'manual_contingencia' else 'leitura' end,case when v_manual_medicamento then p_justificativa else null end
  ) returning id into v_admin;

  update public.prescricao_aprazamentos set status=p_status,administracao_id=v_admin,checado_em=now(),justificativa=p_justificativa,updated_at=now(),updated_by=auth.uid() where id=v_ap.id;

  insert into public.prescricao_eventos(empresa_id,unidade_id,prescricao_id,atendimento_id,evento,detalhe,profissional_id,usuario_id)
  values(v_ap.empresa_id,v_ap.unidade_id,v_p.id,v_ap.atendimento_id,'administracao',jsonb_build_object('administracao_id',v_admin,'status',p_status,'dose',coalesce(p_dose,v_p.dose),'via',coalesce(p_via,v_p.via),'lote',case when p_status='administrado' then v_disp.lote else null end,'confirmacao_medicamento',case when v_manual_medicamento then 'manual_contingencia' else 'leitura' end),v_prof,auth.uid());
  return v_admin;
end;
$$;
