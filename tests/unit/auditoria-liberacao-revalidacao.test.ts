import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("Auditoria - revalidação transacional na liberação", () => {
  it("não bloqueia a ação de liberar com base em uma crítica automática possivelmente desatualizada", () => {
    const page = source("src/app/(painel)/auditoria/page.tsx");

    expect(page).toContain("Revalidar e liberar para Contas Médicas");
    expect(page).toContain("A liberação reexecuta a auditoria");
    expect(page).not.toContain('className="ui-button-primary" disabled={impeditivas.length > 0}');
  });

  it("mantém a liberação delegada ao RPC transacional do banco", () => {
    const actions = source("src/modules/corporativo/actions.ts");

    expect(actions).toContain('rpc("liberar_auditoria_conta"');
    expect(actions).not.toContain('.from("auditoria_contas").update({status:"liberada"');
  });
});
