import { describe, expect, it } from "vitest";
import { personalNavigationItems } from "@/config/navigation-map";

describe("navegação da integração medicamentosa", () => {
  it("expõe a central no Meu setor da Farmácia", () => {
    expect(personalNavigationItems("farmacia").map((item) => item.href)).toContain("/integracoes");
  });

  it("expõe a central no Meu setor da Enfermagem", () => {
    expect(personalNavigationItems("enfermagem").map((item) => item.href)).toContain("/integracoes");
  });
});
