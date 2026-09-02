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
as $function$
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
  if not found then raise exception 'TISS_LOTE_NAO_LOCALIZADO' using errcode='P0002'; end if;

  if not public.tem_unidade(v_lote.empresa_id,v_lote.unidade_id)
     or not public.tem_permissao(v_lote.empresa_id,v_lote.unidade_id,'tiss.enviar') then
    raise exception 'TISS_ENVIO_SEM_PERMISSAO' using errcode='42501';
  end if;
  if v_lote.status in ('aceito','rejeitado') then raise exception 'TISS_LOTE_NAO_EDITAVEL'; end if;

  select * into v_xml
    from public.tiss_xmls
   where id=p_xml_id and lote_id=p_lote_id;
  if not found then raise exception 'TISS_XML_NAO_LOCALIZADO' using errcode='P0002'; end if;
  if not coalesce(v_xml.xsd_validado,false) then raise exception 'TISS_XSD_OBRIGATORIO'; end if;
  if v_xml.tipo_mensagem is distinct from 'ENVIO_LOTE_GUIAS' then
    raise exception 'TISS_XML_FINAL_OBRIGATORIO';
  end if;
  if v_xml.versao_comunicacao is distinct from '04.03.00' then
    raise exception 'TISS_XML_VERSAO_DIVERGENTE';
  end if;

  v_nome_arquivo := 'tiss-' || v_lote.numero_lote || '-ENVIO_LOTE_GUIAS.xml';
  insert into public.tiss_operacoes_manuais(
    empresa_id,unidade_id,convenio_id,lote_id,direcao,tipo_documento,nome_arquivo,
    xml_conteudo,origem,xsd_validado,protocolo_externo,observacoes,processado,created_by
  ) values (
    v_lote.empresa_id,v_lote.unidade_id,v_lote.convenio_id,p_lote_id,'saida','ENVIO_LOTE_GUIAS',
    v_nome_arquivo,v_xml.xml_conteudo,'manual',true,nullif(btrim(coalesce(p_protocolo,'')),''),
    nullif(btrim(coalesce(p_observacoes,'')),''),true,v_user
  ) returning id into v_operacao_id;

  update public.tiss_lotes
     set status='enviado',enviado_em=now(),
         protocolo_operadora=nullif(btrim(coalesce(p_protocolo,'')),''),
         updated_at=now(),updated_by=v_user
   where id=p_lote_id;

  return v_operacao_id;
end
$function$;

revoke all on function public.registrar_envio_manual_tiss_operacional(uuid,uuid,text,text) from public;
grant execute on function public.registrar_envio_manual_tiss_operacional(uuid,uuid,text,text) to authenticated;
