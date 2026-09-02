alter table public.tiss_xmls add column if not exists hash_tiss_md5 text;
alter table public.tiss_lotes add column if not exists hash_tiss_md5 text;

alter table public.tiss_xmls drop constraint if exists tiss_xmls_hash_tiss_md5_check;
alter table public.tiss_xmls add constraint tiss_xmls_hash_tiss_md5_check
  check (hash_tiss_md5 is null or hash_tiss_md5 ~ '^[0-9A-F]{32}$');
alter table public.tiss_lotes drop constraint if exists tiss_lotes_hash_tiss_md5_check;
alter table public.tiss_lotes add constraint tiss_lotes_hash_tiss_md5_check
  check (hash_tiss_md5 is null or hash_tiss_md5 ~ '^[0-9A-F]{32}$');

create or replace function public.salvar_xml_preliminar_tiss_operacional(
  p_lote_id uuid,
  p_xml_conteudo text,
  p_versao_comunicacao text
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user uuid := auth.uid();
  v_lote public.tiss_lotes%rowtype;
  v_xml_id uuid;
  v_erros jsonb := jsonb_build_array(jsonb_build_object(
    'codigo','ARTEFATO_PRELIMINAR',
    'mensagem','Artefato interno não elegível a validação XSD ou envio.'
  ));
begin
  if v_user is null then raise exception 'TISS_XML_NAO_AUTENTICADO' using errcode='42501'; end if;
  if nullif(btrim(coalesce(p_xml_conteudo,'')),'') is null then raise exception 'TISS_XML_CONTEUDO_OBRIGATORIO'; end if;
  if nullif(btrim(coalesce(p_versao_comunicacao,'')),'') is null then raise exception 'TISS_XML_VERSAO_OBRIGATORIA'; end if;

  select * into v_lote from public.tiss_lotes where id=p_lote_id for update;
  if not found then raise exception 'TISS_LOTE_NAO_LOCALIZADO' using errcode='P0002'; end if;
  if not public.tem_unidade(v_lote.empresa_id,v_lote.unidade_id)
     or not public.tem_alguma_permissao_funcional(v_lote.empresa_id,v_lote.unidade_id,array['tiss.gerar','faturamento.criar','faturamento.fechar']) then
    raise exception 'TISS_XML_SEM_PERMISSAO' using errcode='42501';
  end if;
  if v_lote.status in ('enviado','protocolado','aceito','rejeitado') then raise exception 'TISS_LOTE_NAO_EDITAVEL'; end if;

  delete from public.tiss_xmls where lote_id=p_lote_id and tipo_mensagem='PRELIMINAR_INTERNO';
  insert into public.tiss_xmls(lote_id,tipo_mensagem,versao_comunicacao,xml_conteudo,xsd_validado,erros_validacao)
  values(p_lote_id,'PRELIMINAR_INTERNO',btrim(p_versao_comunicacao),p_xml_conteudo,false,v_erros)
  returning id into v_xml_id;

  update public.tiss_lotes
     set status='invalido',xsd_validado=false,erros_validacao=v_erros,hash_documento=null,hash_tiss_md5=null
   where id=p_lote_id;
  return v_xml_id;
end
$function$;

revoke all on function public.salvar_xml_preliminar_tiss_operacional(uuid,text,text) from public,anon;
grant execute on function public.salvar_xml_preliminar_tiss_operacional(uuid,text,text) to authenticated;

create or replace function public.salvar_xml_candidato_tiss_operacional(
  p_lote_id uuid,
  p_xml_conteudo text,
  p_versao_comunicacao text,
  p_hash_sha256 text,
  p_hash_tiss_md5 text
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user uuid := auth.uid();
  v_lote public.tiss_lotes%rowtype;
  v_versao text;
  v_xml_id uuid;
  v_hash_sha text := lower(btrim(coalesce(p_hash_sha256,'')));
  v_hash_md5 text := upper(btrim(coalesce(p_hash_tiss_md5,'')));
  v_sha_calculado text;
  v_md5_calculado text;
  v_pre_epilogo text;
  v_values text;
  v_tipo_guia text;
  v_tipos integer;
  v_quantidade integer;
  v_erros jsonb := jsonb_build_array(jsonb_build_object(
    'codigo','XSD_VALIDACAO_PENDENTE',
    'mensagem','XML candidato íntegro aguardando validação contra o XSD ANS 04.03.00.'
  ));
begin
  if v_user is null then raise exception 'TISS_XML_NAO_AUTENTICADO' using errcode='42501'; end if;
  if nullif(btrim(coalesce(p_xml_conteudo,'')),'') is null then raise exception 'TISS_XML_CONTEUDO_OBRIGATORIO'; end if;
  if btrim(coalesce(p_versao_comunicacao,'')) <> '04.03.00' then raise exception 'TISS_XML_VERSAO_NAO_SUPORTADA'; end if;
  if v_hash_sha !~ '^[0-9a-f]{64}$' then raise exception 'TISS_XML_SHA256_INVALIDO'; end if;
  if v_hash_md5 !~ '^[0-9A-F]{32}$' then raise exception 'TISS_XML_MD5_INVALIDO'; end if;

  select * into v_lote from public.tiss_lotes where id=p_lote_id for update;
  if not found then raise exception 'TISS_LOTE_NAO_LOCALIZADO' using errcode='P0002'; end if;
  if not public.tem_unidade(v_lote.empresa_id,v_lote.unidade_id)
     or not public.tem_alguma_permissao_funcional(v_lote.empresa_id,v_lote.unidade_id,array['tiss.gerar','tiss.enviar','faturamento.criar','faturamento.fechar']) then
    raise exception 'TISS_XML_SEM_PERMISSAO' using errcode='42501';
  end if;
  if v_lote.status in ('enviado','protocolado','aceito','rejeitado') then raise exception 'TISS_LOTE_NAO_EDITAVEL'; end if;

  select tv.comunicacao_principal into v_versao from public.tiss_versoes tv where tv.id=v_lote.versao_id;
  if v_versao is distinct from '04.03.00' then raise exception 'TISS_XML_VERSAO_DIVERGENTE'; end if;

  select min(g.tipo_guia),count(distinct g.tipo_guia)::integer,count(*)::integer
    into v_tipo_guia,v_tipos,v_quantidade
    from public.tiss_lote_guias lg join public.tiss_guias g on g.id=lg.guia_id
   where lg.lote_id=p_lote_id;
  if coalesce(v_quantidade,0)=0 or v_quantidade>100 then raise exception 'TISS_XML_QUANTIDADE_GUIAS_INVALIDA'; end if;
  if coalesce(v_tipos,0)<>1 or v_tipo_guia not in ('consulta','sp_sadt','resumo_internacao') then raise exception 'TISS_XML_TIPO_GUIA_INVALIDO'; end if;

  if position('<ans:mensagemTISS' in p_xml_conteudo)=0
     or position('<ans:tipoTransacao>ENVIO_LOTE_GUIAS</ans:tipoTransacao>' in p_xml_conteudo)=0
     or position('<ans:Padrao>4.03.00</ans:Padrao>' in p_xml_conteudo)=0
     or position('<ans:numeroLote>'||v_lote.numero_lote||'</ans:numeroLote>' in p_xml_conteudo)=0 then
    raise exception 'TISS_XML_ESTRUTURA_DIVERGENTE';
  end if;
  if (v_tipo_guia='consulta' and position('<ans:guiaConsulta>' in p_xml_conteudo)=0)
     or (v_tipo_guia='sp_sadt' and position('<ans:guiaSP-SADT>' in p_xml_conteudo)=0)
     or (v_tipo_guia='resumo_internacao' and position('<ans:guiaResumoInternacao>' in p_xml_conteudo)=0) then
    raise exception 'TISS_XML_TIPO_GUIA_DIVERGENTE';
  end if;
  if position('<ans:epilogo><ans:hash>'||v_hash_md5||'</ans:hash></ans:epilogo>' in p_xml_conteudo)=0 then
    raise exception 'TISS_XML_EPILOGO_DIVERGENTE';
  end if;

  v_sha_calculado := lower(encode(extensions.digest(convert_to(p_xml_conteudo,'UTF8'),'sha256'),'hex'));
  if v_sha_calculado <> v_hash_sha then raise exception 'TISS_XML_SHA256_DIVERGENTE'; end if;

  v_pre_epilogo := split_part(p_xml_conteudo,'<ans:epilogo>',1);
  select string_agg(
    replace(replace(replace(replace(replace(m[1],'&lt;','<'),'&gt;','>'),'&quot;','"'),'&apos;',''''),'&amp;','&'),
    '' order by ord
  ) into v_values
  from regexp_matches(v_pre_epilogo,'>([^<]*)<','g') with ordinality as found(m,ord)
  where btrim(m[1])<>'';
  v_md5_calculado := upper(encode(extensions.digest(convert_to(coalesce(v_values,''),'LATIN1'),'md5'),'hex'));
  if v_md5_calculado <> v_hash_md5 then raise exception 'TISS_XML_MD5_DIVERGENTE'; end if;

  delete from public.tiss_xmls
   where lote_id=p_lote_id and tipo_mensagem in ('ENVIO_LOTE_GUIAS_CANDIDATO','ENVIO_LOTE_GUIAS');
  insert into public.tiss_xmls(
    lote_id,tipo_mensagem,versao_comunicacao,xml_conteudo,hash_documento,hash_tiss_md5,xsd_validado,erros_validacao
  ) values(
    p_lote_id,'ENVIO_LOTE_GUIAS_CANDIDATO','04.03.00',p_xml_conteudo,v_hash_sha,v_hash_md5,false,v_erros
  ) returning id into v_xml_id;

  update public.tiss_lotes
     set status='validando',xsd_validado=false,erros_validacao=v_erros,hash_documento=v_hash_sha,hash_tiss_md5=v_hash_md5
   where id=p_lote_id;
  return v_xml_id;
end
$function$;

revoke all on function public.salvar_xml_candidato_tiss_operacional(uuid,text,text,text,text) from public,anon;
grant execute on function public.salvar_xml_candidato_tiss_operacional(uuid,text,text,text,text) to authenticated;

create or replace function public.registrar_validacao_xsd_tiss_operacional(
  p_xml_id uuid,
  p_xsd_validado boolean,
  p_erros jsonb,
  p_hash text,
  p_versao text
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user uuid := auth.uid();
  v_xml public.tiss_xmls%rowtype;
  v_lote public.tiss_lotes%rowtype;
  v_erros jsonb := coalesce(p_erros,'[]'::jsonb);
  v_hash text := lower(nullif(btrim(coalesce(p_hash,'')),''));
begin
  if v_user is null then raise exception 'TISS_XSD_NAO_AUTENTICADO' using errcode='42501'; end if;
  if jsonb_typeof(v_erros)<>'array' then raise exception 'TISS_XSD_ERROS_INVALIDOS'; end if;
  if v_hash is not null and v_hash !~ '^[0-9a-f]{64}$' then raise exception 'TISS_XSD_HASH_INVALIDO'; end if;

  select * into v_xml from public.tiss_xmls where id=p_xml_id for update;
  if not found or v_xml.lote_id is null then raise exception 'TISS_XML_NAO_LOCALIZADO' using errcode='P0002'; end if;
  select * into v_lote from public.tiss_lotes where id=v_xml.lote_id for update;
  if not found then raise exception 'TISS_LOTE_NAO_LOCALIZADO' using errcode='P0002'; end if;
  if not public.tem_unidade(v_lote.empresa_id,v_lote.unidade_id)
     or not public.tem_alguma_permissao_funcional(v_lote.empresa_id,v_lote.unidade_id,array['tiss.gerar','tiss.enviar','faturamento.criar','faturamento.fechar']) then
    raise exception 'TISS_XSD_SEM_PERMISSAO' using errcode='42501';
  end if;
  if v_lote.status in ('enviado','protocolado','aceito','rejeitado') then raise exception 'TISS_LOTE_NAO_EDITAVEL'; end if;
  if nullif(btrim(coalesce(p_versao,'')),'') is null or btrim(p_versao)<>v_xml.versao_comunicacao then raise exception 'TISS_XSD_VERSAO_DIVERGENTE'; end if;
  if coalesce(p_xsd_validado,false) and v_xml.tipo_mensagem='PRELIMINAR_INTERNO' then raise exception 'TISS_XML_PRELIMINAR_NAO_VALIDAVEL'; end if;
  if coalesce(p_xsd_validado,false) and v_xml.tipo_mensagem not in ('ENVIO_LOTE_GUIAS_CANDIDATO','ENVIO_LOTE_GUIAS') then raise exception 'TISS_XML_TIPO_NAO_ENVIAVEL'; end if;
  if coalesce(p_xsd_validado,false) and jsonb_array_length(v_erros)>0 then raise exception 'TISS_XSD_RESULTADO_INCONSISTENTE'; end if;
  if coalesce(p_xsd_validado,false) and v_hash is null then raise exception 'TISS_XSD_HASH_OBRIGATORIO'; end if;
  if v_xml.hash_documento is not null and v_hash is distinct from lower(v_xml.hash_documento) then raise exception 'TISS_XSD_HASH_DIVERGENTE'; end if;
  if coalesce(p_xsd_validado,false) and (v_xml.hash_tiss_md5 is null or v_xml.hash_tiss_md5 !~ '^[0-9A-F]{32}$') then raise exception 'TISS_XSD_MD5_TISS_OBRIGATORIO'; end if;
  if not coalesce(p_xsd_validado,false) and jsonb_array_length(v_erros)=0 then
    v_erros:=jsonb_build_array(jsonb_build_object('codigo','XSD_INVALIDO','mensagem','O XML não passou pela validação XSD.'));
  end if;

  update public.tiss_xmls
     set tipo_mensagem=case when coalesce(p_xsd_validado,false) and tipo_mensagem='ENVIO_LOTE_GUIAS_CANDIDATO' then 'ENVIO_LOTE_GUIAS' else tipo_mensagem end,
         xsd_validado=coalesce(p_xsd_validado,false),validado_em=now(),erros_validacao=v_erros,hash_documento=v_hash
   where id=v_xml.id;
  update public.tiss_lotes
     set xsd_validado=coalesce(p_xsd_validado,false),erros_validacao=v_erros,
         status=case when coalesce(p_xsd_validado,false) then 'valido' else 'invalido' end,
         hash_documento=v_hash,hash_tiss_md5=v_xml.hash_tiss_md5
   where id=v_lote.id;
  return v_xml.id;
end
$function$;

revoke all on function public.registrar_validacao_xsd_tiss_operacional(uuid,boolean,jsonb,text,text) from public,anon;
grant execute on function public.registrar_validacao_xsd_tiss_operacional(uuid,boolean,jsonb,text,text) to authenticated;
