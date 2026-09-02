import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const migratedServerActions = [
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

  it("mantém a Fila Médica sem redirects de erro e navega só após assumir o paciente", () => {
    const actions = read("src/modules/fila-medica/actions.ts");
    const page = read("src/app/(painel)/fila-medica/page.tsx");
    const prontoSocorroPage = read("src/app/(painel)/pronto-socorro/page.tsx");
    const form = read("src/components/fila-medica/assume-patient-background-form.tsx");

    expect(actions).not.toContain('from "next/navigation"');
    expect(actions).not.toMatch(/\bredirect\s*\(/);
    expect(actions).not.toContain("filaComErro");
    expect(actions).toContain("data: { redirectTo: `/prontuario/${encaminhamento.atendimento_id}/clinico` }");
    expect(page).toContain("AssumePatientBackgroundForm");
    expect(page).not.toContain("action={assumirPaciente}");
    expect(page).not.toContain("MENSAGENS_ERRO");
    expect(prontoSocorroPage).toContain("AssumePatientBackgroundForm");
    expect(prontoSocorroPage).not.toContain("action={assumirPaciente}");
    expect(form).toContain("router.push");
  });

  it("mantém Autorizações inline e navega somente para próxima etapa real", () => {
    const actions = read("src/modules/autorizacoes/actions.ts");
    const page = read("src/app/(painel)/autorizacoes/page.tsx");
    const forms = read("src/components/autorizacoes/authorization-background-actions.tsx");

    expect(actions).not.toContain('from "next/navigation"');
    expect(actions).not.toMatch(/\bredirect\s*\(/);
    expect(actions).toContain("return failure(\"identificacao-obrigatoria\")");
    expect(actions).toContain("return success(\"Autorização salva.\")");
    expect(actions).toContain("/triagem?atendimento=");
    expect(actions).toContain("/fila-medica?atendimento=");
    expect(actions).toContain("/pronto-socorro?atendimento=");
    expect(page).toContain("AuthorizationIdentificationBackgroundForm");
    expect(page).toContain("AuthorizationUpdateBackgroundForm");
    expect(page).not.toContain("action={registrarIdentificacaoAutorizacao}");
    expect(page).not.toContain("action={atualizarAutorizacao}");
    expect(forms).toContain("router.push");
  });

  it("mantém evolução de Enfermagem inline em Andares e Pronto-Socorro", () => {
    const actions = read("src/modules/enfermagem/actions.ts");
    const evolutionStart = actions.indexOf("export async function registrarEvolucaoEnfermagemAction");
    const evolutionSource = actions.slice(evolutionStart);
    const andares = read("src/app/(painel)/assistencial/enfermagem/andares/page.tsx");
    const prontoSocorro = read("src/app/(painel)/assistencial/enfermagem/pronto-socorro/page.tsx");

    expect(evolutionStart).toBeGreaterThan(-1);
    expect(evolutionSource).toContain("BackgroundActionState");
    expect(evolutionSource).toContain("return evolutionFailure");
    expect(evolutionSource).toContain('status: "success"');
    expect(evolutionSource).not.toMatch(/\bredirect\s*\(/);
    expect(andares).toContain("NursingEvolutionBackgroundForm");
    expect(andares).not.toContain("action={registrarEvolucaoEnfermagemAction}");
    expect(prontoSocorro).toContain("NursingEvolutionBackgroundForm");
    expect(prontoSocorro).not.toContain("action={registrarEvolucaoEnfermagemAction}");
  });

  it("mantém a Farmácia nos formulários de segundo plano sem actions legadas na página", () => {
    const actions = read("src/modules/assistencial/medicamentos-background-actions.ts");
    const page = read("src/app/(painel)/assistencial/medicamentos/page.tsx");

    expect(actions).not.toContain('from "next/navigation"');
    expect(actions).not.toMatch(/\bredirect\s*\(/);
    expect(page).toContain("PharmacyBackgroundForm");
    expect(page).toContain('kind="reconciliation"');
    expect(page).toContain('kind="validation"');
    expect(page).toContain('kind="dispense"');
    expect(page).toContain('kind="component-dispense"');
    expect(page).toContain('kind="return"');
    expect(page).not.toContain("registrarConciliacaoMedicamentosaAction");
    expect(page).not.toContain("validarPrescricaoFarmaceuticaAction");
    expect(page).not.toContain("dispensarPrescricaoAction");
    expect(page).not.toContain("dispensarComponentePrescricaoAction");
    expect(page).not.toContain("devolverMedicamentoAction");
  });

  it("mantém a operação RIS nos formulários de segundo plano sem actions legadas na página", () => {
    const actions = read("src/modules/assistencial/imagem-background-actions.ts");
    const page = read("src/app/(painel)/assistencial/imagem/page.tsx");

    expect(actions).not.toContain('from "next/navigation"');
    expect(actions).not.toMatch(/\bredirect\s*\(/);
    expect(page).toContain("RadiologyBackgroundForm");
    expect(page).toContain('kind="schedule"');
    expect(page).toContain('kind="schedule-status"');
    expect(page).toContain('kind="start"');
    expect(page).toContain('kind="finish"');
    expect(page).toContain('kind="contrast"');
    expect(page).toContain('kind="dose"');
    expect(page).not.toContain("agendarImagem,");
    expect(page).not.toContain("atualizarAgendaImagem,");
    expect(page).not.toContain("iniciarExecucaoImagem,");
    expect(page).not.toContain("concluirExecucaoImagem,");
    expect(page).not.toContain("registrarContrasteImagem,");
    expect(page).not.toContain("registrarDoseImagem,");
  });

  it("mantém os laudos RIS sem redirects de feedback e abre editor apenas após criação confirmada", () => {
    const actions = read("src/modules/assistencial/imagem-laudo-background-actions.ts");
    const listPage = read("src/app/(painel)/assistencial/imagem/page.tsx");
    const editorPage = read("src/app/(painel)/assistencial/imagem/laudos/[laudoId]/page.tsx");
    const form = read("src/components/imagem/radiology-report-background-form.tsx");

    expect(actions).not.toContain('from "next/navigation"');
    expect(actions).not.toMatch(/\bredirect\s*\(/);
    expect(actions).toContain("salvar_laudo_imagem");
    expect(actions).toContain("registrar_criticidade_laudo_imagem");
    expect(actions).toContain("liberar_laudo_imagem");
    expect(actions).toContain("abrir_retificacao_laudo_imagem");
    expect(actions).toContain("redirectTo: `/assistencial/imagem/laudos/${id}`");
    expect(form).toContain("OpenRadiologyReportForm");
    expect(form).toContain("router.push");
    expect(listPage).toContain("OpenRadiologyReportForm");
    expect(listPage).toContain('kind="release"');
    expect(listPage).not.toContain("salvarLaudoImagem");
    expect(listPage).not.toContain("liberarLaudoImagem");
    expect(editorPage).toContain('kind="save"');
    expect(editorPage).toContain('kind="critical"');
    expect(editorPage).toContain('kind="release"');
    expect(editorPage).toContain('kind="rectify"');
    expect(editorPage).not.toContain("searchParams");
    expect(editorPage).not.toContain("salvarLaudoImagem");
    expect(editorPage).not.toContain("registrarCriticidadeLaudoImagem");
    expect(editorPage).not.toContain("liberarLaudoImagem");
    expect(editorPage).not.toContain("abrirRetificacaoLaudoImagem");
  });

  it("mantém assinatura e status do GED no componente de segundo plano", () => {
    const actions = read("src/modules/ged/background-actions.ts");
    const page = read("src/app/(painel)/ged/[documentoId]/page.tsx");

    expect(actions).toContain("atualizar_status_documento_ged");
    expect(actions).toContain("assinar_documento_ged");
    expect(actions).toContain('createHash("sha256")');
    expect(page).toContain("GedGovernanceBackgroundForm");
    expect(page).toContain('kind="sign"');
    expect(page).toContain('kind="status"');
    expect(page).not.toContain("action={assinarDocumentoGed}");
    expect(page).not.toContain("action={atualizarStatusDocumentoGed}");
  });

  it("mantém o Centro Cirúrgico principal e procedimentos nos formulários de segundo plano", () => {
    const actions = read("src/modules/centro-cirurgico/background-actions.ts");
    const page = read("src/app/(painel)/assistencial/centro-cirurgico/page.tsx");
    const proceduresPage = read("src/app/(painel)/assistencial/centro-cirurgico/procedimentos/page.tsx");

    expect(actions).toContain("centro_cirurgico_agendar_operacional");
    expect(actions).toContain("centro_cirurgico_transicionar_operacional");
    expect(actions).toContain("centro_cirurgico_salvar_checklist_operacional");
    expect(actions).toContain("centro_cirurgico_registrar_opme_operacional");
    expect(actions).toContain("centro_cirurgico_salvar_membro_equipe_operacional");
    expect(page).toContain("SurgicalBackgroundForm");
    expect(page).toContain("SurgerySchedulingForm");
    expect(page).not.toContain("action={transicionarCirurgia}");
    expect(page).not.toContain("action={salvarChecklistCirurgico}");
    expect(page).not.toContain("action={registrarOpme}");
    expect(proceduresPage).toContain("SurgeryProcedureAddForm");
    expect(proceduresPage).toContain("ProcedureTeamForm");
    expect(proceduresPage).toContain('kind="procedure-action"');
    expect(proceduresPage).not.toContain("adicionarProcedimentoAoAto");
    expect(proceduresPage).not.toContain("salvarMembroEquipeProcedimento");
    expect(proceduresPage).not.toContain("acionarProcedimentoCirurgico");
  });

  it("mantém autosave de Anestesia e RPA sem RPC direto no cliente nem router.refresh", () => {
    const actions = read("src/modules/centro-cirurgico/anestesia-rpa-background-actions.ts");
    const anesthesia = read("src/components/centro-cirurgico/anesthesia-autosave-form.tsx");
    const rpa = read("src/components/centro-cirurgico/rpa-autosave-form.tsx");

    expect(actions).toContain("centro_cirurgico_salvar_anestesia_operacional");
    expect(actions).toContain("centro_cirurgico_salvar_rpa_operacional");
    expect(actions).toContain('.select("id,inicio_em,fim_em")');
    expect(actions).toContain('.select("id,status,alta_em")');
    expect(anesthesia).toContain("requestSubmit");
    expect(rpa).toContain("requestSubmit");
    expect(anesthesia).not.toContain("createClient");
    expect(rpa).not.toContain("createClient");
    expect(anesthesia).not.toContain("router.refresh");
    expect(rpa).not.toContain("router.refresh");
  });
});
