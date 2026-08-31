import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("Urgência: parametrização institucional de SLA", () => {
  it("mantém mutações da configuração somente em RPCs com RBAC", () => {
    const actions = source("src/modules/urgencia/actions.ts");
    expect(actions).toContain('rpc("salvar_configuracao_sla_emergencia_operacional"');
    expect(actions).toContain('rpc("desativar_configuracao_sla_emergencia_operacional"');
    expect(actions).toContain('rpc("aplicar_sla_institucional_emergencia_operacional"');
    expect(actions).toContain('requirePermission("emergencia.gerenciar")');
    expect(actions).not.toContain('.from("emergencia_sla_configuracoes").insert');
    expect(actions).not.toContain('.from("emergencia_sla_configuracoes").update');
    expect(actions).not.toContain('.from("emergencia_sla_aplicacoes").insert');
  });

  it("não inventa tempos institucionais nem autoaplica ao abrir a urgência", () => {
    const configPage = source("src/app/(painel)/assistencial/urgencia/sla/configuracoes/page.tsx");
    const actions = source("src/modules/urgencia/actions.ts");
    const aberturaInicio = actions.indexOf("export async function abrirRegistroEmergencia");
    const aberturaFim = actions.indexOf("export async function atualizarRegistroEmergencia");
    const abertura = actions.slice(aberturaInicio, aberturaFim);

    expect(configPage).toContain("não preenche, sugere nem grava automaticamente");
    expect(configPage).toContain('name="sla_minutos"');
    expect(configPage).toContain("Não configurado");
    expect(configPage).not.toMatch(/defaultValue=\{?(10|60|120|240)\}?/);
    expect(abertura).not.toContain("aplicar_sla_institucional_emergencia_operacional");
  });

  it("exige ação explícita para copiar a política vigente para o atendimento", () => {
    const page = source("src/app/(painel)/assistencial/urgencia/sla/page.tsx");
    expect(page).toContain("Aplicar SLA institucional");
    expect(page).toContain("action={aplicarSlaInstitucionalEmergencia}");
    expect(page).toContain("Mudanças futuras da política não reescrevem atendimentos anteriores");
    expect(page).toContain("SLA deste atendimento (min)");
  });

  it("preserva vigências, trilha de aplicação e bloqueia DML direto", () => {
    const migration = source("supabase/migrations/20260830230050_urgencia_parametrizacao_sla_institucional.sql");
    expect(migration).toContain("emergencia_sla_configuracoes_ativa_uk");
    expect(migration).toContain("emergencia_sla_aplicacoes");
    expect(migration).toContain("vigente_ate = now()");
    expect(migration).toContain("revoke all on public.emergencia_sla_configuracoes from public, anon, authenticated");
    expect(migration).toContain("grant select on public.emergencia_sla_configuracoes to authenticated");
    expect(migration).toContain("revoke all on public.emergencia_sla_aplicacoes from public, anon, authenticated");
    expect(migration).toContain("public.tem_permissao(p_empresa_id, p_unidade_id, 'emergencia.gerenciar')");
    expect(migration).not.toMatch(/values\s*\(\s*'vermelho'\s*,\s*(10|60|120|240)/i);
  });
});
