import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Comercial / Central de Histórico", () => {
  it("é somente leitura e usa a auditoria comercial existente", () => {
    const page = read("src/app/(painel)/comercial/historico/page.tsx");
    expect(page).toContain('.from("comercial_eventos")');
    expect(page).toContain('.eq("empresa_id", empresaId)');
    expect(page).not.toMatch(/\.insert\(/);
    expect(page).not.toMatch(/\.update\(/);
    expect(page).not.toMatch(/\.delete\(/);
    expect(page).not.toMatch(/\.upsert\(/);
  });

  it("inclui o próprio contrato e os principais objetos comerciais no histórico", () => {
    const page = read("src/app/(painel)/comercial/historico/page.tsx");
    for (const entity of [
      "credenciamento_contratos",
      "contrato_tabelas_comerciais",
      "contrato_depara_tuss",
      "contrato_regras_faturamento",
      "tabelas_comerciais_edicoes",
      "tabelas_comerciais_itens",
    ]) expect(page).toContain(entity);
  });

  it("pagina os eventos para não carregar a trilha inteira", () => {
    const page = read("src/app/(painel)/comercial/historico/page.tsx");
    expect(page).toContain("const PAGE_SIZE = 50");
    expect(page).toContain(".range(start, start + PAGE_SIZE - 1)");
    expect(page).toContain('{ count: "exact" }');
  });

  it("expõe filtros por contrato, entidade, ação e período", () => {
    const page = read("src/app/(painel)/comercial/historico/page.tsx");
    expect(page).toContain('name="contrato"');
    expect(page).toContain('name="entidade"');
    expect(page).toContain('name="acao"');
    expect(page).toContain('name="de"');
    expect(page).toContain('name="ate"');
  });

  it("fica acessível pela navegação comercial", () => {
    const nav = read("src/components/cadastros/cadastros-workspace-nav.tsx");
    expect(nav).toContain('{href:"/comercial/historico",label:"Histórico comercial"');
  });
});
