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
  v_erros jsonb := coalesce(p_erros, '[]'::jsonb);
begin
  if v_user is null then
    raise exception 'TISS_XSD_NAO_AUTENTICADO' using errcode='42501';
  end if;

  select * into v_xml
  from public.tiss_xmls
  where id = p_xml_id
  for update;

  if not found or v_xml.lote_id is null then
    raise exception 'TISS_XML_NAO_LOCALIZADO' using errcode='P0002';
  end if;

  select * into v_lote
  from public.tiss_lotes
  where id = v_xml.lote_id
  for update;

  if not found then
    raise exception 'TISS_LOTE_NAO_LOCALIZADO' using errcode='P0002';
  end if;

  if not public.tem_unidade(v_lote.empresa_id, v_lote.unidade_id)
     or not public.tem_alguma_permissao_funcional(
       v_lote.empresa_id,
       v_lote.unidade_id,
       array['tiss.gerar','tiss.enviar','faturamento.criar','faturamento.fechar']
     ) then
    raise exception 'TISS_XSD_SEM_PERMISSAO' using errcode='42501';
  end if;

  if v_lote.status in ('enviado','protocolado','aceito','rejeitado') then
    raise exception 'TISS_LOTE_NAO_EDITAVEL';
  end if;

  if nullif(btrim(coalesce(p_versao,'')), '') is null
     or btrim(p_versao) <> v_xml.versao_comunicacao then
    raise exception 'TISS_XSD_VERSAO_DIVERGENTE';
  end if;

  if coalesce(p_xsd_validado,false) and v_xml.tipo_mensagem = 'PRELIMINAR_INTERNO' then
    raise exception 'TISS_XML_PRELIMINAR_NAO_VALIDAVEL';
  end if;

  if coalesce(p_xsd_validado,false) and jsonb_array_length(v_erros) > 0 then
    raise exception 'TISS_XSD_RESULTADO_INCONSISTENTE';
  end if;

  if not coalesce(p_xsd_validado,false) and jsonb_array_length(v_erros) = 0 then
    v_erros := jsonb_build_array(jsonb_build_object(
      'codigo','XSD_INVALIDO',
      'mensagem','O XML não passou pela validação XSD.'
    ));
  end if;

  update public.tiss_xmls
     set xsd_validado = coalesce(p_xsd_validado,false),
         validado_em = now(),
         erros_validacao = v_erros,
         hash_documento = nullif(btrim(coalesce(p_hash,'')), '')
   where id = v_xml.id;

  update public.tiss_lotes
     set xsd_validado = coalesce(p_xsd_validado,false),
         erros_validacao = v_erros,
         status = case when coalesce(p_xsd_validado,false) then 'valido' else 'invalido' end,
         hash_documento = nullif(btrim(coalesce(p_hash,'')), ''),
         updated_at = now(),
         updated_by = v_user
   where id = v_lote.id;

  return v_xml.id;
end
$function$;

revoke all on function public.registrar_validacao_xsd_tiss_operacional(uuid,boolean,jsonb,text,text) from public;
grant execute on function public.registrar_validacao_xsd_tiss_operacional(uuid,boolean,jsonb,text,text) to authenticated;
