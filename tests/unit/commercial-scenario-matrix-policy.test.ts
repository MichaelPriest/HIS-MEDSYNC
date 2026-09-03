import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Comercial / matriz de cenários", () => {
  it("compara somente contextos ativos do mesmo convênio e data", () => {
    const migration = read("supabase/migrations/20260903145847_comercial_matriz_cenarios_contextuais.sql");
    expect(migration).toContain("create or replace function public.comercial_simular_matriz_cenarios");
    expect(migration).toContain("c.convenio_id = v_root.convenio_id");
    expect(migration).toContain("c.status = 'ativo'");
    expect(migration).toContain("c.data_inicio is null or c.data_inicio <= v_data");
    expect(migration).toContain("c.data_fim is null or c.data_fim >= v_data");
  });

  it("reutiliza prontidão e o simulador oficial sem criar segunda precificação", () => {
    const migration = read("supabase/migrations/20260903145847_comercial_matriz_cenarios_contextuais.sql");
    expect(migration).toContain("public.comercial_prontidao_contrato");
    expect(migration).toContain("public.comercial_simular_precificacao");
    expect(migration).toContain("sobreposicoes_contexto");
    expect(migration).not.toMatch(/insert\s+into/i);
    expect(migration).not.toMatch(/update\s+public\./i);
    expect(migration).not.toMatch(/delete\s+from/i);
  });

  it("mantém a RPC somente para autenticados e respeita escopo comercial", () => {
    const migration = read("supabase/migrations/20260903145847_comercial_matriz_cenarios_contextuais.sql");
    expect(migration).toContain("auth.uid() is null");
    expect(migration).toContain("public.comercial_pode_visualizar");
    expect(migration).toContain("revoke all on function public.comercial_simular_matriz_cenarios");
    expect(migration).toContain("grant execute on function public.comercial_simular_matriz_cenarios");
  });

  it("expõe a matriz na interface comercial", () => {
    const page = read("src/app/(painel)/comercial/matriz/page.tsx");
    const nav = read("src/components/cadastros/cadastros-workspace-nav.tsx");
    expect(page).toContain('supabase.rpc("comercial_simular_matriz_cenarios"');
    expect(page).toContain("Matriz de cenários contratuais");
    expect(page).toContain("sobreposicoes_contexto");
    expect(page).toContain("contrato_contextual_diferente");
    expect(nav).toContain('{href:"/comercial/matriz",label:"Matriz de cenários"');
  });
});
