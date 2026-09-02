import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const strictBackgroundServerActions = [
  "src/modules/prontuario-medico/encerramento-actions.ts",
  "src/modules/prontuario-medico/avaliacao-medica-actions.ts",
  "src/modules/triagem/actions.ts",
  "src/modules/fila-medica/actions.ts",
  "src/modules/autorizacoes/actions.ts",
  "src/modules/assistencial/medicamentos-background-actions.ts",
  "src/modules/assistencial/imagem-background-actions.ts",
  "src/modules/assistencial/imagem-laudo-background-actions.ts",
  "src/modules/ged/background-actions.ts",
  "src/modules/centro-cirurgico/background-actions.ts",
  "src/modules/centro-cirurgico/anestesia-rpa-background-actions.ts",
  "src/modules/centro-cirurgico/suprimentos-background-actions.ts",
  "src/modules/centro-cirurgico/cme-background-actions.ts",
];

const backgroundForms = [
  "src/components/prontuario/alta-medica-background-form.tsx",
  "src/components/prontuario/avaliacao-medica-background-form.tsx",
  "src/components/agenda/agenda-form.tsx",
  "src/components/agenda/agenda-status-actions.tsx",
  "src/components/atendimentos/admission-background-form.tsx",
  "src/components/triagem/triage-background-actions.tsx",
  "src/components/fila-medica/assume-patient-background-form.tsx",
  "src/components/autorizacoes/authorization-background-actions.tsx",
  "src/components/enfermagem/nursing-evolution-background-form.tsx",
  "src/components/enfermagem/medication-administration-background-form.tsx",
  "src/components/farmacia/pharmacy-background-form.tsx",
  "src/components/imagem/radiology-background-form.tsx",
  "src/components/imagem/radiology-report-background-form.tsx",
  "src/components/ged/ged-governance-background-form.tsx",
  "src/components/centro-cirurgico/surgical-background-form.tsx",
  "src/components/centro-cirurgico/anesthesia-autosave-form.tsx",
  "src/components/centro-cirurgico/rpa-autosave-form.tsx",
  "src/components/centro-cirurgico/surgical-supply-background-form.tsx",
  "src/components/centro-cirurgico/cme-background-form.tsx",
];

describe("política de salvamento em segundo plano", () => {
  it.each(strictBackgroundServerActions)("não permite redirect em %s", (path) => {
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

  it("mantém navegação da Agenda apenas para check-in que muda de etapa", () => {
    const source = read("src/modules/agenda/actions.ts");
    const redirects = source.match(/\bredirect\s*\(/g) ?? [];

    expect(source).toContain("BackgroundActionState");
    expect(source).not.toContain("agendaRedirect");
    expect(source).not.toMatch(/redirect\s*\(\s*["'`]\/agenda/);
    expect(redirects).toHaveLength(2);
    expect(source).toContain("/assistencial/centro-cirurgico?agendamento=");
    expect(source).toContain("/atendimentos/novo?agendamento=");
  });

  it("mantém erros da Admissão inline e navega apenas após abertura real do atendimento", () => {
    const source = read("src/modules/atendimentos/actions.ts");
    const redirects = source.match(/\bredirect\s*\(/g) ?? [];

    expect(source).toContain("BackgroundActionState");
    expect(source).not.toMatch(/redirect\s*\(\s*["'`]\/atendimentos\/novo/);
    expect(redirects).toHaveLength(2);
    expect(source).toContain("/autorizacoes?atendimento=");
    expect(source).toContain("/triagem?sucesso=admissao&atendimento=");
  });

  it("mantém Triagem, Fila Médica e Autorizações sem redirects de feedback", () => {
    const triage = read("src/modules/triagem/actions.ts");
    const queue = read("src/modules/fila-medica/actions.ts");
    const authorizations = read("src/modules/autorizacoes/actions.ts");

    for (const source of [triage, queue, authorizations]) {
      expect(source).not.toContain('from "next/navigation"');
      expect(source).not.toMatch(/\bredirect\s*\(/);
    }
    expect(queue).toContain("redirectTo: `/prontuario/${encaminhamento.atendimento_id}/clinico`");
    expect(authorizations).toContain("/triagem?atendimento=");
    expect(authorizations).toContain("/fila-medica?atendimento=");
    expect(authorizations).toContain("/pronto-socorro?atendimento=");
  });

  it("mantém Farmácia e Enfermagem nas camadas de segundo plano", () => {
    const pharmacyPage = read("src/app/(painel)/assistencial/medicamentos/page.tsx");
    const wards = read("src/app/(painel)/assistencial/enfermagem/andares/page.tsx");
    const emergency = read("src/app/(painel)/assistencial/enfermagem/pronto-socorro/page.tsx");

    expect(pharmacyPage).toContain("PharmacyBackgroundForm");
    expect(pharmacyPage).not.toContain("dispensarPrescricaoAction");
    expect(wards).toContain("NursingEvolutionBackgroundForm");
    expect(emergency).toContain("NursingEvolutionBackgroundForm");
  });

  it("mantém operação e laudos RIS nas camadas de segundo plano", () => {
    const listPage = read("src/app/(painel)/assistencial/imagem/page.tsx");
    const editor = read("src/app/(painel)/assistencial/imagem/laudos/[laudoId]/page.tsx");
    const reportForm = read("src/components/imagem/radiology-report-background-form.tsx");

    expect(listPage).toContain("RadiologyBackgroundForm");
    expect(listPage).toContain("OpenRadiologyReportForm");
    expect(editor).toContain('kind="save"');
    expect(editor).toContain('kind="release"');
    expect(editor).not.toContain("searchParams");
    expect(reportForm).toContain("router.push");
  });

  it("mantém assinatura e status do GED no componente de segundo plano", () => {
    const actions = read("src/modules/ged/background-actions.ts");
    const page = read("src/app/(painel)/ged/[documentoId]/page.tsx");

    expect(actions).toContain("atualizar_status_documento_ged");
    expect(actions).toContain("assinar_documento_ged");
    expect(actions).toContain('createHash("sha256")');
    expect(page).toContain("GedGovernanceBackgroundForm");
    expect(page).not.toContain("action={assinarDocumentoGed}");
  });

  it("mantém o Centro Cirúrgico principal, procedimentos, Anestesia e RPA sem reload", () => {
    const page = read("src/app/(painel)/assistencial/centro-cirurgico/page.tsx");
    const proceduresPage = read("src/app/(painel)/assistencial/centro-cirurgico/procedimentos/page.tsx");
    const anesthesia = read("src/components/centro-cirurgico/anesthesia-autosave-form.tsx");
    const rpa = read("src/components/centro-cirurgico/rpa-autosave-form.tsx");

    expect(page).toContain("SurgicalBackgroundForm");
    expect(proceduresPage).toContain("SurgeryProcedureAddForm");
    expect(proceduresPage).toContain("ProcedureTeamForm");
    expect(proceduresPage).toContain('kind="procedure-action"');
    expect(anesthesia).toContain("requestSubmit");
    expect(rpa).toContain("requestSubmit");
    expect(anesthesia).not.toContain("createClient");
    expect(rpa).not.toContain("createClient");
  });

  it("mantém Suprimentos cirúrgicos inline e preserva a cadeia farmacêutica", () => {
    const actions = read("src/modules/centro-cirurgico/suprimentos-background-actions.ts");
    const detail = read("src/app/(painel)/assistencial/centro-cirurgico/suprimentos/[cirurgiaId]/page.tsx");
    const list = read("src/app/(painel)/assistencial/centro-cirurgico/suprimentos/page.tsx");

    expect(actions).toContain("centro_cirurgico_requisitar_suprimentos_operacional");
    expect(actions).toContain("centro_cirurgico_receber_suprimentos_operacional");
    expect(actions).toContain("centro_cirurgico_consumir_suprimento_operacional");
    expect(actions).toContain("centro_cirurgico_estornar_consumo_operacional");
    expect(actions).toContain("CC_MEDICAMENTO_EXIGE_FLUXO_FARMACIA_PRESCRICAO");
    expect(detail).toContain("SurgicalSupplyBackgroundForm");
    expect(detail).toContain('kind="request"');
    expect(detail).toContain('kind="receive"');
    expect(detail).toContain('kind="consume"');
    expect(detail).toContain('kind="reverse"');
    expect(detail).not.toContain("searchParams");
    expect(detail).not.toContain("requisitarSuprimentosCirurgicosAction");
    expect(list).not.toContain("searchParams");
  });

  it("mantém CME inline e liberação definitiva sem redirect", () => {
    const actions = read("src/modules/centro-cirurgico/cme-background-actions.ts");
    const page = read("src/app/(painel)/assistencial/centro-cirurgico/cme/page.tsx");
    const form = read("src/components/centro-cirurgico/cme-background-form.tsx");

    expect(actions).toContain("cme_salvar_ciclo_operacional");
    expect(actions).toContain("CME_LIBERACAO_EXIGE_RESULTADO_E_INDICADORES");
    expect(actions).toContain("CME_USUARIO_SEM_PROFISSIONAL");
    expect(page).toContain("CmeBackgroundForm");
    expect(page).not.toContain("salvarCicloCme");
    expect(page).not.toContain("searchParams");
    expect(form).toContain('state.data?.status === "liberado"');
  });
});
