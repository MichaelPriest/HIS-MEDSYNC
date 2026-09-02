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
});
