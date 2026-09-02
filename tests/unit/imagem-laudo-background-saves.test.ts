import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("laudos RIS sem reload", () => {
  it("preserva os RPCs canônicos e não usa redirect no servidor", () => {
    const source = read("src/modules/assistencial/imagem-laudo-background-actions.ts");

    expect(source).toContain("BackgroundActionState");
    expect(source).toContain("revalidatePath");
    expect(source).not.toContain('from "next/navigation"');
    expect(source).not.toMatch(/\bredirect\s*\(/);
    expect(source).toContain("salvar_laudo_imagem");
    expect(source).toContain("registrar_criticidade_laudo_imagem");
    expect(source).toContain("liberar_laudo_imagem");
    expect(source).toContain("abrir_retificacao_laudo_imagem");
  });

  it("navega somente ao abrir um novo editor e mantém feedback inline nas demais operações", () => {
    const form = read("src/components/imagem/radiology-report-background-form.tsx");

    expect(form).toContain("useActionState");
    expect(form).toContain("OpenRadiologyReportForm");
    expect(form).toContain("router.push");
    expect(form).toContain('aria-live="polite"');
    expect(form).toContain("Salvando…");
    expect(form).not.toContain("router.refresh");
    expect(form).not.toContain("window.location");
  });

  it("mantém o editor no componente assíncrono para rascunho, crítico, liberação e retificação", () => {
    const page = read("src/app/(painel)/assistencial/imagem/laudos/[laudoId]/page.tsx");

    expect(page).toContain("RadiologyReportBackgroundForm");
    expect(page).toContain('kind="save"');
    expect(page).toContain('kind="critical"');
    expect(page).toContain('kind="release"');
    expect(page).toContain('kind="rectify"');
    expect(page).not.toContain("searchParams");
    expect(page).not.toContain("salvarLaudoImagem");
    expect(page).not.toContain("registrarCriticidadeLaudoImagem");
    expect(page).not.toContain("liberarLaudoImagem");
    expect(page).not.toContain("abrirRetificacaoLaudoImagem");
  });

  it("permite registrar criticidade antes da comunicação e mantém bloqueio de liberação na UI", () => {
    const actions = read("src/modules/assistencial/imagem-laudo-background-actions.ts");
    const page = read("src/app/(painel)/assistencial/imagem/laudos/[laudoId]/page.tsx");

    expect(actions).toContain("a comunicação clínica permanece pendente antes da liberação");
    expect(actions).not.toContain("Informe a pessoa comunicada quando houver achado crítico");
    expect(page).toContain("criticoPendente");
    expect(page).toContain("disabled={criticoPendente}");
  });
});
