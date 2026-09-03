import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const teamMigration = read("supabase/migrations/20260903182654_faturamento_equipe_cirurgica_origem_integrada.sql");
const typeMigration = read("supabase/migrations/20260903182902_faturamento_separacao_tipo_atendimento.sql");
const dischargeMigration = read("supabase/migrations/20260903184500_faturamento_reclassificar_tipo_na_alta.sql");

describe("integração Centro Cirúrgico → Faturamento", () => {
  it("usa a mesma cirurgia_equipe e marca complemento do faturamento sem falsificar confirmação clínica", () => {
    expect(teamMigration).toContain("origem_registro text not null default 'centro_cirurgico'");
    expect(teamMigration).toContain("confirmado_assistencial boolean not null default true");
    expect(teamMigration).toContain("faturamento_complementar_membro_equipe_cirurgica");
    expect(teamMigration).toContain("'faturamento',false");
    expect(teamMigration).toContain("equipe_complementada_faturamento");
    expect(teamMigration).toContain("v_sync:=public.faturamento_sincronizar_equipe_cirurgica");
  });

  it("confirma pelo Centro Cirúrgico e reconhece instrumentador previsto como faturável", () => {
    expect(teamMigration).toContain("origem_registro='centro_cirurgico',confirmado_assistencial=true");
    expect(teamMigration).toContain("when v_role='instrumentador' then coalesce((v_req->>'instrumentador')::boolean,true)");
  });

  it("a UI oferece apenas papéis faltantes e exige justificativa", () => {
    const component = read("src/components/faturamento/surgical-team-billing.tsx");
    const actions = read("src/modules/faturamento/equipe-cirurgica-background-actions.ts");
    expect(component).toContain("missingRoles");
    expect(component).toContain("Equipe incompleta no Centro Cirúrgico");
    expect(component).toContain("papel_selecao");
    expect(component).toContain("justificativa");
    expect(actions).toContain("faturamento_complementar_membro_equipe_cirurgica");
  });
});

describe("separação do faturamento por natureza de atendimento", () => {
  it("define exatamente PA, Ambulatório, Internação e SADT", () => {
    for (const type of ["pronto_atendimento", "ambulatorio", "internacao", "sadt"]) {
      expect(typeMigration).toContain(`'${type}'`);
    }
    expect(typeMigration).toContain("internacao > pronto_atendimento > sadt_eletivo > ambulatorio");
  });

  it("prioriza internação e pronto atendimento antes do SADT eletivo", () => {
    expect(typeMigration).toContain("if v_internacao then v_tipo:='internacao'");
    expect(typeMigration).toContain("elsif v_sinal_ps");
    expect(typeMigration).toContain("elsif v_sinal_sadt or (v_exames and not v_nao_exame) then v_tipo:='sadt'");
  });

  it("reclassifica contas automáticas na alta sem sobrescrever revisão manual", () => {
    expect(dischargeMigration).toContain("new.status='alta'");
    expect(dischargeMigration).toContain("tipo_atendimento_classificacao_origem='automatico'");
    expect(dischargeMigration).toContain("not exists(select 1 from public.tiss_guias");
  });

  it("não permite misturar tipos de atendimento no mesmo lote", () => {
    expect(typeMigration).toContain("validar_tipo_atendimento_lote_tiss_internal");
    expect(typeMigration).toContain("TISS_LOTE_TIPO_ATENDIMENTO_MISTO");
    expect(typeMigration).toContain("criar_lote_tiss_por_tipo_transacional");
    expect(typeMigration).toContain("cf.tipo_atendimento_faturamento=v_tipo_faturamento");
  });

  it("expõe os quatro tipos na relação de contas e na criação do lote", () => {
    const accounts = read("src/app/(painel)/faturamento/contas/page.tsx");
    const batches = read("src/components/faturamento/new-tiss-batch-by-type-modal.tsx");
    for (const label of ["Pronto Atendimento", "Ambulatório", "Internação", "SADT"]) {
      expect(accounts + batches).toContain(label);
    }
    expect(accounts).toContain("SADT corresponde ao exame eletivo fora do Pronto Atendimento e da Internação");
    expect(batches).toContain("bloqueia qualquer mistura entre PA, Ambulatório, Internação e SADT");
    expect(batches).toContain("gere outro lote separado");
  });
});
