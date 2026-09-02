"use server";

import { revalidatePath } from "next/cache";
import type { BackgroundActionState } from "@/lib/actions/background-action";
import { getAssistencialContext } from "@/modules/assistencial/context";

export type TissLotActionData = {
  kind: "protocol" | "denial" | "import-xml" | "manual-send" | "preliminary-xml";
};

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function money(formData: FormData, key: string) {
  const raw = text(formData, key).replace(/\./g, "").replace(",", ".");
  const value = Number(raw || 0);
  return Number.isFinite(value) ? value : 0;
}

function nullable(value: string) {
  return value || null;
}

function refreshLot(loteId: string) {
  revalidatePath("/faturamento");
  revalidatePath("/faturamento/lotes");
  revalidatePath(`/faturamento/lotes/${loteId}`);
  revalidatePath(`/faturamento/lotes/${loteId}/financeiro`);
  revalidatePath("/faturamento/glosas");
  revalidatePath("/financeiro");
  revalidatePath("/financeiro/recebiveis");
}

export async function registrarProtocoloTissBackground(
  loteId: string,
  _previous: BackgroundActionState<TissLotActionData>,
  formData: FormData,
): Promise<BackgroundActionState<TissLotActionData>> {
  const { supabase } = await getAssistencialContext();
  const numero = text(formData, "numero_protocolo");
  if (!numero) return { status: "error", code: "protocolo", message: "Informe o número do protocolo." };

  const { error } = await supabase.rpc("registrar_protocolo_tiss_transacional", {
    p_lote_id: loteId,
    p_numero_protocolo: numero,
    p_data_protocolo: nullable(text(formData, "data_protocolo")),
    p_status: text(formData, "status") || "recebido",
    p_valor_apresentado: money(formData, "valor_apresentado"),
    p_valor_processado: money(formData, "valor_processado"),
    p_valor_liberado: money(formData, "valor_liberado"),
    p_valor_glosa: money(formData, "valor_glosa"),
    p_observacoes: nullable(text(formData, "observacoes")),
  });
  if (error) {
    console.error("[tiss.lote.background] registrar protocolo", { code: error.code });
    return { status: "error", code: "protocolo", message: "Não foi possível registrar o protocolo. Os campos foram preservados." };
  }

  refreshLot(loteId);
  return { status: "success", code: "protocolo", message: "Protocolo registrado e financeiro atualizado.", data: { kind: "protocol" } };
}

export async function registrarGlosaTissBackground(
  loteId: string,
  _previous: BackgroundActionState<TissLotActionData>,
  formData: FormData,
): Promise<BackgroundActionState<TissLotActionData>> {
  const { supabase } = await getAssistencialContext();
  const codigo = text(formData, "codigo_glosa");
  const valor = money(formData, "valor_glosado");
  if (!codigo || valor <= 0) return { status: "error", code: "glosa", message: "Informe código e valor da glosa." };

  const { error } = await supabase.rpc("registrar_glosa_tiss_transacional", {
    p_lote_id: loteId,
    p_protocolo_id: nullable(text(formData, "protocolo_id")),
    p_guia_id: nullable(text(formData, "guia_id")),
    p_guia_item_id: nullable(text(formData, "guia_item_id")),
    p_codigo_glosa: codigo,
    p_descricao_glosa: nullable(text(formData, "descricao_glosa")),
    p_valor_glosado: valor,
  });
  if (error) {
    console.error("[tiss.lote.background] registrar glosa", { code: error.code });
    return { status: "error", code: "glosa", message: "Não foi possível registrar a glosa. Os campos foram preservados." };
  }

  refreshLot(loteId);
  return { status: "success", code: "glosa", message: "Glosa registrada e enviada para a fila de recuperação de receita.", data: { kind: "denial" } };
}

export async function importarXmlManualTissBackground(
  loteId: string,
  _previous: BackgroundActionState<TissLotActionData>,
  formData: FormData,
): Promise<BackgroundActionState<TissLotActionData>> {
  const { supabase, user, empresaId, unidadeId } = await getAssistencialContext();
  const arquivo = formData.get("arquivo_xml");
  if (!(arquivo instanceof File) || arquivo.size <= 0 || arquivo.size > 10 * 1024 * 1024 || !arquivo.name.toLowerCase().endsWith(".xml")) {
    return { status: "error", code: "xml-manual", message: "Selecione um arquivo XML válido de até 10 MB." };
  }

  const xml = await arquivo.text();
  const inicio = xml.trim().slice(0, 200).toLowerCase();
  if (!inicio.startsWith("<?xml") && !inicio.startsWith("<")) {
    return { status: "error", code: "xml-invalido", message: "O arquivo informado não possui estrutura XML reconhecível." };
  }

  const { data: lote } = await supabase
    .from("tiss_lotes")
    .select("id,convenio_id")
    .eq("id", loteId)
    .eq("unidade_id", unidadeId)
    .maybeSingle();
  if (!lote) return { status: "error", code: "lote", message: "Lote não localizado na unidade ativa." };

  const { error } = await supabase.from("tiss_operacoes_manuais").insert({
    empresa_id: empresaId,
    unidade_id: unidadeId,
    convenio_id: lote.convenio_id,
    lote_id: loteId,
    direcao: "entrada",
    tipo_documento: text(formData, "tipo_documento") || "retorno_operadora",
    nome_arquivo: arquivo.name,
    xml_conteudo: xml,
    origem: "importacao",
    xsd_validado: false,
    erros_validacao: [{ codigo: "IMPORTADO_PENDENTE_VALIDACAO", mensagem: "XML importado manualmente e ainda não validado/processado." }],
    protocolo_externo: text(formData, "protocolo_externo") || null,
    observacoes: text(formData, "observacoes") || null,
    created_by: user.id,
  });
  if (error) {
    console.error("[tiss.lote.background] importar xml", { code: error.code });
    return { status: "error", code: "importar-xml", message: "Não foi possível registrar o XML manual." };
  }

  refreshLot(loteId);
  return { status: "success", code: "xml-importado", message: "XML importado como pendente de validação e processamento.", data: { kind: "import-xml" } };
}

export async function registrarEnvioManualTissBackground(
  loteId: string,
  _previous: BackgroundActionState<TissLotActionData>,
  formData: FormData,
): Promise<BackgroundActionState<TissLotActionData>> {
  const { supabase, user, empresaId, unidadeId } = await getAssistencialContext();
  const xmlId = text(formData, "xml_id");
  if (!xmlId) return { status: "error", code: "xml-id", message: "Selecione um XML validado para registrar o envio." };

  const { data: xml } = await supabase
    .from("tiss_xmls")
    .select("id,xml_conteudo,tipo_mensagem,xsd_validado")
    .eq("id", xmlId)
    .eq("lote_id", loteId)
    .maybeSingle();
  if (!xml || !xml.xsd_validado) {
    return { status: "error", code: "xsd-obrigatorio", message: "O envio manual só pode ser registrado para XML validado pelo XSD aplicável." };
  }

  const { data: lote } = await supabase
    .from("tiss_lotes")
    .select("id,numero_lote,convenio_id")
    .eq("id", loteId)
    .eq("unidade_id", unidadeId)
    .maybeSingle();
  if (!lote) return { status: "error", code: "lote", message: "Lote não localizado na unidade ativa." };

  const protocolo = text(formData, "protocolo_externo") || null;
  const { error } = await supabase.from("tiss_operacoes_manuais").insert({
    empresa_id: empresaId,
    unidade_id: unidadeId,
    convenio_id: lote.convenio_id,
    lote_id: loteId,
    direcao: "saida",
    tipo_documento: xml.tipo_mensagem,
    nome_arquivo: `tiss-${lote.numero_lote}-${xml.tipo_mensagem}.xml`,
    xml_conteudo: xml.xml_conteudo,
    origem: "manual",
    xsd_validado: true,
    protocolo_externo: protocolo,
    observacoes: text(formData, "observacoes") || null,
    processado: true,
    created_by: user.id,
  });
  if (error) {
    console.error("[tiss.lote.background] registrar envio manual", { code: error.code });
    return { status: "error", code: "envio-manual", message: "Não foi possível registrar o envio manual." };
  }

  const { error: statusError } = await supabase
    .from("tiss_lotes")
    .update({ status: "enviado", enviado_em: new Date().toISOString(), protocolo_operadora: protocolo })
    .eq("id", loteId);
  if (statusError) {
    console.error("[tiss.lote.background] atualizar lote após envio manual", { code: statusError.code });
    return { status: "error", code: "status-lote", message: "O envio foi registrado, mas o status do lote não pôde ser atualizado. Revise a trilha manual." };
  }

  refreshLot(loteId);
  return { status: "success", code: "envio-manual", message: "Envio manual registrado com trilha de auditoria.", data: { kind: "manual-send" } };
}

export async function gerarXmlPreliminarTissBackground(
  loteId: string,
  _previous: BackgroundActionState<TissLotActionData>,
  _formData: FormData,
): Promise<BackgroundActionState<TissLotActionData>> {
  const { supabase } = await getAssistencialContext();
  const { data: lote } = await supabase
    .from("tiss_lotes")
    .select("id,numero_lote,versao:tiss_versoes(comunicacao_principal)")
    .eq("id", loteId)
    .maybeSingle();
  if (!lote) return { status: "error", code: "lote", message: "Lote não localizado." };

  const versaoRel = Array.isArray(lote.versao) ? lote.versao[0] : lote.versao;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<!-- XML PRELIMINAR INTERNO. NAO ENVIAR. Requer montagem final conforme XSD oficial ANS e validacao XSD. -->\n<medsync:tissPreliminar xmlns:medsync="urn:medsync:tiss:preliminar" lote="${lote.numero_lote}">\n  <medsync:versaoComunicacao>${versaoRel?.comunicacao_principal ?? ""}</medsync:versaoComunicacao>\n  <medsync:observacao>Estrutura interna de conferencia; nao representa mensagem TISS valida para operadora.</medsync:observacao>\n</medsync:tissPreliminar>`;

  await supabase.from("tiss_xmls").delete().eq("lote_id", loteId).eq("tipo_mensagem", "PRELIMINAR_INTERNO");
  const pendingValidation = [{ codigo: "XSD_PENDENTE", mensagem: "XSD oficial ainda não instalado/validado no gerador." }];
  const { error } = await supabase.from("tiss_xmls").insert({
    lote_id: loteId,
    tipo_mensagem: "PRELIMINAR_INTERNO",
    versao_comunicacao: versaoRel?.comunicacao_principal ?? "",
    xml_conteudo: xml,
    xsd_validado: false,
    erros_validacao: pendingValidation,
  });
  if (error) return { status: "error", code: "xml", message: "Não foi possível gerar o XML preliminar interno." };

  await supabase.from("tiss_lotes").update({ status: "invalido", xsd_validado: false, erros_validacao: pendingValidation }).eq("id", loteId);
  refreshLot(loteId);
  return {
    status: "success",
    code: "preliminar",
    message: "XML preliminar interno gerado. Ele continua bloqueado para envio até validação XSD oficial.",
    data: { kind: "preliminary-xml" },
  };
}
