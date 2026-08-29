import { describe, expect, it } from "vitest";
import { surgeryWorkspaceItems } from "@/components/centro-cirurgico/surgery-workspace-nav";

describe("workspace de suprimentos do Centro Cirúrgico", () => {
  it("expõe a rota de Suprimentos / OPME no workspace cirúrgico", () => {
    const item = surgeryWorkspaceItems.find((entry) => entry.href === "/assistencial/centro-cirurgico/suprimentos");
    expect(item).toBeDefined();
    expect(item?.label).toBe("Suprimentos / OPME");
  });

  it("mantém a Central Cirúrgica como rota exata", () => {
    const central = surgeryWorkspaceItems.find((entry) => entry.href === "/assistencial/centro-cirurgico");
    expect(central?.exact).toBe(true);
  });
});
