export type NfseAmbiente = "homologacao" | "producao";

export const NFSE_PROVIDERS = {
  padrao_nacional: {
    label: "NFS-e Padrão Nacional / SEFIN",
    modo: "api" as const,
    authTipo: "mtls" as const,
    versao: "SNNFSe 1.01",
    homologacao: "https://sefin.producaorestrita.nfse.gov.br/SefinNacional",
    producao: "https://sefin.nfse.gov.br/SefinNacional",
    documentacao: "https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/apis-prod-restrita-e-producao",
  },
  abrasf: { label: "ABRASF / Prefeitura", modo: "webservice" as const, authTipo: "mtls" as const, versao: "Conforme município" },
  ginfes: { label: "GINFES", modo: "webservice" as const, authTipo: "mtls" as const, versao: "Conforme município" },
  issnet: { label: "ISS.Net", modo: "webservice" as const, authTipo: "mtls" as const, versao: "Conforme município" },
  simpliss: { label: "SimplISS", modo: "webservice" as const, authTipo: "mtls" as const, versao: "Conforme município" },
  betha: { label: "Betha", modo: "webservice" as const, authTipo: "mtls" as const, versao: "Conforme município" },
  outro: { label: "Outro provedor municipal", modo: "api" as const, authTipo: "nenhuma" as const, versao: "Conforme município" },
} as const;

export function nfseProviderDefaults(provedor: string | null | undefined, ambiente: NfseAmbiente) {
  if (provedor !== "padrao_nacional") return null;
  const p = NFSE_PROVIDERS.padrao_nacional;
  return {
    endpoint: ambiente === "producao" ? p.producao : p.homologacao,
    modo: p.modo,
    authTipo: p.authTipo,
    versao: p.versao,
  };
}

export function nfseNationalEndpoint(ambiente: NfseAmbiente, configured?: string | null) {
  if (configured?.trim()) return configured.replace(/\/$/, "");
  return ambiente === "producao" ? NFSE_PROVIDERS.padrao_nacional.producao : NFSE_PROVIDERS.padrao_nacional.homologacao;
}
