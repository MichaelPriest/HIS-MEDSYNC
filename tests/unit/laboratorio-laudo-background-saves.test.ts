import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Laboratório — laudos em segundo plano", () => {
  it("mantém ações de laudo sem redirect e preserva RPCs canônicos", () => {
    const source = read("src/modules/assistencial/laboratorio-laudo-actions.ts");

    expect(source).toContain("BackgroundActionState");
    expect(source).not.toContain('from "next/navigation"');
    expect(source).not.toMatch(/\bredirect\s*\(/);
    expect(source).toContain('supabase.rpc("salvar_laudo_laboratorio"');
    expect(source).toContain('supabase.rpc("liberar_resultado_laboratorio"');
    expect(source).toContain('supabase.rpc("registrar_notificacao_resultado_critico"');
    expect(source).toContain('supabase.rpc("liberar_laudo_laboratorio"');
    expect(source).toContain('supabase.rpc("abrir_retificacao_laudo_laboratorio"');
    expect(source).toContain("redirectTo: `/assistencial/laboratorio/laudos/${id}`");
  });

  it("abre o editor somente após criação confirmada do laudo", () => {
    const listPage = read("src/app/(painel)/assistencial/laboratorio/laudos/page.tsx");
    const form = read("src/components/laboratorio/laboratory-report-background-form.tsx");

    expect(listPage).toContain("OpenLaboratoryReportForm");
    expect(listPage).not.toContain("action={abrirLaudoLaboratorio}");
    expect(form).toContain("useActionState(abrirLaudoLaboratorio");
    expect(form).toContain("router.push(redirectTo as Route)");
    expect(form).not.toContain("router.refresh");
    expect(form).not.toContain("window.location");
  });

  it("mantém todas as mutações do editor inline", () => {
    const page = read("src/app/(painel)/assistencial/laboratorio/laudos/[laudoId]/page.tsx");
    const form = read("src/components/laboratorio/laboratory-report-background-form.tsx");

    for (const kind of ["validate", "critical", "save", "release", "rectify"]) {
      expect(page).toContain(`kind=\"${kind}\"`);
    }
    expect(page).not.toContain("action={validarResultadoNoLaudo}");
    expect(page).not.toContain("action={notificarCriticoNoLaudo}");
    expect(page).not.toContain("action={salvarLaudoLaboratorio}");
    expect(page).not.toContain("action={liberarLaudoLaboratorio}");
    expect(page).not.toContain("action={abrirRetificacaoLaudoLaboratorio}");
    expect(form).toContain("useActionState");
    expect(form).toContain('aria-live="polite"');
    expect(form).toContain("Salvando…");
  });
});
