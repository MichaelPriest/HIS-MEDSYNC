export type TissTransport = "soap" | "http_xml" | "sftp" | "manual";
export type TissAuthType = "nenhuma" | "basic" | "bearer" | "cabecalho" | "certificado_mtls";

export type TissWebserviceConfig = {
  id: string;
  convenio_id: string;
  ambiente: "homologacao" | "producao";
  versao_comunicacao: string;
  transporte: TissTransport;
  endpoint_url: string | null;
  wsdl_url: string | null;
  soap_action: string | null;
  namespace_operacao: string | null;
  operacao_envio: string | null;
  operacao_status: string | null;
  operacao_cancelamento: string | null;
  operacao_retorno: string | null;
  tipo_autenticacao: TissAuthType;
  usuario: string | null;
  segredo_referencia: string | null;
  token_referencia: string | null;
  certificado_referencia: string | null;
  certificado_senha_referencia: string | null;
  header_nome: string | null;
  timeout_ms: number;
  validar_tls: boolean;
};

export type TissSendRequest = {
  xml: string;
  tipoOperacao: string;
  protocoloLocal: string;
};

export type TissSendResult = {
  ok: boolean;
  httpStatus?: number;
  protocoloOperadora?: string | null;
  respostaConteudo?: string | null;
  codigoErro?: string | null;
  mensagemErro?: string | null;
};
