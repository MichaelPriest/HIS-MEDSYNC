import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Enfermagem sem reload", () => {
  it("não usa redirect nas ações de administração ou evolução", () => {
    const source = read("src/modules/enfermagem/actions.ts");

    expect(source).toContain("BackgroundActionState");
    expect(source).not.toContain('from "next/navigation"');
    expect(source).not.toMatch(/\bredirect\s*\(/);
    expect(source).toContain('supabase.rpc("registrar_administracao_beira_leito"');
    expect(source).toContain("p_dispensacao_id");
    expect(source).toContain("p_codigo_paciente");
    expect(source).toContain("p_codigo_medicamento");
    expect(source).toContain("p_dupla_checagem");
    expect(source).toContain("p_segundo_profissional_id");
  });

  it("mantém administração à beira-leito no formulário assíncrono", () => {
    const page = read("src/app/(painel)/assistencial/enfermagem/page.tsx");
    const form = read("src/components/enfermagem/medication-administration-background-form.tsx");

    expect(page).toContain("MedicationAdministrationBackgroundForm");
    expect(page).not.toContain("action={checarAdministracaoEnfermagemAction}");
    expect(page).toContain('name="dispensacao_id"');
    expect(page).toContain('name="codigo_paciente"');
    expect(page).toContain('name="codigo_medicamento"');
    expect(page).toContain('name="confirmacao_manual_medicamento"');
    expect(page).toContain('name="segundo_profissional_id"');
    expect(page).toContain('name="dupla_checagem"');
    expect(form).toContain("useActionState");
    expect(form).toContain('aria-live="polite"');
    expect(form).toContain("Salvando…");
    expect(form).not.toContain("router.refresh");
    expect(form).not.toContain("window.location");
  });

  it("mantém evolução de Andares e Pronto-Socorro no formulário assíncrono", () => {
    const andares = read("src/app/(painel)/assistencial/enfermagem/andares/page.tsx");
    const prontoSocorro = read("src/app/(painel)/assistencial/enfermagem/pronto-socorro/page.tsx");
    const form = read("src/components/enfermagem/nursing-evolution-background-form.tsx");

    expect(andares).toContain("NursingEvolutionBackgroundForm");
    expect(prontoSocorro).toContain("NursingEvolutionBackgroundForm");
    expect(andares).not.toContain("action={registrarEvolucaoEnfermagemAction}");
    expect(prontoSocorro).not.toContain("action={registrarEvolucaoEnfermagemAction}");
    expect(form).toContain("useActionState");
    expect(form).toContain('aria-live="polite"');
    expect(form).toContain("Salvando…");
  });
});
