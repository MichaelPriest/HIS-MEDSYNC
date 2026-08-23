import type { TissSendRequest, TissSendResult, TissWebserviceConfig } from "./types";

function envSecret(reference: string | null | undefined) {
  if (!reference) return null;
  return process.env[reference] ?? null;
}

function soapEnvelope(xml: string, config: TissWebserviceConfig) {
  const ns = config.namespace_operacao || "http://www.ans.gov.br/padroes/tiss/schemas";
  const operation = config.operacao_envio || "recepcaoLoteGuias";
  return `<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tiss="${ns}"><soapenv:Header/><soapenv:Body><tiss:${operation}>${xml}</tiss:${operation}></soapenv:Body></soapenv:Envelope>`;
}

export async function sendTiss(config: TissWebserviceConfig, request: TissSendRequest): Promise<TissSendResult> {
  if (config.transporte === "manual") return { ok: false, codigoErro: "TRANSPORTE_MANUAL", mensagemErro: "Operadora configurada para envio manual." };
  if (config.transporte === "sftp") return { ok: false, codigoErro: "SFTP_PENDENTE", mensagemErro: "Adapter SFTP preparado no contrato, mas ainda não habilitado." };
  if (!config.endpoint_url) return { ok: false, codigoErro: "ENDPOINT_AUSENTE", mensagemErro: "Endpoint do webservice não configurado." };

  const headers: Record<string, string> = { Accept: "application/xml, text/xml, */*" };
  let body = request.xml;
  if (config.transporte === "soap") {
    headers["Content-Type"] = "text/xml; charset=utf-8";
    if (config.soap_action) headers.SOAPAction = config.soap_action;
    body = soapEnvelope(request.xml, config);
  } else {
    headers["Content-Type"] = "application/xml; charset=utf-8";
  }

  if (config.tipo_autenticacao === "basic") {
    const secret = envSecret(config.segredo_referencia);
    if (!config.usuario || !secret) return { ok: false, codigoErro: "CREDENCIAL_AUSENTE", mensagemErro: "Usuário ou segredo da operadora não disponível." };
    headers.Authorization = `Basic ${Buffer.from(`${config.usuario}:${secret}`).toString("base64")}`;
  }
  if (config.tipo_autenticacao === "bearer") {
    const token = envSecret(config.token_referencia);
    if (!token) return { ok: false, codigoErro: "TOKEN_AUSENTE", mensagemErro: "Token da operadora não disponível." };
    headers.Authorization = `Bearer ${token}`;
  }
  if (config.tipo_autenticacao === "cabecalho") {
    const secret = envSecret(config.segredo_referencia);
    if (!config.header_nome || !secret) return { ok: false, codigoErro: "CABECALHO_AUSENTE", mensagemErro: "Cabeçalho customizado não configurado." };
    headers[config.header_nome] = secret;
  }
  if (config.tipo_autenticacao === "certificado_mtls") {
    return { ok: false, codigoErro: "MTLS_REQUER_ADAPTER", mensagemErro: "mTLS requer runtime/agent HTTPS com certificado cliente; configuração está preparada, envio ainda bloqueado." };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeout_ms || 30000);
  try {
    const response = await fetch(config.endpoint_url, { method: "POST", headers, body, signal: controller.signal, cache: "no-store" });
    const text = await response.text();
    return { ok: response.ok, httpStatus: response.status, respostaConteudo: text, protocoloOperadora: extractProtocol(text), codigoErro: response.ok ? null : `HTTP_${response.status}`, mensagemErro: response.ok ? null : `Operadora respondeu HTTP ${response.status}.` };
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return { ok: false, codigoErro: aborted ? "TIMEOUT" : "TRANSPORTE_ERRO", mensagemErro: error instanceof Error ? error.message : "Falha ao comunicar com a operadora." };
  } finally {
    clearTimeout(timer);
  }
}

function extractProtocol(xml: string) {
  const patterns = [/<numeroProtocolo>([^<]+)<\/numeroProtocolo>/i, /<protocolo>([^<]+)<\/protocolo>/i, /<nrProtocolo>([^<]+)<\/nrProtocolo>/i];
  for (const pattern of patterns) {
    const match = xml.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}
