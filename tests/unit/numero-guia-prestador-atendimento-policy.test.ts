import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const migration = read("supabase/migrations/20260903202843_numero_guia_prestador_igual_numero_atendimento.sql");
const admissionForm = read("src/components/atendimentos/admission-form.tsx");
const admissionPage = read("src/app/(painel)/atendimentos/novo/page.tsx");
const attendanceList = read("src/app/(painel)/atendimentos/page.tsx");

describe("número da guia do prestador", () => {
  it("usa o número do atendimento como identificador único desde a admissão", () => {
    expect(migration).toContain("new.numero_guia_prestador := new.numero_atendimento");
    expect(migration).toContain("check (numero_guia_prestador=numero_atendimento)");
    expect(migration).toContain("v_numero:=v_at.numero_atendimento::text;");
  });

  it("propaga o mesmo número para autorização, central de guias e faturamento", () => {
    expect(migration).toContain("trg_00_autorizacao_numero_guia_atendimento");
    expect(migration).toContain("trg_00_central_numero_guia_atendimento");
    expect(migration).toContain("trg_00_tiss_numero_guia_atendimento");
    expect(migration).toContain("normalizar_numero_guia_prestador_atendimento_internal");
  });

  it("permite contas parciais e final da mesma internação sem criar outro número de guia", () => {
    expect(migration).toContain("drop constraint if exists tiss_guias_empresa_id_convenio_id_numero_guia_prestador_key");
    expect(migration).toContain("tiss_guias_conta_ativa_uidx");
    expect(migration).toContain("Contas parciais e final da mesma internação compartilham o número do atendimento");
  });

  it("não mantém o gerador paralelo de número da guia na função de criação", () => {
    expect(migration).toContain("tiss_guia_numero_seq");
    expect(migration).toContain("PADRAO_ANTIGO_NUMERO_GUIA_TISS_NAO_ENCONTRADO");
    expect(migration).toContain("v_numero:=v_at.numero_atendimento::text;");
  });

  it("explica na interface que atendimento e guia compartilham o mesmo número", () => {
    expect(admissionForm).toContain("Atendimento / Guia");
    expect(admissionForm).toContain("O mesmo número será gerado automaticamente na abertura");
    expect(attendanceList).toContain("Atendimento / Guia");
    expect(attendanceList).toContain("número do atendimento é também o número da guia do prestador");
  });
});

describe("linguagem operacional da admissão", () => {
  it("não expõe jargão regulatório desnecessário na orientação ao usuário", () => {
    expect(admissionPage).not.toContain("classificação TISS");
    expect(admissionPage).not.toContain("domínios regulatórios ANS/TISS");
    expect(admissionForm).not.toContain("Domínios regulatórios ANS / FHIR");
    expect(admissionForm).not.toContain("Tipo de atendimento ANS · Tabela 50");
    expect(admissionForm).not.toContain("Tipo de consulta ANS · Tabela 52");
    expect(admissionForm).not.toContain("Atendimento a RN (TISS)");
    expect(admissionForm).toContain("Classificação do atendimento");
    expect(admissionForm).toContain("Atendimento / Faturamento");
  });
});
