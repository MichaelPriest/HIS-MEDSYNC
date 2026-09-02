"use server";

import { revalidatePath } from "next/cache";
import type { BackgroundActionState } from "@/lib/actions/background-action";
import { getAssistencialContext } from "@/modules/assistencial/context";
import { TISS_XSD_VERSION, validateTissXmlXsd } from "@/modules/tiss/xsd-validator";

export type TissLotActionData = {
  kind: "protocol" | "denial" | "import-xml" | "manual-send" | "preliminary-xml" | "xsd-validation";
  xmlId?: string;
  valid?: boolean;
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
    .select("id,convenio_id,versao:tiss_versoes(comunicacao_principal)")
    .eq("id", loteId)
    .eq("unidade_id", unidadeId)
    .maybeSingle();
  if (!lote) return { status: "error", code: "lote", message: "Lote não localizado na unidade ativa." };

  const versaoRel = Array.isArray(lote.versao) ? lote.versao[0] : lote.versao;
  const versao = String(versaoRel?.comunicacao_principal ?? "");
  const validation = versao === TISS_XSD_VERSION
    ? await validateTissXmlXsd(xml)
    : {
        valid: false,
        errors: [{ codigo: "XSD_VERSAO_NAO_SUPORTADA", mensagem: `Validador instalado para ${TISS_XSD_VERSION}; XML do lote usa ${versao || "versão não informada"}.` }],
      };

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
    xsd_validado: validation.valid,
    erros_validacao: validation.errors,
    protocolo_externo: text(formData, "protocolo_externo") || null,
    observacoes: text(formData, "observacoes") || null,
    processado: validation.valid,
    created_by: user.id,
  });
  if (error) {
    console.error("[tiss.lote.background] importar xml", { code: error.code });
    return { status: "error", code: "importar-xml", message: "Não foi possível registrar o XML manual." };
  }

  refreshLot(loteId);
  return {
    status: "success",
    code: validation.valid ? "xml-importado-validado" : "xml-importado-invalido",
    message: validation.valid
      ? `XML importado e validado contra o XSD ANS ${TISS_XSD_VERSION}.`
      : `XML importado, mas não passou no XSD ANS ${TISS_XSD_VERSION}. Revise o histórico de validação.`,
    data: { kind: "import-xml", valid: validation.valid },
  };
}

export async function registrarEnvioManualTissBackground(
  loteId: string,
  _previous: BackgroundActionState<TissLotActionData>,
  formData: FormData,
): Promise<BackgroundActionState<TissLotActionData>> {
  const { supabase } = await getAssistencialContext();
  const xmlId = text(formData, "xml_id");
  if (!xmlId) return { status: "error", code: "xml-id", message: "Selecione um XML validado para registrar o envio." };

  const { error } = await supabase.rpc("registrar_envio_manual_tiss_operacional", {
    p_lote_id: loteId,
    p_xml_id: xmlId,
    p_protocolo: text(formData, "protocolo_externo") || null,
    p_observacoes: text(formData, "observacoes") || null,
  });
  if (error) {
    const value = String(error.message ?? "");
    const message = value.includes("TISS_XSD_OBRIGATORIO")
      ? "O envio manual só pode ser registrado para XML validado pelo XSD aplicável."
      : value.includes("TISS_XML_PRELIMINAR_NAO_ENVIAVEL")
        ? "O XML preliminar interno nunca pode ser enviado à operadora."
        : value.includes("TISS_ENVIO_SEM_PERMISSAO")
          ? "Seu perfil não possui permissão para registrar o envio TISS."
          : "Não foi possível registrar o envio manual.";
    console.error("[tiss.lote.background] registrar envio manual", { code: error.code });
    return { status: "error", code: "envio-manual", message };
  }

  refreshLot(loteId);
  return { status: "success", code: "envio-manual", message: "Envio manual registrado pelo fluxo transacional com trilha de auditoria.", data: { kind: "manual-send" } };
}

export async function validarXmlLoteTissBackground(
  loteId: string,
  xmlId: string,
  _previous: BackgroundActionState<TissLotActionData>,
  _formData: FormData,
): Promise<BackgroundActionState<TissLotActionData>> {
  void _previous;
  void _formData;
  const { supabase } = await getAssistencialContext();
  const { data: xml } = await supabase
    .from("tiss_xmls")
    .select("id,lote_id,tipo_mensagem,versao_comunicacao,xml_conteudo")
    .eq("id", xmlId)
    .eq("lote_id", loteId)
    .maybeSingle();

  if (!xml) return { status: "error", code: "xml", message: "XML não localizado neste lote." };
  if (xml.tipo_mensagem === "PRELIMINAR_INTERNO") {
    return { status: "error", code: "preliminar", message: "O artefato preliminar não é uma mensagem TISS e não pode receber selo XSD." };
  }
  if (xml.versao_comunicacao !== TISS_XSD_VERSION) {
    return { status: "error", code: "versao", message: `O validador instalado é ${TISS_XSD_VERSION}; este XML declara ${xml.versao_comunicacao}.` };
  }

  const validation = await validateTissXmlXsd(xml.xml_conteudo);
  const { error } = await supabase.rpc("registrar_validacao_xsd_tiss_operacional", {
    p_xml_id: xmlId,
    p_xsd_validado: validation.valid,
    p_erros: validation.errors,
    p_hash: validation.hashSha256,
    p_versao: validation.version,
  });
  if (error) {
    console.error("[tiss.lote.background] persistir validacao xsd", { code: error.code });
    return { status: "error", code: "persistencia-xsd", message: "A validação foi executada, mas o resultado não pôde ser persistido de forma transacional." };
  }

  refreshLot(loteId);
  return {
    status: validation.valid ? "success" : "error",
    code: validation.valid ? "xsd-valido" : "xsd-invalido",
    message: validation.valid
      ? `XML válido contra o XSD ANS ${TISS_XSD_VERSION}. O envio foi desbloqueado para este artefato.`
      : `XML inválido contra o XSD ANS ${TISS_XSD_VERSION}. ${validation.errors[0]?.mensagem ?? "Revise a estrutura da mensagem."}`,
    data: { kind: "xsd-validation", xmlId, valid: validation.valid },
  };
}

export async function gerarXmlPreliminarTissBackground(
  loteId: string,
  _previous: BackgroundActionState<TissLotActionData>,
  _formData: FormData,
): Promise<BackgroundActionState<TissLotActionData>> {
  void _previous;
  void _formData;
  const { supabase } = await getAssistencialContext();
  const { data: lote } = await supabase
    .from("tiss_lotes")
    .select("id,numero_lote,versao:tiss_versoes(comunicacao_principal)")
    .eq("id", loteId)
    .maybeSingle();
  if (!lote) return { status: "error", code: "lote", message: "Lote não localizado." };

  const versaoRel = Array.isArray(lote.versao) ? lote.versao[0] : lote.versao;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<!-- ARTEFATO PRELIMINAR INTERNO. NAO ENVIAR. -->\n<medsync:tissPreliminar xmlns:medsync="urn:medsync:tiss:preliminar" lote="${lote.numero_lote}">\n  <medsync:versaoComunicacao>${versaoRel?.comunicacao_principal ?? ""}</medsync:versaoComunicacao>\n  <medsync:observacao>Estrutura interna de conferencia; nao representa mensagem TISS valida para operadora.</medsync:observacao>\n</medsync:tissPreliminar>`;

  await supabase.from("tiss_xmls").delete().eq("lote_id", loteId).eq("tipo_mensagem", "PRELIMINAR_INTERNO");
  const pendingValidation = [{ codigo: "ARTEFATO_PRELIMINAR", mensagem: "Artefato interno não elegível a validação XSD ou envio." }];
  const { error } = await supabase.from("tiss_xmls").insert({
    lote_id: loteId,
    tipo_mensagem: "PRELIMINAR_INTERNO",
    versao_comunicacao: versaoRel?.comunicacao_principal ?? "",
    xml_conteudo: xml,
    xsd_validado: false,
    erros_validacao: pendingValidation,
  });
  if (error) return { status: "error", code: "xml", message: "Não foi possível gerar o artefato preliminar interno." };

  await supabase.from("tiss_lotes").update({ status: "invalido", xsd_validado: false, erros_validacao: pendingValidation }).eq("id", loteId);
  refreshLot(loteId);
  return {
    status: "success",
    code: "preliminar",
    message: "Artefato preliminar interno gerado. O XSD ANS está instalado, mas este artefato não é uma mensagem TISS enviável.",
    data: { kind: "preliminary-xml" },
  };
}
