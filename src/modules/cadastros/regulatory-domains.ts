export type RegulatoryOption = { code: string; label: string };

export const BRAZIL_UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

export type BrazilUf = (typeof BRAZIL_UFS)[number];

export const TISS_COUNCIL_ABBREVIATIONS: Record<string, string> = {
  "01": "CRESS",
  "02": "COREN",
  "03": "CRF",
  "04": "CREFONO",
  "05": "CREFITO",
  "06": "CRM",
  "07": "CRN",
  "08": "CRO",
  "09": "CRP",
  "10": "OUTROS",
  "11": "CRBio",
  "12": "CRBM",
  "13": "CREF",
  "14": "CRMV",
  "15": "CRTR",
};

export function isBrazilUf(value: string | null | undefined): value is BrazilUf {
  return BRAZIL_UFS.includes(String(value ?? "").toUpperCase() as BrazilUf);
}

export function councilAbbreviation(code: string | null | undefined) {
  return TISS_COUNCIL_ABBREVIATIONS[String(code ?? "")] ?? null;
}

/**
 * Sugestão de UX baseada apenas em famílias ocupacionais de associação inequívoca.
 * A seleção continua editável e o servidor valida o conselho escolhido contra a TUSS 26.
 */
export function suggestCouncilCodeForCbo(cbo: string | null | undefined): string | null {
  const code = String(cbo ?? "").replace(/\D/g, "");
  if (!/^\d{6}$/.test(code) || code === "999999") return null;
  if (code.startsWith("225")) return "06"; // médicos
  if (code.startsWith("2232")) return "08"; // odontologia
  if (code.startsWith("2234")) return "03"; // farmácia
  if (code.startsWith("2235") || ["322205", "322220", "322230"].includes(code)) return "02"; // enfermagem
  if (code.startsWith("2236") || code === "223905") return "05"; // fisioterapia / TO
  if (["223705", "223710"].includes(code)) return "07"; // nutrição
  if (code.startsWith("2238")) return "04"; // fonoaudiologia
  if (["251510", "251545", "251555"].includes(code)) return "09"; // psicologia
  if (code === "251605") return "01"; // serviço social
  if (code === "221205") return "12"; // biomedicina
  if (code === "221105") return "11"; // biologia
  if (code.startsWith("2241")) return "13"; // educação física
  return null;
}
