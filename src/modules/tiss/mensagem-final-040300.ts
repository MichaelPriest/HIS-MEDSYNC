import { createHash } from "node:crypto";

export const TISS_FINAL_VERSION = "04.03.00" as const;
export const TISS_FINAL_MESSAGE_TYPE = "ENVIO_LOTE_GUIAS" as const;
export const TISS_XML_NAMESPACE = "http://www.ans.gov.br/padroes/tiss/schemas";

export type TissGuideType040300 = "consulta" | "sp_sadt" | "resumo_internacao";

export type TissFinalItem040300 = {
  sequencial: number;
  data_execucao: string;
  hora_inicial?: string | null;
  hora_final?: string | null;
  tabela: string;
  codigo_procedimento: string;
  descricao?: string | null;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  via_acesso?: string | null;
  tecnica_utilizada?: string | null;
  reducao_acrescimo?: number | null;
  origem_tipo?: string | null;
  unidade_medida_tiss?: string | null;
};

export type TissFinalGuide040300 = {
  id: string;
  tipo_guia: TissGuideType040300;
  numero_guia_prestador: string;
  numero_guia_operadora?: string | null;
  registro_ans: string;
  codigo_prestador_operadora?: string | null;
  numero_carteirinha: string;
  atendimento_rn: boolean;
  data_atendimento: string;
  hora_inicio?: string | null;
  validade_senha?: string | null;
  senha_autorizacao?: string | null;
  data_autorizacao?: string | null;
  cnes_snapshot: string;
  profissional_nome_snapshot?: string | null;
  codigo_conselho_ans_snapshot: string;
  profissional_numero_conselho_snapshot: string;
  profissional_uf_conselho_snapshot: string;
  profissional_cbo_snapshot: string;
  indicador_acidente: string;
  regime_atendimento_tiss?: string | null;
  carater_atendimento?: string | null;
  tipo_atendimento_tuss50_codigo?: string | null;
  tipo_consulta_tuss52_codigo?: string | null;
  numero_solicitacao_internacao?: string | null;
  tipo_faturamento_tiss?: string | null;
  data_inicio_faturamento?: string | null;
  hora_inicio_faturamento?: string | null;
  data_fim_faturamento?: string | null;
  hora_fim_faturamento?: string | null;
  tipo_internacao_tiss?: string | null;
  regime_internacao_tiss?: string | null;
  motivo_encerramento_tiss?: string | null;
  solicitante_codigo_prestador_snapshot?: string | null;
  solicitante_cnpj_snapshot?: string | null;
  solicitante_nome_contratado_snapshot?: string | null;
  solicitante_nome_profissional_snapshot?: string | null;
  solicitante_codigo_conselho_ans_snapshot?: string | null;
  solicitante_numero_conselho_snapshot?: string | null;
  solicitante_uf_conselho_snapshot?: string | null;
  solicitante_cbo_snapshot?: string | null;
  itens: TissFinalItem040300[];
};

export type TissFinalLot040300 = {
  numero_lote: string;
  registro_ans: string;
  prestador_codigo_operadora?: string | null;
  prestador_cnpj: string;
  data_transacao: string;
  hora_transacao: string;
  guias: TissFinalGuide040300[];
};

export type TissSerializedMessage040300 = {
  xml: string;
  hashTissMd5: string;
  hashSha256: string;
  tipoGuia: TissGuideType040300;
  quantidadeGuias: number;
  valorTotal: number;
};

const EXPENSE_CODE: Record<string, string> = {
  gas_medicinal: "01",
  medicamento: "02",
  material: "03",
  diaria: "05",
  taxa: "07",
  opme: "08",
};
const PROCEDURE_ORIGINS = new Set(["procedimento", "honorario", "laboratorio", "imagem", "pacote"]);

class Xml040300 {
  readonly values: string[] = [];

  leaf(name: string, value: string | number | boolean) {
    const raw = String(value);
    assertLatin1(raw, name);
    this.values.push(raw);
    return `<${name}>${escapeXml(raw)}</${name}>`;
  }

  optional(name: string, value: string | number | null | undefined) {
    if (value === null || value === undefined || String(value).trim() === "") return "";
    return this.leaf(name, value);
  }
}

export function serializeTissLoteGuias040300(input: TissFinalLot040300): TissSerializedMessage040300 {
  preflight(input);
  const type = input.guias[0].tipo_guia;
  const x = new Xml040300();

  const header = [
    "<cabecalho>",
    "<identificacaoTransacao>",
    x.leaf("tipoTransacao", TISS_FINAL_MESSAGE_TYPE),
    x.leaf("sequencialTransacao", input.numero_lote),
    x.leaf("dataRegistroTransacao", input.data_transacao),
    x.leaf("horaRegistroTransacao", normalizeTime(input.hora_transacao)),
    "</identificacaoTransacao>",
    "<origem><identificacaoPrestador>",
    contractedIdentifier(x, input.prestador_codigo_operadora, input.prestador_cnpj, "CNPJ"),
    "</identificacaoPrestador></origem>",
    `<destino>${x.leaf("registroANS", input.registro_ans)}</destino>`,
    x.leaf("Padrao", TISS_FINAL_VERSION),
    "</cabecalho>",
  ].join("");

  const lotNumber = x.leaf("numeroLote", input.numero_lote);
  const guideXml = input.guias.map((guide) => serializeGuide(x, guide, input.prestador_cnpj)).join("");
  const lot = `<prestadorParaOperadora><loteGuias>${lotNumber}<guiasTISS>${guideXml}</guiasTISS></loteGuias></prestadorParaOperadora>`;
  const hashTissMd5 = md5Latin1(x.values.join(""));
  const xml = `<?xml version="1.0" encoding="ISO-8859-1"?><mensagemTISS xmlns="${TISS_XML_NAMESPACE}">${header}${lot}<epilogo><hash>${hashTissMd5}</hash></epilogo></mensagemTISS>`;
  assertLatin1(xml, "mensagemTISS");

  return {
    xml,
    hashTissMd5,
    hashSha256: createHash("sha256").update(xml, "utf8").digest("hex"),
    tipoGuia: type,
    quantidadeGuias: input.guias.length,
    valorTotal: roundMoney(input.guias.reduce((sum, guide) => sum + guide.itens.reduce((acc, item) => acc + Number(item.valor_total), 0), 0)),
  };
}

function serializeGuide(x: Xml040300, guide: TissFinalGuide040300, companyCnpj: string) {
  if (guide.tipo_guia === "consulta") return `<guiaConsulta>${serializeConsulta(x, guide, companyCnpj)}</guiaConsulta>`;
  if (guide.tipo_guia === "sp_sadt") return `<guiaSP-SADT>${serializeSadt(x, guide, companyCnpj)}</guiaSP-SADT>`;
  return `<guiaResumoInternacao>${serializeInpatient(x, guide, companyCnpj)}</guiaResumoInternacao>`;
}

function guideHeader(x: Xml040300, guide: TissFinalGuide040300) {
  return x.leaf("registroANS", guide.registro_ans) + x.leaf("numeroGuiaPrestador", guide.numero_guia_prestador);
}

function beneficiary(x: Xml040300, guide: TissFinalGuide040300) {
  return `<dadosBeneficiario>${x.leaf("numeroCarteira", guide.numero_carteirinha)}${x.leaf("atendimentoRN", guide.atendimento_rn ? "S" : "N")}</dadosBeneficiario>`;
}

function executor(x: Xml040300, guide: TissFinalGuide040300, companyCnpj: string) {
  return `<contratadoExecutante>${contractedIdentifier(x, guide.codigo_prestador_operadora, companyCnpj, "cnpjContratado")}</contratadoExecutante>${x.leaf("CNES", guide.cnes_snapshot)}`;
}

function professional(x: Xml040300, guide: TissFinalGuide040300) {
  return [
    "<profissionalExecutante>",
    x.optional("nomeProfissional", guide.profissional_nome_snapshot),
    x.leaf("conselhoProfissional", guide.codigo_conselho_ans_snapshot),
    x.leaf("numeroConselhoProfissional", guide.profissional_numero_conselho_snapshot),
    x.leaf("UF", guide.profissional_uf_conselho_snapshot),
    x.leaf("CBOS", guide.profissional_cbo_snapshot),
    "</profissionalExecutante>",
  ].join("");
}

function serializeConsulta(x: Xml040300, guide: TissFinalGuide040300, companyCnpj: string) {
  const item = guide.itens[0];
  return [
    `<cabecalhoConsulta>${guideHeader(x, guide)}</cabecalhoConsulta>`,
    x.optional("numeroGuiaOperadora", guide.numero_guia_operadora),
    beneficiary(x, guide),
    `<contratadoExecutante>${contractedIdentifier(x, guide.codigo_prestador_operadora, companyCnpj, "cnpjContratado")}</contratadoExecutante>`,
    professional(x, guide),
    x.leaf("indicacaoAcidente", guide.indicador_acidente),
    "<dadosAtendimento>",
    x.leaf("regimeAtendimento", required(guide.regime_atendimento_tiss, "regime de atendimento da consulta")),
    x.leaf("dataAtendimento", guide.data_atendimento),
    x.leaf("tipoConsulta", required(guide.tipo_consulta_tuss52_codigo, "tipo de consulta")),
    "<procedimento>",
    x.leaf("codigoTabela", item.tabela),
    x.leaf("codigoProcedimento", item.codigo_procedimento),
    x.leaf("valorProcedimento", money(item.valor_total)),
    "</procedimento>",
    "</dadosAtendimento>",
  ].join("");
}

function serializeSadt(x: Xml040300, guide: TissFinalGuide040300, companyCnpj: string) {
  const procedures = guide.itens.filter(isProcedure);
  const expenses = guide.itens.filter(isExpense);
  const auth = guide.data_autorizacao ? `<dadosAutorizacao>${x.optional("numeroGuiaOperadora", guide.numero_guia_operadora)}${x.leaf("dataAutorizacao", guide.data_autorizacao)}${x.optional("senha", guide.senha_autorizacao)}${x.optional("dataValidadeSenha", guide.validade_senha)}</dadosAutorizacao>` : "";
  const executed = procedures.length ? `<procedimentosExecutados>${procedures.map((item) => `<procedimentoExecutado>${executedSadt(x, item)}</procedimentoExecutado>`).join("")}</procedimentosExecutados>` : "";
  const other = expenses.length ? serializeOtherExpenses(x, expenses) : "";
  return [
    `<cabecalhoGuia>${guideHeader(x, guide)}</cabecalhoGuia>`,
    auth,
    beneficiary(x, guide),
    "<dadosSolicitante>",
    `<contratadoSolicitante>${contractedIdentifier(x, guide.solicitante_codigo_prestador_snapshot, guide.solicitante_cnpj_snapshot, "cnpjContratado")}</contratadoSolicitante>`,
    x.leaf("nomeContratadoSolicitante", required(guide.solicitante_nome_contratado_snapshot, "nome do contratado solicitante")),
    "<profissionalSolicitante>",
    x.optional("nomeProfissional", guide.solicitante_nome_profissional_snapshot),
    x.leaf("conselhoProfissional", required(guide.solicitante_codigo_conselho_ans_snapshot, "conselho do solicitante")),
    x.leaf("numeroConselhoProfissional", required(guide.solicitante_numero_conselho_snapshot, "número do conselho do solicitante")),
    x.leaf("UF", required(guide.solicitante_uf_conselho_snapshot, "UF do conselho do solicitante")),
    x.leaf("CBOS", required(guide.solicitante_cbo_snapshot, "CBO do solicitante")),
    "</profissionalSolicitante>",
    "</dadosSolicitante>",
    `<dadosSolicitacao>${x.leaf("caraterAtendimento", required(guide.carater_atendimento, "caráter do atendimento"))}</dadosSolicitacao>`,
    `<dadosExecutante>${executor(x, guide, companyCnpj)}</dadosExecutante>`,
    "<dadosAtendimento>",
    x.leaf("tipoAtendimento", required(guide.tipo_atendimento_tuss50_codigo, "tipo de atendimento")),
    x.leaf("indicacaoAcidente", guide.indicador_acidente),
    x.optional("tipoConsulta", guide.tipo_consulta_tuss52_codigo),
    x.leaf("regimeAtendimento", required(guide.regime_atendimento_tiss, "regime de atendimento")),
    "</dadosAtendimento>",
    executed,
    other,
    serializeTotals(x, guide.itens),
  ].join("");
}

function serializeInpatient(x: Xml040300, guide: TissFinalGuide040300, companyCnpj: string) {
  const procedures = guide.itens.filter(isProcedure);
  const expenses = guide.itens.filter(isExpense);
  const executed = procedures.length ? `<procedimentosExecutados>${procedures.map((item) => `<procedimentoExecutado>${executedInpatient(x, item)}</procedimentoExecutado>`).join("")}</procedimentosExecutados>` : "";
  const other = expenses.length ? serializeOtherExpenses(x, expenses) : "";
  return [
    `<cabecalhoGuia>${guideHeader(x, guide)}</cabecalhoGuia>`,
    x.leaf("numeroGuiaSolicitacaoInternacao", required(guide.numero_solicitacao_internacao, "guia de solicitação de internação")),
    "<dadosAutorizacao>",
    x.optional("numeroGuiaOperadora", guide.numero_guia_operadora),
    x.leaf("dataAutorizacao", required(guide.data_autorizacao, "data de autorização da internação")),
    x.leaf("senha", required(guide.senha_autorizacao, "senha da autorização da internação")),
    x.optional("dataValidadeSenha", guide.validade_senha),
    "</dadosAutorizacao>",
    beneficiary(x, guide),
    `<dadosExecutante>${executor(x, guide, companyCnpj)}</dadosExecutante>`,
    "<dadosInternacao>",
    x.leaf("caraterAtendimento", required(guide.carater_atendimento, "caráter da internação")),
    x.leaf("tipoFaturamento", required(guide.tipo_faturamento_tiss, "tipo de faturamento")),
    x.leaf("dataInicioFaturamento", required(guide.data_inicio_faturamento, "data inicial do faturamento")),
    x.leaf("horaInicioFaturamento", normalizeTime(required(guide.hora_inicio_faturamento, "hora inicial do faturamento"))),
    x.leaf("dataFinalFaturamento", required(guide.data_fim_faturamento, "data final do faturamento")),
    x.leaf("horaFinalFaturamento", normalizeTime(required(guide.hora_fim_faturamento, "hora final do faturamento"))),
    x.leaf("tipoInternacao", required(guide.tipo_internacao_tiss, "tipo de internação")),
    x.leaf("regimeInternacao", required(guide.regime_internacao_tiss, "regime de internação")),
    "</dadosInternacao>",
    `<dadosSaidaInternacao>${x.leaf("indicadorAcidente", guide.indicador_acidente)}${x.leaf("motivoEncerramento", required(guide.motivo_encerramento_tiss, "motivo de encerramento"))}</dadosSaidaInternacao>`,
    executed,
    serializeTotals(x, guide.itens),
    other,
  ].join("");
}

function executedSadt(x: Xml040300, item: TissFinalItem040300) {
  return [
    x.leaf("sequencialItem", item.sequencial),
    x.leaf("dataExecucao", item.data_execucao),
    x.optional("horaInicial", normalizeOptionalTime(item.hora_inicial)),
    x.optional("horaFinal", normalizeOptionalTime(item.hora_final)),
    procedimentoDados(x, item),
    x.optional("unidadeMedida", item.unidade_medida_tiss),
    x.leaf("quantidadeExecutada", decimal(item.quantidade, 4)),
    x.optional("viaAcesso", item.via_acesso),
    x.optional("tecnicaUtilizada", item.tecnica_utilizada),
    x.leaf("valorUnitario", money(item.valor_unitario)),
    x.leaf("valorTotal", money(item.valor_total)),
  ].join("");
}

function executedInpatient(x: Xml040300, item: TissFinalItem040300) {
  const quantity = Number(item.quantidade);
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 999) throw new Error(`TISS040300_ITEM_QUANTIDADE_INTERNACAO_INVALIDA:${item.sequencial}`);
  return [
    x.leaf("sequencialItem", item.sequencial),
    x.leaf("dataExecucao", item.data_execucao),
    x.optional("horaInicial", normalizeOptionalTime(item.hora_inicial)),
    x.optional("horaFinal", normalizeOptionalTime(item.hora_final)),
    procedimentoDados(x, item),
    x.leaf("quantidadeExecutada", quantity),
    x.optional("viaAcesso", item.via_acesso),
    x.optional("tecnicaUtilizada", item.tecnica_utilizada),
    x.leaf("reducaoAcrescimo", factor(item.reducao_acrescimo)),
    x.leaf("valorUnitario", money(item.valor_unitario)),
    x.leaf("valorTotal", money(item.valor_total)),
  ].join("");
}

function serializeOtherExpenses(x: Xml040300, items: TissFinalItem040300[]) {
  return `<outrasDespesas>${items.map((item) => {
    const code = EXPENSE_CODE[required(item.origem_tipo, `origem da despesa ${item.sequencial}`)];
    if (!code) throw new Error(`TISS040300_DESPESA_NAO_MAPEADA:${item.sequencial}`);
    const unit = required(item.unidade_medida_tiss, `unidade da despesa ${item.sequencial}`);
    return `<despesa>${x.leaf("sequencialItem", item.sequencial)}${x.leaf("codigoDespesa", code)}<servicosExecutados>${x.leaf("dataExecucao", item.data_execucao)}${x.optional("horaInicial", normalizeOptionalTime(item.hora_inicial))}${x.optional("horaFinal", normalizeOptionalTime(item.hora_final))}${x.leaf("codigoTabela", item.tabela)}${x.leaf("codigoProcedimento", item.codigo_procedimento)}${x.leaf("quantidadeExecutada", decimal(item.quantidade, 4))}${x.leaf("unidadeMedida", unit)}${x.leaf("reducaoAcrescimo", factor(item.reducao_acrescimo))}${x.leaf("valorUnitario", money(item.valor_unitario))}${x.leaf("valorTotal", money(item.valor_total))}${x.leaf("descricaoProcedimento", required(item.descricao, `descrição da despesa ${item.sequencial}`))}</servicosExecutados></despesa>`;
  }).join("")}</outrasDespesas>`;
}

function procedimentoDados(x: Xml040300, item: TissFinalItem040300) {
  return `<procedimento>${x.leaf("codigoTabela", item.tabela)}${x.leaf("codigoProcedimento", item.codigo_procedimento)}${x.leaf("descricaoProcedimento", required(item.descricao, `descrição do item ${item.sequencial}`))}</procedimento>`;
}

function serializeTotals(x: Xml040300, items: TissFinalItem040300[]) {
  const total = (origin: string) => roundMoney(items.filter((item) => item.origem_tipo === origin).reduce((sum, item) => sum + Number(item.valor_total), 0));
  const procedures = roundMoney(items.filter(isProcedure).reduce((sum, item) => sum + Number(item.valor_total), 0));
  const general = roundMoney(items.reduce((sum, item) => sum + Number(item.valor_total), 0));
  return `<valorTotal>${procedures ? x.leaf("valorProcedimentos", money(procedures)) : ""}${total("diaria") ? x.leaf("valorDiarias", money(total("diaria"))) : ""}${total("taxa") ? x.leaf("valorTaxasAlugueis", money(total("taxa"))) : ""}${total("material") ? x.leaf("valorMateriais", money(total("material"))) : ""}${total("medicamento") ? x.leaf("valorMedicamentos", money(total("medicamento"))) : ""}${total("opme") ? x.leaf("valorOPME", money(total("opme"))) : ""}${total("gas_medicinal") ? x.leaf("valorGasesMedicinais", money(total("gas_medicinal"))) : ""}${x.leaf("valorTotalGeral", money(general))}</valorTotal>`;
}

function contractedIdentifier(x: Xml040300, providerCode: string | null | undefined, cnpj: string | null | undefined, cnpjTag: "CNPJ" | "cnpjContratado") {
  if (providerCode?.trim()) return x.leaf("codigoPrestadorNaOperadora", providerCode.trim());
  const digits = String(cnpj ?? "").replace(/\D/g, "");
  if (digits.length !== 14) throw new Error("TISS040300_PRESTADOR_SEM_IDENTIFICACAO");
  return x.leaf(cnpjTag, digits);
}

function isExpense(item: TissFinalItem040300) {
  return Boolean(item.origem_tipo && EXPENSE_CODE[item.origem_tipo]);
}

function isProcedure(item: TissFinalItem040300) {
  return Boolean(item.origem_tipo && PROCEDURE_ORIGINS.has(item.origem_tipo));
}

function preflight(input: TissFinalLot040300) {
  if (!/^.{1,12}$/.test(input.numero_lote)) throw new Error("TISS040300_NUMERO_LOTE_INVALIDO");
  if (!/^\d{6}$/.test(input.registro_ans)) throw new Error("TISS040300_REGISTRO_ANS_INVALIDO");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.data_transacao)) throw new Error("TISS040300_DATA_TRANSACAO_INVALIDA");
  if (input.guias.length < 1 || input.guias.length > 100) throw new Error("TISS040300_QUANTIDADE_GUIAS_INVALIDA");
  const types = new Set(input.guias.map((guide) => guide.tipo_guia));
  if (types.size !== 1) throw new Error("TISS040300_LOTE_MISTURA_TIPOS_GUIA");
  for (const guide of input.guias) {
    if (guide.registro_ans !== input.registro_ans) throw new Error(`TISS040300_GUIA_ANS_DIVERGENTE:${guide.id}`);
    if (!guide.itens.length) throw new Error(`TISS040300_GUIA_SEM_ITENS:${guide.id}`);
    if (guide.tipo_guia === "consulta" && guide.itens.length !== 1) throw new Error(`TISS040300_CONSULTA_QUANTIDADE_ITEM:${guide.id}`);
    for (const item of guide.itens) {
      if (!item.origem_tipo || (!isProcedure(item) && !isExpense(item))) throw new Error(`TISS040300_ORIGEM_ITEM_NAO_SUPORTADA:${item.sequencial}`);
      if (!item.data_execucao || !item.tabela || !item.codigo_procedimento) throw new Error(`TISS040300_ITEM_INCOMPLETO:${item.sequencial}`);
      if (isExpense(item) && !item.unidade_medida_tiss) throw new Error(`TISS040300_ITEM_UNIDADE_OBRIGATORIA:${item.sequencial}`);
    }
  }
}

function required<T extends string>(value: T | null | undefined, label: string): T {
  if (!value?.trim()) throw new Error(`TISS040300_CAMPO_OBRIGATORIO:${label}`);
  return value;
}

function normalizeTime(value: string) {
  const raw = value.trim();
  if (/^\d{2}:\d{2}:\d{2}$/.test(raw)) return raw;
  if (/^\d{2}:\d{2}$/.test(raw)) return `${raw}:00`;
  throw new Error(`TISS040300_HORA_INVALIDA:${raw}`);
}

function normalizeOptionalTime(value?: string | null) {
  if (!value?.trim()) return null;
  return normalizeTime(value);
}

function money(value: number) {
  if (!Number.isFinite(Number(value)) || Number(value) < 0) throw new Error("TISS040300_VALOR_INVALIDO");
  return Number(value).toFixed(2);
}

function decimal(value: number, digits: number) {
  if (!Number.isFinite(Number(value)) || Number(value) < 0) throw new Error("TISS040300_DECIMAL_INVALIDO");
  return Number(value).toFixed(digits);
}

function factor(value?: number | null) {
  const number = value == null ? 1 : Number(value);
  if (!Number.isFinite(number) || number < 0 || number >= 10) throw new Error("TISS040300_FATOR_REDUCAO_INVALIDO");
  return number.toFixed(2);
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function md5Latin1(value: string) {
  assertLatin1(value, "hash TISS");
  return createHash("md5").update(Buffer.from(value, "latin1")).digest("hex");
}

function assertLatin1(value: string, field: string) {
  for (const character of value) {
    const point = character.codePointAt(0) ?? 0;
    if (point > 255) throw new Error(`TISS040300_CARACTERE_FORA_ISO_8859_1:${field}:U+${point.toString(16).toUpperCase()}`);
  }
}

function escapeXml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}
