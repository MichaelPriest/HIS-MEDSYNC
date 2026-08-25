import { describe,expect,it } from "vitest";
import { detectXmlLayout,parseCommercialXml,parseEquivalenciasXml,parseGlosasXml } from "./xml-reference-parser";

describe("xml-reference-parser",()=>{
  it("identifica e importa AMB preservando CH e atributos",()=>{
    const raw='<procedimentos><procedimento><codigoAMB>10014</codigoAMB><descricaoAMB>Consulta Medica</descricaoAMB><quantidadeCH>50</quantidadeCH><quantidadeAux>1</quantidadeAux><porteCirurgico>2</porteCirurgico><CHAnestesista>10</CHAnestesista><quantidadeFilme>0.5</quantidadeFilme></procedimento></procedimentos>';
    expect(detectXmlLayout(raw)).toBe("amb");
    const r=parseCommercialXml(raw,"amb");expect(r.rejeitados).toBe(0);expect(r.itens[0]).toMatchObject({codigo:"10014",pontos_ch:50,valor_referencia:0});expect(r.itens[0].metadata).toMatchObject({quantidade_aux:1,porte_cirurgico:"2",ch_anestesista:10,quantidade_filme:.5});
  });
  it("identifica CBHPM e preserva porte/UCO e valores de origem em metadata",()=>{
    const raw='<procedimentos><procedimento><codigo>10101012</codigo><descricao>Em consultório</descricao><porte>2B</porte><fracaoPorte>0</fracaoPorte><valorPorte>42</valorPorte><custoOperacional>16.38</custoOperacional><quantidadeAux>0</quantidadeAux><porteCirurgico>0</porteCirurgico><porteAnestesista>0</porteAnestesista><valorPorteAnestesista>0</valorPorteAnestesista><quantidadeFilme>0</quantidadeFilme></procedimento></procedimentos>';
    expect(detectXmlLayout(raw)).toBe("cbhpm");const r=parseCommercialXml(raw,"cbhpm");expect(r.itens[0]).toMatchObject({codigo:"10101012",porte:"2B",quantidade_uco:16.38,porte_anestesico:"0"});expect(r.itens[0].metadata).toMatchObject({valor_porte_origem:42});
  });
  it("importa equivalencia AMB para TUSS sem inventar descricao",()=>{
    const raw='<dados><procedimento><codigo_AMB>10014</codigo_AMB><descricao_AMB>CONSULTA</descricao_AMB><codigo_TUSS>10101012</codigo_TUSS><descricao_TUSS>EM CONSULTORIO</descricao_TUSS></procedimento></dados>';
    expect(detectXmlLayout(raw)).toBe("equivalencias");const r=parseEquivalenciasXml(raw,"dados.xml");expect(r.itens[0]).toMatchObject({codigo_origem:"10014",codigo_destino:"10101012",status:"ativa",fonte:"dados.xml"});
  });
  it("importa catalogo de glosas",()=>{
    const raw='<glosas><glosa><codigo>1001</codigo><motivo>NÚMERO DA CARTEIRA INVÁLIDO</motivo></glosa></glosas>';
    expect(detectXmlLayout(raw)).toBe("glosas");const r=parseGlosasXml(raw,"glosas.xml");expect(r.itens[0]).toMatchObject({codigo:"1001",fonte:"glosas.xml",ativo:true});
  });
});
