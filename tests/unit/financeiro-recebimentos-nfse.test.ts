import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path:string){return readFileSync(join(process.cwd(),path),"utf8");}

describe("Recebíveis → Conciliação → NFS-e",()=>{
  it("mantém baixas em ledger próprio com RPCs para registrar, conciliar e estornar",()=>{
    const actions=source("src/modules/financeiro/actions.ts");
    expect(actions).toContain('rpc("registrar_recebimento_financeiro_operacional"');
    expect(actions).toContain('rpc("conciliar_recebimento_financeiro_operacional"');
    expect(actions).toContain('rpc("estornar_recebimento_financeiro_operacional"');
    expect(actions).not.toContain('.from("financeiro_recebimentos").insert');
    expect(actions).not.toContain('.from("financeiro_recebimentos").update');
    expect(actions).not.toContain('.from("financeiro_recebimentos").delete');
  });

  it("faz mutações NFS-e somente pelos RPCs RBAC",()=>{
    const actions=source("src/modules/nfse/actions.ts");
    expect(actions).toContain('rpc("salvar_configuracao_nfse_operacional"');
    expect(actions).toContain('rpc("criar_nfse_lote_operacional"');
    expect(actions).toContain('rpc("registrar_estado_nfse_operacional"');
    expect(actions).toContain('rpc("registrar_transacao_nfse_operacional"');
    expect(actions).not.toContain('.from("nfse_configuracoes").upsert');
    expect(actions).not.toContain('.from("notas_fiscais_servico").insert');
    expect(actions).not.toContain('.from("notas_fiscais_servico").update');
    expect(actions).not.toContain('.from("nfse_transacoes").insert');
    expect(actions).not.toContain('.from("financeiro_recebiveis").update');
  });

  it("revoga escrita direta das tabelas financeiras críticas",()=>{
    const migration=source("supabase/migrations/20260828220121_financeiro_recebimentos_conciliacao_nfse_hardening.sql");
    expect(migration).toContain("revoke insert,update,delete on public.financeiro_recebiveis from authenticated");
    expect(migration).toContain("revoke insert,update,delete on public.notas_fiscais_servico from authenticated");
    expect(migration).toContain("revoke insert,update,delete on public.nfse_transacoes from authenticated");
    expect(migration).toContain("revoke insert,update,delete on public.nfse_configuracoes from authenticated");
    expect(migration).toContain("alter table public.financeiro_recebimentos force row level security");
    expect(migration).toContain("revoke execute on function public.recalcular_recebivel_financeiro_internal(uuid,uuid) from public,anon,authenticated");
  });

  it("expõe o detalhe operacional do recebível a partir do hub financeiro",()=>{
    const hub=source("src/app/(painel)/financeiro/page.tsx");
    const detalhe=source("src/app/(painel)/financeiro/recebiveis/[recebivelId]/page.tsx");
    expect(hub).toContain("/financeiro/recebiveis/${r.id}");
    expect(hub).toContain("Vencido");
    expect(detalhe).toContain("Ledger de recebimentos");
    expect(detalhe).toContain("Registrar baixa");
    expect(detalhe).toContain("Conciliar");
    expect(detalhe).toContain("Estornar");
  });
});
