import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { validateXML } from "xmllint-wasm";

const SCHEMA_DIR = join(process.cwd(), "vendor", "tiss", "040300");
const MAIN_SCHEMA = "tissV4_03_00.xsd";
const WEBSERVICE_SCHEMA = "tissWebServicesV4_03_00.xsd";
const DEPENDENCIES = [
  "tissAssinaturaDigital_v1.01.xsd",
  "tissComplexTypesV4_03_00.xsd",
  "tissGuiasV4_03_00.xsd",
  "tissSimpleTypesV4_03_00.xsd",
  "xmldsig-core-schema.xsd",
] as const;

export const TISS_XSD_VERSION = "04.03.00";

export type TissXsdValidationError = {
  codigo: string;
  mensagem: string;
  arquivo?: string | null;
  linha?: number | null;
};

export type TissXsdValidationResult = {
  valid: boolean;
  version: typeof TISS_XSD_VERSION;
  schema: string;
  hashSha256: string;
  errors: TissXsdValidationError[];
};

let schemaCache: Promise<{
  messageSchema: string;
  webserviceSchema: string;
  preload: Array<{ fileName: string; contents: string }>;
}> | null = null;

function normalizeXmlDeclaration(value: string) {
  return value.replace(/^<\?xml([^>]*?)encoding=["']ISO-8859-1["']([^>]*?)\?>/i, "<?xml$1encoding=\"UTF-8\"$2?>");
}

function decodeAnsXsd(bytes: Buffer) {
  return normalizeXmlDeclaration(bytes.toString("latin1"));
}

async function loadSchemas() {
  schemaCache ??= (async () => {
    const [messageBytes, webserviceBytes, ...dependencyBytes] = await Promise.all([
      readFile(join(SCHEMA_DIR, MAIN_SCHEMA)),
      readFile(join(SCHEMA_DIR, WEBSERVICE_SCHEMA)),
      ...DEPENDENCIES.map((name) => readFile(join(SCHEMA_DIR, name))),
    ]);

    return {
      messageSchema: decodeAnsXsd(messageBytes),
      webserviceSchema: decodeAnsXsd(webserviceBytes),
      preload: DEPENDENCIES.map((fileName, index) => ({
        fileName,
        contents: decodeAnsXsd(dependencyBytes[index]),
      })),
    };
  })();
  return schemaCache;
}

function rejectsExternalEntities(xml: string) {
  return /<!DOCTYPE\b/i.test(xml) || /<!ENTITY\b/i.test(xml);
}

function looksLikeWebserviceEnvelope(xml: string) {
  const head = xml.slice(0, 4096);
  return /<(?:[A-Za-z_][\w.-]*:)?(?:loteGuiasWS|recursoGlosaWS|solicitacaoProcedimentoWS|verificaElegibilidadeWS|cancelaGuiaWS)\b/.test(head);
}

export async function validateTissXmlXsd(xml: string): Promise<TissXsdValidationResult> {
  const hashSha256 = createHash("sha256").update(xml, "utf8").digest("hex");
  const webservice = looksLikeWebserviceEnvelope(xml);
  const schemaName = webservice ? WEBSERVICE_SCHEMA : MAIN_SCHEMA;

  if (rejectsExternalEntities(xml)) {
    return {
      valid: false,
      version: TISS_XSD_VERSION,
      schema: schemaName,
      hashSha256,
      errors: [{
        codigo: "XML_DTD_ENTITY_BLOQUEADO",
        mensagem: "DTD e declarações ENTITY não são aceitas no processamento TISS.",
      }],
    };
  }

  const { messageSchema, webserviceSchema, preload } = await loadSchemas();
  const normalizedXml = normalizeXmlDeclaration(xml);

  try {
    const result = await validateXML({
      xml: [{ fileName: "mensagem.xml", contents: normalizedXml }],
      schema: [{ fileName: schemaName, contents: webservice ? webserviceSchema : messageSchema }],
      preload,
      initialMemoryPages: 512,
      maxMemoryPages: 4096,
    });

    return {
      valid: result.valid,
      version: TISS_XSD_VERSION,
      schema: schemaName,
      hashSha256,
      errors: (result.errors ?? []).slice(0, 100).map((error, index) => ({
        codigo: `XSD_${String(index + 1).padStart(3, "0")}`,
        mensagem: error.message || error.rawMessage || "Erro de validação XSD.",
        arquivo: error.loc?.fileName ?? null,
        linha: error.loc?.lineNumber ?? null,
      })),
    };
  } catch (error) {
    console.error("[tiss.xsd] falha técnica ao executar xmllint", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      valid: false,
      version: TISS_XSD_VERSION,
      schema: schemaName,
      hashSha256,
      errors: [{
        codigo: "XSD_ENGINE_ERROR",
        mensagem: "O validador XSD não conseguiu concluir a validação técnica.",
      }],
    };
  }
}
