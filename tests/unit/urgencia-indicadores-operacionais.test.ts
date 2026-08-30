import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("Urgência: indicadores operacionais", () => {
  const page = source("src/app/(painel)/assistencial/urgencia/indicadores/page.tsx");

  it("usa somente fatos persistidos e mantém escopo empresa/unidade", () => {
    expect(page).toContain('.from("emergencia_registros")');
    expect(page).toContain('.from("emergencia_reavaliacoes")');
    expect(page).toContain('.from("emergencia_observacoes")');
    expect(page).toContain('.eq("empresa_id", empresaId)');
    expect(page).toContain('.eq("unidade_id", unidadeId)');
    expect(page).toContain('requireAnyPermission([');
  });

  it("permanece estritamente read-only", () => {
    expect(page).not.toContain(".insert(");
    expect(page).not.toContain(".update(");
    expect(page).not.toContain(".delete(");
    expect(page).not.toContain(".upsert(");
    expect(page).not.toContain(".rpc(");
  });

  it("explicita denominadores e não inventa SLA clínico", () => {
    expect(page).toContain("SLA institucional configurado");
    expect(page).toContain("não cria nem presume protocolo clínico");
    expect(page).toContain("const PERIODOS = [7, 30, 90] as const");
    expect(page).toContain("Registros sem configuração, sem classificação ou sem desfecho");
  });

  it("mede reavaliação e observação usando timestamps existentes", () => {
    expect(page).toContain("sla_cumprido_em");
    expect(page).toContain("atraso_minutos");
    expect(page).toContain("iniciado_em");
    expect(page).toContain("encerrado_em");
    expect(page).toContain("destino_final");
  });
});
