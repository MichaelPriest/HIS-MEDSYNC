-- Fecha o fluxo operacional de Laboratorio (LIS) e Imagem (RIS) no mesmo episodio.
-- Mantem os estados compartilhados de solicitacoes_exames compativeis com ambos os modulos.

alter table public.solicitacoes_exames
  drop constraint if exists solicitacoes_exames_status_check;
alter table public.solicitacoes_exames
  add constraint solicitacoes_exames_status_check
  check (status in ('rascunho','solicitado','agendado','coletado','processamento','em_execucao','liberado','cancelado'));

-- Uma solicitacao laboratorial mantem uma amostra ativa por vez; rejeicao libera recoleta.
create unique index if not exists ux_laboratorio_amostra_ativa_solicitacao
  on public.laboratorio_amostras(solicitacao_id)
  where status <> 'rejeitada';

-- Um analito possui um resultado corrente por amostra. Correcao antes da validacao atualiza o rascunho.
create unique index if not exists ux_laboratorio_resultado_amostra_analito
  on public.laboratorio_resultados(amostra_id, catalogo_analito_id)
  where amostra_id is not null and catalogo_analito_id is not null;

-- Evita duplo agendamento ativo e dupla execucao simultanea por solicitacao de imagem.
create unique index if not exists ux_imagem_agendamento_ativo_solicitacao
  on public.imagem_agendamentos(solicitacao_id)
  where status not in ('cancelado','faltou');
create unique index if not exists ux_imagem_execucao_ativa_solicitacao
  on public.imagem_execucoes(solicitacao_id)
  where status = 'em_execucao';

create or replace function public.preparar_amostra_laboratorio_operacional(
  p_solicitacao_id uuid,
  p_material text default null,
  p_recipiente text default null,
  p_prioridade text default null,
  p_coleta_prevista_em timestamptz default null
) returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog, extensions
as $$
declare
  v_sol public.solicitacoes_exames%rowtype;
  v_at public.atendimentos%rowtype;
  v_amostra public.laboratorio_amostras%rowtype;
  v_codigo text;
  v_accession text;
begin
  if auth.uid() is null then
    raise exception 'LAB_AUTENTICACAO_OBRIGATORIA' using errcode='42501';
  end if;

  select * into v_sol
  from public.solicitacoes_exames
  where id = p_solicitacao_id
  for update;
  if not found or v_sol.modalidade <> 'laboratorio' then
    raise exception 'LAB_SOLICITACAO_NAO_LOCALIZADA';
  end if;
  if not public.tem_permissao(v_sol.empresa_id, v_sol.unidade_id, 'laboratorio.coletar') then
    raise exception 'LAB_SEM_PERMISSAO_COLETA' using errcode='42501';
  end if;
  if v_sol.status in ('liberado','cancelado') then
    raise exception 'LAB_SOLICITACAO_ENCERRADA';
  end if;

  select * into v_amostra
  from public.laboratorio_amostras
  where solicitacao_id = v_sol.id and status <> 'rejeitada'
  order by created_at desc
  limit 1
  for update;
  if found then
    return v_amostra.id;
  end if;

  select * into v_at from public.atendimentos where id=v_sol.atendimento_id;
  if not found or v_at.paciente_id is null then
    raise exception 'LAB_ATENDIMENTO_NAO_LOCALIZADO';
  end if;

  v_codigo := 'LAB-' || upper(substr(replace(extensions.gen_random_uuid()::text,'-',''),1,12));
  v_accession := 'ACC-' || upper(substr(replace(extensions.gen_random_uuid()::text,'-',''),1,12));

  insert into public.laboratorio_amostras(
    empresa_id,unidade_id,solicitacao_id,atendimento_id,paciente_id,
    codigo_amostra,accession_number,etiqueta_codigo,material,recipiente,
    prioridade,coleta_prevista_em,status,cadeia_custodia,created_by,updated_by
  ) values (
    v_sol.empresa_id,v_sol.unidade_id,v_sol.id,v_sol.atendimento_id,v_at.paciente_id,
    v_codigo,v_accession,v_codigo,nullif(btrim(p_material),''),nullif(btrim(p_recipiente),''),
    coalesce(nullif(btrim(p_prioridade),''),v_sol.prioridade,'rotina'),p_coleta_prevista_em,'aguardando_coleta',
    jsonb_build_array(jsonb_build_object('evento','amostra_criada','em',now(),'usuario_id',auth.uid())),
    auth.uid(),auth.uid()
  ) returning * into v_amostra;

  return v_amostra.id;
end;
$$;

create or replace function public.atualizar_status_amostra_laboratorio_operacional(
  p_amostra_id uuid,
  p_acao text,
  p_temperatura_recebimento numeric default null,
  p_motivo text default null
) returns text
language plpgsql
security definer
set search_path = public, pg_catalog, extensions
as $$
declare
  v_a public.laboratorio_amostras%rowtype;
  v_prof uuid;
  v_acao text := lower(coalesce(btrim(p_acao),''));
  v_evento jsonb;
begin
  if auth.uid() is null then
    raise exception 'LAB_AUTENTICACAO_OBRIGATORIA' using errcode='42501';
  end if;

  select * into v_a from public.laboratorio_amostras where id=p_amostra_id for update;
  if not found then raise exception 'LAB_AMOSTRA_NAO_LOCALIZADA'; end if;
  if not public.tem_permissao(v_a.empresa_id,v_a.unidade_id,'laboratorio.coletar') then
    raise exception 'LAB_SEM_PERMISSAO_COLETA' using errcode='42501';
  end if;

  v_prof := public.profissional_logado(v_a.empresa_id);
  if v_prof is null then raise exception 'LAB_USUARIO_SEM_PROFISSIONAL'; end if;

  if v_acao='coletar' then
    if v_a.status='coletada' then return v_a.status; end if;
    if v_a.status<>'aguardando_coleta' then raise exception 'LAB_TRANSICAO_COLETA_INVALIDA'; end if;
    v_evento:=jsonb_build_object('evento','coleta','em',now(),'profissional_id',v_prof,'usuario_id',auth.uid());
    update public.laboratorio_amostras set
      status='coletada',coletada_em=now(),coletada_por=v_prof,
      cadeia_custodia=coalesce(cadeia_custodia,'[]'::jsonb)||jsonb_build_array(v_evento),
      updated_at=now(),updated_by=auth.uid()
    where id=v_a.id;
    update public.solicitacoes_exames set status='coletado',updated_at=now(),updated_by=auth.uid()
    where id=v_a.solicitacao_id and status not in ('liberado','cancelado');
    return 'coletada';
  elsif v_acao='receber' then
    if v_a.status='recebida' then return v_a.status; end if;
    if v_a.status<>'coletada' then raise exception 'LAB_TRANSICAO_RECEBIMENTO_INVALIDA'; end if;
    v_evento:=jsonb_build_object('evento','recebimento','em',now(),'profissional_id',v_prof,'usuario_id',auth.uid(),'temperatura',p_temperatura_recebimento);
    update public.laboratorio_amostras set
      status='recebida',recebida_em=now(),recebida_por=v_prof,temperatura_recebimento=p_temperatura_recebimento,
      cadeia_custodia=coalesce(cadeia_custodia,'[]'::jsonb)||jsonb_build_array(v_evento),
      updated_at=now(),updated_by=auth.uid()
    where id=v_a.id;
    update public.solicitacoes_exames set status='processamento',updated_at=now(),updated_by=auth.uid()
    where id=v_a.solicitacao_id and status not in ('liberado','cancelado');
    return 'recebida';
  elsif v_acao='rejeitar' then
    if v_a.status='rejeitada' then return v_a.status; end if;
    if v_a.status not in ('aguardando_coleta','coletada') then raise exception 'LAB_TRANSICAO_REJEICAO_INVALIDA'; end if;
    if coalesce(btrim(p_motivo),'')='' then raise exception 'LAB_MOTIVO_REJEICAO_OBRIGATORIO'; end if;
    v_evento:=jsonb_build_object('evento','rejeicao','em',now(),'profissional_id',v_prof,'usuario_id',auth.uid(),'motivo',btrim(p_motivo));
    update public.laboratorio_amostras set
      status='rejeitada',rejeitada_em=now(),rejeitada_por=v_prof,rejeitada_motivo=btrim(p_motivo),
      cadeia_custodia=coalesce(cadeia_custodia,'[]'::jsonb)||jsonb_build_array(v_evento),
      updated_at=now(),updated_by=auth.uid()
    where id=v_a.id;
    update public.solicitacoes_exames set status='solicitado',updated_at=now(),updated_by=auth.uid()
    where id=v_a.solicitacao_id and status not in ('liberado','cancelado');
    return 'rejeitada';
  end if;

  raise exception 'LAB_ACAO_AMOSTRA_INVALIDA';
end;
$$;

create or replace function public.registrar_resultado_laboratorio_operacional(
  p_amostra_id uuid,
  p_catalogo_analito_id uuid,
  p_laboratorio_equipamento_id uuid default null,
  p_resultado text default null,
  p_valor_numerico numeric default null
) returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog, extensions
as $$
declare
  v_a public.laboratorio_amostras%rowtype;
  v_an public.laboratorio_catalogo_analitos%rowtype;
  v_eq record;
  v_result public.laboratorio_resultados%rowtype;
  v_eng uuid;
  v_flag text;
  v_criticidade text;
  v_critico boolean := false;
begin
  if auth.uid() is null then raise exception 'LAB_AUTENTICACAO_OBRIGATORIA' using errcode='42501'; end if;
  select * into v_a from public.laboratorio_amostras where id=p_amostra_id for update;
  if not found or v_a.status<>'recebida' then raise exception 'LAB_AMOSTRA_NAO_RECEBIDA'; end if;
  if not public.tem_permissao(v_a.empresa_id,v_a.unidade_id,'laboratorio.resultar') then raise exception 'LAB_SEM_PERMISSAO_RESULTAR' using errcode='42501'; end if;
  if coalesce(btrim(p_resultado),'')='' and p_valor_numerico is null then raise exception 'LAB_RESULTADO_OBRIGATORIO'; end if;

  select * into v_an from public.laboratorio_catalogo_analitos where id=p_catalogo_analito_id and empresa_id=v_a.empresa_id and ativo;
  if not found then raise exception 'LAB_ANALITO_NAO_LOCALIZADO'; end if;

  if p_laboratorio_equipamento_id is not null then
    select le.id,le.engenharia_equipamento_id,le.ativo,ee.status,ee.patrimonio,ee.nome
      into v_eq
    from public.laboratorio_equipamentos le
    left join public.engenharia_equipamentos ee on ee.id=le.engenharia_equipamento_id
    where le.id=p_laboratorio_equipamento_id and le.empresa_id=v_a.empresa_id and le.unidade_id=v_a.unidade_id;
    if not found or not v_eq.ativo then raise exception 'LAB_ANALISADOR_INATIVO'; end if;
    if v_eq.engenharia_equipamento_id is not null and coalesce(v_eq.status,'') not in ('operacional','reserva') then
      raise exception 'LAB_ANALISADOR_INDISPONIVEL';
    end if;
    v_eng:=v_eq.engenharia_equipamento_id;
  end if;

  if p_valor_numerico is not null then
    if v_an.critico_min is not null and p_valor_numerico <= v_an.critico_min then v_flag:='LL';v_criticidade:='critico_baixo';v_critico:=true;
    elsif v_an.critico_max is not null and p_valor_numerico >= v_an.critico_max then v_flag:='HH';v_criticidade:='critico_alto';v_critico:=true;
    elsif v_an.referencia_min is not null and p_valor_numerico < v_an.referencia_min then v_flag:='L';
    elsif v_an.referencia_max is not null and p_valor_numerico > v_an.referencia_max then v_flag:='H';
    end if;
  end if;

  select * into v_result from public.laboratorio_resultados
  where amostra_id=v_a.id and catalogo_analito_id=v_an.id
  for update;

  if found then
    if v_result.liberado then raise exception 'LAB_RESULTADO_LIBERADO_IMUTAVEL'; end if;
    update public.laboratorio_resultados set
      analito=v_an.analito,resultado=coalesce(nullif(btrim(p_resultado),''),p_valor_numerico::text),valor_numerico=p_valor_numerico,
      unidade_medida=v_an.unidade_medida,referencia_min=v_an.referencia_min,referencia_max=v_an.referencia_max,referencia_texto=v_an.referencia_texto,
      flag=v_flag,criticidade=v_criticidade,valor_critico=v_critico,metodo=v_an.metodo,engenharia_equipamento_id=v_eng,
      updated_at=now(),updated_by=auth.uid()
    where id=v_result.id returning * into v_result;
  else
    insert into public.laboratorio_resultados(
      empresa_id,unidade_id,solicitacao_id,amostra_id,atendimento_id,catalogo_analito_id,analito,resultado,valor_numerico,
      unidade_medida,referencia_min,referencia_max,referencia_texto,flag,criticidade,valor_critico,metodo,engenharia_equipamento_id,created_by,updated_by
    ) values (
      v_a.empresa_id,v_a.unidade_id,v_a.solicitacao_id,v_a.id,v_a.atendimento_id,v_an.id,v_an.analito,
      coalesce(nullif(btrim(p_resultado),''),p_valor_numerico::text),p_valor_numerico,v_an.unidade_medida,v_an.referencia_min,v_an.referencia_max,v_an.referencia_texto,
      v_flag,v_criticidade,v_critico,v_an.metodo,v_eng,auth.uid(),auth.uid()
    ) returning * into v_result;
  end if;

  update public.solicitacoes_exames set status='processamento',updated_at=now(),updated_by=auth.uid()
  where id=v_a.solicitacao_id and status not in ('liberado','cancelado');
  return v_result.id;
end;
$$;

create or replace function public.agendar_exame_imagem_operacional(
  p_solicitacao_id uuid,
  p_agendado_em timestamptz,
  p_duracao_minutos integer default 30,
  p_protocolo_id uuid default null,
  p_sala text default null,
  p_engenharia_equipamento_id uuid default null,
  p_observacoes text default null
) returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog, extensions
as $$
declare
  v_sol public.solicitacoes_exames%rowtype;
  v_at public.atendimentos%rowtype;
  v_ag public.imagem_agendamentos%rowtype;
  v_eq public.engenharia_equipamentos%rowtype;
begin
  if auth.uid() is null then raise exception 'IMAGEM_AUTENTICACAO_OBRIGATORIA' using errcode='42501'; end if;
  if p_agendado_em is null then raise exception 'IMAGEM_DATA_AGENDAMENTO_OBRIGATORIA'; end if;

  select * into v_sol from public.solicitacoes_exames where id=p_solicitacao_id for update;
  if not found or v_sol.modalidade<>'imagem' then raise exception 'IMAGEM_SOLICITACAO_NAO_LOCALIZADA'; end if;
  if not public.tem_permissao(v_sol.empresa_id,v_sol.unidade_id,'imagem.agendar') then raise exception 'IMAGEM_SEM_PERMISSAO_AGENDAR' using errcode='42501'; end if;
  if v_sol.status in ('liberado','cancelado') then raise exception 'IMAGEM_SOLICITACAO_ENCERRADA'; end if;

  select * into v_ag from public.imagem_agendamentos
  where solicitacao_id=v_sol.id and status not in ('cancelado','faltou')
  order by created_at desc limit 1 for update;
  if found then return v_ag.id; end if;

  if p_engenharia_equipamento_id is null then raise exception 'IMAGEM_EQUIPAMENTO_OBRIGATORIO'; end if;
  select * into v_eq from public.engenharia_equipamentos
  where id=p_engenharia_equipamento_id and empresa_id=v_sol.empresa_id and unidade_id=v_sol.unidade_id;
  if not found or v_eq.status not in ('operacional','reserva') then raise exception 'IMAGEM_EQUIPAMENTO_INDISPONIVEL'; end if;
  if p_protocolo_id is not null and not exists(
    select 1 from public.imagem_protocolos p where p.id=p_protocolo_id and p.empresa_id=v_sol.empresa_id and (p.unidade_id is null or p.unidade_id=v_sol.unidade_id) and p.ativo
  ) then raise exception 'IMAGEM_PROTOCOLO_INVALIDO'; end if;

  select * into v_at from public.atendimentos where id=v_sol.atendimento_id;
  if not found or v_at.paciente_id is null then raise exception 'IMAGEM_ATENDIMENTO_NAO_LOCALIZADO'; end if;

  insert into public.imagem_agendamentos(
    empresa_id,unidade_id,solicitacao_id,atendimento_id,paciente_id,protocolo_id,agendado_em,duracao_minutos,sala,equipamento,
    engenharia_equipamento_id,status,observacoes,created_by,updated_by
  ) values (
    v_sol.empresa_id,v_sol.unidade_id,v_sol.id,v_sol.atendimento_id,v_at.paciente_id,p_protocolo_id,p_agendado_em,greatest(coalesce(p_duracao_minutos,30),5),
    nullif(btrim(p_sala),''),concat_ws(' · ',v_eq.patrimonio,v_eq.nome),v_eq.id,'agendado',nullif(btrim(p_observacoes),''),auth.uid(),auth.uid()
  ) returning * into v_ag;

  update public.solicitacoes_exames set status='agendado',updated_at=now(),updated_by=auth.uid() where id=v_sol.id;
  return v_ag.id;
end;
$$;

create or replace function public.atualizar_agendamento_imagem_operacional(
  p_agendamento_id uuid,
  p_status text
) returns text
language plpgsql
security definer
set search_path = public, pg_catalog, extensions
as $$
declare
  v_ag public.imagem_agendamentos%rowtype;
  v_novo text:=lower(coalesce(btrim(p_status),''));
begin
  if auth.uid() is null then raise exception 'IMAGEM_AUTENTICACAO_OBRIGATORIA' using errcode='42501'; end if;
  select * into v_ag from public.imagem_agendamentos where id=p_agendamento_id for update;
  if not found then raise exception 'IMAGEM_AGENDAMENTO_NAO_LOCALIZADO'; end if;
  if not public.tem_permissao(v_ag.empresa_id,v_ag.unidade_id,'imagem.agendar') then raise exception 'IMAGEM_SEM_PERMISSAO_AGENDAR' using errcode='42501'; end if;
  if v_novo not in ('confirmado','chegou','faltou','cancelado') then raise exception 'IMAGEM_STATUS_AGENDA_INVALIDO'; end if;
  if v_ag.status=v_novo then return v_novo; end if;
  if v_novo='confirmado' and v_ag.status<>'agendado' then raise exception 'IMAGEM_TRANSICAO_AGENDA_INVALIDA'; end if;
  if v_novo='chegou' and v_ag.status not in ('agendado','confirmado') then raise exception 'IMAGEM_TRANSICAO_AGENDA_INVALIDA'; end if;
  if v_novo in ('faltou','cancelado') and v_ag.status not in ('agendado','confirmado','chegou') then raise exception 'IMAGEM_TRANSICAO_AGENDA_INVALIDA'; end if;

  update public.imagem_agendamentos set status=v_novo,updated_at=now(),updated_by=auth.uid() where id=v_ag.id;
  if v_novo in ('faltou','cancelado') then
    update public.solicitacoes_exames set status='solicitado',updated_at=now(),updated_by=auth.uid()
    where id=v_ag.solicitacao_id and status not in ('liberado','cancelado','em_execucao');
  else
    update public.solicitacoes_exames set status='agendado',updated_at=now(),updated_by=auth.uid()
    where id=v_ag.solicitacao_id and status not in ('liberado','cancelado','em_execucao');
  end if;
  return v_novo;
end;
$$;

create or replace function public.iniciar_execucao_imagem_operacional(
  p_solicitacao_id uuid,
  p_agendamento_id uuid default null,
  p_protocolo_id uuid default null,
  p_sala text default null,
  p_engenharia_equipamento_id uuid default null,
  p_accession_number text default null
) returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog, extensions
as $$
declare
  v_sol public.solicitacoes_exames%rowtype;
  v_at public.atendimentos%rowtype;
  v_ag public.imagem_agendamentos%rowtype;
  v_exec public.imagem_execucoes%rowtype;
  v_eq public.engenharia_equipamentos%rowtype;
  v_eq_id uuid:=p_engenharia_equipamento_id;
  v_prot uuid:=p_protocolo_id;
  v_sala text:=nullif(btrim(p_sala),'');
  v_accession text;
begin
  if auth.uid() is null then raise exception 'IMAGEM_AUTENTICACAO_OBRIGATORIA' using errcode='42501'; end if;
  select * into v_sol from public.solicitacoes_exames where id=p_solicitacao_id for update;
  if not found or v_sol.modalidade<>'imagem' then raise exception 'IMAGEM_SOLICITACAO_NAO_LOCALIZADA'; end if;
  if not public.tem_permissao(v_sol.empresa_id,v_sol.unidade_id,'imagem.executar') then raise exception 'IMAGEM_SEM_PERMISSAO_EXECUTAR' using errcode='42501'; end if;
  if v_sol.status in ('liberado','cancelado') then raise exception 'IMAGEM_SOLICITACAO_ENCERRADA'; end if;

  select * into v_exec from public.imagem_execucoes where solicitacao_id=v_sol.id order by created_at desc limit 1 for update;
  if found then
    if v_exec.status='em_execucao' then return v_exec.id; end if;
    if v_exec.status='concluido' then raise exception 'IMAGEM_EXECUCAO_JA_CONCLUIDA'; end if;
    raise exception 'IMAGEM_EXECUCAO_EXISTENTE';
  end if;

  if p_agendamento_id is not null then
    select * into v_ag from public.imagem_agendamentos where id=p_agendamento_id and solicitacao_id=v_sol.id for update;
    if not found or v_ag.status in ('cancelado','faltou','concluido') then raise exception 'IMAGEM_AGENDAMENTO_INVALIDO'; end if;
    v_eq_id:=coalesce(v_eq_id,v_ag.engenharia_equipamento_id);
    v_prot:=coalesce(v_prot,v_ag.protocolo_id);
    v_sala:=coalesce(v_sala,v_ag.sala);
  end if;

  if v_eq_id is null then raise exception 'IMAGEM_EQUIPAMENTO_OBRIGATORIO'; end if;
  select * into v_eq from public.engenharia_equipamentos where id=v_eq_id and empresa_id=v_sol.empresa_id and unidade_id=v_sol.unidade_id;
  if not found or v_eq.status not in ('operacional','reserva') then raise exception 'IMAGEM_EQUIPAMENTO_INDISPONIVEL'; end if;
  if v_prot is not null and not exists(select 1 from public.imagem_protocolos p where p.id=v_prot and p.empresa_id=v_sol.empresa_id and (p.unidade_id is null or p.unidade_id=v_sol.unidade_id) and p.ativo) then raise exception 'IMAGEM_PROTOCOLO_INVALIDO'; end if;

  select * into v_at from public.atendimentos where id=v_sol.atendimento_id;
  if not found or v_at.paciente_id is null then raise exception 'IMAGEM_ATENDIMENTO_NAO_LOCALIZADO'; end if;
  v_accession:=coalesce(nullif(btrim(p_accession_number),''),'IMG-'||upper(substr(replace(extensions.gen_random_uuid()::text,'-',''),1,12)));

  insert into public.imagem_execucoes(
    empresa_id,unidade_id,solicitacao_id,atendimento_id,paciente_id,sala,equipamento,accession_number,iniciado_em,status,
    protocolo_id,agendamento_id,engenharia_equipamento_id,created_by,updated_by
  ) values (
    v_sol.empresa_id,v_sol.unidade_id,v_sol.id,v_sol.atendimento_id,v_at.paciente_id,v_sala,concat_ws(' · ',v_eq.patrimonio,v_eq.nome),v_accession,now(),'em_execucao',
    v_prot,p_agendamento_id,v_eq.id,auth.uid(),auth.uid()
  ) returning * into v_exec;

  if p_agendamento_id is not null then update public.imagem_agendamentos set status='em_execucao',updated_at=now(),updated_by=auth.uid() where id=p_agendamento_id; end if;
  update public.solicitacoes_exames set status='em_execucao',updated_at=now(),updated_by=auth.uid() where id=v_sol.id;
  return v_exec.id;
end;
$$;

create or replace function public.concluir_execucao_imagem_operacional(
  p_execucao_id uuid,
  p_study_instance_uid text default null,
  p_series_instance_uid text default null,
  p_pacs_url text default null,
  p_intercorrencias text default null
) returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog, extensions
as $$
declare
  v_exec public.imagem_execucoes%rowtype;
  v_prof uuid;
begin
  if auth.uid() is null then raise exception 'IMAGEM_AUTENTICACAO_OBRIGATORIA' using errcode='42501'; end if;
  select * into v_exec from public.imagem_execucoes where id=p_execucao_id for update;
  if not found then raise exception 'IMAGEM_EXECUCAO_NAO_LOCALIZADA'; end if;
  if not public.tem_permissao(v_exec.empresa_id,v_exec.unidade_id,'imagem.executar') then raise exception 'IMAGEM_SEM_PERMISSAO_EXECUTAR' using errcode='42501'; end if;
  if v_exec.status='concluido' then return v_exec.id; end if;
  if v_exec.status<>'em_execucao' then raise exception 'IMAGEM_TRANSICAO_EXECUCAO_INVALIDA'; end if;
  v_prof:=public.profissional_logado(v_exec.empresa_id);
  if v_prof is null then raise exception 'IMAGEM_USUARIO_SEM_PROFISSIONAL'; end if;

  update public.imagem_execucoes set
    status='concluido',finalizado_em=now(),executado_por=v_prof,
    study_instance_uid=nullif(btrim(p_study_instance_uid),''),series_instance_uid=nullif(btrim(p_series_instance_uid),''),
    pacs_url=nullif(btrim(p_pacs_url),''),intercorrencias=nullif(btrim(p_intercorrencias),''),updated_at=now(),updated_by=auth.uid()
  where id=v_exec.id;
  if v_exec.agendamento_id is not null then update public.imagem_agendamentos set status='concluido',updated_at=now(),updated_by=auth.uid() where id=v_exec.agendamento_id; end if;
  update public.solicitacoes_exames set status='em_execucao',updated_at=now(),updated_by=auth.uid()
  where id=v_exec.solicitacao_id and status not in ('liberado','cancelado');
  return v_exec.id;
end;
$$;

revoke all on function public.preparar_amostra_laboratorio_operacional(uuid,text,text,text,timestamptz) from public, anon;
revoke all on function public.atualizar_status_amostra_laboratorio_operacional(uuid,text,numeric,text) from public, anon;
revoke all on function public.registrar_resultado_laboratorio_operacional(uuid,uuid,uuid,text,numeric) from public, anon;
revoke all on function public.agendar_exame_imagem_operacional(uuid,timestamptz,integer,uuid,text,uuid,text) from public, anon;
revoke all on function public.atualizar_agendamento_imagem_operacional(uuid,text) from public, anon;
revoke all on function public.iniciar_execucao_imagem_operacional(uuid,uuid,uuid,text,uuid,text) from public, anon;
revoke all on function public.concluir_execucao_imagem_operacional(uuid,text,text,text,text) from public, anon;

grant execute on function public.preparar_amostra_laboratorio_operacional(uuid,text,text,text,timestamptz) to authenticated;
grant execute on function public.atualizar_status_amostra_laboratorio_operacional(uuid,text,numeric,text) to authenticated;
grant execute on function public.registrar_resultado_laboratorio_operacional(uuid,uuid,uuid,text,numeric) to authenticated;
grant execute on function public.agendar_exame_imagem_operacional(uuid,timestamptz,integer,uuid,text,uuid,text) to authenticated;
grant execute on function public.atualizar_agendamento_imagem_operacional(uuid,text) to authenticated;
grant execute on function public.iniciar_execucao_imagem_operacional(uuid,uuid,uuid,text,uuid,text) to authenticated;
grant execute on function public.concluir_execucao_imagem_operacional(uuid,text,text,text,text) to authenticated;