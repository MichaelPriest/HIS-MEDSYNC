import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BRAZIL_UFS, councilAbbreviation, suggestCouncilCodeForCbo } from "@/modules/cadastros/regulatory-domains";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("domínios regulatórios do profissional", () => {
  it("mantém exatamente as 27 UFs brasileiras", () => {
    expect(BRAZIL_UFS).toHaveLength(27);
    expect(new Set(BRAZIL_UFS).size).toBe(27);
    expect(BRAZIL_UFS).toContain("SP");
    expect(BRAZIL_UFS).toContain("DF");
    expect(BRAZIL_UFS).not.toContain("XX");
  });

  it("mapeia conselhos ANS conhecidos sem inventar vínculo ambíguo", () => {
    expect(councilAbbreviation("06")).toBe("CRM");
    expect(councilAbbreviation("02")).toBe("COREN");
    expect(councilAbbreviation("04")).toBe("CREFONO");
    expect(suggestCouncilCodeForCbo("225125")).toBe("06");
    expect(suggestCouncilCodeForCbo("223505")).toBe("02");
    expect(suggestCouncilCodeForCbo("251510")).toBe("09");
    expect(suggestCouncilCodeForCbo("226305")).toBeNull();
    expect(suggestCouncilCodeForCbo("999999")).toBeNull();
  });

  it("versiona TUSS 24/26 e separa habilitação TISS de perfis administrativos", () => {
    const migration = read("supabase/migrations/20260902202239_tiss_profissional_dominios_cbo_conselho.sql");
    expect(migration).toContain("tuss-24");
    expect(migration).toContain("tuss-26");
    expect(migration).toContain("habilitado_tiss boolean not null default false");
    expect(migration).toContain("PROFISSIONAL_TISS_CBO_FORA_TABELA_24");
    expect(migration).toContain("PROFISSIONAL_TISS_CONSELHO_FORA_TABELA_26");
    expect(migration).toContain("new.cbo='999999'");
  });

  it("não permite CBO, especialidade ou UF como texto livre no formulário regulatório", () => {
    const fields = read("src/components/cadastros/professional-regulatory-fields.tsx");
    expect(fields).toContain('select\n          name="cbo"');
    expect(fields).toContain('select name="uf_conselho"');
    expect(fields).toContain('select name="codigo_conselho_ans"');
    expect(fields).toContain("Especialidade / ocupação vinculada");
    expect(fields).not.toContain('input name="especialidade"');
    expect(fields).not.toContain('input name="uf_conselho"');
  });

  it("deriva especialidade do CBO ativo e valida conselho no servidor", () => {
    const editAction = read("src/modules/profissionais/tiss-background-actions.ts");
    const createAction = read("src/modules/profissionais/actions.ts");
    for (const source of [editAction, createAction]) {
      expect(source).toContain('eq("tabela", 24)');
      expect(source).toContain('eq("tabela", 26)');
      expect(source).toContain('cbo === "999999"');
      expect(source).toContain("cboRef.display");
      expect(source).toContain("codigo_conselho_ans");
      expect(source).toContain("habilitado_tiss");
    }
  });

  it("não classifica administrativos como pendência cadastral TISS", () => {
    const readiness = read("src/app/(painel)/cadastros/tiss/page.tsx");
    const list = read("src/app/(painel)/profissionais/page.tsx");
    expect(readiness).toContain('.eq("habilitado_tiss", true)');
    expect(readiness).toContain("Profissionais administrativos não são tratados como pendência");
    expect(list).toContain("Não usa TISS");
  });

  it("mantém salvamento da edição regulatória em segundo plano", () => {
    const action = read("src/modules/profissionais/tiss-background-actions.ts");
    const form = read("src/components/cadastros/professional-tiss-profile-form.tsx");
    expect(action).toContain("BackgroundActionState");
    expect(action).not.toContain('from "next/navigation"');
    expect(action).not.toMatch(/\bredirect\s*\(/);
    expect(form).toContain("useActionState");
    expect(form).toContain('aria-live="polite"');
    expect(form).toContain("Salvando…");
  });
});
