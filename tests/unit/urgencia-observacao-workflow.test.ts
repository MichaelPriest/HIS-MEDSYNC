import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("Urgência: observação operacional", () => {
  it("inicia e encerra observação somente por RPCs transacionais", () => {
    const actions = source("src/modules/urgencia/actions.ts");
    expect(actions).toContain('rpc("iniciar_observacao_emergencia_operacional"');
    expect(actions).toContain('rpc("encerrar_observacao_emergencia_operacional"');
    expect(actions).toContain('requirePermission("emergencia.gerenciar")');
    expect(actions).not.toContain('.from("emergencia_observacoes").insert');
    expect(actions).not.toContain('.from("emergencia_observacoes").update');
  });

  it("mantém observação no mesmo atendimento e não inventa leito físico", () => {
    const page = source("src/app/(painel)/assistencial/urgencia/observacao/page.tsx");
    expect(page).toContain("mesmo atendimento/RA");
    expect(page).toContain("não cria leito físico");
    expect(page).toContain('href={`/prontuario/${observacao.atendimento_id}`}');
    expect(page).toContain('href={`/assistencial/urgencia?registro=${observacao.emergencia_id}`}');
    expect(page).toContain('name="local_observacao"');
  });

  it("bloqueia DML direto legado e protege encerramento com observação ativa", () => {
    const migration = source("supabase/migrations/20260830212736_urgencia_observacao_operacional.sql");
    expect(migration).toContain("revoke insert, update, delete on public.emergencia_registros from authenticated");
    expect(migration).toContain("revoke insert, update, delete on public.emergencia_reavaliacoes from authenticated");
    expect(migration).toContain("revoke all on public.emergencia_observacoes from anon, authenticated");
    expect(migration).toContain("grant select on public.emergencia_observacoes to authenticated");
    expect(migration).toContain("EMERGENCIA_OBSERVACAO_ATIVA");
    expect(migration).toContain("emergencia_bloquear_encerramento_com_observacao");
  });

  it("preserva trilha longitudinal de início e saída da observação", () => {
    const migration = source("supabase/migrations/20260830212736_urgencia_observacao_operacional.sql");
    expect(migration).toContain("'emergencia.observacao_iniciada'");
    expect(migration).toContain("'emergencia.observacao_encerrada'");
    expect(migration).toContain("public.registrar_integracao_evento_internal");
  });
});
