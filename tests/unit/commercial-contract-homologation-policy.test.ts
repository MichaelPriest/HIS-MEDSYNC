import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Comercial / homologação contratual", () => {
  it("mantém histórico formal sob RLS e sem DML direto do frontend", () => {
    const migration = read("supabase/migrations/20260903112717_comercial_homologacao_contratual.sql");
    expect(migration).toContain("create table if not exists public.contrato_homologacoes_comerciais");
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("force row level security");
    expect(migration).toContain("revoke all on table public.contrato_homologacoes_comerciais from public, anon, authenticated");
    expect(migration).toContain("grant select on table public.contrato_homologacoes_comerciais to authenticated");
  });

  it("bloqueia homologação com prontidão inválida e exige aceite explícito dos avisos", () => {
    const migration = read("supabase/migrations/20260903112717_comercial_homologacao_contratual.sql");
    expect(migration).toContain("public.comercial_prontidao_contrato(p_contrato_id,v_data)");
    expect(migration).toContain("PRONTIDAO_COM_BLOQUEIOS");
    expect(migration).toContain("AVISOS_PENDENTES_REQUEREM_ACEITE");
    expect(migration).toContain("p_aceitar_avisos boolean default false");
    expect(migration).toContain("prontidao_snapshot");
  });

  it("marca homologação como desatualizada quando a cadeia comercial muda", () => {
    const migration = read("supabase/migrations/20260903112717_comercial_homologacao_contratual.sql");
    expect(migration).toContain("comercial_ultima_mutacao_relevante_internal");
    expect(migration).toContain("contexto_contrato_id=p_contrato_id");
    expect(migration).toContain("tabelas_comerciais_fontes");
    expect(migration).toContain("tabelas_comerciais_edicoes");
    expect(migration).toContain("v_estado:='desatualizado'");
    expect(migration).toContain("entidade_tipo <> 'contrato_homologacoes_comerciais'");
  });

  it("mantém o helper de mutação interno e expõe somente RPCs governados", () => {
    const migration = read("supabase/migrations/20260903112717_comercial_homologacao_contratual.sql");
    expect(migration).toContain("revoke all on function public.comercial_ultima_mutacao_relevante_internal(uuid) from public, anon, authenticated");
    expect(migration).toContain("grant execute on function public.comercial_ultima_mutacao_relevante_internal(uuid) to postgres");
    expect(migration).toContain("revoke all on function public.comercial_homologar_contrato(uuid,date,boolean,text) from public, anon");
    expect(migration).toContain("revoke all on function public.comercial_revogar_homologacao(uuid,text) from public, anon");
    expect(migration).toContain("comercial_pode_editar");
    expect(migration).toContain("comercial_pode_visualizar");
  });

  it("audita homologação e revogação sem apagar o histórico", () => {
    const migration = read("supabase/migrations/20260903112717_comercial_homologacao_contratual.sql");
    expect(migration).toContain("'contrato_homologacoes_comerciais',v_hom.id,'homologar'");
    expect(migration).toContain("'contrato_homologacoes_comerciais',v_hom.id,'revogar'");
    expect(migration).toContain("set status='substituido'");
    expect(migration).toContain("set status='revogado'");
  });

  it("usa ações críticas por RPC e revalida todas as superfícies comerciais", () => {
    const actions = read("src/modules/comercial/homologacao-actions.ts");
    expect(actions).toContain('supabase.rpc("comercial_homologar_contrato"');
    expect(actions).toContain('supabase.rpc("comercial_revogar_homologacao"');
    expect(actions).not.toMatch(/\.from\(["']contrato_homologacoes_comerciais["']\)/);
    for (const path of ["/comercial", "/comercial/homologacao", "/comercial/prontidao", "/comercial/simulador"]) expect(actions).toContain(path);
  });

  it("expõe aceite de avisos, revogação motivada e limites da homologação na UI", () => {
    const page = read("src/app/(painel)/comercial/homologacao/page.tsx");
    expect(page).toContain("comercial_status_homologacao");
    expect(page).toContain("comercial_prontidao_contrato");
    expect(page).toContain('name="aceitar_avisos"');
    expect(page).toContain('name="motivo_revogacao"');
    expect(page).toContain("não substitui homologação da operadora");
    expect(page).toContain("planos ou unidades mais específicos");
    expect(page).toContain("Homologar nova versão");
  });

  it("inclui homologação na navegação comercial", () => {
    const nav = read("src/components/cadastros/cadastros-workspace-nav.tsx");
    expect(nav).toContain('{href:"/comercial/homologacao",label:"Homologação comercial"');
  });
});
