import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Comercial / vínculos editáveis com histórico", () => {
  it("desvincula sem apagar e registra motivo, usuário e data", () => {
    const migration = read("supabase/migrations/20260903121239_comercial_editavel_historico_depara_auto.sql");
    expect(migration).toContain("desvinculado_em");
    expect(migration).toContain("desvinculado_por");
    expect(migration).toContain("motivo_desvinculo");
    expect(migration).toContain("create or replace function public.comercial_desvincular_tabela");
    expect(migration).toContain("COMERCIAL_MOTIVO_DESVINCULO_OBRIGATORIO");
    expect(migration).toContain("set ativo=false");
    expect(migration).not.toMatch(/delete\s+from\s+public\.contrato_tabelas_comerciais/i);
  });

  it("reativa o mesmo vínculo histórico sem recriar configuração", () => {
    const migration = read("supabase/migrations/20260903121947_comercial_reativar_vinculo_historico.sql");
    expect(migration).toContain("create or replace function public.comercial_reativar_vinculo_tabela");
    expect(migration).toContain("set ativo=true");
    expect(migration).toContain("comercial_pode_editar");
    expect(migration).toContain("tabelas_comerciais_pode_editar");
  });

  it("gera DePara somente por dado explícito e preserva manual como autoridade", () => {
    const migration = read("supabase/migrations/20260903121636_comercial_depara_edicao_fixa_vigencia_contrato.sql");
    expect(migration).toContain("automatico_tabela");
    expect(migration).toContain("automatico_equivalencia");
    expect(migration).toContain("referencia_equivalencias");
    expect(migration).toContain("codigo_tuss");
    expect(migration).toContain("d.origem_mapeamento='manual'");
    expect(migration).not.toContain("similarity(");
    expect(migration).not.toContain("levenshtein(");
  });

  it("usa a vigência do contrato quando a tabela está em edição fixa", () => {
    const migration = read("supabase/migrations/20260903121636_comercial_depara_edicao_fixa_vigencia_contrato.sql");
    expect(migration).toContain("if v_v.modo_edicao='edicao_fixa'");
    expect(migration).toContain("v_inicio:=coalesce(v_c.data_inicio,v_e.vigencia_inicio,current_date)");
    expect(migration).toContain("v_fim:=v_c.data_fim");
  });

  it("expõe manutenção em background e área comercial editável", () => {
    const actions = read("src/modules/comercial/link-maintenance-actions.ts");
    const page = read("src/app/(painel)/comercial/vinculos/page.tsx");
    expect(actions).toContain('supabase.rpc("comercial_desvincular_tabela"');
    expect(actions).toContain('supabase.rpc("comercial_reativar_vinculo_tabela"');
    expect(actions).toContain('supabase.rpc("comercial_sincronizar_depara_vinculo"');
    expect(page).toContain("100% editável sem reescrever o passado");
    expect(page).toContain("CommercialNegotiationBackgroundForm");
    expect(page).toContain("CommercialTableLinkBackgroundForm");
    expect(page).toContain("Histórico comercial");
  });

  it("inclui vínculos e histórico na navegação comercial", () => {
    const nav = read("src/components/cadastros/cadastros-workspace-nav.tsx");
    expect(nav).toContain('{href:"/comercial/vinculos",label:"Vínculos e histórico"');
  });
});
