"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getAssistencialContext } from "@/modules/assistencial/context";

function text(fd: FormData, key: string) { return String(fd.get(key) ?? "").trim(); }
function money(fd: FormData, key: string) { const raw=text(fd,key).replace(/\./g, "").replace(",", "."); const n=Number(raw || 0); return Number.isFinite(n) ? n : 0; }
function nullable(value: string) { return value || null; }

export async function criarLoteTiss(formData: FormData) {
  const { supabase, unidadeId } = await getAssistencialContext();
  const convenioId = text(formData, "convenio_id");
  const competencia = text(formData, "competencia");
  const previsaoPagamento = text(formData, "previsao_pagamento") || null;
  if (!convenioId || !competencia) redirect("/faturamento/lotes?erro=campos");

  const { data, error } = await supabase.rpc("criar_lote_tiss_transacional", {
    p_unidade_id: unidadeId,
    p_convenio_id: convenioId,
    p_competencia: competencia,
    p_previsao_pagamento: previsaoPagamento,
  });
  if (error) {
    console.error("[tiss] criar lote transacional", { code: error.code, operation: "criar_lote_tiss_transacional" });
    const value=String(error.message??"");
    const motivo=value.includes("SEM_GUIAS_ELEGIVEIS")?"sem-guias":value.includes("COMPETENCIA_INVALIDA")?"competencia":value.includes("VERSAO_INDISPONIVEL")?"versao":value.includes("SEM_PERMISSAO")?"permissao":"criar";
    redirect(`/faturamento/lotes?erro=${motivo}`);
  }
  const result=(data??{}) as {lote_id?:string};
  if(!result.lote_id) redirect("/faturamento/lotes?erro=criar");
  redirect(`/faturamento/lotes/${result.lote_id}`);
}

export async function anexarDocumentoLote(loteId:string, formData:FormData){
  const { supabase, user, empresaId } = await getAssistencialContext();
  const arquivo=formData.get("arquivo"); const tipo=text(formData,"tipo")||"outro";
  if(!(arquivo instanceof File)||arquivo.size<=0||arquivo.size>15*1024*1024) redirect(`/faturamento/lotes/${loteId}?erro=anexo`);
  const safe=arquivo.name.replace(/[^a-zA-Z0-9._-]/g,"_"); const path=`${empresaId}/tiss-lotes/${loteId}/${Date.now()}-${safe}`;
  const { error: upError }=await supabase.storage.from("cadastros-fotos").upload(path,arquivo,{contentType:arquivo.type||"application/octet-stream",upsert:false});
  if(upError) redirect(`/faturamento/lotes/${loteId}?erro=anexo-upload`);
  const { error }=await supabase.from("tiss_lote_anexos").insert({lote_id:loteId,tipo,nome_arquivo:arquivo.name,storage_path:path,mime_type:arquivo.type||null,tamanho_bytes:arquivo.size,observacao:text(formData,"observacao")||null,created_by:user.id});
  if(error) redirect(`/faturamento/lotes/${loteId}?erro=anexo-db`);
  revalidatePath(`/faturamento/lotes/${loteId}`);
}

export async function gerarXmlPreliminar(loteId: string) {
  const { supabase } = await getAssistencialContext();
  const { data: lote } = await supabase.from("tiss_lotes").select("id,numero_lote,convenio_id,versao:tiss_versoes(comunicacao_principal),guias:tiss_lote_guias(guia:tiss_guias(id,tipo_guia,numero_guia_prestador,registro_ans,numero_carteirinha,valor_total,itens:tiss_guia_itens(sequencial,tabela,codigo_procedimento,descricao,quantidade,valor_unitario,valor_total)))").eq("id", loteId).maybeSingle();
  if (!lote) redirect("/faturamento/lotes?erro=lote");
  const versaoRel = Array.isArray(lote.versao) ? lote.versao[0] : lote.versao;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!-- XML PRELIMINAR INTERNO. NAO ENVIAR. Requer montagem final conforme XSD oficial ANS e validacao XSD. -->
<medsync:tissPreliminar xmlns:medsync="urn:medsync:tiss:preliminar" lote="${lote.numero_lote}">
  <medsync:versaoComunicacao>${versaoRel?.comunicacao_principal ?? ""}</medsync:versaoComunicacao>
  <medsync:observacao>Estrutura interna de conferencia; nao representa mensagem TISS valida para operadora.</medsync:observacao>
</medsync:tissPreliminar>`;
  await supabase.from("tiss_xmls").delete().eq("lote_id", loteId).eq("tipo_mensagem", "PRELIMINAR_INTERNO");
  const { error } = await supabase.from("tiss_xmls").insert({ lote_id:loteId, tipo_mensagem:"PRELIMINAR_INTERNO", versao_comunicacao:versaoRel?.comunicacao_principal ?? "", xml_conteudo:xml, xsd_validado:false, erros_validacao:[{codigo:"XSD_PENDENTE",mensagem:"XSD oficial ainda não instalado/validado no gerador."}] });
  if (error) redirect(`/faturamento/lotes/${loteId}?erro=xml`);
  await supabase.from("tiss_lotes").update({ status:"invalido", xsd_validado:false, erros_validacao:[{codigo:"XSD_PENDENTE",mensagem:"Aguardando validador XSD oficial ANS."}] }).eq("id", loteId);
  revalidatePath(`/faturamento/lotes/${loteId}`);
  redirect(`/faturamento/lotes/${loteId}?xml=preliminar`);
}

export async function importarXmlManual(loteId: string, formData: FormData) {
  const { supabase, user, empresaId, unidadeId } = await getAssistencialContext();
  const arquivo = formData.get("arquivo_xml"); const tipoDocumento = text(formData,"tipo_documento") || "retorno_operadora"; const protocolo = text(formData,"protocolo_externo") || null; const observacoes = text(formData,"observacoes") || null;
  if (!(arquivo instanceof File) || arquivo.size <= 0 || arquivo.size > 10 * 1024 * 1024 || !arquivo.name.toLowerCase().endsWith(".xml")) redirect(`/faturamento/lotes/${loteId}?erro=xml-manual`);
  const xml = await arquivo.text(); const inicio = xml.trim().slice(0,200).toLowerCase(); if (!inicio.startsWith("<?xml") && !inicio.startsWith("<")) redirect(`/faturamento/lotes/${loteId}?erro=xml-invalido`);
  const { data: lote } = await supabase.from("tiss_lotes").select("id,convenio_id").eq("id",loteId).eq("unidade_id",unidadeId).maybeSingle(); if (!lote) redirect("/faturamento/lotes?erro=lote");
  const { error } = await supabase.from("tiss_operacoes_manuais").insert({ empresa_id:empresaId, unidade_id:unidadeId, convenio_id:lote.convenio_id, lote_id:loteId, direcao:"entrada", tipo_documento:tipoDocumento, nome_arquivo:arquivo.name, xml_conteudo:xml, origem:"importacao", xsd_validado:false, erros_validacao:[{codigo:"IMPORTADO_PENDENTE_VALIDACAO",mensagem:"XML importado manualmente e ainda não validado/processado."}], protocolo_externo:protocolo, observacoes, created_by:user.id });
  if (error) redirect(`/faturamento/lotes/${loteId}?erro=importar-xml`); revalidatePath(`/faturamento/lotes/${loteId}`); redirect(`/faturamento/lotes/${loteId}?manual=importado`);
}

export async function registrarEnvioManual(loteId: string, formData: FormData) {
  const { supabase, user, empresaId, unidadeId } = await getAssistencialContext();
  const xmlId = text(formData,"xml_id"); const protocolo = text(formData,"protocolo_externo") || null; const observacoes = text(formData,"observacoes") || null; if (!xmlId) redirect(`/faturamento/lotes/${loteId}?erro=xml-id`);
  const { data: xml } = await supabase.from("tiss_xmls").select("id,xml_conteudo,tipo_mensagem,xsd_validado").eq("id",xmlId).eq("lote_id",loteId).maybeSingle(); if (!xml || !xml.xsd_validado) redirect(`/faturamento/lotes/${loteId}?erro=xsd-obrigatorio`);
  const { data: lote } = await supabase.from("tiss_lotes").select("id,numero_lote,convenio_id").eq("id",loteId).eq("unidade_id",unidadeId).maybeSingle(); if (!lote) redirect("/faturamento/lotes?erro=lote");
  const nomeArquivo = `tiss-${lote.numero_lote}-${xml.tipo_mensagem}.xml`;
  const { error } = await supabase.from("tiss_operacoes_manuais").insert({ empresa_id:empresaId, unidade_id:unidadeId, convenio_id:lote.convenio_id, lote_id:loteId, direcao:"saida", tipo_documento:xml.tipo_mensagem, nome_arquivo:nomeArquivo, xml_conteudo:xml.xml_conteudo, origem:"manual", xsd_validado:true, protocolo_externo:protocolo, observacoes, processado:true, created_by:user.id });
  if (error) redirect(`/faturamento/lotes/${loteId}?erro=envio-manual`);
  await supabase.from("tiss_lotes").update({ status:"enviado", enviado_em:new Date().toISOString(), protocolo_operadora:protocolo }).eq("id",loteId); revalidatePath(`/faturamento/lotes/${loteId}`); redirect(`/faturamento/lotes/${loteId}?manual=enviado`);
}

export async function registrarProtocolo(loteId: string, formData: FormData) {
  const { supabase } = await getAssistencialContext();
  const numero=text(formData,"numero_protocolo");
  if(!numero) redirect(`/faturamento/lotes/${loteId}?erro=protocolo`);
  const { error }=await supabase.rpc("registrar_protocolo_tiss_transacional",{
    p_lote_id:loteId,
    p_numero_protocolo:numero,
    p_data_protocolo:nullable(text(formData,"data_protocolo")),
    p_status:text(formData,"status")||"recebido",
    p_valor_apresentado:money(formData,"valor_apresentado"),
    p_valor_processado:money(formData,"valor_processado"),
    p_valor_liberado:money(formData,"valor_liberado"),
    p_valor_glosa:money(formData,"valor_glosa"),
    p_observacoes:nullable(text(formData,"observacoes")),
  });
  if(error){console.error("[tiss] registrar protocolo",{code:error.code,operation:"registrar_protocolo_tiss_transacional"});redirect(`/faturamento/lotes/${loteId}?erro=protocolo`);}
  revalidatePath(`/faturamento/lotes/${loteId}`);
  revalidatePath(`/faturamento/lotes/${loteId}/financeiro`);
}

export async function registrarGlosa(loteId: string, formData: FormData) {
  const { supabase } = await getAssistencialContext();
  const codigo=text(formData,"codigo_glosa"); const valor=money(formData,"valor_glosado");
  if(!codigo||valor<=0) redirect(`/faturamento/lotes/${loteId}?erro=glosa`);
  const { error }=await supabase.rpc("registrar_glosa_tiss_transacional",{
    p_lote_id:loteId,
    p_protocolo_id:nullable(text(formData,"protocolo_id")),
    p_guia_id:nullable(text(formData,"guia_id")),
    p_guia_item_id:nullable(text(formData,"guia_item_id")),
    p_codigo_glosa:codigo,
    p_descricao_glosa:nullable(text(formData,"descricao_glosa")),
    p_valor_glosado:valor,
  });
  if(error){console.error("[tiss] registrar glosa",{code:error.code,operation:"registrar_glosa_tiss_transacional"});redirect(`/faturamento/lotes/${loteId}?erro=glosa`);}
  revalidatePath(`/faturamento/lotes/${loteId}`);
  revalidatePath(`/faturamento/lotes/${loteId}/financeiro`);
  revalidatePath("/faturamento/glosas");
}

export async function criarRecursoGlosa(formData: FormData) {
  const { supabase }=await getAssistencialContext();
  const glosaId=text(formData,"glosa_id"); const justificativa=text(formData,"justificativa"); const valor=money(formData,"valor_recursado");
  if(!glosaId||!justificativa||valor<=0) redirect("/faturamento/glosas?erro=campos");
  const { data,error }=await supabase.rpc("criar_recurso_glosa_tiss_transacional",{p_glosa_id:glosaId,p_justificativa:justificativa,p_valor_recursado:valor});
  if(error){
    console.error("[tiss] criar recurso de glosa",{code:error.code,operation:"criar_recurso_glosa_tiss_transacional"});
    const value=String(error.message??"");
    const motivo=value.includes("VALOR_EXCEDE")?"valor":value.includes("SEM_PERMISSAO")?"permissao":value.includes("NAO_ELEGIVEL")?"status":"recurso";
    redirect(`/faturamento/glosas?erro=${motivo}`);
  }
  const recursoId=typeof data==="string"?data:null;
  if(!recursoId) redirect("/faturamento/glosas?erro=recurso");
  revalidatePath("/faturamento/glosas");
  revalidatePath("/faturamento/recursos");
  redirect(`/faturamento/recursos/${recursoId}`);
}
