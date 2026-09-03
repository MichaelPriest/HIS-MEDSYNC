import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Comercial / simulador de precificação", () => {
  it("mantém o simulador somente leitura e protegido por permissão comercial", () => {
    const migration = read("supabase/migrations/20260903111259_comercial_simulador_precificacao.sql");
    expect(migration).toContain("create or replace function public.comercial_simular_precificacao");
    expect(migration).toContain("comercial_pode_visualizar");
    expect(migration).toContain("obter_valor_item_comercial_tuss_contextual_internal");
    expect(migration).toContain("revoke all on function public.comercial_simular_precificacao");
    expect(migration).not.toMatch(/\binsert\s+into\b/i);
    expect(migration).not.toMatch(/\bupdate\s+public\./i);
    expect(migration).not.toMatch(/\bdelete\s+from\b/i);
  });

  it("usa o mesmo contexto e regras determinísticas do faturamento", () => {
    const migration = read("supabase/migrations/20260903111259_comercial_simulador_precificacao.sql");
    for (const token of [
      "MULTIPLO_N",
      "URGENCIA",
      "HORARIO_ESPECIAL",
      "ACOMODACAO_INDIVIDUAL",
      "ANESTESIA",
      "AUXILIARES",
      "sequencia_min",
      "sequencia_max",
      "via_acesso",
      "mesma_via",
      "origem_tipo",
      "substituir_valor",
      "descontar_percentual",
      "acrescentar_percentual",
      "encerra_processamento",
    ]) expect(migration).toContain(token);
  });

  it("detecta contrato contextual diferente em vez de homologar preço enganoso", () => {
    const migration = read("supabase/migrations/20260903111259_comercial_simulador_precificacao.sql");
    expect(migration).toContain("contrato_contextual_diferente");
    expect(migration).toContain("contrato_selecionado_id");
    expect(migration).toContain("contrato_resolvido_id");
    expect(migration).toContain("sem_preco_contratual");
    expect(migration).toContain("contrato_fora_contexto");
  });

  it("expõe memória de cálculo e fatores do ato sem persistência", () => {
    const page = read("src/app/(painel)/comercial/simulador/page.tsx");
    expect(page).toContain("comercial_simular_precificacao");
    expect(page).toContain("comercial_prontidao_contrato");
    expect(page).toContain('name="urgencia"');
    expect(page).toContain('name="horario_especial"');
    expect(page).toContain('name="acomodacao_individual"');
    expect(page).toContain('name="anestesia"');
    expect(page).toContain('name="auxiliares"');
    expect(page).toContain('name="sequencia"');
    expect(page).toContain('name="via_acesso"');
    expect(page).toContain('name="mesma_via"');
    expect(page).toContain("Memória da base");
    expect(page).toContain("Caminho do valor base ao valor final");
    expect(page).toContain("Simulação somente leitura");
  });

  it("inclui o simulador na navegação comercial", () => {
    const nav = read("src/components/cadastros/cadastros-workspace-nav.tsx");
    expect(nav).toContain('{href:"/comercial/simulador",label:"Simulador de preço"');
  });
});
