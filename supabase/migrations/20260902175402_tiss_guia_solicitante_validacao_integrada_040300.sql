alter table public.tiss_guias add column if not exists solicitante_codigo_prestador_snapshot text;
alter table public.tiss_guias add column if not exists solicitante_cnpj_snapshot text;
alter table public.tiss_guias add column if not exists solicitante_nome_contratado_snapshot text;
alter table public.tiss_guias add column if not exists solicitante_nome_profissional_snapshot text;
alter table public.tiss_guias add column if not exists solicitante_codigo_conselho_ans_snapshot text;
alter table public.tiss_guias add column if not exists solicitante_numero_conselho_snapshot text;
alter table public.tiss_guias add column if not exists solicitante_uf_conselho_snapshot text;
alter table public.tiss_guias add column if not exists solicitante_cbo_snapshot text;

alter table public.tiss_guias drop constraint if exists tiss_guias_solicitante_conselho_ans_040300_check;
alter table public.tiss_guias add constraint tiss_guias_solicitante_conselho_ans_040300_check
check (solicitante_codigo_conselho_ans_snapshot is null or solicitante_codigo_conselho_ans_snapshot = any (array['01','02','03','04','05','06','07','08','09','10','11','12','13','14','15']));

create or replace function public.validar_guia_tiss_040300_completa(p_guia_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_base jsonb;
  v_com jsonb;
  v_guia public.tiss_guias%rowtype;
  v_user uuid := auth.uid();
  v_erros integer := 0;
  v_alertas integer := 0;
  v_status text;
begin
  v_base := public.validar_guia_tiss_internal(p_guia_id);
  select * into v_guia from public.tiss_guias where id=p_guia_id;
  if not found then raise exception 'TISS_GUIA_NAO_LOCALIZADA' using errcode='P0002'; end if;

  if v_guia.status not in ('rascunho','pronta') then
    return v_base;
  end if;

  v_com := public.validar_guia_tiss_comunicacao_040300_internal(p_guia_id);
  select * into v_guia from public.tiss_guias where id=p_guia_id;

  delete from public.tiss_guia_criticas
   where guia_id=p_guia_id
     and not resolvida
     and codigo like 'XSD040300-SADT-SOL-%';

  if v_guia.tipo_guia='sp_sadt' then
    if nullif(btrim(coalesce(v_guia.solicitante_codigo_prestador_snapshot,'')),'') is null
       and length(regexp_replace(coalesce(v_guia.solicitante_cnpj_snapshot,''),'\D','','g'))<>14 then
      insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by)
      values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'XSD040300-SADT-SOL-PREST','erro','solicitante_codigo_prestador_snapshot','Informe o código do prestador solicitante na operadora ou o CNPJ do contratado solicitante.',v_user);
    end if;
    if nullif(btrim(coalesce(v_guia.solicitante_nome_contratado_snapshot,'')),'') is null then
      insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by)
      values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'XSD040300-SADT-SOL-NOME','erro','solicitante_nome_contratado_snapshot','Informe o nome do contratado solicitante da guia SP/SADT.',v_user);
    end if;
    if nullif(btrim(coalesce(v_guia.solicitante_codigo_conselho_ans_snapshot,'')),'') is null
       or nullif(btrim(coalesce(v_guia.solicitante_numero_conselho_snapshot,'')),'') is null
       or nullif(btrim(coalesce(v_guia.solicitante_uf_conselho_snapshot,'')),'') is null
       or nullif(btrim(coalesce(v_guia.solicitante_cbo_snapshot,'')),'') is null
       or v_guia.solicitante_cbo_snapshot !~ '^[0-9]{6}$' then
      insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by)
      values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'XSD040300-SADT-SOL-PROF','erro','solicitante_profissional','Conselho ANS, número, UF e CBO do profissional solicitante devem estar completos.',v_user);
    end if;
  end if;

  select count(*) filter (where severidade='erro')::integer,
         count(*) filter (where severidade='alerta')::integer
    into v_erros,v_alertas
    from public.tiss_guia_criticas
   where guia_id=p_guia_id and not resolvida;

  v_status := case when coalesce(v_erros,0)=0 then 'pronta' else 'rascunho' end;
  update public.tiss_guias
     set status=v_status,validado_em=now(),validado_por=v_user,updated_at=now(),updated_by=v_user
   where id=p_guia_id and status in ('rascunho','pronta');

  return jsonb_build_object('guia_id',p_guia_id,'status',v_status,'preservada',false,'erros',coalesce(v_erros,0),'alertas',coalesce(v_alertas,0),'comunicacao',v_com);
end
$function$;
revoke all on function public.validar_guia_tiss_040300_completa(uuid) from public,anon;
grant execute on function public.validar_guia_tiss_040300_completa(uuid) to authenticated;

create or replace function public.validar_guia_tiss(p_guia_id uuid)
returns jsonb
language sql
security definer
set search_path to 'public','pg_catalog'
as $function$
  select public.validar_guia_tiss_040300_completa(p_guia_id)
$function$;
revoke all on function public.validar_guia_tiss(uuid) from public,anon;
grant execute on function public.validar_guia_tiss(uuid) to authenticated;

create or replace function public.salvar_complemento_comunicacao_tiss_040300_operacional(
  p_guia_id uuid,
  p_codigo_conselho_ans text default null,
  p_indicador_acidente text default null,
  p_regime_atendimento text default null,
  p_carater_atendimento text default null,
  p_numero_solicitacao_internacao text default null,
  p_data_autorizacao date default null,
  p_tipo_faturamento text default null,
  p_data_inicio_faturamento date default null,
  p_hora_inicio_faturamento time default null,
  p_data_fim_faturamento date default null,
  p_hora_fim_faturamento time default null,
  p_tipo_internacao text default null,
  p_regime_internacao text default null,
  p_motivo_encerramento text default null,
  p_solicitante_codigo_prestador text default null,
  p_solicitante_cnpj text default null,
  p_solicitante_nome_contratado text default null,
  p_solicitante_nome_profissional text default null,
  p_solicitante_codigo_conselho_ans text default null,
  p_solicitante_numero_conselho text default null,
  p_solicitante_uf_conselho text default null,
  p_solicitante_cbo text default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user uuid := auth.uid();
  v_guia public.tiss_guias%rowtype;
begin
  if v_user is null then raise exception 'TISS_GUIA_NAO_AUTENTICADO' using errcode='42501'; end if;
  select * into v_guia from public.tiss_guias where id=p_guia_id for update;
  if not found then raise exception 'TISS_GUIA_NAO_LOCALIZADA' using errcode='P0002'; end if;
  if not public.tem_unidade(v_guia.empresa_id,v_guia.unidade_id) or not public.tem_permissao(v_guia.empresa_id,v_guia.unidade_id,'tiss.gerar') then raise exception 'TISS_GUIA_SEM_PERMISSAO' using errcode='42501'; end if;
  if v_guia.status not in ('rascunho','pronta') then raise exception 'TISS_GUIA_NAO_EDITAVEL'; end if;

  update public.tiss_guias set
    codigo_conselho_ans_snapshot=nullif(btrim(coalesce(p_codigo_conselho_ans,'')),''),
    indicador_acidente=nullif(btrim(coalesce(p_indicador_acidente,'')),''),
    regime_atendimento_tiss=nullif(btrim(coalesce(p_regime_atendimento,'')),''),
    carater_atendimento=nullif(btrim(coalesce(p_carater_atendimento,'')),''),
    numero_solicitacao_internacao=nullif(btrim(coalesce(p_numero_solicitacao_internacao,'')),''),
    data_autorizacao=p_data_autorizacao,
    tipo_faturamento_tiss=nullif(btrim(coalesce(p_tipo_faturamento,'')),''),
    data_inicio_faturamento=p_data_inicio_faturamento,
    hora_inicio_faturamento=p_hora_inicio_faturamento,
    data_fim_faturamento=p_data_fim_faturamento,
    hora_fim_faturamento=p_hora_fim_faturamento,
    tipo_internacao_tiss=nullif(btrim(coalesce(p_tipo_internacao,'')),''),
    regime_internacao_tiss=nullif(btrim(coalesce(p_regime_internacao,'')),''),
    motivo_encerramento_tiss=nullif(btrim(coalesce(p_motivo_encerramento,'')),''),
    solicitante_codigo_prestador_snapshot=nullif(btrim(coalesce(p_solicitante_codigo_prestador,'')),''),
    solicitante_cnpj_snapshot=nullif(regexp_replace(coalesce(p_solicitante_cnpj,''),'\D','','g'),''),
    solicitante_nome_contratado_snapshot=nullif(btrim(coalesce(p_solicitante_nome_contratado,'')),''),
    solicitante_nome_profissional_snapshot=nullif(btrim(coalesce(p_solicitante_nome_profissional,'')),''),
    solicitante_codigo_conselho_ans_snapshot=nullif(btrim(coalesce(p_solicitante_codigo_conselho_ans,'')),''),
    solicitante_numero_conselho_snapshot=nullif(btrim(coalesce(p_solicitante_numero_conselho,'')),''),
    solicitante_uf_conselho_snapshot=nullif(upper(btrim(coalesce(p_solicitante_uf_conselho,''))),''),
    solicitante_cbo_snapshot=nullif(regexp_replace(coalesce(p_solicitante_cbo,''),'\D','','g'),''),
    updated_at=now(),updated_by=v_user
  where id=v_guia.id;

  return public.validar_guia_tiss_040300_completa(v_guia.id);
end
$function$;
revoke all on function public.salvar_complemento_comunicacao_tiss_040300_operacional(uuid,text,text,text,text,text,date,text,date,time,date,time,text,text,text,text,text,text,text,text,text,text,text) from public,anon;
grant execute on function public.salvar_complemento_comunicacao_tiss_040300_operacional(uuid,text,text,text,text,text,date,text,date,time,date,time,text,text,text,text,text,text,text,text,text,text,text) to authenticated;

create or replace function public.validar_vinculo_guia_lote_tiss_internal()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_lote public.tiss_lotes%rowtype;
  v_guia public.tiss_guias%rowtype;
  v_tipo_existente text;
  v_quantidade integer;
  v_validacao jsonb;
begin
  select * into v_lote from public.tiss_lotes where id=new.lote_id;
  if not found then raise exception 'TISS_LOTE_NAO_LOCALIZADO' using errcode='P0002'; end if;
  select * into v_guia from public.tiss_guias where id=new.guia_id;
  if not found then raise exception 'TISS_GUIA_NAO_LOCALIZADA' using errcode='P0002'; end if;

  if v_guia.empresa_id is distinct from v_lote.empresa_id or v_guia.unidade_id is distinct from v_lote.unidade_id or v_guia.convenio_id is distinct from v_lote.convenio_id or v_guia.versao_id is distinct from v_lote.versao_id then raise exception 'TISS_LOTE_GUIA_ESCOPO_DIVERGENTE'; end if;

  v_validacao := public.validar_guia_tiss_040300_completa(v_guia.id);
  if coalesce((v_validacao->>'erros')::integer,0)>0 or coalesce(v_validacao->>'status','rascunho')<>'pronta' then raise exception 'TISS_LOTE_GUIA_XSD_INCOMPLETA'; end if;

  select g.tipo_guia into v_tipo_existente from public.tiss_lote_guias lg join public.tiss_guias g on g.id=lg.guia_id where lg.lote_id=new.lote_id limit 1;
  if v_tipo_existente is not null and v_tipo_existente<>v_guia.tipo_guia then raise exception 'TISS_LOTE_TIPO_GUIA_DIVERGENTE'; end if;
  select count(*)::integer into v_quantidade from public.tiss_lote_guias where lote_id=new.lote_id;
  if v_quantidade>=100 then raise exception 'TISS_LOTE_LIMITE_XSD_EXCEDIDO'; end if;
  return new;
end
$function$;
revoke all on function public.validar_vinculo_guia_lote_tiss_internal() from public,anon,authenticated;
