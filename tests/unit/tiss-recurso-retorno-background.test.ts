import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Retorno de recurso de glosa", () => {
  it("versiona a RPC e impede escrita direta pela interface", () => {
    const migration = read("supabase/migrations/20260903005115_tiss_recurso_retorno_transacional.sql");
    expect(migration).toContain("registrar_retorno_recurso_glosa_transacional");
    expect(migration).toContain("recalcular_recebivel_glosa_tiss_internal");
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("grant execute on function public.registrar_retorno_recurso_glosa_transacional");
    expect(migration).toContain("revoke all on public.tiss_recurso_retornos from public, anon, authenticated");
  });

  it("usa background action com a RPC canônica e sem redirect", () => {
    const source = read("src/modules/tiss/recurso-background-actions.ts");
    expect(source).toContain("BackgroundActionState");
    expect(source).toContain('rpc("registrar_retorno_recurso_glosa_transacional"');
    expect(source).toContain("p_itens: itens");
    expect(source).not.toContain('from "next/navigation"');
    expect(source).not.toMatch(/\bredirect\s*\(/);
    expect(source).not.toContain("router.refresh");
    expect(source).not.toContain('.from("tiss_recurso_itens").update');
  });

  it("expõe modal acessível e mantém o detalhe ligado ao fluxo", () => {
    const modal = read("src/components/faturamento/recurso-retorno-modal.tsx");
    const page = read("src/app/(painel)/faturamento/recursos/[recursoId]/page.tsx");
    expect(modal).toContain('role="dialog"');
    expect(modal).toContain('aria-modal="true"');
    expect(modal).toContain('aria-live="polite"');
    expect(modal).toContain("useActionState");
    expect(page).toContain("RecursoRetornoModal");
    expect(page).toContain("Retorno financeiro transacional");
    expect(page).not.toContain("O registro manual de deferimento/indeferimento");
  });
});
