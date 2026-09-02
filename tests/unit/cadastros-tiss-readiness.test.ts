import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("prontidão cadastral TISS", () => {
  it("expõe a central no workspace de cadastros", () => {
    const nav = read("src/components/cadastros/cadastros-workspace-nav.tsx");
    const page = read("src/app/(painel)/cadastros/tiss/page.tsx");
    expect(nav).toContain('href:"/cadastros/tiss"');
    expect(page).toContain("Prontidão cadastral para TISS");
    expect(page).toContain("Carteirinha, autorização e senha continuam pertencendo ao episódio/atendimento");
  });

  it("trata empresa, unidade, profissionais, convênios e TUSS como bloqueios de origem", () => {
    const page = read("src/app/(painel)/cadastros/tiss/page.tsx");
    expect(page).toContain("validCnpj");
    expect(page).toContain("validCnes");
    expect(page).toContain("professionalReady");
    expect(page).toContain("registro_ans");
    expect(page).toContain("codigo_tuss");
    expect(page).toContain("Itens sem TUSS");
    expect(page).not.toContain('codigo_tuss: "');
  });

  it("não transforma CPF/CNS em bloqueio TISS universal", () => {
    const page = read("src/app/(painel)/cadastros/tiss/page.tsx");
    expect(page).toContain("Pacientes — qualidade documental");
    expect(page).toContain('tone="quality"');
    expect(page).toContain("a obrigatoriedade TISS final depende do tipo de mensagem e do episódio");
    const blockersExpression = page.match(/const blockers =[\s\S]*?;/)?.[0] ?? "";
    expect(blockersExpression).not.toContain("pacientesIncompletosCount");
  });

  it("sinaliza prontidão individual de profissionais sem inventar conselho ou CBO", () => {
    const page = read("src/app/(painel)/profissionais/page.tsx");
    expect(page).toContain("Prontos TISS nesta página");
    expect(page).toContain("prontoTiss");
    expect(page).toContain("Revisar conselho/UF/CBO");
    expect(page).not.toContain('defaultValue="225');
  });

  it("permite corrigir a habilitação regulatória do profissional em segundo plano", () => {
    const actions = read("src/modules/profissionais/tiss-background-actions.ts");
    const form = read("src/components/cadastros/professional-tiss-profile-form.tsx");
    const detail = read("src/app/(painel)/profissionais/[profissionalId]/page.tsx");
    expect(actions).toContain("BackgroundActionState");
    expect(actions).toContain('requirePermission("profissionais.editar")');
    expect(actions).toContain('revalidatePath("/cadastros/tiss")');
    expect(actions).not.toContain('from "next/navigation"');
    expect(actions).not.toMatch(/\bredirect\s*\(/);
    expect(form).toContain("useActionState");
    expect(form).toContain('aria-live="polite"');
    expect(form).toContain("Salvando…");
    expect(form).not.toContain("router.refresh");
    expect(detail).toContain("ProfessionalTissProfileForm");
  });

  it("permite corrigir registro ANS do convênio sem redirect", () => {
    const actions = read("src/modules/convenios/tiss-background-actions.ts");
    const form = read("src/components/cadastros/convenio-tiss-profile-form.tsx");
    const list = read("src/app/(painel)/convenios/page.tsx");
    const detail = read("src/app/(painel)/convenios/[convenioId]/page.tsx");
    expect(actions).toContain("BackgroundActionState");
    expect(actions).toContain('requirePermission("convenios.editar")');
    expect(actions).toContain("registroAns.length !== 6");
    expect(actions).not.toContain('from "next/navigation"');
    expect(actions).not.toMatch(/\bredirect\s*\(/);
    expect(form).toContain("useActionState");
    expect(form).toContain('aria-live="polite"');
    expect(form).toContain("Salvando…");
    expect(list).toContain("Registro ANS válido");
    expect(detail).toContain("ConvenioTissProfileForm");
  });

  it("permite corrigir CNPJ/CNES da empresa e CNES da unidade na central", () => {
    const actions = read("src/modules/cadastros/tiss-readiness-background-actions.ts");
    const forms = read("src/components/cadastros/institution-tiss-profile-forms.tsx");
    const page = read("src/app/(painel)/cadastros/tiss/page.tsx");
    expect(actions).toContain("BackgroundActionState");
    expect(actions).toContain('requirePermission("empresas.administrar")');
    expect(actions).toContain("cnpj.length !== 14");
    expect(actions).toContain("cnes.length !== 7");
    expect(actions).not.toContain('from "next/navigation"');
    expect(actions).not.toMatch(/\bredirect\s*\(/);
    expect(forms).toContain("CompanyTissProfileForm");
    expect(forms).toContain("UnitTissProfileForm");
    expect(forms).toContain("useActionState");
    expect(forms).toContain('aria-live="polite"');
    expect(forms).toContain("Salvando…");
    expect(page).toContain("CompanyTissProfileForm");
    expect(page).toContain("UnitTissProfileForm");
  });
});
