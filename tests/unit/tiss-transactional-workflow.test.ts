import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("fluxo transacional Conta → TISS → Glosa/Recurso → Financeiro", () => {
  it("gera guia e itens pelo RPC atômico, sem recriar a escrita fragmentada no frontend", () => {
    const faturamento = source("src/modules/faturamento/actions.ts");
    expect(faturamento).toContain('rpc("criar_guia_tiss_conta_transacional"');
    expect(faturamento).not.toContain('.from("tiss_guias").insert');
    expect(faturamento).not.toContain('.from("tiss_guia_itens").insert');
  });

  it("usa os RPCs transacionais para lote, protocolo, glosa e recurso", () => {
    const tiss = source("src/modules/tiss/actions.ts");
    expect(tiss).toContain('rpc("criar_lote_tiss_transacional"');
    expect(tiss).toContain('rpc("registrar_protocolo_tiss_transacional"');
    expect(tiss).toContain('rpc("registrar_glosa_tiss_transacional"');
    expect(tiss).toContain('rpc("criar_recurso_glosa_tiss_transacional"');
    expect(tiss).not.toContain('.from("tiss_protocolos").insert');
    expect(tiss).not.toContain('.from("tiss_glosas").insert');
    expect(tiss).not.toContain('.from("tiss_recursos_glosa").insert');
    expect(tiss).not.toContain('.from("tiss_recurso_itens").insert');
  });

  it("mantém anomalias globais sem exposição ao cliente autenticado", () => {
    const migration = source("supabase/migrations/20260828212958_integracao_faturamento_tiss_ponta_a_ponta.sql");
    expect(migration).toContain("alter table public.integracao_anomalias_globais force row level security");
    expect(migration).toContain("revoke all on public.integracao_anomalias_globais from public,anon,authenticated");
    expect(migration).toContain("revoke execute on function public.reconciliar_anomalias_globais_tiss_internal() from public,anon,authenticated");
  });
});
