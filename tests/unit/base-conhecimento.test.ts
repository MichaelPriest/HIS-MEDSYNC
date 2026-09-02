import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Base de Conhecimento", () => {
  it("transforma /manual em uma experiência pesquisável", () => {
    const page = read("src/app/(painel)/manual/page.tsx");
    const browser = read("src/components/manual/knowledge-base-browser.tsx");

    expect(page).toContain("Base de Conhecimento do MedSync HIS");
    expect(page).toContain("KnowledgeBaseBrowser");
    expect(browser).toContain("Pesquisar na base de conhecimento");
    expect(browser).toContain("useMemo");
    expect(browser).toContain("useState");
    expect(browser).toContain("Ver passo a passo");
  });

  it("cobre os principais fluxos operacionais sem inventar homologação", () => {
    const articles = read("src/modules/knowledge-base/articles.ts");

    for (const term of [
      "recepcao-senhas-admissao",
      "autorizacoes-guias",
      "triagem-fila-medica",
      "prontuario-prescricao",
      "enfermagem-administracao",
      "farmacia-fefo",
      "laboratorio-lis",
      "imagem-ris-pacs",
      "internacao-nir-leitos",
      "auditoria-contas-medicas",
      "faturamento-tiss",
      "glosas-recursos",
      "financeiro-nfse",
      "compras-estoque",
      "usuarios-permissoes",
    ]) expect(articles).toContain(term);

    expect(articles).toContain("sourceDocs");
    expect(articles).toContain("homolog");
    expect(articles).not.toContain("paciente fictício");
  });
});
