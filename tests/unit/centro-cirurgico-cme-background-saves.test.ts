import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("CME sem reload", () => {
  it("mantém o RPC canônico e não usa redirect", () => {
    const actions = read("src/modules/centro-cirurgico/cme-background-actions.ts");

    expect(actions).toContain("BackgroundActionState");
    expect(actions).toContain("cme_salvar_ciclo_operacional");
    expect(actions).toContain('.select("id,status,inicio_em,fim_em,liberado_em")');
    expect(actions).toContain("revalidatePath");
    expect(actions).not.toContain('from "next/navigation"');
    expect(actions).not.toMatch(/\bredirect\s*\(/);
  });

  it("preserva as regras de liberação definitiva", () => {
    const actions = read("src/modules/centro-cirurgico/cme-background-actions.ts");

    expect(actions).toContain("liberacao-exige-resultado");
    expect(actions).toContain("liberacao-exige-indicador");
    expect(actions).toContain("CME_LIBERACAO_EXIGE_RESULTADO_E_INDICADORES");
    expect(actions).toContain("CME_USUARIO_SEM_PROFISSIONAL");
    expect(actions).toContain("CME_CICLO_NAO_LOCALIZADO");
    expect(actions).toContain('action: liberar ? "release" : cicloId ? "update" : "create"');
  });

  it("usa useActionState, feedback inline e bloqueia após liberação confirmada", () => {
    const form = read("src/components/centro-cirurgico/cme-background-form.tsx");

    expect(form).toContain("useActionState");
    expect(form).toContain('aria-live="polite"');
    expect(form).toContain("Salvando…");
    expect(form).toContain('state.data?.status === "liberado"');
    expect(form).toContain("pending || released");
    expect(form).toContain('timeZone: "America/Sao_Paulo"');
    expect(form).not.toContain("router.refresh");
    expect(form).not.toContain("window.location");
  });

  it("remove action e feedback legado do workspace CME", () => {
    const page = read("src/app/(painel)/assistencial/centro-cirurgico/cme/page.tsx");

    expect(page).toContain("CmeBackgroundForm");
    expect(page).toContain("<CmeBackgroundForm />");
    expect(page).toContain("<CmeBackgroundForm ciclo={ciclo} />");
    expect(page).toContain("Ciclo liberado e protegido contra alteração");
    expect(page).not.toContain("salvarCicloCme");
    expect(page).not.toContain("searchParams");
    expect(page).not.toContain("params.sucesso");
    expect(page).not.toContain("params.erro");
  });
});
