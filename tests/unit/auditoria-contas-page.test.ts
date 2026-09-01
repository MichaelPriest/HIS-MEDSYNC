import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("Auditoria de Contas", () => {
  it("desambigua o vínculo com contas_faturamento no PostgREST", () => {
    const page = source("src/app/(painel)/auditoria/page.tsx");

    expect(page).toContain(
      "conta:contas_faturamento!auditoria_contas_conta_id_fkey(id,valor_bruto,valor_liquido,status)",
    );
    expect(page).not.toContain("conta:contas_faturamento(id,valor_bruto,valor_liquido,status)");
  });

  it("não converte erro de carregamento em fila vazia silenciosa", () => {
    const page = source("src/app/(painel)/auditoria/page.tsx");

    expect(page).toContain("const { data, error } = await supabase");
    expect(page).toContain("Não foi possível carregar a fila de Auditoria");
    expect(page).toContain("error ? null");
  });

  it("persiste a revalidação antes de tentar liberar a conta", () => {
    const actions = source("src/modules/auditoria/actions.ts");
    const revalidacao = actions.indexOf('"executar_auditoria_conta_automatica"');
    const leituraImpedimentos = actions.indexOf('.from("auditoria_conta_itens")', revalidacao);
    const liberacao = actions.indexOf('"liberar_auditoria_conta"', leituraImpedimentos);

    expect(revalidacao).toBeGreaterThan(-1);
    expect(leituraImpedimentos).toBeGreaterThan(revalidacao);
    expect(liberacao).toBeGreaterThan(leituraImpedimentos);
    expect(actions).toContain('.eq("resolvida", false)');
    expect(actions).toContain('.in("severidade", ["erro", "bloqueio"])');
    expect(actions).toContain("A conta ainda possui pendência impeditiva após a revalidação automática.");
  });

  it("usa finalizado_em no evento de integração da liberação", () => {
    const migration = source(
      "supabase/migrations/20260901223840_auditoria_trigger_liberacao_finalizado_em.sql",
    );

    expect(migration).toContain("coalesce(new.finalizado_em, now())");
    expect(migration).not.toContain("new.liberado_em");
    expect(migration).toContain("'conta.auditada'");
  });
});
