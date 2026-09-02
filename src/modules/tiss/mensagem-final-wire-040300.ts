import { createHash } from "node:crypto";
import {
  serializeTissLoteGuias040300,
  TISS_XML_NAMESPACE,
  type TissFinalLot040300,
  type TissSerializedMessage040300,
} from "@/modules/tiss/mensagem-final-040300";

export const TISS_WIRE_PADRAO_040300 = "4.03.00" as const;

/**
 * Converte a representação canônica interna para o wire-format exigido pelos
 * XSDs ANS 4.03.00 e pela autoridade transacional do lote.
 *
 * A versão persistida no catálogo do HIS continua 04.03.00; a tag Padrao do
 * XML, porém, é dm_versao e usa 4.03.00 conforme o XSD oficial.
 */
export function serializeTissWireLoteGuias040300(input: TissFinalLot040300): TissSerializedMessage040300 {
  const base = serializeTissLoteGuias040300(input);
  let xml = base.xml
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

function decodeForTissHash(value: string) {
  // Mesma ordem utilizada pela autoridade transacional no PostgreSQL.
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}
