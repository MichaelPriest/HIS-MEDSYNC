import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Auditoria - fila atual e salvamentos em segundo plano", () => {
  it("não mistura histórico resolvido com pendências atuais", () => {
    const page = read("src/app/(painel)/auditoria/page.tsx");

    expect(page).toContain("Pendências e críticas atuais");
    expect(page).toContain("Histórico resolvido");
    expect(page).toContain("resolvedHistoryGroups");
    expect(page).toContain("abertasDaConta.map");
    expect(page).not.toContain("itens.map((item)");
    expect(page).toContain("verificações históricas");
  });

  it("não oferece reabertura manual para crítica automática resolvida", () => {
    const page = read("src/app/(painel)/auditoria/page.tsx");

    expect(page).toContain("!latest.automatizada");
    expect(page).toContain("ReabrirPendenciaButton");
  });

  it("remove feedback por query string e usa ações inline", () => {
    const page = read("src/app/(painel)/auditoria/page.tsx");
    const actions = read("src/modules/auditoria/actions.ts");
    const ui = read("src/components/auditoria/auditoria-background-actions.tsx");

    expect(page).not.toContain("searchParams");
    expect(page).not.toContain("Operação bloqueada:");
    expect(actions).toContain("BackgroundActionState");
    expect(actions).not.toContain('from "next/navigation"');
    expect(actions).not.toMatch(/\bredirect\s*\(/);
    expect(ui).toContain("useActionState");
    expect(ui).toContain('aria-live="polite"');
    expect(ui).toContain("Salvando…");
    expect(ui).not.toContain("router.refresh");
    expect(ui).not.toContain("window.location");
  });

  it("revalida no RPC antes de liberar e mostra a causa correta do bloqueio", () => {
    const actions = read("src/modules/auditoria/actions.ts");
    const ui = read("src/components/auditoria/auditoria-background-actions.tsx");

    expect(actions).toContain('rpc("liberar_auditoria_conta"');
    expect(actions).toContain("Existem pendencias impeditivas");
    expect(actions).toContain("A conta ainda possui pendência impeditiva após a revalidação automática.");
    expect(actions).not.toContain('.from("contas_faturamento").update({ auditoria_liberada: true');
    expect(ui).toContain("Revalidar e liberar para Contas Médicas");
    expect(ui).toContain("A auditoria será reexecutada no banco antes da liberação.");
    expect(ui).not.toContain("disabled={impeditivasNaUltimaVerificacao > 0}");
  });
});
