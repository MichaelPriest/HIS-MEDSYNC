import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const migratedServerActions = [
  "src/modules/prontuario-medico/encerramento-actions.ts",
  "src/modules/prontuario-medico/avaliacao-medica-actions.ts",
  "src/modules/triagem/actions.ts",
];

const backgroundForms = [
  "src/components/prontuario/alta-medica-background-form.tsx",
  "src/components/prontuario/avaliacao-medica-background-form.tsx",
  "src/components/agenda/agenda-form.tsx",
  "src/components/agenda/agenda-status-actions.tsx",
  "src/components/atendimentos/admission-background-form.tsx",
  "src/components/triagem/triage-background-actions.tsx",
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

  it("mantém a Agenda sem redirects usados apenas como feedback", () => {
    const source = read("src/modules/agenda/actions.ts");
    const redirects = source.match(/\bredirect\s*\(/g) ?? [];

    expect(source).toContain("BackgroundActionState");
    expect(source).not.toContain("agendaRedirect");
    expect(source).not.toMatch(/redirect\s*\(\s*["'`]\/agenda/);
    expect(redirects).toHaveLength(2);
    expect(source).toContain("/assistencial/centro-cirurgico?agendamento=");
    expect(source).toContain("/atendimentos/novo?agendamento=");
  });

  it("renderiza ações operacionais da Agenda no componente de segundo plano", () => {
    const source = read("src/app/(painel)/agenda/page.tsx");
    expect(source).toContain("AgendaStatusActions");
    expect(source).not.toContain("atualizarStatusAgendamento");
  });

  it("mantém o novo agendamento no formulário de segundo plano", () => {
    const source = read("src/app/(painel)/agenda/novo/page.tsx");
    expect(source).toContain("<AgendaForm");
    expect(source).not.toContain("searchParams");
    expect(source).not.toContain("criarAgendamento");
  });

  it("mantém erros da Admissão inline e navega apenas após abertura real", () => {
    const source = read("src/modules/atendimentos/actions.ts");
    const redirects = source.match(/\bredirect\s*\(/g) ?? [];

    expect(source).toContain("BackgroundActionState");
    expect(source).toContain("return failure(\"campos-obrigatorios\")");
    expect(source).toContain("return failure(\"cobertura\")");
    expect(source).not.toMatch(/redirect\s*\(\s*["'`]\/atendimentos\/novo/);
    expect(source).not.toMatch(/redirect\s*\(\s*["'`]\/senhas\?erro=/);
    expect(source).not.toMatch(/redirect\s*\(\s*["'`]\/agenda\?erro=/);
    expect(redirects).toHaveLength(2);
    expect(source).toContain("/autorizacoes?atendimento=");
    expect(source).toContain("/triagem?sucesso=admissao&atendimento=");
  });

  it("renderiza a Admissão no formulário de segundo plano", () => {
    const source = read("src/app/(painel)/atendimentos/novo/page.tsx");
    expect(source).toContain("AdmissionBackgroundForm");
    expect(source).toContain("<AdmissionBackgroundForm");
    expect(source).not.toContain("<AdmissionForm");
  });

  it("mantém chamada e registro da Triagem sem redirect usado como feedback", () => {
    const actions = read("src/modules/triagem/actions.ts");
    const page = read("src/app/(painel)/triagem/page.tsx");

    expect(actions).not.toContain('from "next/navigation"');
    expect(actions).not.toMatch(/\bredirect\s*\(/);
    expect(actions).toContain("return success(\"Paciente chamado no painel");
    expect(actions).toContain("redirectTo: `/autorizacoes?atendimento=");
    expect(actions).toContain("redirectTo: `/pronto-socorro?atendimento=");
    expect(actions).not.toContain("/triagem?sucesso=encaminhado");
    expect(page).toContain("TriageCallAction");
    expect(page).toContain("TriageBackgroundForm");
    expect(page).not.toContain("action={chamarPacienteTriagem}");
    expect(page).not.toContain("action={registrarTriagem}");
  });
});
