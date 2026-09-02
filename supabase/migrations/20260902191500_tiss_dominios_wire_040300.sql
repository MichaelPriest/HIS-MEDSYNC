create or replace function public.uf_ans_tiss_040300(p_uf text)
returns text
language sql
immutable
set search_path to ''
as $function$
  select case upper(btrim(coalesce(p_uf,'')))
    when 'RO' then '11' when '11' then '11'
    when 'AC' then '12' when '12' then '12'
    when 'AM' then '13' when '13' then '13'
    when 'RR' then '14' when '14' then '14'
    when 'PA' then '15' when '15' then '15'
    when 'AP' then '16' when '16' then '16'
    when 'TO' then '17' when '17' then '17'
    when 'MA' then '21' when '21' then '21'
    when 'PI' then '22' when '22' then '22'
    when 'CE' then '23' when '23' then '23'
    when 'RN' then '24' when '24' then '24'
    when 'PB' then '25' when '25' then '25'
    when 'PE' then '26' when '26' then '26'
    when 'AL' then '27' when '27' then '27'
    when 'SE' then '28' when '28' then '28'
    when 'BA' then '29' when '29' then '29'
    when 'MG' then '31' when '31' then '31'
    when 'ES' then '32' when '32' then '32'
    when 'RJ' then '33' when '33' then '33'
    when 'SP' then '35' when '35' then '35'
    when 'PR' then '41' when '41' then '41'
    when 'SC' then '42' when '42' then '42'
    when 'RS' then '43' when '43' then '43'
    when 'MS' then '50' when '50' then '50'
    when 'MT' then '51' when '51' then '51'
    when 'GO' then '52' when '52' then '52'
    when 'DF' then '53' when '53' then '53'
    when '98' then '98'
    else null
  end
$function$;
revoke all on function public.uf_ans_tiss_040300(text) from public,anon,authenticated;

create or replace function public.validar_guia_tiss_comunicacao_040300_internal(p_guia_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_guia public.tiss_guias%rowtype;
  v_versao text;
  v_empresa_cnpj text;
  v_user uuid := auth.uid();
  v_itens integer := 0;
  v_erros integer := 0;
begin
  select g.* into v_guia from public.tiss_guias g where g.id=p_guia_id;
  if not found then raise exception 'TISS_GUIA_NAO_LOCALIZADA' using errcode='P0002'; end if;
  select tv.comunicacao_principal into v_versao from public.tiss_versoes tv where tv.id=v_guia.versao_id;
  if v_versao is distinct from '04.03.00' then return jsonb_build_object('guia_id',v_guia.id,'aplicavel',false,'erros',0); end if;

  delete from public.tiss_guia_criticas where guia_id=v_guia.id and not resolvida and codigo like 'XSD040300-%';
  select regexp_replace(coalesce(e.cnpj,''),'\D','','g') into v_empresa_cnpj from public.empresas e where e.id=v_guia.empresa_id;
  select count(*)::integer into v_itens from public.tiss_guia_itens gi where gi.guia_id=v_guia.id;

  if nullif(btrim(coalesce(v_guia.codigo_prestador_operadora,'')),'') is null and length(coalesce(v_empresa_cnpj,''))<>14 then
    insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by)
    values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'XSD040300-PRESTADOR-ID','erro','codigo_prestador_operadora','O XSD 04.03.00 exige identificação do prestador por código na operadora, CPF ou CNPJ; não há identificador utilizável.',v_user);
    v_erros:=v_erros+1;
  end if;
  if v_guia.tipo_guia in ('consulta','sp_sadt','resumo_internacao') and nullif(btrim(coalesce(v_guia.codigo_conselho_ans_snapshot,'')),'') is null then
    insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by)
    values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'XSD040300-CONSELHO','erro','codigo_conselho_ans_snapshot','Conselho profissional sem código ANS/TISS 04.03.00 normalizado.',v_user);
    v_erros:=v_erros+1;
  end if;
  if v_guia.tipo_guia in ('consulta','sp_sadt') and public.uf_ans_tiss_040300(v_guia.profissional_uf_conselho_snapshot) is null then
    insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by)
    values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'XSD040300-UF-EXEC','erro','profissional_uf_conselho_snapshot','A UF do conselho do executante não corresponde ao domínio dm_UF da Comunicação 4.03.00.',v_user);
    v_erros:=v_erros+1;
  end if;

  if v_guia.tipo_guia='consulta' then
    if nullif(btrim(coalesce(v_guia.indicador_acidente,'')),'') is null then
      insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by) values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'XSD040300-CONS-ACIDENTE','erro','indicador_acidente','Informe o indicador de acidente exigido pela Guia de Consulta 04.03.00.',v_user); v_erros:=v_erros+1;
    end if;
    if nullif(btrim(coalesce(v_guia.regime_atendimento_tiss,'')),'') is null then
      insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by) values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'XSD040300-CONS-REGIME','erro','regime_atendimento_tiss','Informe o regime de atendimento exigido pela Guia de Consulta 04.03.00.',v_user); v_erros:=v_erros+1;
    end if;
    if v_guia.tipo_consulta_tuss52_codigo is null or not (v_guia.tipo_consulta_tuss52_codigo = any(array['1','2','3','4'])) then
      insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by)
      values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'XSD040300-CONS-TIPO','erro','tipo_consulta_tuss52_codigo','O tipo de consulta não pertence ao domínio dm_tipoConsulta aceito pela Comunicação 4.03.00.',v_user);
      v_erros:=v_erros+1;
    end if;
    if v_itens<>1 then
      insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by) values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'XSD040300-CONS-ITEM','erro','itens','A Guia de Consulta 04.03.00 transporta exatamente um procedimento no bloco dadosAtendimento.',v_user); v_erros:=v_erros+1;
    end if;
  elsif v_guia.tipo_guia='sp_sadt' then
    if nullif(btrim(coalesce(v_guia.indicador_acidente,'')),'') is null then
      insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by) values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'XSD040300-SADT-ACIDENTE','erro','indicador_acidente','Informe o indicador de acidente exigido pela Guia SP/SADT 04.03.00.',v_user); v_erros:=v_erros+1;
    end if;
    if nullif(btrim(coalesce(v_guia.regime_atendimento_tiss,'')),'') is null then
      insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by) values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'XSD040300-SADT-REGIME','erro','regime_atendimento_tiss','Informe o regime de atendimento exigido pela Guia SP/SADT 04.03.00.',v_user); v_erros:=v_erros+1;
    end if;
    if nullif(btrim(coalesce(v_guia.carater_atendimento,'')),'') is null then
      insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by) values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'XSD040300-SADT-CARATER','erro','carater_atendimento','Informe o caráter do atendimento exigido pela Guia SP/SADT 04.03.00.',v_user); v_erros:=v_erros+1;
    end if;
    if v_guia.tipo_atendimento_tuss50_codigo is null or not (v_guia.tipo_atendimento_tuss50_codigo = any(array['01','02','03','04','08','09','10','13','23'])) then
      insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by)
      values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'XSD040300-SADT-TIPO','erro','tipo_atendimento_tuss50_codigo','O tipo de atendimento não pertence ao domínio dm_tipoAtendimento aceito pela Comunicação 4.03.00. Corrija o tipo TUSS do atendimento de origem.',v_user);
      v_erros:=v_erros+1;
    end if;
    if nullif(btrim(coalesce(v_guia.solicitante_uf_conselho_snapshot,'')),'') is not null and public.uf_ans_tiss_040300(v_guia.solicitante_uf_conselho_snapshot) is null then
      insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by)
      values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'XSD040300-SADT-SOL-UF','erro','solicitante_uf_conselho_snapshot','A UF do conselho do solicitante não corresponde ao domínio dm_UF da Comunicação 4.03.00.',v_user);
      v_erros:=v_erros+1;
    end if;
  elsif v_guia.tipo_guia='resumo_internacao' then
    if nullif(btrim(coalesce(v_guia.numero_solicitacao_internacao,'')),'') is null then insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by) values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'XSD040300-INT-SOLIC','erro','numero_solicitacao_internacao','Informe o número da guia de solicitação de internação referenciada.',v_user); v_erros:=v_erros+1; end if;
    if v_guia.data_autorizacao is null then insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by) values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'XSD040300-INT-AUT-DATA','erro','data_autorizacao','Informe a data formal da autorização da internação.',v_user); v_erros:=v_erros+1; end if;
    if nullif(btrim(coalesce(v_guia.senha_autorizacao,'')),'') is null then insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by) values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'XSD040300-INT-SENHA','erro','senha_autorizacao','A senha da autorização é obrigatória no resumo de internação 04.03.00.',v_user); v_erros:=v_erros+1; end if;
    if nullif(btrim(coalesce(v_guia.carater_atendimento,'')),'') is null then insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by) values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'XSD040300-INT-CARATER','erro','carater_atendimento','Informe o caráter do atendimento da internação.',v_user); v_erros:=v_erros+1; end if;
    if nullif(btrim(coalesce(v_guia.tipo_faturamento_tiss,'')),'') is null then insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by) values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'XSD040300-INT-FAT','erro','tipo_faturamento_tiss','Informe o tipo de faturamento da internação: parcial, final, complementar ou total.',v_user); v_erros:=v_erros+1; end if;
    if v_guia.data_inicio_faturamento is null or v_guia.hora_inicio_faturamento is null or v_guia.data_fim_faturamento is null or v_guia.hora_fim_faturamento is null then
      insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by) values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'XSD040300-INT-PERIODO','erro','periodo_faturamento','Informe início e fim do período faturado com data e hora.',v_user); v_erros:=v_erros+1;
    elsif v_guia.data_inicio_faturamento > v_guia.data_fim_faturamento or (v_guia.data_inicio_faturamento=v_guia.data_fim_faturamento and v_guia.hora_inicio_faturamento>v_guia.hora_fim_faturamento) then
      insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by) values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'XSD040300-INT-PERIODO-ORDEM','erro','periodo_faturamento','O início do período faturado não pode ser posterior ao fim.',v_user); v_erros:=v_erros+1;
    end if;
    if nullif(btrim(coalesce(v_guia.tipo_internacao_tiss,'')),'') is null then insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by) values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'XSD040300-INT-TIPO','erro','tipo_internacao_tiss','Informe o tipo de internação TISS 04.03.00.',v_user); v_erros:=v_erros+1; end if;
    if nullif(btrim(coalesce(v_guia.regime_internacao_tiss,'')),'') is null then insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by) values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'XSD040300-INT-REGIME','erro','regime_internacao_tiss','Informe o regime de internação: hospitalar, hospital-dia ou domiciliar.',v_user); v_erros:=v_erros+1; end if;
    if nullif(btrim(coalesce(v_guia.indicador_acidente,'')),'') is null then insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by) values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'XSD040300-INT-ACIDENTE','erro','indicador_acidente','Informe o indicador de acidente do resumo de internação.',v_user); v_erros:=v_erros+1; end if;
    if nullif(btrim(coalesce(v_guia.motivo_encerramento_tiss,'')),'') is null then insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by) values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'XSD040300-INT-MOTIVO','erro','motivo_encerramento_tiss','Informe o código TISS do motivo de encerramento da internação.',v_user); v_erros:=v_erros+1; end if;
  end if;

  if v_erros>0 and v_guia.status='pronta' then
    update public.tiss_guias set status='rascunho',updated_at=now(),updated_by=coalesce(v_user,updated_by) where id=v_guia.id;
  end if;
  return jsonb_build_object('guia_id',v_guia.id,'aplicavel',true,'erros',v_erros);
end
$function$;
revoke all on function public.validar_guia_tiss_comunicacao_040300_internal(uuid) from public,anon,authenticated;
