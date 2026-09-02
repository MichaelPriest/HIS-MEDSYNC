import type { TissSendRequest, TissSendResult, TissWebserviceConfig } from "./types";

function envSecret(reference: string | null | undefined) {
  if (!reference) return null;
  return process.env[reference] ?? null;
}

function usesLatin1(xml: string) {
  return /<\?xml[^>]*encoding=["']ISO-8859-1["']/i.test(xml);
}

function stripXmlDeclaration(xml: string) {
  return xml.replace(/^\s*<\?xml[^>]*\?>\s*/i, "");
}

function encodeBody(value: string, latin1: boolean): ArrayBuffer {
  const bytes = Buffer.from(value, latin1 ? "latin1" : "utf8");
  const body = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(body).set(bytes);
  return body;
}

function soapEnvelope(xml: string, config: TissWebserviceConfig, latin1: boolean) {
  const ns = config.namespace_operacao || "http://www.ans.gov.br/padroes/tiss/schemas";
  const operation = config.operacao_envio || "recepcaoLoteGuias";
  const encoding = latin1 ? "ISO-8859-1" : "UTF-8";
  return `<?xml version="1.0" encoding="${encoding}"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tiss="${ns}"><soapenv:Header/><soapenv:Body><tiss:${operation}>${stripXmlDeclaration(xml)}</tiss:${operation}></soapenv:Body></soapenv:Envelope>`;
}

export async function sendTiss(config: TissWebserviceConfig, request: TissSendRequest): Promise<TissSendResult> {
  if (config.transporte === "manual") return { ok: false, codigoErro: "TRANSPORTE_MANUAL", mensagemErro: "Operadora configurada para envio manual." };
  if (config.transporte === "sftp") return { ok: false, codigoErro: "SFTP_PENDENTE", mensagemErro: "Adapter SFTP preparado no contrato, mas ainda não habilitado." };
  if (!config.endpoint_url) return { ok: false, codigoErro: "ENDPOINT_AUSENTE", mensagemErro: "Endpoint do webservice não configurado." };

  const latin1 = usesLatin1(request.xml);
  const charset = latin1 ? "iso-8859-1" : "utf-8";
  const headers: Record<string, string> = { Accept: "application/xml, text/xml, */*" };
  let bodyText = request.xml;
  if (config.transporte === "soap") {
    headers["Content-Type"] = `text/xml; charset=${charset}`;
    if (config.soap_action) headers.SOAPAction = config.soap_action;
    bodyText = soapEnvelope(request.xml, config, latin1);
  } else {
    headers["Content-Type"] = `application/xml; charset=${charset}`;
  }
  const body = encodeBody(bodyText, latin1);

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
  const patterns = [
    /<(?:[A-Za-z_][\w.-]*:)?numeroProtocolo>([^<]+)<\/(?:[A-Za-z_][\w.-]*:)?numeroProtocolo>/i,
    /<(?:[A-Za-z_][\w.-]*:)?protocolo>([^<]+)<\/(?:[A-Za-z_][\w.-]*:)?protocolo>/i,
    /<(?:[A-Za-z_][\w.-]*:)?nrProtocolo>([^<]+)<\/(?:[A-Za-z_][\w.-]*:)?nrProtocolo>/i,
  ];
  for (const pattern of patterns) {
    const match = xml.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}
