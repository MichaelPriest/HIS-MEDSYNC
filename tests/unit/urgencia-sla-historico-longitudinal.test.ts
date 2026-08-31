import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("Urgência: SLA no histórico longitudinal", () => {
  it("expõe somente aplicações reais dentro do prontuário do paciente", () => {
    const page = source("src/app/(painel)/prontuario/[atendimentoId]/historico/sla/page.tsx");

    expect(page).toContain('requireAnyPermission(["prontuario.visualizar"])');
    expect(page).toContain('.from("emergencia_sla_aplicacoes")');
    expect(page).toContain('.in("atendimento_id", ids)');
    expect(page).toContain("aplicações efetivamente registradas em atendimentos do paciente");
    expect(page).toContain("A política institucional vigente, por si só, não é um fato clínico");
    expect(page).not.toContain('.from("emergencia_sla_configuracoes")');
  });

  it("mantém a visualização read-only e preserva o episódio longitudinal", () => {
    const page = source("src/app/(painel)/prontuario/[atendimentoId]/historico/sla/page.tsx");
    const migration = source("supabase/migrations/20260830231419_urgencia_sla_historico_longitudinal.sql");

    expect(page).toContain('href={`/prontuario/${aplicacao.atendimento_id}` as Route}');
    expect(page).not.toMatch(/\.insert\s*\(/);
    expect(page).not.toMatch(/\.update\s*\(/);
    expect(page).not.toMatch(/\.delete\s*\(/);
    expect(migration).toContain("or public.tem_permissao(empresa_id, unidade_id, 'prontuario.visualizar')");
    expect(migration).toContain("revoke insert, update, delete on public.emergencia_sla_aplicacoes from authenticated");
    expect(migration).toContain("grant select on public.emergencia_sla_aplicacoes to authenticated");
  });

  it("adiciona a aba SLA dentro do Histórico clínico sem criar novo prontuário", () => {
    const layout = source("src/app/(painel)/prontuario/[atendimentoId]/historico/layout.tsx");
    const workspace = source("src/components/prontuario/medical-workspace-nav.tsx");

    expect(layout).toContain("Histórico clínico");
    expect(layout).toContain("SLA da Urgência");
    expect(layout).toContain('const sla = `${base}/sla`');
    expect(workspace).toContain('label: "Histórico clínico"');
    expect(workspace).not.toContain('label: "SLA da Urgência"');
  });

  it("não interpreta SLA aplicado como cumprimento de protocolo ou desfecho clínico", () => {
    const page = source("src/app/(painel)/prontuario/[atendimentoId]/historico/sla/page.tsx");
    expect(page).toContain("Não representa, isoladamente, cumprimento de protocolo ou desfecho clínico");
  });
});
