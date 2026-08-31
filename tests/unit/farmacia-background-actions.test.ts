import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Farmácia — salvamentos em segundo plano", () => {
  it("mantém os RPCs canônicos e não usa redirect nas novas actions", () => {
    const source = read("src/modules/assistencial/medicamentos-background-actions.ts");

    expect(source).toContain("BackgroundActionState");
    expect(source).not.toContain('from "next/navigation"');
    expect(source).not.toMatch(/\bredirect\s*\(/);
    expect(source).toContain('supabase.rpc("validar_prescricao_farmaceutica"');
    expect(source).toContain('supabase.rpc("dispensar_medicamento_prescricao_fefo"');
    expect(source).toContain('supabase.rpc("dispensar_componente_prescricao_fefo"');
    expect(source).toContain('supabase.rpc("devolver_medicamento_dispensacao"');
    expect(source).toContain('supabase.rpc("registrar_conciliacao_medicamentosa"');
  });

  it("mantém feedback assíncrono acessível no formulário reutilizável", () => {
    const source = read("src/components/farmacia/pharmacy-background-form.tsx");

    expect(source).toContain("useActionState");
    expect(source).toContain('aria-live="polite"');
    expect(source).toContain("Salvando…");
    expect(source).not.toContain("router.refresh");
    expect(source).not.toContain("window.location");
  });
});
