import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const migration = read("supabase/migrations/20260903180554_faturamento_equipe_cirurgica_honorarios_amb_cbhpm.sql");

describe("faturamento da equipe cirúrgica AMB/CBHPM", () => {
  it("usa colunas estruturadas da tabela para auxiliares e anestesia", () => {
    expect(migration).toContain("v_item.quantidade_auxiliares");
    expect(migration).toContain("v_item.ch_anestesista");
    expect(migration).toContain("centro_cirurgico_requisitos_equipe_item");
  });

  it("aplica os percentuais definidos por papel e limita auxiliares pela tabela", () => {
    expect(migration).toContain("v_pct:=100");
    expect(migration).toContain("v_pct:=30");
    expect(migration).toContain("v_pct:=20");
    expect(migration).toContain("v_pct:=10");
    expect(migration).toContain("v_membro.ordem_participacao>v_aux_req");
    expect(migration).toContain("fora_quantidade_auxiliares_tabela");
  });

  it("prioriza CH explícito do item AMB90/92 e usa porte apenas como fallback", () => {
    expect(migration).toContain("case when coalesce(v_item.ch_anestesista,0)>0 then v_item.ch_anestesista else public.faturamento_amb_porte_anestesico_ch(v_porte) end");
    for (const pair of ["'1' then 70", "'2' then 110", "'3' then 170", "'4' then 250", "'5' then 380", "'6' then 550", "'7' then 780"]) {
      expect(migration).toContain(pair);
    }
  });

  it("não embute valores monetários aproximados da AMB96/99", () => {
    expect(migration).toContain("amb96_99_metodo");
    expect(migration).toContain("conversao_ch");
    expect(migration).toContain("valor_tabela_reajustado");
    expect(migration).not.toContain("35.00");
    expect(migration).not.toContain("55.00");
    expect(migration).not.toContain("390.00");
  });

  it("mantém snapshot, cobrança, repasse e justificativa auditáveis", () => {
    expect(migration).toContain("create table if not exists public.faturamento_equipe_cirurgica");
    expect(migration).toContain("cobrar_regra boolean");
    expect(migration).toContain("repasse boolean");
    expect(migration).toContain("FAT_EQUIPE_JUSTIFICATIVA_OBRIGATORIA");
    expect(migration).toContain("auditoria_eventos");
    expect(migration).toContain("force row level security");
    expect(migration).toContain("revoke insert,update,delete");
  });

  it("materializa honorários na conta sem DML direto no cliente", () => {
    const actions = read("src/modules/faturamento/equipe-cirurgica-background-actions.ts");
    const component = read("src/components/faturamento/surgical-team-billing.tsx");
    const page = read("src/app/(painel)/faturamento/[contaId]/procedimentos-cirurgicos/page.tsx");
    expect(migration).toContain("origem_tipo,origem_id");
    expect(migration).toContain("'honorario'");
    expect(actions).toContain("faturamento_sincronizar_equipe_cirurgica");
    expect(actions).toContain("faturamento_atualizar_equipe_cirurgica");
    expect(actions).not.toMatch(/\.from\([^)]*faturamento_equipe_cirurgica[^)]*\)\.(insert|update|delete|upsert)/s);
    expect(component).toContain("Cobrar");
    expect(component).toContain("Repasse");
    expect(component).toContain("Sincronizar equipe e honorários");
    expect(page).toContain("SurgicalTeamBillingPanel");
  });
});
