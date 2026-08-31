import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Laboratório — bancada em segundo plano", () => {
  it("mantém os RPCs operacionais sem redirect", () => {
    const source = read("src/modules/assistencial/laboratorio-actions.ts");

    expect(source).toContain("BackgroundActionState");
    expect(source).not.toContain('from "next/navigation"');
    expect(source).not.toMatch(/\bredirect\s*\(/);
    expect(source).toContain('supabase.rpc("preparar_amostra_laboratorio_operacional"');
    expect(source).toContain('supabase.rpc("atualizar_status_amostra_laboratorio_operacional"');
    expect(source).toContain('supabase.rpc("encaminhar_amostra_laboratorio_operacional"');
    expect(source).toContain('supabase.rpc("registrar_resultado_laboratorio_operacional"');
    expect(source).toContain('supabase.rpc("liberar_resultado_laboratorio"');
    expect(source).toContain('supabase.rpc("registrar_notificacao_resultado_critico"');
  });

  it("conecta todas as operações da bancada ao formulário assíncrono", () => {
    const page = read("src/app/(painel)/assistencial/laboratorio/page.tsx");
    const form = read("src/components/laboratorio/laboratory-background-form.tsx");

    expect(form).toContain("useActionState");
    expect(form).toContain('aria-live="polite"');
    expect(form).toContain("Salvando…");
    for (const kind of ["prepare", "sample-status", "forward", "result", "release", "critical"]) {
      expect(page).toContain(`kind=\"${kind}\"`);
    }
    expect(page).not.toContain("action={prepararAmostraLaboratorio}");
    expect(page).not.toContain("action={atualizarStatusAmostraLaboratorio}");
    expect(page).not.toContain("action={encaminharAmostraLaboratorio}");
    expect(page).not.toContain("action={registrarResultadoLaboratorio}");
    expect(page).not.toContain("action={liberarResultadoLaboratorio}");
    expect(page).not.toContain("action={notificarResultadoCriticoLaboratorio}");
  });
});
