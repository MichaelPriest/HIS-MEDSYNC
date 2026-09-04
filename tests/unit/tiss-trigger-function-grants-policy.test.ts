import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("TISS / grants da trigger interna de habilitação profissional", () => {
  it("mantém a validação como trigger interna da tabela profissionais", () => {
    const source = read("supabase/migrations/20260902202239_tiss_profissional_dominios_cbo_conselho.sql");
    expect(source).toContain("validar_habilitacao_tiss_profissional_internal");
    expect(source).toContain("profissionais_validar_habilitacao_tiss_trg");
    expect(source).toMatch(/before\s+insert\s+or\s+update/i);
  });

  it("remove execução direta de public, anon e authenticated", () => {
    const migration = read("supabase/migrations/20260903150601_hardening_tiss_trigger_function_grants.sql");
    expect(migration).toContain("revoke all on function public.validar_habilitacao_tiss_profissional_internal()");
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).not.toMatch(/grant\s+execute[^;]+authenticated/i);
    expect(migration).not.toMatch(/grant\s+execute[^;]+anon/i);
  });
});
