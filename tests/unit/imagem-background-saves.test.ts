import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("RIS / Diagnóstico por Imagem sem reload", () => {
  it("mantém a camada operacional sem redirects e preserva RPCs canônicos", () => {
    const source = read("src/modules/assistencial/imagem-background-actions.ts");

    expect(source).toContain("BackgroundActionState");
    expect(source).toContain("revalidatePath");
    expect(source).not.toContain('from "next/navigation"');
    expect(source).not.toMatch(/\bredirect\s*\(/);
    expect(source).toContain("agendar_exame_imagem_operacional");
    expect(source).toContain("atualizar_agendamento_imagem_operacional");
    expect(source).toContain("iniciar_execucao_imagem_operacional");
    expect(source).toContain("concluir_execucao_imagem_operacional");
  });

  it("usa useActionState e feedback inline acessível", () => {
    const source = read("src/components/imagem/radiology-background-form.tsx");

    expect(source).toContain("useActionState");
    expect(source).toContain('aria-live="polite"');
    expect(source).toContain("Salvando…");
    expect(source).not.toContain("router.refresh");
    expect(source).not.toContain("window.location");
  });

  it("remove actions legadas e mantém operação e laudos nos formulários assíncronos", () => {
    const source = read("src/app/(painel)/assistencial/imagem/page.tsx");

    expect(source).toContain("RadiologyBackgroundForm");
    expect(source).toContain('kind="schedule"');
    expect(source).toContain('kind="schedule-status"');
    expect(source).toContain('kind="start"');
    expect(source).toContain('kind="finish"');
    expect(source).toContain('kind="contrast"');
    expect(source).toContain('kind="dose"');
    expect(source).toContain("OpenRadiologyReportForm");
    expect(source).toContain("RadiologyReportBackgroundForm");
    expect(source).not.toContain("agendarImagem,");
    expect(source).not.toContain("atualizarAgendaImagem,");
    expect(source).not.toContain("iniciarExecucaoImagem,");
    expect(source).not.toContain("concluirExecucaoImagem,");
    expect(source).not.toContain("registrarContrasteImagem,");
    expect(source).not.toContain("registrarDoseImagem,");
    expect(source).not.toContain("salvarLaudoImagem");
    expect(source).not.toContain("liberarLaudoImagem");
  });
});
