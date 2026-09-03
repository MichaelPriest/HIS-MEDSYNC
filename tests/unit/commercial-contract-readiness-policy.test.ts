import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Comercial / prontidão contratual", () => {
  it("mantém o diagnóstico somente leitura e protegido por escopo", () => {
    const migration = read("supabase/migrations/20260903033044_comercial_prontidao_contratual.sql");
    expect(migration).toContain("create or replace function public.comercial_prontidao_contrato");
    expect(migration).toContain("stable");
    expect(migration).toContain("comercial_pode_visualizar");
    expect(migration).toContain("revoke all on function public.comercial_prontidao_contrato(uuid,date) from public, anon");
    expect(migration).not.toMatch(/\binsert\s+into\b/i);
    expect(migration).not.toMatch(/\bupdate\s+public\./i);
    expect(migration).not.toMatch(/\bdelete\s+from\b/i);
  });

  it("falha fechado para componentes comerciais necessários", () => {
    const migration = read("supabase/migrations/20260903033044_comercial_prontidao_contratual.sql");
    for (const code of [
      "CONTRATO_FORA_VIGENCIA",
      "SEM_TABELA_VINCULADA",
      "EDICAO_NAO_RESOLVIDA",
      "EDICAO_SEM_ITENS",
      "BASE_PRECO_NAO_DEFINIDA",
      "ITENS_SEM_BASE_PRECO",
      "AMB_SADT_AUSENTE",
      "AMB_FILME_AUSENTE",
      "CH_CONTRATUAL_AUSENTE",
      "HM_CONTRATUAL_AUSENTE",
      "SADT_CONTRATUAL_AUSENTE",
      "CBHPM_UCO_AUSENTE",
      "CBHPM_PORTES_PROCEDIMENTO_AUSENTES",
    ]) expect(migration).toContain(code);
  });

  it("sinaliza pendências TUSS e empates sem inventar correção", () => {
    const migration = read("supabase/migrations/20260903033044_comercial_prontidao_contratual.sql");
    expect(migration).toContain("TUSS_NAO_MAPEADO");
    expect(migration).toContain("contrato_depara_tuss");
    expect(migration).toContain("referencia_equivalencias");
    expect(migration).toContain("PRIORIDADE_TABELA_EMPATE");
    expect(migration).toContain("não cria preço, edição, porte ou DePara automaticamente");
  });

  it("expõe a data de referência e ações corretivas por domínio", () => {
    const page = read("src/app/(painel)/comercial/prontidao/page.tsx");
    expect(page).toContain('name="data"');
    expect(page).toContain("comercial_prontidao_contrato");
    expect(page).toContain("Prontidão não significa homologação");
    expect(page).toContain("Revisar DePara TUSS");
    expect(page).toContain("Revisar CBHPM");
    expect(page).toContain("Revisar negociação");
    expect(page).toContain("Nenhum dado é preenchido pelo diagnóstico");
  });

  it("inclui a central na navegação comercial", () => {
    const nav = read("src/components/cadastros/cadastros-workspace-nav.tsx");
    expect(nav).toContain('{href:"/comercial/prontidao",label:"Prontidão comercial"');
  });
});
