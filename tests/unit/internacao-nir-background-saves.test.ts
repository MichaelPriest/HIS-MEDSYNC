import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("NIR sem reload", () => {
  it("mantém movimentar_internacao_leito como autoridade e não usa redirect", () => {
    const actions = read("src/modules/internacao/nir-actions.ts");

    expect(actions).toContain("BackgroundActionState");
    expect(actions).toContain("movimentar_internacao_leito");
    expect(actions).toContain("revalidatePath");
    expect(actions).toContain("LEITO_INCOMPATIVEL_ISOLAMENTO");
    expect(actions).toContain("LEITO_INCOMPATIVEL_SEXO");
    expect(actions).toContain("LEITO_INCOMPATIVEL_ACOMODACAO");
    expect(actions).toContain("LEITO_RESERVADO_PARA_OUTRO_ATENDIMENTO");
    expect(actions).toContain("LEITO_DESTINO_OCUPADO");
    expect(actions).not.toContain('from "next/navigation"');
    expect(actions).not.toMatch(/\bredirect\s*\(/);
  });

  it("usa useActionState e feedback inline no formulário de alocação", () => {
    const form = read("src/components/internacao/nir-bed-allocation-background-form.tsx");

    expect(form).toContain("useActionState");
    expect(form).toContain('aria-live="polite"');
    expect(form).toContain("Salvando…");
    expect(form).toContain("Alocar leito");
    expect(form).not.toContain("router.refresh");
    expect(form).not.toContain("window.location");
  });

  it("mantém filtros de consulta na URL e remove sucesso/erro por query string", () => {
    const page = read("src/app/(painel)/internacao/nir/page.tsx");

    expect(page).toContain("NirBedAllocationBackgroundForm");
    expect(page).toContain('name="q"');
    expect(page).toContain('name="risco"');
    expect(page).toContain('name="setor"');
    expect(page).not.toContain("action={alocarLeitoNir}");
    expect(page).not.toContain("sucesso?: string");
    expect(page).not.toContain("erro?: string");
    expect(page).not.toContain("sp.sucesso");
    expect(page).not.toContain("sp.erro");
  });

  it("preserva compatibilidade visual como recomendação sem substituir a validação do banco", () => {
    const page = read("src/app/(painel)/internacao/nir/page.tsx");

    expect(page).toContain("bedCompatibility");
    expect(page).toContain("normalizeAccommodation");
    expect(page).toContain("normalizeSexRestriction");
    expect(page).toContain("admission.isolamento");
    expect(page).toContain("Sem leito compatível");
  });
});
