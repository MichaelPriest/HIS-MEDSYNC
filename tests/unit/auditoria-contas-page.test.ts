import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("Auditoria de Contas", () => {
  it("desambigua o vínculo com contas_faturamento no PostgREST", () => {
    const page = source("src/app/(painel)/auditoria/page.tsx");

    expect(page).toContain(
      "conta:contas_faturamento!auditoria_contas_conta_id_fkey(id,valor_bruto,valor_liquido,status)",
    );
    expect(page).not.toContain("conta:contas_faturamento(id,valor_bruto,valor_liquido,status)");
  });

  it("não converte erro de carregamento em fila vazia silenciosa", () => {
    const page = source("src/app/(painel)/auditoria/page.tsx");

    expect(page).toContain("const { data, error } = await supabase");
    expect(page).toContain("Não foi possível carregar a fila de Auditoria");
    expect(page).toContain("error ? null");
  });
});
