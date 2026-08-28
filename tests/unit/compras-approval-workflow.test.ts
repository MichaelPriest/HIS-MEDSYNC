import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const actions = readFileSync("src/modules/compras/actions.ts", "utf8");
const migration = readFileSync("supabase/migrations/20260828173414_compras_alcadas_aprovacao_operacional.sql", "utf8");

describe("workflow de aprovação de compras", () => {
  it("não usa compras.gerenciar como substituto de compras.aprovar nas actions financeiras", () => {
    const approvalAction = actions.slice(actions.indexOf("export async function aprovarFornecedorCotacao"), actions.indexOf("export async function rejeitarCotacaoCompra"));
    const orderAction = actions.slice(actions.indexOf("export async function gerarPedidoDaCotacao"));
    expect(approvalAction).toContain('requireAnyPermission(["compras.aprovar"])');
    expect(approvalAction).not.toContain('"compras.gerenciar"');
    expect(orderAction).toContain('requireAnyPermission(["compras.aprovar"])');
    expect(orderAction).not.toContain('"compras.gerenciar"');
  });

  it("bloqueia aprovação sem alçada e autoaprovação do solicitante no banco", () => {
    expect(migration).toContain("COMPRAS_ALCADA_NAO_CONFIGURADA");
    expect(migration).toContain("COMPRAS_SEGREGACAO_SOLICITANTE_APROVADOR");
    expect(migration).toContain("unique (fluxo_id, aprovador_id)");
  });

  it("remove escrita direta das tabelas financeiras críticas", () => {
    expect(migration).toContain("revoke insert, update, delete on public.compras_cotacoes");
    expect(migration).toContain("public.compras_pedidos, public.compras_pedido_itens from authenticated, anon");
    expect(migration).toContain("COMPRAS_VALOR_ALTERADO_APOS_APROVACAO");
  });
});
