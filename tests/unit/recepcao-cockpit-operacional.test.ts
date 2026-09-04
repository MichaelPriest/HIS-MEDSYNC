import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("cockpit operacional da recepção", () => {
  it("consolida Totem, Agenda e atendimentos sem criar uma terceira origem de admissão", () => {
    const page = read("src/app/(painel)/senhas/cockpit/page.tsx");
    expect(page).toContain('from("senhas_atendimento")');
    expect(page).toContain('from("agendamentos")');
    expect(page).toContain('from("atendimentos")');
    expect(page).toContain("/atendimentos/novo?senha=");
    expect(page).toContain("/atendimentos/novo?agendamento=");
    expect(page).not.toContain('href="/atendimentos/novo"');
    expect(page).not.toContain('primaryActionHref="/atendimentos/novo"');
  });

  it("mantém a fila como etapa obrigatória da demanda espontânea", () => {
    const page = read("src/app/(painel)/senhas/cockpit/page.tsx");
    expect(page).toContain('item.status === "em_atendimento"');
    expect(page).toContain('actionLabel: item.status === "em_atendimento" ? "Continuar admissão" : "Abrir fila de senhas"');
    expect(page).toContain('href: item.status === "em_atendimento"');
    expect(page).toContain(': "/senhas"');
  });

  it("exige check-in da Agenda e exclui cirurgia eletiva do atalho", () => {
    const page = read("src/app/(painel)/senhas/cockpit/page.tsx");
    expect(page).toContain('.eq("status", "checkin")');
    expect(page).toContain('.eq("cirurgia_eletiva", false)');
    expect(page).toContain('agendasComAtendimento.has(item.id)');
  });

  it("atualiza o cockpit por mudanças das três fontes operacionais", () => {
    const refresh = read("src/components/recepcao/reception-cockpit-refresh.tsx");
    expect(refresh).toContain('"senhas_atendimento", "agendamentos", "atendimentos"');
    expect(refresh).toContain('filter: `unidade_id=eq.${unidadeId}`');
    expect(refresh).toContain("router.refresh()");
    expect(refresh).toContain("visibilitychange");
  });

  it("expõe o cockpit a partir da fila de senhas já protegida por permissão", () => {
    const queueRefresh = read("src/components/senhas/queue-auto-refresh.tsx");
    const permissions = read("src/lib/permissions/navigation.ts");
    expect(queueRefresh).toContain('href="/senhas/cockpit"');
    expect(queueRefresh).toContain("Cockpit");
    expect(permissions).toContain('"/senhas": ["recepcao.visualizar", "senhas.visualizar"]');
  });

  it("documenta o fluxo na Base de Conhecimento", () => {
    const manual = read("src/app/(painel)/manual/page.tsx");
    const article = read("src/modules/knowledge-base/recepcao-cockpit-articles.ts");
    const docs = read("docs/RECEPCAO_COCKPIT_OPERACIONAL.md");
    expect(manual).toContain("receptionCockpitKnowledgeBaseArticles");
    expect(article).toContain("Acompanhar chegadas e admissões no Cockpit da Recepção");
    expect(docs).toContain("não oferece um botão genérico");
    expect(docs).toContain("não existe admissão direta sem origem válida");
  });
});
