import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath =
  "supabase/migrations/20260901225717_faturamento_fallback_comercial_tuss.sql";

function migration() {
  return readFileSync(join(process.cwd(), migrationPath), "utf8");
}

describe("fallback comercial TUSS no faturamento", () => {
  it("resolve de/para fonte -> TUSS sem hardcode de procedimento ou preço", () => {
    const sql = migration();

    expect(sql).toContain("obter_valor_item_comercial_tuss_internal");
    expect(sql).toContain("upper(eq.sistema_destino) = 'TUSS'");
    expect(sql).toContain("eq.codigo_destino = p_codigo");
    expect(sql).toContain("v_map.codigo_origem");
    expect(sql).toContain("'fonte_para_tuss_reverso'");
    expect(sql).not.toContain("10101012");
    expect(sql).not.toContain("10014");
    expect(sql).not.toContain("15.00");
  });

  it("mantém o helper de resolução restrito ao backend", () => {
    const sql = migration();

    expect(sql).toContain(
      "revoke all on function public.obter_valor_item_comercial_tuss_internal(uuid,uuid,text,date,text) from public, anon, authenticated;",
    );
  });

  it("tenta o catálogo legado antes do fallback comercial versionado", () => {
    const sql = migration();
    const legado = sql.indexOf("obter_valor_procedimento_contratual(");
    const comercial = sql.indexOf("obter_valor_item_comercial_tuss_internal(", legado);

    expect(legado).toBeGreaterThan(-1);
    expect(comercial).toBeGreaterThan(legado);
    expect(sql).toContain("v_usou_comercial := v_preco.valor is not null");
  });

  it("grava a referência na família de FK correspondente ao catálogo usado", () => {
    const sql = migration();

    expect(sql).toContain(
      "tabela_procedimento_edicao_id = case when v_usou_comercial then null else v_preco.edicao_id end",
    );
    expect(sql).toContain(
      "tabela_procedimento_item_id = case when v_usou_comercial then null else v_preco.item_id end",
    );
    expect(sql).toContain(
      "tabela_comercial_edicao_id = case when v_usou_comercial then v_preco.edicao_id else null end",
    );
    expect(sql).toContain(
      "tabela_comercial_item_id = case when v_usou_comercial then v_preco.item_id else null end",
    );
    expect(sql).toContain("'catalogo_preco'");
  });
});
