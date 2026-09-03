import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Comercial / contratos", () => {
  it("mantém regras e pacotes sem redirects de feedback", () => {
    const actions = read("src/modules/comercial/regras-actions.ts");
    expect(actions).toContain("BackgroundActionState");
    expect(actions).toContain("comercial_salvar_regra_faturamento");
    expect(actions).toContain("comercial_salvar_pacote");
    expect(actions).toContain("comercial_salvar_item_pacote");
    expect(actions).not.toContain('from "next/navigation"');
    expect(actions).not.toMatch(/\bredirect\s*\(/);
  });

  it("mantém feedback inline nos formulários comerciais", () => {
    const forms = read("src/components/comercial/commercial-background-forms.tsx");
    expect(forms).toContain("useActionState");
    expect(forms).toContain('aria-live="polite"');
    expect(forms).toContain("Salvando em segundo plano…");
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
});
