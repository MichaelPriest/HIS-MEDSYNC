import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("Urgência: SLA e reavaliação operacional", () => {
  it("usa RPC dedicado para atualizar classificação, prioridade e SLA", () => {
    const actions = source("src/modules/urgencia/actions.ts");
    expect(actions).toContain('rpc("atualizar_registro_emergencia_operacional"');
    expect(actions).toContain('requirePermission("emergencia.gerenciar")');
    expect(actions).not.toContain('.from("emergencia_registros").update');
  });

  it("mantém SLA institucional configurável sem tempos Manchester hardcoded", () => {
    const page = source("src/app/(painel)/assistencial/urgencia/sla/page.tsx");
    expect(page).toContain('name="sla_minutos"');
    expect(page).toContain("emergencia_fila_operacional");
    expect(page).toContain("não aplica intervalos de Manchester automaticamente");
    expect(page).not.toMatch(/sla_minutos[^\n]*(10|60|120|240)/);
  });

  it("deriva atrasos e pendências sem expor helper interno ao cliente", () => {
    const migration = source("supabase/migrations/20260830195047_urgencia_sla_reavaliacao_operacional.sql");
    expect(migration).toContain("create or replace view public.emergencia_fila_operacional");
    expect(migration).toContain("'urgencia_sla_atendimento_vencido'");
    expect(migration).toContain("'urgencia_reavaliacao_vencida'");
    expect(migration).toContain("revoke all on function public.reconciliar_pendencias_urgencia_internal(uuid,uuid,uuid,uuid) from public, anon, authenticated");
    expect(migration).toContain("grant execute on function public.atualizar_registro_emergencia_operacional(uuid,text,integer,integer,timestamptz,text,text) to authenticated");
  });
});