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
  "/assistencial/enfermagem": ["enfermagem.visualizar"],
  "/assistencial/urgencia": ["emergencia.visualizar", "emergencia.gerenciar", "emergencia.reavaliar"],
  "/assistencial": ["assistencial.visualizar", "prontuario.visualizar"],
  "/prescricao": ["prescricao.visualizar", "prescricao.criar"],
  "/internacao/altas": ["internacao.visualizar", "internacao.gerenciar"],
  "/internacao/leitos": ["internacao.visualizar", "leitos.gerenciar"],
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
  "/relatorios": ["diretoria.visualizar", "faturamento.visualizar", "financeiro.visualizar"],
  "/diretoria": ["diretoria.visualizar"],
  "/ged": ["ged.visualizar"],
  "/compras": ["compras.visualizar"],
  "/almoxarifado": ["estoque.visualizar"],
  "/ti": ["ti.visualizar", "ti.chamados.abrir", "ti.admin"],
  "/engenharia-clinica": ["engenharia_clinica.visualizar", "engenharia_clinica.solicitar", "engenharia_clinica.gerenciar"],
  "/auditoria": ["auditoria.visualizar"],
  "/contas-medicas": ["contas_medicas.visualizar"],
  "/faturamento/lotes": ["tiss.visualizar", "faturamento.visualizar"],
  "/faturamento/glosas": ["glosas.visualizar", "faturamento.visualizar"],
  "/faturamento": ["faturamento.visualizar"],
  "/financeiro/notas-fiscais": ["nfse.visualizar", "financeiro.visualizar"],
  "/financeiro": ["financeiro.visualizar"],
  "/configuracoes/acessos": ["usuarios.administrar"],
  "/configuracoes/estrutura/leitos": ["leitos.gerenciar"],
  "/configuracoes/estrutura": ["estrutura.visualizar", "configuracoes.visualizar"],
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

export function canAccessNavigation(granted: readonly string[] | null, pathname: string) {
  const required = requirementForPath(pathname);
  if (!required?.length) return true;
  if (granted === null) return true;
  return required.some((permission) => granted.includes(permission));
}
