import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("base de conhecimento contextual do ciclo da receita", () => {
  it("publica guias específicos para conta, TISS, glosa, recurso e financeiro", () => {
    const articles = read("src/modules/knowledge-base/faturamento-tiss-articles.ts");
    for (const slug of [
      "faturamento-conta-producao",
      "faturamento-tiss-guia-lote",
      "faturamento-glosa-analise",
      "faturamento-recurso-glosa-retorno",
      "financeiro-recebiveis-nfse",
    ]) {
      expect(articles).toContain(`slug: "${slug}"`);
    }
    expect(articles.includes("RPC transacional") || articles.includes("transacional")).toBe(true);
    expect(articles).toContain("sourceDocs");
    expect(articles).toContain("docs/FATURAMENTO_UX_OPERACIONAL_V2.md");
    expect(articles).toContain("docs/TISS_XSD_ANS.md");
  });

  it("integra os novos guias ao manual sem duplicar a documentação fonte", () => {
    const page = read("src/app/(painel)/manual/page.tsx");
    expect(page).toContain("billingTissKnowledgeBaseArticles");
    expect(page).toContain("...billingTissKnowledgeBaseArticles");
    expect(page).toContain("audiences={audiences}");
    expect(page).toContain("Todos os perfis");
  });

  it("leva o usuário ao artigo correspondente à etapa atual do ciclo da receita", () => {
    const nav = read("src/components/faturamento/billing-workspace-nav.tsx");
    expect(nav).toContain("helpHrefFor");
    expect(nav).toContain("/manual#faturamento-recurso-glosa-retorno");
    expect(nav).toContain("/manual#faturamento-glosa-analise");
    expect(nav).toContain("/manual#faturamento-tiss-guia-lote");
    expect(nav).toContain("/manual#financeiro-recebiveis-nfse");
    expect(nav).toContain("/manual#faturamento-equipe-cirurgica-amb-cbhpm");
    expect(nav).toContain("Ajuda desta etapa");
  });

  it("abre automaticamente o passo a passo quando a ajuda chega por hash", () => {
    const browser = read("src/components/manual/knowledge-base-browser.tsx");
    expect(browser).toContain("window.location.hash");
    expect(browser).toContain("HTMLDetailsElement");
    expect(browser).toContain('addEventListener("hashchange"');
    expect(browser).toContain("scrollIntoView");
  });

  it("permite filtrar os guias pelo perfil operacional sem esconder a ajuda contextual", () => {
    const browser = read("src/components/manual/knowledge-base-browser.tsx");
    expect(browser).toContain('const [audience, setAudience] = useState("Todos os perfis")');
    expect(browser).toContain('article.audience.includes(audience)');
    expect(browser).toContain('aria-label="Filtrar por perfil operacional"');
    expect(browser).toContain("Limpar filtros");
    expect(browser).toContain('setAudience("Todos os perfis")');
  });
});
