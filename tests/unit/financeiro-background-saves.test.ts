import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Financeiro em segundo plano", () => {
  it("preserva RPCs canônicos do ledger sem redirect", () => {
    const source = read("src/modules/financeiro/background-actions.ts");
    expect(source).toContain("registrar_recebimento_financeiro_operacional");
    expect(source).toContain("conciliar_recebimento_financeiro_operacional");
    expect(source).toContain("estornar_recebimento_financeiro_operacional");
    expect(source).toContain("BackgroundActionState");
    expect(source).not.toContain('from "next/navigation"');
    expect(source).not.toMatch(/\bredirect\s*\(/);
  });

  it("mantém feedback acessível e campos no próprio formulário", () => {
    const source = read("src/components/financeiro/receivable-background-forms.tsx");
    expect(source).toContain("useActionState");
    expect(source).toContain('aria-live="polite"');
    expect(source).toContain("Salvando…");
    expect(source).toContain('name="valor_baixado"');
    expect(source).toContain('name="motivo"');
    expect(source).not.toContain("router.refresh");
  });

  it("remove actions legadas da página de detalhe", () => {
    const source = read("src/app/(painel)/financeiro/recebiveis/[recebivelId]/page.tsx");
    expect(source).toContain("ReceivablePaymentForm");
    expect(source).toContain("ReceivableLedgerActions");
    expect(source).not.toContain("registrarRecebimentoFinanceiro");
    expect(source).not.toContain("conciliarRecebimentoFinanceiro");
    expect(source).not.toContain("estornarRecebimentoFinanceiro");
    expect(source).not.toContain("searchParams");
  });
});
