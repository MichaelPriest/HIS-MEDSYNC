import { describe, expect, it } from "vitest";
import { detectXmlLayout, parseCommercialXml } from "../../src/modules/comercial/xml-reference-parser";

describe("importação comercial XML", () => {
  it("preserva todas as colunas AMB e consolida códigos repetidos", () => {
    const raw = "<procedimentos><procedimento><codigoAMB>10014</codigoAMB><descricaoAMB>Consulta</descricaoAMB><quantidadeCH>50</quantidadeCH><quantidadeAux>1</quantidadeAux><porteCirurgico>2</porteCirurgico><CHAnestesista>10</CHAnestesista><quantidadeFilme>0.5</quantidadeFilme></procedimento><procedimento><codigoAMB>10014</codigoAMB><descricaoAMB>Descrição alternativa</descricaoAMB><quantidadeCH>50</quantidadeCH><quantidadeAux>1</quantidadeAux><porteCirurgico>2</porteCirurgico><CHAnestesista>10</CHAnestesista><quantidadeFilme>0.5</quantidadeFilme></procedimento></procedimentos>";
    expect(detectXmlLayout(raw)).toBe("amb");
    const parsed = parseCommercialXml(raw, "amb");
    expect(parsed.rejeitados).toBe(0);
    expect(parsed.consolidados).toBe(1);
    expect(parsed.itens).toHaveLength(1);
    expect(parsed.itens[0]).toMatchObject({
      codigo: "10014",
      pontos_ch: 50,
      quantidade_auxiliares: 1,
      porte: "2",
      ch_anestesista: 10,
      quantidade_filme: 0.5,
    });
    expect(parsed.itens[0].metadata).toMatchObject({ descricoes_alternativas: ["Descrição alternativa"] });
  });
});
