import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const migratedServerActions = [
  "src/modules/prontuario-medico/encerramento-actions.ts",
  "src/modules/prontuario-medico/avaliacao-medica-actions.ts",
];

const backgroundForms = [
  "src/components/prontuario/alta-medica-background-form.tsx",
  "src/components/prontuario/avaliacao-medica-background-form.tsx",
];

describe("política de salvamento em segundo plano", () => {
  it.each(migratedServerActions)("não permite redirect em %s", (path) => {
    const source = read(path);
    expect(source).toContain("BackgroundActionState");
    expect(source).not.toContain('from "next/navigation"');
    expect(source).not.toMatch(/\bredirect\s*\(/);
  });

  it.each(backgroundForms)("usa estado assíncrono e feedback inline em %s", (path) => {
    const source = read(path);
    expect(source).toContain("useActionState");
    expect(source).toContain('aria-live="polite"');
    expect(source).toContain("Salvando…");
    expect(source).not.toContain("router.refresh");
    expect(source).not.toContain("window.location");
  });

  it("mantém a alta médica no componente de segundo plano", () => {
    const source = read("src/app/(painel)/prontuario/[atendimentoId]/alta/page.tsx");
    expect(source).toContain("AltaMedicaBackgroundForm");
    expect(source).not.toContain("action={finalizarAtendimentoMedico}");
  });

  it("mantém a avaliação médica no componente de segundo plano", () => {
    const source = read("src/app/(painel)/prontuario/[atendimentoId]/avaliacoes/page.tsx");
    expect(source).toContain("AvaliacaoMedicaBackgroundForm");
    expect(source).not.toContain("action={solicitarAvaliacaoMedicaAction}");
  });
});
