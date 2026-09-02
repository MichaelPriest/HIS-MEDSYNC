import { createHash } from "node:crypto";
import {
  serializeTissLoteGuias040300,
  TISS_XML_NAMESPACE,
  type TissFinalItem040300,
  type TissFinalLot040300,
  type TissSerializedMessage040300,
} from "@/modules/tiss/mensagem-final-040300";

export const TISS_WIRE_PADRAO_040300 = "4.03.00" as const;

const PROCEDURE_ORIGINS = new Set(["procedimento", "honorario", "laboratorio", "imagem", "pacote"]);
const VALID_SADT_TIPO_ATENDIMENTO = new Set(["01", "02", "03", "04", "08", "09", "10", "13", "23"]);
const UF_ANS_040300: Record<string, string> = {
  RO: "11", AC: "12", AM: "13", RR: "14", PA: "15", AP: "16", TO: "17",
  MA: "21", PI: "22", CE: "23", RN: "24", PB: "25", PE: "26", AL: "27", SE: "28", BA: "29",
  MG: "31", ES: "32", RJ: "33", SP: "35",
  PR: "41", SC: "42", RS: "43",
  MS: "50", MT: "51", GO: "52", DF: "53",
};
const VALID_UF_ANS_040300 = new Set([...Object.values(UF_ANS_040300), "98"]);

/**
 * Converte a representação canônica interna para o wire-format exigido pelos
 * XSDs ANS 4.03.00 e pela autoridade transacional do lote.
 *
 * A versão persistida no catálogo do HIS continua 04.03.00; a tag Padrao do
 * XML, porém, é dm_versao e usa 4.03.00 conforme o XSD oficial.
 */
export function serializeTissWireLoteGuias040300(input: TissFinalLot040300): TissSerializedMessage040300 {
  const base = serializeTissLoteGuias040300(input);
  assertCommunicationDomains(input);
  let canonicalXml = base.xml;

  canonicalXml = patchUfDomains(canonicalXml);
  if (base.tipoGuia === "consulta") canonicalXml = patchConsultaExecutante(canonicalXml, input);
  if (base.tipoGuia === "sp_sadt") canonicalXml = patchSadtExecutados(canonicalXml, input);

  let xml = canonicalXml
    .replace("<Padrao>04.03.00</Padrao>", `<Padrao>${TISS_WIRE_PADRAO_040300}</Padrao>`)
    .replace(/<(\/?)([A-Za-z_][A-Za-z0-9_.-]*)(?=[\s>])/g, "<$1ans:$2")
    .replace(`xmlns=\"${TISS_XML_NAMESPACE}\"`, `xmlns:ans=\"${TISS_XML_NAMESPACE}\"`);

  const preEpilogo = xml.split("<ans:epilogo>", 1)[0] ?? "";
  const values = Array.from(preEpilogo.matchAll(/>([^<]*)</g))
    .map((match) => decodeForTissHash(match[1] ?? ""))
    .filter((value) => value.trim() !== "")
    .join("");
  const hashTissMd5 = createHash("md5").update(Buffer.from(values, "latin1")).digest("hex").toUpperCase();

  xml = xml.replace(
    /<ans:epilogo><ans:hash>[^<]*<\/ans:hash><\/ans:epilogo>/,
    `<ans:epilogo><ans:hash>${hashTissMd5}</ans:hash></ans:epilogo>`,
  );

  return {
    ...base,
    xml,
    hashTissMd5,
    // Hash técnico da representação textual persistida no PostgreSQL. O wire
    // HTTP/download é codificado em ISO-8859-1 na borda.
    hashSha256: createHash("sha256").update(xml, "utf8").digest("hex"),
  };
}

function assertCommunicationDomains(input: TissFinalLot040300) {
  for (const guide of input.guias) {
    ansUf040300(guide.profissional_uf_conselho_snapshot);
    if (guide.tipo_guia === "sp_sadt") {
      ansUf040300(guide.solicitante_uf_conselho_snapshot);
      const tipoAtendimento = String(guide.tipo_atendimento_tuss50_codigo ?? "").trim();
      if (!VALID_SADT_TIPO_ATENDIMENTO.has(tipoAtendimento)) {
        throw new Error(`TISS040300_TIPO_ATENDIMENTO_INVALIDO:${guide.id}:${tipoAtendimento || "VAZIO"}`);
      }
    }
  }
}

function patchUfDomains(xml: string) {
  return xml.replace(/<UF>([^<]*)<\/UF>/g, (_full, value: string) => `<UF>${ansUf040300(value)}</UF>`);
}

function ansUf040300(value: string | null | undefined) {
  const raw = String(value ?? "").trim().toUpperCase();
  if (VALID_UF_ANS_040300.has(raw)) return raw;
  const mapped = UF_ANS_040300[raw];
  if (mapped) return mapped;
  throw new Error(`TISS040300_UF_INVALIDA:${raw || "VAZIA"}`);
}

function patchConsultaExecutante(xml: string, input: TissFinalLot040300) {
  let guideIndex = 0;
  return xml.replace(/<contratadoExecutante>([\s\S]*?)<\/contratadoExecutante>/g, (_full, identifier: string) => {
    const guide = input.guias[guideIndex++];
    if (!guide || !/^\d{7}$/.test(guide.cnes_snapshot)) throw new Error(`TISS040300_CNES_INVALIDO:${guide?.id ?? guideIndex}`);
    // Na Guia de Consulta, CNES integra o próprio contratadoExecutante
    // (extensão de ct_contratadoDados), diferente dos blocos de SADT/internação.
    return `<contratadoExecutante>${identifier}<CNES>${guide.cnes_snapshot}</CNES></contratadoExecutante>`;
  });
}

function patchSadtExecutados(xml: string, input: TissFinalLot040300) {
  const items = input.guias.flatMap((guide) => guide.itens.filter(isProcedure));
  let itemIndex = 0;

  const patched = xml.replace(/<procedimentoExecutado>([\s\S]*?)<\/procedimentoExecutado>/g, (_full, body: string) => {
    const item = items[itemIndex++];
    if (!item) throw new Error("TISS040300_SADT_ITEM_SERIALIZACAO_DIVERGENTE");

    const quantity = Number(item.quantidade);
    if (!Number.isInteger(quantity) || quantity < 0 || quantity > 999) {
      throw new Error(`TISS040300_ITEM_QUANTIDADE_SADT_INVALIDA:${item.sequencial}`);
    }

    const reduction = factor(item.reducao_acrescimo);
    let result = body
      .replace(/<quantidadeExecutada>[^<]*<\/quantidadeExecutada>/, `<quantidadeExecutada>${quantity}</quantidadeExecutada>`)
      .replace(/<unidadeMedida>[^<]*<\/unidadeMedida>/g, "");

    if (!/<reducaoAcrescimo>/.test(result)) {
      result = result.replace("<valorUnitario>", `<reducaoAcrescimo>${reduction}</reducaoAcrescimo><valorUnitario>`);
    }
    return `<procedimentoExecutado>${result}</procedimentoExecutado>`;
  });

  if (itemIndex !== items.length) throw new Error("TISS040300_SADT_ITEM_SERIALIZACAO_DIVERGENTE");
  return patched;
}

function isProcedure(item: TissFinalItem040300) {
  return Boolean(item.origem_tipo && PROCEDURE_ORIGINS.has(item.origem_tipo));
}

function factor(value?: number | null) {
  const number = value == null ? 1 : Number(value);
  if (!Number.isFinite(number) || number < 0 || number >= 10) throw new Error("TISS040300_FATOR_REDUCAO_INVALIDO");
  return number.toFixed(2);
}

function decodeForTissHash(value: string) {
  // Mesma ordem utilizada pela autoridade transacional no PostgreSQL.
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}
