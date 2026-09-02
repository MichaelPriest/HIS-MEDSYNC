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

/**
 * Converte a representação canônica interna para o wire-format exigido pelos
 * XSDs ANS 4.03.00 e pela autoridade transacional do lote.
 *
 * A versão persistida no catálogo do HIS continua 04.03.00; a tag Padrao do
 * XML, porém, é dm_versao e usa 4.03.00 conforme o XSD oficial.
 */
export function serializeTissWireLoteGuias040300(input: TissFinalLot040300): TissSerializedMessage040300 {
  const base = serializeTissLoteGuias040300(input);
  let canonicalXml = base.xml;

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
