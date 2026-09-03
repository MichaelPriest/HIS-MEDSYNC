import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("workspace do ciclo da receita", () => {
  it("mantém navegação única, orientada por tarefas, e modal acessível", () => {
    const nav = read("src/components/faturamento/billing-workspace-nav.tsx");
    const modal = read("src/components/faturamento/billing-modal.tsx");
    const billingLayout = read("src/app/(painel)/faturamento/layout.tsx");
    const financeLayout = read("src/app/(painel)/financeiro/layout.tsx");

    for (const label of ["Central", "Contas", "Produção", "Guias TISS", "Lotes", "Glosas", "Recursos", "Recebíveis", "Notas fiscais"]) {
      expect(nav).toContain(label);
    }
    expect(nav).toContain("Conta → produção → TISS → glosa → recebimento");
    expect(modal).toContain('role="dialog"');
    expect(modal).toContain('aria-modal="true"');
    expect(modal).toContain("Escape");
    expect(billingLayout).toContain("BillingWorkspaceNav");
    expect(financeLayout).toContain("BillingWorkspaceNav");
  });

  it("mantém a central de faturamento orientada por pendências", () => {
    const page = read("src/app/(painel)/faturamento/page.tsx");
    expect(page).toContain("Central do Ciclo da Receita");
    expect(page).toContain("O que precisa de ação agora");
    expect(page).toContain("Com críticas");
    expect(page).toContain("Glosas abertas");
    expect(page).toContain("Recebíveis vencidos");
    expect(page).toContain("NewBillingAccountModal");
    expect(page).toContain("NewTissBatchModal");
  });

  it("adiciona relação de contas com filtros equivalentes ao fluxo operacional", () => {
    const page = read("src/app/(painel)/faturamento/contas/page.tsx");
    expect(page).toContain("Relação de contas");
    expect(page).toContain("Filtros avançados");
    expect(page).toContain('name="convenio"');
    expect(page).toContain('name="plano"');
    expect(page).toContain('name="competencia"');
    expect(page).toContain('name="tipo"');
    expect(page).toContain('name="status"');
    expect(page).toContain("Internação");
    expect(page).toContain("Ambulatório");
    expect(page).toContain("Pronto-socorro");
    expect(page).not.toMatch(/\.insert\(|\.update\(|\.delete\(|\.upsert\(/);
  });

  it("cria centrais reais para Guias, Recursos e Recebíveis", () => {
    const guides = read("src/app/(painel)/faturamento/guias/page.tsx");
    const appeals = read("src/app/(painel)/faturamento/recursos/page.tsx");
    const receivables = read("src/app/(painel)/financeiro/recebiveis/page.tsx");

    expect(guides).toContain("Central de Guias TISS");
    expect(guides).toContain("tiss_guia_criticas");
    expect(guides).toContain('name="q"');
    expect(appeals).toContain("Central de Recursos de Glosa");
    expect(appeals).toContain("tiss_recursos_glosa");
    expect(receivables).toContain("Central de Recebíveis");
    expect(receivables).toContain('name="vencidos"');
  });

  it("move criação de lote, recurso e NFS-e para modais com background actions", () => {
    const actions = read("src/modules/faturamento/workspace-background-actions.ts");
    const forms = read("src/components/faturamento/billing-workspace-actions.tsx");
    const lots = read("src/app/(painel)/faturamento/lotes/page.tsx");
    const denials = read("src/app/(painel)/faturamento/glosas/page.tsx");
    const invoices = read("src/app/(painel)/financeiro/notas-fiscais/page.tsx");

    expect(actions).toContain("criar_lote_tiss_transacional");
    expect(actions).toContain("criar_recurso_glosa_tiss_transacional");
    expect(actions).toContain("criar_nfse_lote_operacional");
    expect(actions).not.toContain('from "next/navigation"');
    expect(actions).not.toMatch(/\bredirect\s*\(/);
    expect(forms).toContain("NewTissBatchModal");
    expect(forms).toContain("GlosaAppealModal");
    expect(forms).toContain("NewNfseModal");
    expect(forms).toContain("Salvando…");
    expect(lots).toContain("NewTissBatchModal");
    expect(lots).not.toContain("criarLoteTiss");
    expect(denials).toContain("GlosaAppealModal");
    expect(denials).not.toContain("criarRecursoGlosa");
    expect(invoices).toContain("NewNfseModal");
    expect(invoices).not.toContain("criarNotaFiscalLote");
  });

  it("mantém produção pesquisável e contingência sem redirect", () => {
    const page = read("src/app/(painel)/faturamento/producao/page.tsx");
    const actions = read("src/modules/faturamento/producao-background-actions.ts");
    expect(page).toContain("ProductionSyncModal");
    expect(page).toContain('name="q"');
    expect(page).toContain('name="status"');
    expect(page).toContain('name="tipo"');
    expect(page).not.toContain("sincronizarProducaoAtendimentoAction");
    expect(actions).toContain("sincronizar_producao_atendimento");
    expect(actions).not.toMatch(/\bredirect\s*\(/);
  });

  it("mantém cockpit contextual da conta hospitalar", () => {
    const layout = read("src/app/(painel)/faturamento/[contaId]/layout.tsx");
    expect(layout).toContain("Cockpit da conta hospitalar");
    expect(layout).toContain("Valor líquido");
    expect(layout).toContain("Convênio / plano");
    expect(layout).toContain("Resumo");
    expect(layout).toContain("Lançamentos");
    expect(layout).toContain("Catálogo");
    expect(layout).toContain("Cirurgia / SADT");
    expect(layout).toContain("Guias / Autorizações");
    expect(layout).toContain("Produção");
    expect(layout).toContain("Críticas");
    expect(layout).toContain("Prontuário");
    expect(layout).toContain("Relação de contas");
  });
});
