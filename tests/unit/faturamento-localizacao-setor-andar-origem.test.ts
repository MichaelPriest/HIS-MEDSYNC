import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const migration = read("supabase/migrations/20260903204859_faturamento_localizacao_nao_confundir_origem_operacional.sql");
const grid = read("src/components/faturamento/lancamentos-grid.tsx");

describe("localização do paciente no faturamento", () => {
  it("não usa automaticamente Farmácia/Almoxarifado como localização física do paciente", () => {
    expect(migration).toContain("v_fallback:=case");
    expect(migration).toContain("consulta_ambulatorial");
    expect(migration).toContain("consulta_pronto_atendimento");
    expect(migration).toContain("then null");
    expect(migration).toContain("('farmacia','almoxarifado','estoque','cme')");
    expect(migration).not.toContain("new.setor_paciente:=nullif(btrim(coalesce(new.setor,'')),'')");
  });

  it("preserva a origem operacional mesmo quando a localização não é identificada", () => {
    expect(migration).toContain("new.origem_operacional:=coalesce");
    expect(migration).toContain("origem_operacional=coalesce(c.origem_operacional,p.origem_operacional,c.setor)");
    expect(migration).toContain("'nao_identificada'");
  });

  it("exibe setor do paciente, andar e origem operacional como dimensões separadas", () => {
    expect(grid).toContain("Setor do paciente");
    expect(grid).toContain("Andar");
    expect(grid).toContain("Origem operacional");
    expect(grid).toContain("Não identificada");
    expect(grid).toContain("id,setor_paciente,andar_paciente,origem_operacional");
    expect(grid).toContain("Todos os setores do paciente");
    expect(grid).toContain("Todas as origens");
  });
});
