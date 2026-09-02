import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("lançamentos e atos do faturamento em segundo plano", () => {
  it("mantém uma única implementação da resolução comercial e do RPC de lançamento", () => {
    const service = read("src/modules/faturamento/conta-item-service.ts");
    const background = read("src/modules/faturamento/conta-item-background-actions.ts");
    const legacy = read("src/modules/faturamento/conta-operacional-actions.ts");
    expect(service).toContain("obter_valor_item_comercial");
    expect(service).toContain("salvar_item_conta_faturamento");
    expect(service).toContain("memoria_calculo_comercial");
    expect(service).toContain("recalcular_item_contratual_avancado");
    expect(background).toContain("saveBillingAccountItem");
    expect(background).not.toContain('from "next/navigation"');
    expect(background).not.toMatch(/\bredirect\s*\(/);
    expect(legacy).toContain("saveBillingAccountItem");
    expect((legacy.match(/obter_valor_item_comercial/g) ?? [])).toHaveLength(0);
  });

  it("mantém formulários de lançamento com useActionState e feedback acessível", () => {
    const form = read("src/components/faturamento/billing-item-background-form.tsx");
    expect(form).toContain("useActionState");
    expect(form).toContain('aria-live="polite"');
    expect(form).toContain("Salvando…");
    expect(form).toContain("AccountItemDeleteButton");
    expect(form).not.toContain("router.refresh");
    expect(form).not.toContain("window.location");
  });

  it("liga conta e catálogo ao fluxo de lançamento em segundo plano", () => {
    const account = read("src/app/(painel)/faturamento/[contaId]/page.tsx");
    const catalog = read("src/app/(painel)/faturamento/[contaId]/catalogo/page.tsx");
    expect(account).toContain("BillingItemBackgroundForm");
    expect(account).not.toContain("salvarLancamentoConta");
    expect(catalog).toContain("BillingItemBackgroundForm");
    expect(catalog).not.toContain("salvarLancamentoConta");
  });

  it("mantém atos e SADT sem redirect e preserva bloqueios por conta/guia", () => {
    const actions = read("src/modules/faturamento/atos-background-actions.ts");
    const form = read("src/components/faturamento/billing-act-background-form.tsx");
    const page = read("src/app/(painel)/faturamento/[contaId]/procedimentos-cirurgicos/page.tsx");
    expect(actions).toContain('requirePermission("faturamento.criar")');
    expect(actions).toContain("guia-tiss-ativa");
    expect(actions).toContain("recalcular_item_contratual_avancado");
    expect(actions).not.toContain('from "next/navigation"');
    expect(actions).not.toMatch(/\bredirect\s*\(/);
    expect(form).toContain("useActionState");
    expect(form).toContain('aria-live="polite"');
    expect(form).toContain("Salvando…");
    expect(page).toContain("BillingActBackgroundForm");
    expect(page).not.toContain("atualizarGrupoAto");
    expect(page).not.toContain("criarGrupoAto");
    expect(page).not.toContain("recalcularGrupoAto");
  });
});
