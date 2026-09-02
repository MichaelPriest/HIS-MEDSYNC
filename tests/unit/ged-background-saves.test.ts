import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("GED sem reload", () => {
  it("preserva hash e RPCs na governança assíncrona", () => {
    const actions = read("src/modules/ged/background-actions.ts");

    expect(actions).toContain("BackgroundActionState");
    expect(actions).toContain('createHash("sha256")');
    expect(actions).toContain("hash_sha256");
    expect(actions).toContain("atualizar_status_documento_ged");
    expect(actions).toContain("assinar_documento_ged");
    expect(actions).toContain("revalidatePath");
    expect(actions).not.toContain('from "next/navigation"');
    expect(actions).not.toMatch(/\bredirect\s*\(/);
  });

  it("mantém assinatura e status no formulário de segundo plano", () => {
    const page = read("src/app/(painel)/ged/[documentoId]/page.tsx");
    const form = read("src/components/ged/ged-governance-background-form.tsx");

    expect(page).toContain("GedGovernanceBackgroundForm");
    expect(page).toContain('kind="sign"');
    expect(page).toContain('kind="status"');
    expect(page).not.toContain("searchParams");
    expect(page).not.toContain("action={assinarDocumentoGed}");
    expect(page).not.toContain("action={atualizarStatusDocumentoGed}");
    expect(form).toContain("useActionState");
    expect(form).toContain('aria-live="polite"');
    expect(form).toContain("Salvando…");
    expect(form).not.toContain("router.refresh");
    expect(form).not.toContain("window.location");
  });
});
