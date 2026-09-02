import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("alta médica com encaminhamentos assistenciais", () => {
  it("expõe os encaminhamentos que realmente bloqueiam a alta", () => {
    const page = read("src/app/(painel)/prontuario/[atendimentoId]/alta/page.tsx");
    expect(page).toContain('from("encaminhamentos_assistenciais")');
    expect(page).toContain('rpc("profissional_logado"');
    expect(page).toContain("encaminhamentosBloqueantes");
    expect(page).toContain("Encaminhamentos que impedem a alta");
    expect(page).toContain("AssumePatientBackgroundForm");
    expect(page).toContain("Abrir fila médica");
  });

  it("mantém a regra clínica: encaminhamento do próprio profissional não é bloqueador", () => {
    const page = read("src/app/(painel)/prontuario/[atendimentoId]/alta/page.tsx");
    expect(page).toContain("item.profissional_id !== profissionalLogadoId");
    const action = read("src/modules/prontuario-medico/encerramento-actions.ts");
    expect(action).toContain("ALTA_PENDENCIAS_BLOQUEANTES");
  });

  it("impede nova tentativa enquanto o bloqueio conhecido ainda está visível", () => {
    const form = read("src/components/prontuario/alta-medica-background-form.tsx");
    expect(form).toContain("encaminhamentosBloqueantes");
    expect(form).toContain("bloqueadaPorEncaminhamento");
    expect(form).toContain("Resolver pendências para concluir");
    expect(form).toContain('aria-live="polite"');
    expect(form).toContain("Salvando…");
  });

  it("reutiliza o claim transacional da fila médica em vez de fechar encaminhamento silenciosamente", () => {
    const assume = read("src/modules/fila-medica/actions.ts");
    expect(assume).toContain('status: "em_atendimento"');
    expect(assume).toContain("profissional_id: profissionalId");
    expect(assume).toContain('.eq("status", "aguardando_profissional")');
  });

  it("antecipa encaminhamentos ativos no contexto assistencial do episódio", () => {
    const context = read("src/components/prontuario/episodio-contexto-assistencial.tsx");
    expect(context).toContain('from("encaminhamentos_assistenciais")');
    expect(context).toContain("Encaminhamentos ativos no episódio");
    expect(context).toContain("encaminhamentosAtivos");
  });
});
