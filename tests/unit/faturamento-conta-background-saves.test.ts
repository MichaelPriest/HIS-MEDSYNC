import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Conta hospitalar em segundo plano", () => {
  it("preserva RPCs canônicos das operações convertidas", () => {
    const source = read("src/modules/faturamento/conta-background-actions.ts");
    expect(source).toContain("atualizar_resumo_conta_faturamento");
    expect(source).toContain("sincronizar_producao_atendimento");
    expect(source).toContain("recalcular_conta_contratual_avancada");
    expect(source).toContain("validar_conta_tiss");
    expect(source).toContain("excluir_item_conta_faturamento");
    expect(source).not.toContain('from "next/navigation"');
    expect(source).not.toMatch(/\bredirect\s*\(/);
  });

  it("mantém feedback inline e ação alternativa de exclusão no formulário do item", () => {
    const source = read("src/components/faturamento/account-background-forms.tsx");
    expect(source).toContain("useActionState");
    expect(source).toContain('aria-live="polite"');
    expect(source).toContain("Salvando…");
    expect(source).toContain("formAction={formAction}");
  });

  it("liga a página às ações em segundo plano sem remover a geração real da guia", () => {
    const source = read("src/app/(painel)/faturamento/[contaId]/page.tsx");
    expect(source).toContain("AccountBackgroundForm");
    expect(source).toContain("AccountItemDeleteButton");
    expect(source).not.toContain("atualizarResumoConta");
    expect(source).not.toContain("excluirLancamentoConta");
    expect(source).not.toContain("sincronizarProducaoConta");
    expect(source).not.toContain("recalcularPrecosConta");
    expect(source).not.toContain("validarContaTissOperacional");
    expect(source).toContain("gerarGuiaTiss");
    expect(source).toContain("salvarLancamentoConta");
  });
});
