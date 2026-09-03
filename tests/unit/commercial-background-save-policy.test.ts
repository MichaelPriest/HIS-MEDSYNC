import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Comercial / contratos", () => {
  it("mantém regras, pacotes e portes CBHPM sem redirects de feedback", () => {
    const actions = read("src/modules/comercial/regras-actions.ts");
    expect(actions).toContain("BackgroundActionState");
    expect(actions).toContain("comercial_salvar_regra_faturamento");
    expect(actions).toContain("comercial_salvar_pacote");
    expect(actions).toContain("comercial_salvar_item_pacote");
    expect(actions).toContain("comercial_salvar_porte_cbhpm");
    expect(actions).not.toContain('from "next/navigation"');
    expect(actions).not.toMatch(/\bredirect\s*\(/);
  });

  it("mantém feedback inline nos formulários comerciais", () => {
    const forms = read("src/components/comercial/commercial-background-forms.tsx");
    expect(forms).toContain("useActionState");
    expect(forms).toContain('aria-live="polite"');
    expect(forms).toContain("Salvando em segundo plano…");
    expect(forms).toContain("CommercialCbhpmPortBackgroundForm");
    expect(forms).not.toContain("router.refresh");
    expect(forms).not.toContain("window.location");
  });

  it("não expõe JSON bruto como formulário primário de regras", () => {
    const page = read("src/app/(painel)/comercial/regras/page.tsx");
    expect(page).toContain('name="urgencia_condicao"');
    expect(page).toContain('name="horario_especial_condicao"');
    expect(page).toContain('name="acomodacao_individual_condicao"');
    expect(page).toContain('name="mesma_via_condicao"');
    expect(page).toContain('name="quantidade_auxiliares_min"');
    expect(page).not.toContain("condicoes_json");
  });

  it("expõe portes CBHPM versionados sem sugerir valor monetário genérico", () => {
    const page = read("src/app/(painel)/comercial/regras/page.tsx");
    expect(page).toContain("Portes CBHPM versionados");
    expect(page).toContain('name="vinculo_id"');
    expect(page).toContain('name="porte"');
    expect(page).toContain('name="vigencia_inicio"');
    expect(page).toContain("não existe valor monetário genérico embutido no sistema");
  });

  it("salva contrato e negociação do workspace em segundo plano e somente por RPC", () => {
    const actions = read("src/modules/comercial/workspace-background-actions.ts");
    expect(actions).toContain("BackgroundActionState");
    expect(actions).toContain("comercial_atualizar_contrato_contextual");
    expect(actions).toContain("comercial_salvar_vinculo_tabela");
    expect(actions).toContain("comercial_salvar_negociacao_tabela_v2");
    expect(actions).toContain("p_valor_filme_m2");
    expect(actions).toContain("p_base_preco");
    expect(actions).not.toContain('from "next/navigation"');
    expect(actions).not.toContain('.from("contrato_tabelas_comerciais").upsert');
  });

  it("mantém feedback inline também no workspace principal", () => {
    const forms = read("src/components/comercial/commercial-workspace-background-forms.tsx");
    expect(forms).toContain("useActionState");
    expect(forms).toContain('aria-live="polite"');
    expect(forms).toContain("Salvando em segundo plano…");
    expect(forms).toContain("CommercialContractBackgroundForm");
    expect(forms).toContain("CommercialTableLinkBackgroundForm");
    expect(forms).toContain("CommercialNegotiationBackgroundForm");
  });

  it("expõe plano, base de preço, filme e categorias granulares no workspace", () => {
    const page = read("src/app/(painel)/comercial/page.tsx");
    expect(page).toContain('name="plano_id"');
    expect(page).toContain('name="base_preco"');
    expect(page).toContain('name="valor_filme_m2"');
    expect(page).toContain('["cirurgias", "Cirurgias"]');
    expect(page).toContain('["sadt", "SADT / exames"]');
    expect(page).toContain('["honorarios", "Honorários"]');
    expect(page).toContain('["anestesia", "Anestesia"]');
    expect(page).toContain('["auxiliares", "Auxiliares"]');
    expect(page).toContain("CommercialContractBackgroundForm");
    expect(page).toContain("CommercialNegotiationBackgroundForm");
    expect(page).not.toContain("vincularTabelaContratoWorkspace");
    expect(page).not.toContain("atualizarNegociacaoTabela,");
    expect(page).not.toContain("atualizarContratoComercial,");
  });

  it("mantém preço contextual fail-closed e histórico fechado protegido", () => {
    const migration = read("supabase/migrations/20260903014600_comercial_motor_cobranca_contextual.sql");
    expect(migration).toContain("conta_historica_fechada");
    expect(migration).toContain("sem_preco_contratual");
    expect(migration).toContain("v_fonte.tipo in ('brasindice','cmed','simpro')");
    expect(migration).toContain("base_preco");
    expect(migration).toContain("regras_aplicadas");
    expect(migration).toContain("referencia_equivalencias");
    expect(migration).not.toContain("array['40808033'");
  });

  it("preserva configurações extras ao salvar negociação de tabela", () => {
    const migration = read("supabase/migrations/20260903015639_comercial_negociacao_contextual_v2.sql");
    expect(migration).toContain("v_regras:=coalesce(v_v.regras_adicionais,'{}'::jsonb)");
    expect(migration).toContain("comercial_sincronizar_regra_vinculo_internal");
    expect(migration).toContain("COMERCIAL_BASE_PRECO_OBRIGATORIA");
    expect(migration).not.toContain("regras_adicionais=jsonb_build_object");
  });

  it("resolve CBHPM por porte versionado, vigência e fallback legado explícito", () => {
    const migration = read("supabase/migrations/20260903020319_comercial_cbhpm_portes_versionados.sql");
    expect(migration).toContain("create table if not exists public.contrato_cbhpm_portes");
    expect(migration).toContain("comercial_salvar_porte_cbhpm");
    expect(migration).toContain("resolver_valor_porte_cbhpm_internal");
    expect(migration).toContain("COMERCIAL_PORTE_VIGENCIA_SOBREPOSTA");
    expect(migration).toContain("'versionado'::text");
    expect(migration).toContain("'legado_json'::text");
    expect(migration).toContain("cbhpm_porte_uco_versionado");
    expect(migration).toContain("cbhpm_porte_anestesico_versionado");
  });

  it("cria vínculos comerciais por RPC e aceita as categorias usadas pelo motor", () => {
    const migration = read("supabase/migrations/20260903022310_comercial_vinculo_tabela_background_rpc.sql");
    expect(migration).toContain("comercial_salvar_vinculo_tabela");
    expect(migration).toContain("comercial_salvar_negociacao_tabela_v2");
    expect(migration).toContain("'cirurgias','sadt','honorarios','anestesia','auxiliares'");
    expect(migration).toContain("COMERCIAL_FONTE_EMPRESA_INCOMPATIVEL");
    expect(migration).toContain("COMERCIAL_SEM_PERMISSAO_EDITAR");
  });
});
