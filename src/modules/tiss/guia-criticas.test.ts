import { describe,expect,it } from "vitest";
import { acaoCriticaTiss,origemCriticaTiss,resumirCriticas } from "./guia-criticas";

describe("guia-criticas",()=>{
  it("resume bloqueios e alertas separadamente",()=>{
    const resumo=resumirCriticas([
      {codigo:"TISS-GUIA-BEN-001",severidade:"erro",campo:"numero_carteirinha",mensagem:"x"},
      {codigo:"TISS-GUIA-AUT-001",severidade:"alerta",campo:"numero_guia_operadora",mensagem:"y"},
    ]);
    expect(resumo).toEqual({erros:1,alertas:1,total:2,semBloqueios:false});
  });
  it("classifica a origem operacional da crítica",()=>{
    expect(origemCriticaTiss("TISS-GUIA-AUT-004")).toBe("Autorização");
    expect(origemCriticaTiss("TISS-GUIA-CBO-001")).toBe("Cadastro prestador");
    expect(origemCriticaTiss("TISS-GUIA-DOM-052")).toBe("Domínio ANS / TUSS");
    expect(origemCriticaTiss("TISS-GUIA-ITEM-003")).toBe("Faturamento");
  });
  it("fornece orientação acionável sem expor detalhes sensíveis",()=>{
    expect(acaoCriticaTiss({codigo:"TISS-GUIA-AUT-004",campo:"numero_guia_operadora"})).toContain("autorização");
    expect(acaoCriticaTiss({codigo:"TISS-GUIA-BEN-005",campo:"validade_carteirinha"})).toContain("beneficiário");
  });
});
