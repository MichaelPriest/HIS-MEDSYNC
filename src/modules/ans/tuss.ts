const ANS_TUSS_BASE = "https://consulta-ocl.apps.sa-1a.mendixcloud.com/rest/oclservice/ANS";

export type AnsTussConcept = {
  code: string;
  description: string;
  table: string;
  raw: Record<string, unknown>;
};

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function text(value: unknown): string | null {
  if (typeof value === "string" || typeof value === "number") {
    const result = String(value).trim();
    return result || null;
  }
  return null;
}

function firstText(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = text(row[key]);
    if (value) return value;
  }
  return null;
}

function extractDescription(row: Record<string, unknown>) {
  const direct = firstText(row, ["description", "descricao", "display_name", "displayName", "name", "term", "label"]);
  if (direct) return direct;
  const names = row.names;
  if (Array.isArray(names)) {
    for (const candidate of names) {
      const item = object(candidate);
      if (!item) continue;
      const value = firstText(item, ["name", "display_name", "displayName", "description", "locale_preferred"]);
      if (value) return value;
    }
  }
  return "Sem descrição retornada pela ANS";
}

function extractCode(row: Record<string, unknown>) {
  return firstText(row, ["code", "codigo", "mnemonic", "external_id", "externalId", "concept_code", "conceptCode", "id"]);
}

function arrayCandidates(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload.map(object).filter((item): item is Record<string, unknown> => Boolean(item));
  const root = object(payload);
  if (!root) return [];
  for (const key of ["rows", "results", "data", "items", "concepts", "entries", "content"]) {
    const value = root[key];
    if (Array.isArray(value)) return value.map(object).filter((item): item is Record<string, unknown> => Boolean(item));
    const nested = object(value);
    if (nested) {
      for (const nestedKey of ["rows", "results", "items", "concepts", "entries", "content"]) {
        if (Array.isArray(nested[nestedKey])) return (nested[nestedKey] as unknown[]).map(object).filter((item): item is Record<string, unknown> => Boolean(item));
      }
    }
  }
  return [];
}

export async function buscarConceitosTuss(table: string, query: string, page = 1): Promise<AnsTussConcept[]> {
  if (!/^(18|19|20|22)$/.test(table)) return [];
  const q = query.trim().slice(0, 100);
  if (q.length < 2) return [];
  const url = new URL(`${ANS_TUSS_BASE}/concepts/tuss-${table}`);
  url.searchParams.set("page", String(Math.max(1, page)));
  url.searchParams.set("q", q);

  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json", "User-Agent": "MedSync-HIS/1.0 TUSS-ANS" },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`ANS_TUSS_HTTP_${response.status}`);
  const payload: unknown = await response.json();
  return arrayCandidates(payload).map((row) => ({
    code: extractCode(row) ?? "",
    description: extractDescription(row),
    table,
    raw: row,
  })).filter((item) => item.code && item.description);
}

export async function buscarConceitoTussExato(table: string, code: string) {
  const results = await buscarConceitosTuss(table, code, 1);
  const target = code.trim().toLowerCase();
  return results.find((item) => item.code.trim().toLowerCase() === target) ?? null;
}

export const ansTussApi = {
  baseUrl: ANS_TUSS_BASE,
  documentationUrl: "https://consulta-ocl.apps.sa-1a.mendixcloud.com/rest-doc/rest/oclservice#/",
  supportedTables: ["18", "19", "20", "22"] as const,
};
