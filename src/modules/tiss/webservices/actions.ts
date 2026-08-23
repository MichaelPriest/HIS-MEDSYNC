"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getAssistencialContext } from "@/modules/assistencial/context";
import { sendTiss } from "./adapter";
import type { TissWebserviceConfig } from "./types";

function optional(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? "").trim();
  return value || null;
}

export async function salvarConfiguracaoWebservice(formData: FormData) {
  const { supabase, user, empresaId, unidadeId } = await getAssistencialContext();
  const convenioId = String(formData.get("convenio_id") ?? "").trim();
  const ambiente = String(formData.get("ambiente") ?? "homologacao");
  const versao = String(formData.get("versao_comunicacao") ?? "04.03.00").trim();
  const transporte = String(formData.get("transporte") ?? "soap").trim();
  if (!convenioId || !["homologacao","producao"].includes(ambiente) || !["soap","http_xml","sftp","manual"].includes(transporte)) redirect("/configuracoes/tiss-webservices?erro=campos");

  const payload = {
    empresa_id: empresaId, unidade_id: unidadeId, convenio_id: convenioId, ambiente, ativo: formData.get("ativo") === "on",
    versao_comunicacao: versao, transporte, endpoint_url: optional(formData,"endpoint_url"), wsdl_url: optional(formData,"wsdl_url"),
    soap_action: optional(formData,"soap_action"), namespace_operacao: optional(formData,"namespace_operacao"), operacao_envio: optional(formData,"operacao_envio"),
    operacao_status: optional(formData,"operacao_status"), operacao_cancelamento: optional(formData,"operacao_cancelamento"), operacao_retorno: optional(formData,"operacao_retorno"),
    codigo_prestador_operadora: optional(formData,"codigo_prestador_operadora"), tipo_autenticacao: String(formData.get("tipo_autenticacao") ?? "nenhuma"), usuario: optional(formData,"usuario"),
    segredo_referencia: optional(formData,"segredo_referencia"), token_referencia: optional(formData,"token_referencia"), certificado_referencia: optional(formData,"certificado_referencia"),
    certificado_senha_referencia: optional(formData,"certificado_senha_referencia"), header_nome: optional(formData,"header_nome"), timeout_ms: Number(formData.get("timeout_ms") || 30000),
    validar_tls: formData.get("validar_tls") === "on", observacoes: optional(formData,"observacoes"), updated_by: user.id,
  };
  const { data: existente } = await supabase.from("tiss_webservice_configuracoes").select("id").eq("convenio_id", convenioId).eq("ambiente", ambiente).maybeSingle();
  const result = existente ? await supabase.from("tiss_webservice_configuracoes").update(payload).eq("id", existente.id) : await supabase.from("tiss_webservice_configuracoes").insert({ ...payload, created_by: user.id });
  if (result.error) redirect("/configuracoes/tiss-webservices?erro=salvar");
  revalidatePath("/configuracoes/tiss-webservices");
  redirect("/configuracoes/tiss-webservices?sucesso=1");
}

export async function enviarLoteWebservice(loteId: string) {
  const { supabase, user, empresaId, unidadeId } = await getAssistencialContext();
  const { data: lote } = await supabase.from("tiss_lotes").select("id,convenio_id,status,xmls:tiss_xmls(id,xml_conteudo,xsd_validado,versao_comunicacao,created_at)").eq("id", loteId).maybeSingle();
  if (!lote) redirect("/faturamento/lotes?erro=lote");
  const xmls = Array.isArray(lote.xmls) ? lote.xmls : [];
  const xml = xmls.filter((x) => x.xsd_validado).sort((a,b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
  if (!xml) redirect(`/faturamento/lotes/${loteId}?erro=xsd-obrigatorio`);
  const { data: config } = await supabase.from("tiss_webservice_configuracoes").select("*").eq("convenio_id", lote.convenio_id).eq("ambiente", "producao").eq("ativo", true).maybeSingle();
  if (!config) redirect(`/faturamento/lotes/${loteId}?erro=webservice-config`);

  const protocoloLocal = `TX-${Date.now()}`;
  const { data: tx } = await supabase.from("tiss_webservice_transacoes").insert({ empresa_id: empresaId, unidade_id: unidadeId, convenio_id: lote.convenio_id, configuracao_id: config.id, lote_id: loteId, xml_id: xml.id, tipo_operacao: "envio_lote", ambiente: config.ambiente, endpoint_url: config.endpoint_url, protocolo_local: protocoloLocal, status: "enviando", tentativas: 1, iniciado_em: new Date().toISOString(), created_by: user.id }).select("id").single();
  if (!tx) redirect(`/faturamento/lotes/${loteId}?erro=transacao`);

  const result = await sendTiss(config as TissWebserviceConfig, { xml: xml.xml_conteudo, tipoOperacao: "envio_lote", protocoloLocal });
  await supabase.from("tiss_webservice_transacoes").update({ status: result.ok ? "enviado" : result.codigoErro === "TIMEOUT" ? "timeout" : "erro", http_status: result.httpStatus ?? null, protocolo_operadora: result.protocoloOperadora ?? null, resposta_conteudo: result.respostaConteudo ?? null, codigo_erro: result.codigoErro ?? null, mensagem_erro: result.mensagemErro ?? null, finalizado_em: new Date().toISOString() }).eq("id", tx.id);
  if (result.ok) await supabase.from("tiss_lotes").update({ status: "enviado", enviado_em: new Date().toISOString(), protocolo_operadora: result.protocoloOperadora ?? null }).eq("id", loteId);
  revalidatePath(`/faturamento/lotes/${loteId}`);
  redirect(`/faturamento/lotes/${loteId}?${result.ok ? "enviado=1" : "erro=envio"}`);
}
