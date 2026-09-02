alter table public.tiss_guias add column if not exists codigo_conselho_ans_snapshot text;
alter table public.tiss_guias add column if not exists indicador_acidente text;
alter table public.tiss_guias add column if not exists regime_atendimento_tiss text;
alter table public.tiss_guias add column if not exists tipo_faturamento_tiss text;
alter table public.tiss_guias add column if not exists tipo_internacao_tiss text;
alter table public.tiss_guias add column if not exists regime_internacao_tiss text;
alter table public.tiss_guias add column if not exists motivo_encerramento_tiss text;
alter table public.tiss_guias add column if not exists data_autorizacao date;
alter table public.tiss_guias add column if not exists data_inicio_faturamento date;
alter table public.tiss_guias add column if not exists hora_inicio_faturamento time without time zone;
alter table public.tiss_guias add column if not exists data_fim_faturamento date;
alter table public.tiss_guias add column if not exists hora_fim_faturamento time without time zone;

alter table public.tiss_guias drop constraint if exists tiss_guias_codigo_conselho_ans_040300_check;
alter table public.tiss_guias add constraint tiss_guias_codigo_conselho_ans_040300_check check (codigo_conselho_ans_snapshot is null or codigo_conselho_ans_snapshot = any (array['01','02','03','04','05','06','07','08','09','10','11','12','13','14','15']));
alter table public.tiss_guias drop constraint if exists tiss_guias_indicador_acidente_040300_check;
alter table public.tiss_guias add constraint tiss_guias_indicador_acidente_040300_check check (indicador_acidente is null or indicador_acidente = any (array['0','1','2','9']));
alter table public.tiss_guias drop constraint if exists tiss_guias_regime_atendimento_040300_check;
alter table public.tiss_guias add constraint tiss_guias_regime_atendimento_040300_check check (regime_atendimento_tiss is null or regime_atendimento_tiss = any (array['01','02','03','04','05']));
alter table public.tiss_guias drop constraint if exists tiss_guias_carater_atendimento_040300_check;
alter table public.tiss_guias add constraint tiss_guias_carater_atendimento_040300_check check (carater_atendimento is null or carater_atendimento = any (array['1','2']));
alter table public.tiss_guias drop constraint if exists tiss_guias_tipo_faturamento_040300_check;
alter table public.tiss_guias add constraint tiss_guias_tipo_faturamento_040300_check check (tipo_faturamento_tiss is null or tipo_faturamento_tiss = any (array['1','2','3','4']));
alter table public.tiss_guias drop constraint if exists tiss_guias_tipo_internacao_040300_check;
alter table public.tiss_guias add constraint tiss_guias_tipo_internacao_040300_check check (tipo_internacao_tiss is null or tipo_internacao_tiss = any (array['1','2','3','4','5']));
alter table public.tiss_guias drop constraint if exists tiss_guias_regime_internacao_040300_check;
alter table public.tiss_guias add constraint tiss_guias_regime_internacao_040300_check check (regime_internacao_tiss is null or regime_internacao_tiss = any (array['1','2','3']));

create or replace function public.codigo_conselho_ans_tiss(p_conselho text)
returns text language sql immutable set search_path to '' as $function$
  select case regexp_replace(upper(coalesce(p_conselho,'')),'[^A-Z]','','g')
    when 'CRESS' then '01' when 'COREN' then '02' when 'CRF' then '03' when 'CRFA' then '04'
    when 'CREFITO' then '05' when 'CRM' then '06' when 'CRN' then '07' when 'CRO' then '08'
    when 'CRP' then '09' when 'OUT' then '10' when 'OUTROS' then '10' when 'CRBIO' then '11'
    when 'CRBM' then '12' when 'CREF' then '13' when 'CRMV' then '14' when 'CRTR' then '15'
    else null end
$function$;
revoke all on function public.codigo_conselho_ans_tiss(text) from public,anon;
grant execute on function public.codigo_conselho_ans_tiss(text) to authenticated;

create or replace function public.preencher_complemento_tiss_040300_internal()
returns trigger language plpgsql security definer set search_path to '' as $function$
declare v_regime text; v_tipo_internacao text;
begin
  if nullif(btrim(coalesce(new.codigo_conselho_ans_snapshot,'')),'') is null then new.codigo_conselho_ans_snapshot := public.codigo_conselho_ans_tiss(new.profissional_conselho_snapshot); end if;
  if nullif(btrim(coalesce(new.regime_atendimento_tiss,'')),'') is null and new.atendimento_id is not null then
    select a.regime_atendimento into v_regime from public.atendimentos a where a.id=new.atendimento_id;
    if v_regime = any(array['01','02','03','04','05']) then new.regime_atendimento_tiss := v_regime; end if;
  end if;
  if new.tipo_guia='resumo_internacao' and nullif(btrim(coalesce(new.tipo_internacao_tiss,'')),'') is null and new.atendimento_id is not null then
    select i.tipo_internacao_ans_codigo into v_tipo_internacao from public.internacoes i where i.atendimento_id=new.atendimento_id order by i.data_internacao desc,i.id desc limit 1;
    if v_tipo_internacao = any(array['1','2','3','4','5']) then new.tipo_internacao_tiss := v_tipo_internacao; end if;
  end if;
  return new;
end
$function$;
revoke all on function public.preencher_complemento_tiss_040300_internal() from public,anon,authenticated;
drop trigger if exists trg_tiss_guias_complemento_040300 on public.tiss_guias;
create trigger trg_tiss_guias_complemento_040300 before insert or update on public.tiss_guias for each row execute function public.preencher_complemento_tiss_040300_internal();

create or replace function public.validar_guia_tiss_comunicacao_040300_internal(p_guia_id uuid)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_guia public.tiss_guias%rowtype; v_versao text; v_empresa_cnpj text; v_user uuid:=auth.uid(); v_itens integer:=0; v_erros integer:=0;
begin
  select g.* into v_guia from public.tiss_guias g where g.id=p_guia_id;
  if not found then raise exception 'TISS_GUIA_NAO_LOCALIZADA' using errcode='P0002'; end if;
  select tv.comunicacao_principal into v_versao from public.tiss_versoes tv where tv.id=v_guia.versao_id;
  if v_versao is distinct from '04.03.00' then return jsonb_build_object('guia_id',v_guia.id,'aplicavel',false,'erros',0); end if;
  delete from public.tiss_guia_criticas where guia_id=v_guia.id and not resolvida and codigo like 'XSD040300-%';
  select regexp_replace(coalesce(e.cnpj,''),'\D','','g') into v_empresa_cnpj from public.empresas e where e.id=v_guia.empresa_id;
  select count(*)::integer into v_itens from public.tiss_guia_itens gi where gi.guia_id=v_guia.id;

  if nullif(btrim(coalesce(v_guia.codigo_prestador_operadora,'')),'') is null and length(coalesce(v_empresa_cnpj,''))<>14 then
    insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by) values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'XSD040300-PRESTADOR-ID','erro','codigo_prestador_operadora','O XSD 04.03.00 exige identificação do prestador por código na operadora, CPF ou CNPJ; não há identificador utilizável.',v_user); v_erros:=v_erros+1;
  end if;
  if v_guia.tipo_guia in ('consulta','sp_sadt','resumo_internacao') and nullif(btrim(coalesce(v_guia.codigo_conselho_ans_snapshot,'')),'') is null then
    insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by) values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'XSD040300-CONSELHO','erro','codigo_conselho_ans_snapshot','Conselho profissional sem código ANS/TISS 04.03.00 normalizado.',v_user); v_erros:=v_erros+1;
  end if;

  if v_guia.tipo_guia='consulta' then
    if nullif(btrim(coalesce(v_guia.indicador_acidente,'')),'') is null then insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by) values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'XSD040300-CONS-ACIDENTE','erro','indicador_acidente','Informe o indicador de acidente exigido pela Guia de Consulta 04.03.00.',v_user); v_erros:=v_erros+1; end if;
    if nullif(btrim(coalesce(v_guia.regime_atendimento_tiss,'')),'') is null then insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by) values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'XSD040300-CONS-REGIME','erro','regime_atendimento_tiss','Informe o regime de atendimento exigido pela Guia de Consulta 04.03.00.',v_user); v_erros:=v_erros+1; end if;
    if v_itens<>1 then insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by) values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'XSD040300-CONS-ITEM','erro','itens','A Guia de Consulta 04.03.00 transporta exatamente um procedimento no bloco dadosAtendimento.',v_user); v_erros:=v_erros+1; end if;
  elsif v_guia.tipo_guia='sp_sadt' then
    if nullif(btrim(coalesce(v_guia.indicador_acidente,'')),'') is null then insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by) values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'XSD040300-SADT-ACIDENTE','erro','indicador_acidente','Informe o indicador de acidente exigido pela Guia SP/SADT 04.03.00.',v_user); v_erros:=v_erros+1; end if;
    if nullif(btrim(coalesce(v_guia.regime_atendimento_tiss,'')),'') is null then insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by) values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'XSD040300-SADT-REGIME','erro','regime_atendimento_tiss','Informe o regime de atendimento exigido pela Guia SP/SADT 04.03.00.',v_user); v_erros:=v_erros+1; end if;
    if nullif(btrim(coalesce(v_guia.carater_atendimento,'')),'') is null then insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by) values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'XSD040300-SADT-CARATER','erro','carater_atendimento','Informe o caráter do atendimento exigido pela Guia SP/SADT 04.03.00.',v_user); v_erros:=v_erros+1; end if;
  elsif v_guia.tipo_guia='resumo_internacao' then
    if nullif(btrim(coalesce(v_guia.numero_solicitacao_internacao,'')),'') is null then insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by) values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'XSD040300-INT-SOLIC','erro','numero_solicitacao_internacao','Informe o número da guia de solicitação de internação referenciada.',v_user); v_erros:=v_erros+1; end if;
    if v_guia.data_autorizacao is null then insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by) values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'XSD040300-INT-AUT-DATA','erro','data_autorizacao','Informe a data formal da autorização da internação.',v_user); v_erros:=v_erros+1; end if;
    if nullif(btrim(coalesce(v_guia.senha_autorizacao,'')),'') is null then insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by) values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'XSD040300-INT-SENHA','erro','senha_autorizacao','A senha da autorização é obrigatória no resumo de internação 04.03.00.',v_user); v_erros:=v_erros+1; end if;
    if nullif(btrim(coalesce(v_guia.carater_atendimento,'')),'') is null then insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by) values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'XSD040300-INT-CARATER','erro','carater_atendimento','Informe o caráter do atendimento da internação.',v_user); v_erros:=v_erros+1; end if;
    if nullif(btrim(coalesce(v_guia.tipo_faturamento_tiss,'')),'') is null then insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by) values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'XSD040300-INT-FAT','erro','tipo_faturamento_tiss','Informe o tipo de faturamento da internação: parcial, final, complementar ou total.',v_user); v_erros:=v_erros+1; end if;
    if v_guia.data_inicio_faturamento is null or v_guia.hora_inicio_faturamento is null or v_guia.data_fim_faturamento is null or v_guia.hora_fim_faturamento is null then insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by) values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'XSD040300-INT-PERIODO','erro','periodo_faturamento','Informe início e fim do período faturado com data e hora.',v_user); v_erros:=v_erros+1;
    elsif v_guia.data_inicio_faturamento > v_guia.data_fim_faturamento or (v_guia.data_inicio_faturamento=v_guia.data_fim_faturamento and v_guia.hora_inicio_faturamento>v_guia.hora_fim_faturamento) then insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by) values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'XSD040300-INT-PERIODO-ORDEM','erro','periodo_faturamento','O início do período faturado não pode ser posterior ao fim.',v_user); v_erros:=v_erros+1; end if;
    if nullif(btrim(coalesce(v_guia.tipo_internacao_tiss,'')),'') is null then insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by) values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'XSD040300-INT-TIPO','erro','tipo_internacao_tiss','Informe o tipo de internação TISS 04.03.00.',v_user); v_erros:=v_erros+1; end if;
    if nullif(btrim(coalesce(v_guia.regime_internacao_tiss,'')),'') is null then insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by) values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'XSD040300-INT-REGIME','erro','regime_internacao_tiss','Informe o regime de internação: hospitalar, hospital-dia ou domiciliar.',v_user); v_erros:=v_erros+1; end if;
    if nullif(btrim(coalesce(v_guia.indicador_acidente,'')),'') is null then insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by) values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'XSD040300-INT-ACIDENTE','erro','indicador_acidente','Informe o indicador de acidente do resumo de internação.',v_user); v_erros:=v_erros+1; end if;
    if nullif(btrim(coalesce(v_guia.motivo_encerramento_tiss,'')),'') is null then insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by) values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'XSD040300-INT-MOTIVO','erro','motivo_encerramento_tiss','Informe o código TISS do motivo de encerramento da internação.',v_user); v_erros:=v_erros+1; end if;
  end if;
  if v_erros>0 and v_guia.status='pronta' then update public.tiss_guias set status='rascunho',updated_at=now(),updated_by=coalesce(v_user,updated_by) where id=v_guia.id; end if;
  return jsonb_build_object('guia_id',v_guia.id,'aplicavel',true,'erros',v_erros);
end
$function$;
revoke all on function public.validar_guia_tiss_comunicacao_040300_internal(uuid) from public,anon,authenticated;

create or replace function public.validar_guia_tiss_comunicacao_040300_trigger()
returns trigger language plpgsql security definer set search_path to '' as $function$
begin perform public.validar_guia_tiss_comunicacao_040300_internal(new.id); return new; end
$function$;
revoke all on function public.validar_guia_tiss_comunicacao_040300_trigger() from public,anon,authenticated;
drop trigger if exists trg_tiss_guias_validacao_comunicacao_040300 on public.tiss_guias;
create trigger trg_tiss_guias_validacao_comunicacao_040300 after update of validado_em on public.tiss_guias for each row when (new.validado_em is distinct from old.validado_em) execute function public.validar_guia_tiss_comunicacao_040300_trigger();

create or replace function public.salvar_complemento_comunicacao_tiss_operacional(
  p_guia_id uuid,p_codigo_conselho_ans text default null,p_indicador_acidente text default null,p_regime_atendimento text default null,p_carater_atendimento text default null,p_numero_solicitacao_internacao text default null,p_data_autorizacao date default null,p_tipo_faturamento text default null,p_data_inicio_faturamento date default null,p_hora_inicio_faturamento time without time zone default null,p_data_fim_faturamento date default null,p_hora_fim_faturamento time without time zone default null,p_tipo_internacao text default null,p_regime_internacao text default null,p_motivo_encerramento text default null
)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_user uuid:=auth.uid(); v_guia public.tiss_guias%rowtype; v_validacao jsonb; v_status text; v_erros integer;
begin
  if v_user is null then raise exception 'TISS_GUIA_NAO_AUTENTICADO' using errcode='42501'; end if;
  select * into v_guia from public.tiss_guias where id=p_guia_id for update;
  if not found then raise exception 'TISS_GUIA_NAO_LOCALIZADA' using errcode='P0002'; end if;
  if not public.tem_unidade(v_guia.empresa_id,v_guia.unidade_id) or not public.tem_permissao(v_guia.empresa_id,v_guia.unidade_id,'tiss.gerar') then raise exception 'TISS_GUIA_SEM_PERMISSAO' using errcode='42501'; end if;
  if v_guia.status not in ('rascunho','pronta') then raise exception 'TISS_GUIA_NAO_EDITAVEL'; end if;
  update public.tiss_guias set codigo_conselho_ans_snapshot=nullif(btrim(coalesce(p_codigo_conselho_ans,'')),''),indicador_acidente=nullif(btrim(coalesce(p_indicador_acidente,'')),''),regime_atendimento_tiss=nullif(btrim(coalesce(p_regime_atendimento,'')),''),carater_atendimento=nullif(btrim(coalesce(p_carater_atendimento,'')),''),numero_solicitacao_internacao=nullif(btrim(coalesce(p_numero_solicitacao_internacao,'')),''),data_autorizacao=p_data_autorizacao,tipo_faturamento_tiss=nullif(btrim(coalesce(p_tipo_faturamento,'')),''),data_inicio_faturamento=p_data_inicio_faturamento,hora_inicio_faturamento=p_hora_inicio_faturamento,data_fim_faturamento=p_data_fim_faturamento,hora_fim_faturamento=p_hora_fim_faturamento,tipo_internacao_tiss=nullif(btrim(coalesce(p_tipo_internacao,'')),''),regime_internacao_tiss=nullif(btrim(coalesce(p_regime_internacao,'')),''),motivo_encerramento_tiss=nullif(btrim(coalesce(p_motivo_encerramento,'')),''),updated_at=now(),updated_by=v_user where id=v_guia.id;
  v_validacao:=public.validar_guia_tiss_internal(v_guia.id);
  select g.status into v_status from public.tiss_guias g where g.id=v_guia.id;
  select count(*)::integer into v_erros from public.tiss_guia_criticas c where c.guia_id=v_guia.id and not c.resolvida and c.severidade='erro';
  return jsonb_build_object('guia_id',v_guia.id,'status',v_status,'erros',v_erros,'validacao',v_validacao);
end
$function$;
revoke all on function public.salvar_complemento_comunicacao_tiss_operacional(uuid,text,text,text,text,text,date,text,date,time without time zone,date,time without time zone,text,text,text) from public,anon;
grant execute on function public.salvar_complemento_comunicacao_tiss_operacional(uuid,text,text,text,text,text,date,text,date,time without time zone,date,time without time zone,text,text,text) to authenticated;
