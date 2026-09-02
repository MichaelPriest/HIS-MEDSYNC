import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Centro Cirúrgico sem reload", () => {
  it("mantém os RPCs cirúrgicos na camada de segundo plano e não usa redirect", () => {
    const actions = read("src/modules/centro-cirurgico/background-actions.ts");

    expect(actions).toContain("BackgroundActionState");
    expect(actions).toContain("centro_cirurgico_classificar_internacao_ans");
    expect(actions).toContain("centro_cirurgico_agendar_operacional");
    expect(actions).toContain("centro_cirurgico_transicionar_operacional");
    expect(actions).toContain("centro_cirurgico_salvar_checklist_operacional");
    expect(actions).toContain("centro_cirurgico_registrar_opme_operacional");
    expect(actions).toContain("centro_cirurgico_vincular_ciclo_cme_operacional");
    expect(actions).toContain("centro_cirurgico_movimentar_para_ala_operacional");
    expect(actions).toContain("centro_cirurgico_adicionar_procedimento_operacional");
    expect(actions).toContain("centro_cirurgico_salvar_membro_equipe_operacional");
    expect(actions).toContain("centro_cirurgico_acionar_procedimento_operacional");
    expect(actions).toContain("agendamento-parcial");
    expect(actions).toContain("revalidatePath");
    expect(actions).not.toContain('from "next/navigation"');
    expect(actions).not.toMatch(/\bredirect\s*\(/);
  });

  it("usa useActionState no agendamento, procedimentos e equipe", () => {
    const scheduling = read("src/components/centro-cirurgico/surgery-scheduling-form.tsx");
    const addProcedure = read("src/components/centro-cirurgico/surgery-procedure-add-form.tsx");
    const team = read("src/components/centro-cirurgico/procedure-team-form.tsx");
    const wrapper = read("src/components/centro-cirurgico/surgical-background-form.tsx");

    for (const source of [scheduling, addProcedure, team, wrapper]) {
      expect(source).toContain("useActionState");
      expect(source).toContain('aria-live="polite"');
      expect(source).toContain("Salvando…");
      expect(source).not.toContain("router.refresh");
      expect(source).not.toContain("window.location");
    }
  });

  it("remove actions legadas do workspace principal", () => {
    const page = read("src/app/(painel)/assistencial/centro-cirurgico/page.tsx");

    expect(page).toContain("SurgicalBackgroundForm");
    expect(page).toContain('kind="transition"');
    expect(page).toContain('kind="checklist"');
    expect(page).toContain('kind="opme"');
    expect(page).toContain('kind="cme-link"');
    expect(page).toContain('kind="move"');
    expect(page).not.toContain("action={transicionarCirurgia}");
    expect(page).not.toContain("action={salvarChecklistCirurgico}");
    expect(page).not.toContain("action={registrarOpme}");
    expect(page).not.toContain("action={vincularCicloCme}");
    expect(page).not.toContain("action={movimentarPosOperatorioParaAla}");
    expect(page).not.toContain("sucesso?: string");
    expect(page).not.toContain("erro?: string");
  });

  it("remove actions legadas da tela de procedimentos e equipe", () => {
    const page = read("src/app/(painel)/assistencial/centro-cirurgico/procedimentos/page.tsx");

    expect(page).toContain("SurgeryProcedureAddForm");
    expect(page).toContain("ProcedureTeamForm");
    expect(page).toContain('kind="procedure-action"');
    expect(page).not.toContain("adicionarProcedimentoAoAto");
    expect(page).not.toContain("salvarMembroEquipeProcedimento");
    expect(page).not.toContain("acionarProcedimentoCirurgico");
    expect(page).not.toContain("sucesso?: string");
    expect(page).not.toContain("erro?: string");
  });
});
