import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("pendências acionáveis da admissão", () => {
  it("oferece atalhos apenas para cadastros de origem conhecidos", () => {
    const form = read("src/components/atendimentos/admission-background-form.tsx");
    expect(form).toContain('label: "Corrigir paciente"');
    expect(form).toContain('label: "Corrigir profissional"');
    expect(form).toContain('label: "Corrigir convênio"');
    expect(form).toContain('label: "Abrir cadastros TISS"');
    expect(form).toContain('issue.codigo === "ADMISSAO_CAMPOS_OBRIGATORIOS"');
    expect(form).toContain("PROFESSIONAL_SOURCE_CODES.has(issue.codigo)");
    expect(form).toContain("CONVENIO_SOURCE_CODES.has(issue.codigo)");
    expect(form).toContain("TISS_SOURCE_CODES.has(issue.codigo)");
  });

  it("preserva a admissão abrindo a correção em nova aba", () => {
    const form = read("src/components/atendimentos/admission-background-form.tsx");
    expect(form).toContain('target="_blank"');
    expect(form).toContain('rel="noreferrer"');
    expect(form).toContain("Abre em nova aba para preservar os dados já preenchidos na admissão");
    expect(form).toContain("encodeURIComponent(patientId)");
    expect(form).toContain("encodeURIComponent(professionalId)");
    expect(form).toContain("encodeURIComponent(convenioId)");
  });

  it("revalida automaticamente ao voltar da tela de correção", () => {
    const form = read("src/components/atendimentos/admission-background-form.tsx");
    expect(form).toContain('window.addEventListener("focus", recheckOnFocus)');
    expect(form).toContain('document.addEventListener("visibilitychange", recheckWhenVisible)');
    expect(form).toContain('document.visibilityState === "visible"');
  });

  it("não leva dados sensíveis nas rotas de correção", () => {
    const form = read("src/components/atendimentos/admission-background-form.tsx");
    const actionSection = form.match(/function readinessAction[\s\S]*?return null;\n}/)?.[0] ?? "";
    expect(actionSection).not.toContain("identificacao_referencia");
    expect(actionSection).not.toContain("numero_carteirinha");
    expect(actionSection).not.toContain("senha_autorizacao");
    expect(actionSection).not.toContain("numero_autorizacao");
  });

  it("documenta a correção sem sair do fluxo de admissão", () => {
    const article = read("src/modules/knowledge-base/admissao-prontidao-articles.ts");
    const docs = read("docs/ADMISSAO_PRONTIDAO_OPERACIONAL.md");
    expect(article).toContain("O cadastro abre em nova aba para preservar a admissão em andamento");
    expect(article).toContain("refaz a conferência automaticamente");
    expect(docs).toContain("## Pendências acionáveis");
    expect(docs).toContain("Atalhos de correção devem apontar somente para rotas internas existentes");
  });
});
