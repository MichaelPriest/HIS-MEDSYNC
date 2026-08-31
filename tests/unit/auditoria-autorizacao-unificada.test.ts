import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("Auditoria - autorização unificada", () => {
  it("reconhece guia central ou autorização do atendimento no mesmo tenant", () => {
    const migration = source("supabase/migrations/20260831035056_auditoria_autorizacao_unificada.sql");

    expect(migration).toContain("from public.central_guias g");
    expect(migration).toContain("from public.autorizacoes_atendimento a");
    expect(migration).toContain("a.empresa_id=v_c.empresa_id");
    expect(migration).toContain("a.unidade_id=v_c.unidade_id");
    expect(migration).toContain("a.status='autorizada'");
    expect(migration).toContain("a.validade >= current_date");
  });

  it("mantém o alerta somente quando nenhuma fonte válida existir", () => {
    const migration = source("supabase/migrations/20260831035056_auditoria_autorizacao_unificada.sql");

    expect(migration).toContain("if v_guias=0 then");
    expect(migration).toContain("SEM_GUIA_AUTORIZADA");
    expect(migration).toContain("Nenhuma guia ou autorizacao valida foi localizada para o atendimento.");
  });
});
