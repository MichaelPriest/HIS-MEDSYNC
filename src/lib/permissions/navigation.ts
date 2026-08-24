import type { Permission } from "./catalog";

export const navigationRequirements: Record<string, readonly Permission[]> = {
  "/agenda": ["agenda.visualizar"],
  "/senhas": ["recepcao.visualizar", "senhas.visualizar"],
  "/atendimentos": ["atendimentos.visualizar"],
  "/central-guias": ["guias.visualizar", "autorizacoes.visualizar"],
  "/autorizacoes": ["autorizacoes.visualizar", "guias.visualizar"],
  "/triagem": ["triagem.visualizar", "triagem.registrar"],
  "/fila-medica": ["fila_medica.visualizar"],
  "/prontuario": ["prontuario.visualizar"],
  "/assistencial/urgencia": ["emergencia.visualizar", "emergencia.gerenciar", "emergencia.reavaliar"],
  "/assistencial": ["assistencial.visualizar", "prontuario.visualizar"],
  "/prescricao": ["prescricao.visualizar", "prescricao.criar"],
  "/internacao/nir": ["internacao.visualizar", "internacao.gerenciar", "internacao.movimentar"],
  "/internacao": ["internacao.visualizar"],
  "/setores/enfermagem": ["enfermagem.visualizar"],
  "/setores/farmacia": ["farmacia.visualizar"],
  "/setores/laboratorio": ["laboratorio.visualizar", "exames.visualizar"],
  "/setores/imagem": ["imagem.visualizar", "exames.visualizar"],
  "/setores/internacao": ["internacao.visualizar"],
  "/pacientes": ["pacientes.visualizar"],
  "/profissionais": ["profissionais.visualizar"],
  "/convenios": ["convenios.visualizar"],
  "/catalogos": ["catalogos.visualizar"],
  "/comercial/procedimentos": ["comercial.visualizar", "tabelas_procedimentos.visualizar"],
  "/comercial/regras": ["comercial.visualizar", "credenciamento.visualizar"],
  "/comercial/tabelas": ["comercial.visualizar", "tabelas_comerciais.visualizar"],
  "/comercial": ["comercial.visualizar", "credenciamento.visualizar"],
  "/diretoria": ["diretoria.visualizar"],
  "/ged": ["ged.visualizar"],
  "/compras": ["compras.visualizar"],
  "/almoxarifado": ["estoque.visualizar"],
  "/auditoria": ["auditoria.visualizar"],
  "/contas-medicas": ["contas_medicas.visualizar"],
  "/faturamento/lotes": ["tiss.visualizar", "faturamento.visualizar"],
  "/faturamento/glosas": ["glosas.visualizar", "faturamento.visualizar"],
  "/faturamento": ["faturamento.visualizar"],
  "/financeiro/notas-fiscais": ["nfse.visualizar", "financeiro.visualizar"],
  "/financeiro": ["financeiro.visualizar"],
  "/configuracoes/acessos": ["usuarios.administrar"],
  "/configuracoes/paineis": ["configuracoes.visualizar", "paineis.visualizar", "paineis.configurar"],
  "/configuracoes/tiss-webservices": ["configuracoes.visualizar", "tiss.visualizar", "faturamento.visualizar"],
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
