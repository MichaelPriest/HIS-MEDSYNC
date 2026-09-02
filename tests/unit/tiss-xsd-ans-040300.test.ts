import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("contrato XSD ANS TISS 04.03.00", () => {
  it("fixa a versão vigente e hashes dos sete schemas operacionais", () => {
    const manifest = JSON.parse(read("vendor/tiss/040300/manifest.json")) as {
      communicationVersion: string;
      ansCurrentStandard: string;
      packageSha256: string;
      files: Record<string, string>;
    };
    expect(manifest.communicationVersion).toBe("04.03.00");
    expect(manifest.ansCurrentStandard).toBe("2026-07");
    expect(manifest.packageSha256).toBe("db8640e1c3b87085892f54f838bfcea9934439ff365798c8428559f88c13d62d");
    expect(Object.keys(manifest.files)).toEqual(expect.arrayContaining([
      "tissAssinaturaDigital_v1.01.xsd",
      "tissComplexTypesV4_03_00.xsd",
      "tissGuiasV4_03_00.xsd",
      "tissSimpleTypesV4_03_00.xsd",
      "tissV4_03_00.xsd",
      "tissWebServicesV4_03_00.xsd",
      "xmldsig-core-schema.xsd",
    ]));
    expect(Object.keys(manifest.files)).toHaveLength(7);
    for (const hash of Object.values(manifest.files)) expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("materializa somente bytes com SHA-256 esperado", () => {
    const sync = read("scripts/sync-tiss-ans-xsd.mjs");
    expect(sync).toContain('createHash("sha256")');
    expect(sync).toContain("actualHash !== expectedHash");
    expect(sync).toContain("verifiedMirror.baseRawUrl");
    expect(sync).toContain("TISS_XSD_SYNC_OK");
  });

  it("usa libxml2 wasm, bloqueia DTD/ENTITY e não aceita preliminar como XSD válido", () => {
    const validator = read("src/modules/tiss/xsd-validator.ts");
    const actions = read("src/modules/tiss/lote-background-actions.ts");
    expect(validator).toContain('from "xmllint-wasm"');
    expect(validator).toContain('const MAIN_SCHEMA = "tissV4_03_00.xsd"');
    expect(validator).toContain('const WEBSERVICE_SCHEMA = "tissWebServicesV4_03_00.xsd"');
    expect(validator).toContain("<!DOCTYPE");
    expect(validator).toContain("<!ENTITY");
    expect(validator).toContain("preload");
    expect(actions).toContain("registrar_validacao_xsd_tiss_operacional");
    expect(actions).toContain('xml.tipo_mensagem === "PRELIMINAR_INTERNO"');
    expect(actions).toContain("registrar_envio_manual_tiss_operacional");
  });

  it("mantém a autoridade transacional da validação no Supabase", () => {
    const migration = read("supabase/migrations/20260902144511_tiss_xsd_ans_040300.sql");
    const fixMigration = read("supabase/migrations/20260902153013_tiss_xsd_ans_040300_fix_lote_columns.sql");
    expect(migration).toContain("security definer");
    expect(migration).toContain("TISS_XSD_VERSAO_DIVERGENTE");
    expect(migration).toContain("TISS_XML_PRELIMINAR_NAO_VALIDAVEL");
    expect(migration).toContain("TISS_XSD_RESULTADO_INCONSISTENTE");
    expect(migration).toContain("grant execute");

    expect(fixMigration).toContain("jsonb_typeof(v_erros) <> 'array'");
    expect(fixMigration).toContain("TISS_XSD_HASH_INVALIDO");
    expect(fixMigration).toContain("TISS_XSD_HASH_OBRIGATORIO");
    expect(fixMigration).toContain("xsd_validado = coalesce(p_xsd_validado,false)");
    expect(fixMigration).not.toContain("updated_at = now()");
    expect(fixMigration).not.toContain("updated_by = v_user");
    expect(fixMigration).toContain("grant execute");
  });

  it("instala o motor no runtime e sincroniza schemas antes dos testes e build", () => {
    const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string>; dependencies: Record<string, string> };
    const next = read("next.config.ts");
    expect(pkg.dependencies["xmllint-wasm"]).toBe("5.3.0");
    expect(pkg.scripts.pretest).toContain("sync-tiss-ans-xsd.mjs");
    expect(pkg.scripts.prebuild).toContain("sync-tiss-ans-xsd.mjs");
    expect(next).toContain('serverExternalPackages: ["xmllint-wasm"]');
    expect(next).toContain("vendor/tiss/040300");
  });
});
