import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Anestesia e RPA sem refresh", () => {
  it("mantém os RPCs canônicos e reconcilia o estado confirmado no banco", () => {
    const actions = read("src/modules/centro-cirurgico/anestesia-rpa-background-actions.ts");

    expect(actions).toContain("BackgroundActionState");
    expect(actions).toContain("centro_cirurgico_salvar_anestesia_operacional");
    expect(actions).toContain("centro_cirurgico_salvar_rpa_operacional");
    expect(actions).toContain('.from("anestesia_registros")');
    expect(actions).toContain('.select("id,inicio_em,fim_em")');
    expect(actions).toContain('.from("rpa_registros")');
    expect(actions).toContain('.select("id,status,alta_em")');
    expect(actions).toContain("revalidatePath");
    expect(actions).not.toContain('from "next/navigation"');
    expect(actions).not.toMatch(/\bredirect\s*\(/);
    expect(actions).not.toMatch(/\.insert\s*\(/);
    expect(actions).not.toMatch(/\.update\s*\(/);
    expect(actions).not.toMatch(/\.delete\s*\(/);
  });

  it.each([
    "src/components/centro-cirurgico/anesthesia-autosave-form.tsx",
    "src/components/centro-cirurgico/rpa-autosave-form.tsx",
  ])("mantém autosave com useActionState em %s", (path) => {
    const source = read(path);

    expect(source).toContain("useActionState");
    expect(source).toContain("requestSubmit");
    expect(source).toContain("1200");
    expect(source).toContain('aria-live="polite"');
    expect(source).toContain("Salvando…");
    expect(source).not.toContain("createClient");
    expect(source).not.toContain("useRouter");
    expect(source).not.toContain("router.refresh");
    expect(source).not.toContain("window.location");
  });

  it("usa horários confirmados do banco na anestesia", () => {
    const source = read("src/components/centro-cirurgico/anesthesia-autosave-form.tsx");

    expect(source).toContain("actionState.data?.inicioEm");
    expect(source).toContain("actionState.data?.fimEm");
    expect(source).not.toContain("setInicioEm(new Date().toISOString())");
    expect(source).not.toContain("setFimEm(new Date().toISOString())");
  });

  it("usa status e alta confirmados do banco na RPA", () => {
    const source = read("src/components/centro-cirurgico/rpa-autosave-form.tsx");

    expect(source).toContain("actionState.data?.status");
    expect(source).toContain("actionState.data?.altaEm");
    expect(source).not.toContain("router.refresh");
  });
});
