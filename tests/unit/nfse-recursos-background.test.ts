import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("NFS-e e recursos de glosa", () => {
  it("registra emissão manual da NFS-e em segundo plano pelo RPC operacional", () => {
    const actions = read("src/modules/nfse/background-actions.ts");
    const form = read("src/components/financeiro/nfse-manual-background-form.tsx");
    const page = read("src/app/(painel)/financeiro/notas-fiscais/[notaId]/page.tsx");

    expect(actions).toContain("BackgroundActionState");
    expect(actions).toContain("registrar_estado_nfse_operacional");
    expect(actions).not.toContain('from "next/navigation"');
    expect(actions).not.toMatch(/\bredirect\s*\(/);
    expect(form).toContain("useActionState");
    expect(form).toContain('aria-live="polite"');
    expect(form).toContain("Salvando…");
    expect(page).toContain("NfseManualBackgroundForm");
    expect(page).not.toContain("registrarEmissaoManualNfse.bind");
  });

  it("mantém a emissão automática como transição externa auditada", () => {
    const legacy = read("src/modules/nfse/actions.ts");
    const page = read("src/app/(painel)/financeiro/notas-fiscais/[notaId]/page.tsx");

    expect(legacy).toContain("emitirNfseIntegracao");
    expect(legacy).toContain("registrar_transacao_nfse_operacional");
    expect(legacy).toContain("postJsonMtls");
    expect(page).toContain("Emitir via integração");
  });

  it("expõe o recurso de glosa com visão financeira e retorno por RPC transacional", () => {
    const page = read("src/app/(painel)/faturamento/recursos/[recursoId]/page.tsx");
    const actions = read("src/modules/tiss/recurso-background-actions.ts");
    const modal = read("src/components/faturamento/recurso-retorno-modal.tsx");

    expect(page).toContain("Resultado financeiro do recurso");
    expect(page).toContain("Linha do tempo");
    expect(page).toContain("Retorno financeiro transacional");
    expect(page).toContain("valor_deferido");
    expect(page).toContain("valor_indeferido");
    expect(page).toContain("Aguardando retorno");
    expect(page).toContain("sem DML direto pela interface");
    expect(page).toContain("RecursoRetornoModal");
    expect(actions).toContain("registrar_retorno_recurso_glosa_transacional");
    expect(modal).toContain("useActionState");
    expect(modal).toContain('aria-live="polite"');
    expect(page).not.toContain('.from("tiss_recurso_itens").update(');
    expect(page).not.toContain('.from("tiss_recursos_glosa").update(');
  });
});
