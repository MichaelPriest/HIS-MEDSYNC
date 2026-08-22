export type ParsedEmail = { email: string; principal: boolean };
export type ParsedPhone = { telefone: string; tipo: "celular" | "residencial" | "comercial"; whatsapp: boolean; principal: boolean };
export type ParsedAddress = { cep: string | null; endereco: string; numero: string; complemento: string | null; bairro: string; cidade: string; estado: string; tipo: "residencial" | "comercial" | "outro"; principal: boolean };

function rows(formData: FormData, section: string) {
  const map = new Map<number, Record<string, string>>();
  const regex = new RegExp(`^${section}\\[(\\d+)\\]\\.([a-z_]+)$`);
  for (const [key, value] of formData.entries()) {
    const match = key.match(regex);
    if (!match || typeof value !== "string") continue;
    const index = Number(match[1]);
    const field = match[2];
    const current = map.get(index) ?? {};
    current[field] = value.trim();
    map.set(index, current);
  }
  return [...map.entries()].sort(([a], [b]) => a - b).map(([, value]) => value);
}

export function parseEmails(formData: FormData): ParsedEmail[] {
  return rows(formData, "emails").map((item, index) => ({ email: item.email ?? "", principal: index === 0 })).filter((item) => item.email);
}

export function parsePhones(formData: FormData): ParsedPhone[] {
  return rows(formData, "telefones").map((item, index) => ({ telefone: item.telefone ?? "", tipo: (item.tipo as ParsedPhone["tipo"]) || "celular", whatsapp: item.whatsapp === "1", principal: index === 0 })).filter((item) => item.telefone);
}

export function parseAddresses(formData: FormData): ParsedAddress[] {
  return rows(formData, "enderecos").map((item, index) => ({
    cep: (item.cep ?? "").replace(/\D/g, "") || null,
    endereco: item.endereco ?? "",
    numero: item.numero ?? "",
    complemento: item.complemento || null,
    bairro: item.bairro ?? "",
    cidade: item.cidade ?? "",
    estado: (item.estado ?? "").toUpperCase(),
    tipo: (item.tipo as ParsedAddress["tipo"]) || "residencial",
    principal: index === 0,
  })).filter((item) => item.endereco || item.numero || item.bairro || item.cidade || item.estado);
}

export function validateRequiredContacts(emails: ParsedEmail[], phones: ParsedPhone[], addresses: ParsedAddress[]) {
  if (!emails.length || !phones.length || !addresses.length) return false;
  return addresses.every((item) => item.endereco && item.numero && item.bairro && item.cidade && /^[A-Z]{2}$/.test(item.estado));
}
