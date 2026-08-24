import type { Permission } from "./catalog";

export const navigationRequirements: Record<string, readonly Permission[]> = {
  "/agenda": ["agenda.visualizar"],
  "/senhas": ["recepcao.visualizar"],
  "/atendimentos": ["atendimentos.visualizar"],
  "/central-guias": ["autorizacoes.visualizar"],
  "/autorizacoes": ["autorizacoes.visualizar"],
  "/triagem": ["triagem.visualizar", "triagem.registrar"],
  "/fila-medica": ["fila_medica.visualizar"],
  "/prontuario": ["prontuario.visualizar"],
  "/assistencial": ["assistencial.visualizar"],
  "/prescricao": ["prescricao.visualizar", "prescricao.criar"],
  "/internacao": ["internacao.visualizar"],
  "/setores/enfermagem": ["enfermagem.visualizar"],
  "/setores/farmacia": ["farmacia.visualizar"],
  "/setores/laboratorio": ["laboratorio.visualizar"],
  "/setores/imagem": ["imagem.visualizar"],
  "/setores/internacao": ["internacao.visualizar"],
  "/pacientes": ["pacientes.visualizar"],
  "/profissionais": ["profissionais.visualizar"],
  "/convenios": ["convenios.visualizar"],
  "/catalogos": ["catalogos.visualizar"],
  "/comercial": ["comercial.visualizar"],
  "/comercial/procedimentos": ["comercial.visualizar"],
  "/comercial/regras": ["comercial.visualizar"],
  "/comercial/tabelas": ["comercial.visualizar"],
  "/diretoria": ["diretoria.visualizar"],
  "/ged": ["ged.visualizar"],
  "/compras": ["compras.visualizar"],
  "/almoxarifado": ["estoque.visualizar"],
  "/auditoria": ["auditoria.visualizar"],
  "/contas-medicas": ["contas_medicas.visualizar"],
  "/faturamento": ["faturamento.visualizar"],
  "/faturamento/lotes": ["tiss.visualizar", "faturamento.visualizar"],
  "/faturamento/glosas": ["glosas.visualizar"],
  "/financeiro": ["financeiro.visualizar"],
  "/financeiro/notas-fiscais": ["nfse.visualizar", "financeiro.visualizar"],
  "/configuracoes/paineis": ["configuracoes.visualizar"],
  "/configuracoes/tiss-webservices": ["configuracoes.visualizar", "tiss.visualizar"],
  "/configuracoes/nfse": ["configuracoes.visualizar", "nfse.visualizar"],
};

export function requirementForPath(pathname: string) {
  const match = Object.keys(navigationRequirements)
    .sort((a, b) => b.length - a.length)
    .find((route) => pathname === route || pathname.startsWith(`${route}/`));

  return match ? navigationRequirements[match] : null;
}

export function canAccessNavigation(
  granted: readonly string[] | null,
  pathname: string,
) {
  const required = requirementForPath(pathname);
  if (!required?.length) return true;

  // null representa falha de carregamento da matriz no shell. O RLS continua
  // sendo a fronteira de autorização; manter o menu evita bloquear a aplicação
  // durante rollout de migration/indisponibilidade transitória.
  if (granted === null) return true;

  return required.some((permission) => granted.includes(permission));
}
