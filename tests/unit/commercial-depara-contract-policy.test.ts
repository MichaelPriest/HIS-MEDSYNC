import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Comercial / DePara TUSS contratual", () => {
  it("mantém o DePara isolado por contrato, fonte, vigência e RLS forçado", () => {
    const migration = read("supabase/migrations/20260903031508_comercial_depara_tuss_contratual.sql");
    expect(migration).toContain("create table if not exists public.contrato_depara_tuss");
    expect(migration).toContain("contrato_id uuid not null");
    expect(migration).toContain("fonte_id uuid not null");
    expect(migration).toContain("vigencia_inicio date not null");
    expect(migration).toContain("force row level security");
    expect(migration).toContain("comercial_pode_visualizar");
    expect(migration).toContain("comercial_salvar_depara_tuss");
    expect(migration).toContain("vigência sobreposta");
    expect(migration).toContain("A fonte precisa estar vinculada e ativa no contrato antes do DePara");
    expect(migration).toContain("revoke all on function public.resolver_depara_tuss_contrato_internal");
  });

  it("prioriza DePara contratual e registra sua origem na memória de cálculo", () => {
    const migration = read("supabase/migrations/20260903031635_comercial_depara_tuss_motor_contextual.sql");
    const resolverPosition = migration.indexOf("resolver_depara_tuss_contrato_internal");
    const fallbackPosition = migration.indexOf("referencia_equivalencias");
    expect(resolverPosition).toBeGreaterThan(-1);
    expect(fallbackPosition).toBeGreaterThan(resolverPosition);
    expect(migration).toContain("'depara_tuss_id'");
    expect(migration).toContain("'depara_origem'");
    expect(migration).toContain("'contrato'");
    expect(migration).toContain("'referencia_equivalencias'");
  });

  it("salva DePara no background somente pelo RPC comercial", () => {
    const actions = read("src/modules/comercial/depara-actions.ts");
    expect(actions).toContain("BackgroundActionState");
    expect(actions).toContain("comercial_salvar_depara_tuss");
    expect(actions).toContain('revalidatePath("/comercial/depara")');
    expect(actions).not.toContain('from "next/navigation"');
    expect(actions).not.toMatch(/\bredirect\s*\(/);
    expect(actions).not.toContain('.from("contrato_depara_tuss").insert');
    expect(actions).not.toContain('.from("contrato_depara_tuss").update');
  });

  it("mantém feedback inline e tela estruturada sem equivalência sugerida pelo HIS", () => {
    const form = read("src/components/comercial/commercial-depara-background-form.tsx");
    const page = read("src/app/(painel)/comercial/depara/page.tsx");
    expect(form).toContain("useActionState");
    expect(form).toContain('aria-live="polite"');
    expect(form).toContain("Salvando em segundo plano…");
    expect(page).toContain('name="codigo_origem"');
    expect(page).toContain('name="codigo_tuss"');
    expect(page).toContain('name="vigencia_inicio"');
    expect(page).toContain('value="22"');
    expect(page).toContain("O HIS não sugere equivalências automaticamente");
    expect(page).toContain("DePara pode ser dispensável quando o item já possui TUSS direto");
  });

  it("expõe o workspace na navegação comercial", () => {
    const nav = read("src/components/cadastros/cadastros-workspace-nav.tsx");
    expect(nav).toContain('{href:"/comercial/depara",label:"DePara TUSS"');
  });
});
