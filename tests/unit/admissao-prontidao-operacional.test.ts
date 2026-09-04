import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("prontidão operacional da admissão", () => {
  it("faz a conferência preventiva em background sem enviar token ou biometria em texto puro", () => {
    const form = read("src/components/atendimentos/admission-background-form.tsx");
    expect(form).toContain('supabase.rpc("admissao_prontidao"');
    expect(form).toContain("identificacao_informada");
    expect(form).not.toContain('payload.identificacao_referencia');
    expect(form).toContain("Pronto para abrir o atendimento");
    expect(form).toContain("pendência(s) impedem a abertura");
    expect(form).toContain("preventKnownBlockedSubmit");
  });

  it("mantém a validação transacional como proteção definitiva", () => {
    const form = read("src/components/atendimentos/admission-background-form.tsx");
    expect(form).toContain("Conferência preventiva indisponível");
    expect(form).toContain("A validação final da abertura continua ativa");
  });

  it("protege a RPC com unidade, permissão funcional e helper interno fechado", () => {
    const base = read("supabase/migrations/20260903220356_admissao_prontidao_operacional.sql");
    const hardening = read("supabase/migrations/20260903221208_admissao_prontidao_permissao_funcional.sql");
    expect(base).toContain("admissao_prontidao_internal");
    expect(base).toContain("revoke all on function public.admissao_prontidao_internal");
    expect(base).toContain("grant execute on function public.admissao_prontidao(uuid,jsonb) to authenticated");
    expect(hardening).toContain("tem_permissao(v_empresa_id,p_unidade_id,'atendimentos.abrir')");
    expect(hardening).not.toContain("grant execute on function public.admissao_prontidao_internal");
  });

  it("integra a ajuda operacional e simplifica o rótulo de busca do procedimento", () => {
    const manual = read("src/app/(painel)/manual/page.tsx");
    const article = read("src/modules/knowledge-base/admissao-prontidao-articles.ts");
    const picker = read("src/components/atendimentos/tuss-procedure-picker.tsx");
    expect(manual).toContain("admissionReadinessKnowledgeBaseArticles");
    expect(article).toContain("Abrir atendimento sem pendências para o faturamento");
    expect(picker).toContain("Buscar procedimento");
    expect(picker).not.toContain("Busca inteligente TUSS");
  });
});
