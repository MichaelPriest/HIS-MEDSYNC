create or replace function public.salvar_xml_preliminar_tiss_operacional(
  p_lote_id uuid,
  p_xml_conteudo text,
  p_versao_comunicacao text
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_user uuid := auth.uid();
  v_lote public.tiss_lotes%rowtype;
  v_xml_id uuid;
  v_erros jsonb := jsonb_build_array(jsonb_build_object(
    'codigo','XSD_PENDENTE',
    'mensagem','XSD oficial ainda não instalado/validado no gerador.'
  ));
begin
  if v_user is null then
    raise exception 'TISS_XML_NAO_AUTENTICADO' using errcode='42501';
  end if;
  if nullif(btrim(coalesce(p_xml_conteudo,'')),'') is null then
    raise exception 'TISS_XML_CONTEUDO_OBRIGATORIO';
  end if;
  if nullif(btrim(coalesce(p_versao_comunicacao,'')),'') is null then
    raise exception 'TISS_XML_VERSAO_OBRIGATORIA';
  end if;

  select * into v_lote
  from public.tiss_lotes
  where id=p_lote_id
  for update;

  if not found then
    raise exception 'TISS_LOTE_NAO_LOCALIZADO' using errcode='P0002';
  end if;
  if not public.tem_unidade(v_lote.empresa_id,v_lote.unidade_id)
     or not public.tem_alguma_permissao_funcional(
       v_lote.empresa_id,
       v_lote.unidade_id,
       array['tiss.gerar','faturamento.criar','faturamento.fechar']
     ) then
    raise exception 'TISS_XML_SEM_PERMISSAO' using errcode='42501';
  end if;
  if v_lote.status in ('enviado','protocolado','aceito','rejeitado') then
    raise exception 'TISS_LOTE_NAO_EDITAVEL';
  end if;

  delete from public.tiss_xmls
   where lote_id=p_lote_id
     and tipo_mensagem='PRELIMINAR_INTERNO';

  insert into public.tiss_xmls(
    lote_id,tipo_mensagem,versao_comunicacao,xml_conteudo,xsd_validado,erros_validacao
  ) values (
    p_lote_id,'PRELIMINAR_INTERNO',btrim(p_versao_comunicacao),p_xml_conteudo,false,v_erros
  ) returning id into v_xml_id;

  update public.tiss_lotes
     set status='invalido',
         xsd_validado=false,
         erros_validacao=v_erros,
         updated_at=now(),
         updated_by=v_user
   where id=p_lote_id;

  return v_xml_id;
end
$$;

revoke all on function public.salvar_xml_preliminar_tiss_operacional(uuid,text,text) from public, anon;
grant execute on function public.salvar_xml_preliminar_tiss_operacional(uuid,text,text) to authenticated;

create or replace function public.registrar_envio_manual_tiss_operacional(
  p_lote_id uuid,
  p_xml_id uuid,
  p_protocolo text default null,
  p_observacoes text default null
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_user uuid := auth.uid();
  v_lote public.tiss_lotes%rowtype;
  v_xml public.tiss_xmls%rowtype;
  v_operacao_id uuid;
  v_nome_arquivo text;
begin
  if v_user is null then
    raise exception 'TISS_ENVIO_NAO_AUTENTICADO' using errcode='42501';
  end if;

  select * into v_lote
  from public.tiss_lotes
  where id=p_lote_id
  for update;

  if not found then
    raise exception 'TISS_LOTE_NAO_LOCALIZADO' using errcode='P0002';
  end if;
  if not public.tem_unidade(v_lote.empresa_id,v_lote.unidade_id)
     or not public.tem_permissao(v_lote.empresa_id,v_lote.unidade_id,'tiss.enviar') then
    raise exception 'TISS_ENVIO_SEM_PERMISSAO' using errcode='42501';
  end if;
  if v_lote.status in ('aceito','rejeitado') then
    raise exception 'TISS_LOTE_NAO_EDITAVEL';
  end if;

  select * into v_xml
  from public.tiss_xmls
  where id=p_xml_id and lote_id=p_lote_id;

  if not found then
    raise exception 'TISS_XML_NAO_LOCALIZADO' using errcode='P0002';
  end if;
  if not coalesce(v_xml.xsd_validado,false) then
    raise exception 'TISS_XSD_OBRIGATORIO';
  end if;
  if v_xml.tipo_mensagem='PRELIMINAR_INTERNO' then
    raise exception 'TISS_XML_PRELIMINAR_NAO_ENVIAVEL';
  end if;

  v_nome_arquivo := 'tiss-' || v_lote.numero_lote || '-' || v_xml.tipo_mensagem || '.xml';

  insert into public.tiss_operacoes_manuais(
    empresa_id,unidade_id,convenio_id,lote_id,direcao,tipo_documento,nome_arquivo,
    xml_conteudo,origem,xsd_validado,protocolo_externo,observacoes,processado,created_by
  ) values (
    v_lote.empresa_id,v_lote.unidade_id,v_lote.convenio_id,p_lote_id,'saida',v_xml.tipo_mensagem,
    v_nome_arquivo,v_xml.xml_conteudo,'manual',true,nullif(btrim(coalesce(p_protocolo,'')),''),
    nullif(btrim(coalesce(p_observacoes,'')),''),true,v_user
  ) returning id into v_operacao_id;

  update public.tiss_lotes
     set status='enviado',
         enviado_em=now(),
         protocolo_operadora=nullif(btrim(coalesce(p_protocolo,'')),''),
         updated_at=now(),
         updated_by=v_user
   where id=p_lote_id;

  return v_operacao_id;
end
$$;

revoke all on function public.registrar_envio_manual_tiss_operacional(uuid,uuid,text,text) from public, anon;
grant execute on function public.registrar_envio_manual_tiss_operacional(uuid,uuid,text,text) to authenticated;
