import { describe, expect, it } from "vitest";
import type { TissFinalGuide040300, TissFinalLot040300 } from "@/modules/tiss/mensagem-final-040300";
import { serializeTissWireLoteGuias040300 } from "@/modules/tiss/mensagem-final-wire-040300";
import { validateTissXmlXsd } from "@/modules/tiss/xsd-validator";

function baseGuide(overrides: Partial<TissFinalGuide040300> = {}): TissFinalGuide040300 {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    tipo_guia: "consulta",
    numero_guia_prestador: "GUIA0001",
    numero_guia_operadora: null,
    registro_ans: "123456",
    codigo_prestador_operadora: null,
    numero_carteirinha: "CARTEIRA0001",
    atendimento_rn: false,
    data_atendimento: "2026-09-02",
    hora_inicio: "10:00:00",
    cnes_snapshot: "1234567",
    profissional_nome_snapshot: "MEDICO TESTE",
    codigo_conselho_ans_snapshot: "06",
    profissional_numero_conselho_snapshot: "12345",
    profissional_uf_conselho_snapshot: "SP",
    profissional_cbo_snapshot: "225125",
    indicador_acidente: "9",
    regime_atendimento_tiss: "01",
    tipo_atendimento_tuss50_codigo: "04",
    tipo_consulta_tuss52_codigo: "1",
    itens: [{
      sequencial: 1,
      data_execucao: "2026-09-02",
      tabela: "22",
      codigo_procedimento: "10101012",
      descricao: "CONSULTA EM CONSULTORIO",
      quantidade: 1,
      valor_unitario: 100,
      valor_total: 100,
      reducao_acrescimo: 1,
      origem_tipo: "procedimento",
    }],
    ...overrides,
  };
}

function lot(guide: TissFinalGuide040300): TissFinalLot040300 {
  return {
    numero_lote: "260900000001",
    registro_ans: "123456",
    prestador_codigo_operadora: null,
    prestador_cnpj: "12345678000195",
    data_transacao: "2026-09-02",
    hora_transacao: "12:34:56",
    guias: [guide],
  };
}

describe("mensagem final TISS 4.03.00", () => {
  it("serializa Guia de Consulta no wire-format e passa no XSD oficial", async () => {
    const serialized = serializeTissWireLoteGuias040300(lot(baseGuide()));

    expect(serialized.xml).toContain('<?xml version="1.0" encoding="ISO-8859-1"?>');
    expect(serialized.xml).toContain('<ans:mensagemTISS xmlns:ans="http://www.ans.gov.br/padroes/tiss/schemas">');
    expect(serialized.xml).toContain("<ans:tipoTransacao>ENVIO_LOTE_GUIAS</ans:tipoTransacao>");
    expect(serialized.xml).toContain("<ans:Padrao>4.03.00</ans:Padrao>");
    expect(serialized.xml).toContain("<ans:contratadoExecutante><ans:cnpjContratado>12345678000195</ans:cnpjContratado><ans:CNES>1234567</ans:CNES></ans:contratadoExecutante>");
    expect(serialized.hashTissMd5).toMatch(/^[0-9A-F]{32}$/);
    expect(serialized.hashSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(serialized.xml).toContain(`<ans:epilogo><ans:hash>${serialized.hashTissMd5}</ans:hash></ans:epilogo>`);

    const validation = await validateTissXmlXsd(serialized.xml);
    expect(validation.errors).toEqual([]);
    expect(validation.valid).toBe(true);
  });

  it("normaliza procedimento SP/SADT conforme ct_procedimentoExecutadoSadt", () => {
    const guide = baseGuide({
      tipo_guia: "sp_sadt",
      carater_atendimento: "1",
      tipo_atendimento_tuss50_codigo: "05",
      tipo_consulta_tuss52_codigo: null,
      solicitante_codigo_prestador_snapshot: "PRESTSOL001",
      solicitante_nome_contratado_snapshot: "HOSPITAL SOLICITANTE",
      solicitante_nome_profissional_snapshot: "MEDICO SOLICITANTE",
      solicitante_codigo_conselho_ans_snapshot: "06",
      solicitante_numero_conselho_snapshot: "99999",
      solicitante_uf_conselho_snapshot: "SP",
      solicitante_cbo_snapshot: "225125",
      itens: [
        {
          sequencial: 1,
          data_execucao: "2026-09-02",
          tabela: "22",
          codigo_procedimento: "40301010",
          descricao: "PROCEDIMENTO SADT",
          quantidade: 1,
          valor_unitario: 80,
          valor_total: 80,
          reducao_acrescimo: null,
          origem_tipo: "procedimento",
          unidade_medida_tiss: "001",
        },
        {
          sequencial: 2,
          data_execucao: "2026-09-02",
          tabela: "20",
          codigo_procedimento: "0000000001",
          descricao: "MEDICAMENTO TESTE",
          quantidade: 1.5,
          valor_unitario: 10,
          valor_total: 15,
          reducao_acrescimo: 1,
          origem_tipo: "medicamento",
          unidade_medida_tiss: "001",
        },
      ],
    });
    const serialized = serializeTissWireLoteGuias040300(lot(guide));
    const procedure = serialized.xml.match(/<ans:procedimentoExecutado>([\s\S]*?)<\/ans:procedimentoExecutado>/)?.[1] ?? "";

    expect(procedure).toContain("<ans:quantidadeExecutada>1</ans:quantidadeExecutada>");
    expect(procedure).toContain("<ans:reducaoAcrescimo>1.00</ans:reducaoAcrescimo>");
    expect(procedure).not.toContain("<ans:unidadeMedida>");
    expect(serialized.xml).toContain("<ans:codigoDespesa>02</ans:codigoDespesa>");
    expect(serialized.xml).toContain("<ans:unidadeMedida>001</ans:unidadeMedida>");
  });

  it("bloqueia despesa sem unidade TISS e lotes mistos", () => {
    const expenseWithoutUnit = baseGuide({
      tipo_guia: "sp_sadt",
      carater_atendimento: "1",
      tipo_atendimento_tuss50_codigo: "05",
      solicitante_codigo_prestador_snapshot: "PRESTSOL001",
      solicitante_nome_contratado_snapshot: "HOSPITAL SOLICITANTE",
      solicitante_codigo_conselho_ans_snapshot: "06",
      solicitante_numero_conselho_snapshot: "99999",
      solicitante_uf_conselho_snapshot: "SP",
      solicitante_cbo_snapshot: "225125",
      itens: [{
        sequencial: 1,
        data_execucao: "2026-09-02",
        tabela: "19",
        codigo_procedimento: "0000000001",
        descricao: "MATERIAL TESTE",
        quantidade: 1,
        valor_unitario: 10,
        valor_total: 10,
        origem_tipo: "material",
        unidade_medida_tiss: null,
      }],
    });
    expect(() => serializeTissWireLoteGuias040300(lot(expenseWithoutUnit))).toThrow("TISS040300_ITEM_UNIDADE_OBRIGATORIA");

    const mixed: TissFinalLot040300 = {
      ...lot(baseGuide()),
      guias: [baseGuide(), baseGuide({ id: "00000000-0000-0000-0000-000000000002", tipo_guia: "sp_sadt" })],
    };
    expect(() => serializeTissWireLoteGuias040300(mixed)).toThrow("TISS040300_LOTE_MISTURA_TIPOS_GUIA");
  });

  it("mantém bordas de download e transporte em ISO-8859-1 e envio final-only", async () => {
    const fs = await import("node:fs/promises");
    const [route, adapter, migration] = await Promise.all([
      fs.readFile("src/app/api/tiss/xml/[xmlId]/route.ts", "utf8"),
      fs.readFile("src/modules/tiss/webservices/adapter.ts", "utf8"),
      fs.readFile("supabase/migrations/20260902183026_tiss_envio_final_only_040300.sql", "utf8"),
    ]);
    expect(route).toContain('Buffer.from(xml.xml_conteudo, latin1 ? "latin1" : "utf8")');
    expect(route).toContain('"iso-8859-1"');
    expect(adapter).toContain("function encodeBody(value: string, latin1: boolean): ArrayBuffer");
    expect(adapter).toContain('Buffer.from(value, latin1 ? "latin1" : "utf8")');
    expect(adapter).toContain("new Uint8Array(body).set(bytes)");
    expect(adapter).toContain("stripXmlDeclaration");
    expect(migration).toContain("v_xml.tipo_mensagem is distinct from 'ENVIO_LOTE_GUIAS'");
    expect(migration).toContain("v_xml.versao_comunicacao is distinct from '04.03.00'");
  });
});
