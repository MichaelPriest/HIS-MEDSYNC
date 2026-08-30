import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Internação → transferência interunidades", () => {
  it("mantém as quatro mutações em RPCs transacionais", () => {
    const actions = source("src/modules/internacao/transferencias-actions.ts");
    expect(actions).toContain('rpc("solicitar_transferencia_interunidade"');
    expect(actions).toContain('rpc("aceitar_transferencia_interunidade"');
    expect(actions).toContain('rpc("recusar_transferencia_interunidade"');
    expect(actions).toContain('rpc("cancelar_transferencia_interunidade"');
    expect(actions).not.toContain('.from("internacao_transferencias_interunidades").insert');
    expect(actions).not.toContain('.from("internacao_transferencias_interunidades").update');
  });

  it("expõe fila mínima segura e destinos por RPC", () => {
    const page = source("src/app/(painel)/internacao/transferencias/page.tsx");
    expect(page).toContain('rpc("listar_transferencias_interunidades_operacionais"');
    expect(page).toContain('rpc("listar_unidades_destino_transferencia_interunidade"');
    expect(page).toContain("nenhum destino fictício");
  });

  it("protege ocupação concorrente de leito reservado", () => {
    const migration = source("supabase/migrations/20260830023008_internacao_transferencia_reserva_leito_hardening.sql");
    expect(migration).toContain("LEITO_RESERVADO_PARA_OUTRO_ATENDIMENTO");
    expect(migration).toContain("status='utilizada'");
    expect(migration).toContain("revoke all on function public.validar_ocupacao_leito_reserva_internal()");
  });

  it("inclui o workspace na navegação da Internação", () => {
    const layout = source("src/app/(painel)/internacao/layout.tsx");
    expect(layout).toContain('href="/internacao/transferencias"');
    expect(layout).toContain("Transferências");
  });
});
