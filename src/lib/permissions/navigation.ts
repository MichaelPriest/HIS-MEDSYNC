export const navigationRequirements: Record<string, readonly string[]> = {
  "/agenda": ["agenda.visualizar"],
  "/senhas": ["recepcao.visualizar", "senhas.visualizar"],
  "/atendimentos": ["atendimentos.visualizar"],
  "/central-guias": ["guias.visualizar", "autorizacoes.visualizar"],
  "/autorizacoes": ["autorizacoes.visualizar", "guias.visualizar"],
  "/triagem": ["triagem.visualizar", "triagem.registrar"],
  "/fila-medica": ["fila_medica.visualizar"],
  "/prontuario": ["prontuario.visualizar"],
  "/prescricao": ["prescricao.visualizar", "prescricao.criar"],

  "/assistencial/sae": ["sae.visualizar", "enfermagem.visualizar"],
  "/assistencial/medicamentos": ["farmacia.visualizar", "prescricao.visualizar", "medicamentos.administrar"],
  "/assistencial/laboratorio/laudos": ["laboratorio.visualizar", "exames.visualizar", "prontuario.visualizar"],
  "/assistencial/laboratorio": ["laboratorio.visualizar", "exames.visualizar"],
  "/assistencial/imagem/laudos": ["imagem.visualizar", "exames.visualizar", "prontuario.visualizar"],
  "/assistencial/imagem": ["imagem.visualizar", "exames.visualizar"],
  "/assistencial/internacao": ["internacao.visualizar"],
  "/assistencial/urgencia": ["emergencia.visualizar", "emergencia.gerenciar", "emergencia.reavaliar"],
  "/assistencial/centro-cirurgico": ["centro_cirurgico.visualizar", "centro_cirurgico.gerenciar", "centro_cirurgico.operar", "cme.visualizar", "cme.gerenciar"],
  "/assistencial/nutricao": ["nutricao.visualizar", "nutricao.operar", "nutricao.registrar"],
  "/assistencial/hemoterapia": ["hemoterapia.visualizar", "hemoterapia.gerenciar", "hemoterapia.operar"],
  "/assistencial/ccih": ["ccih.visualizar", "ccih.gerenciar", "ccih.operar"],
  "/assistencial/antimicrobianos": ["antimicrobianos.visualizar", "antimicrobianos.gerenciar", "ccih.visualizar", "farmacia.visualizar"],
  "/assistencial/uti": ["uti.visualizar", "uti.gerenciar", "uti.operar"],
  "/assistencial/multiprofissional": ["multiprofissional.visualizar", "multiprofissional.registrar"],
  "/assistencial/procedimentos": ["procedimentos_assistenciais.visualizar", "procedimentos_assistenciais.registrar", "assistencial.visualizar"],
  "/assistencial/transportes": ["transportes.visualizar", "transportes.gerenciar"],
  "/assistencial/alta": ["alta.planejar", "alta.sumario", "internacao.visualizar"],
  "/assistencial/seguranca-paciente": ["seguranca_paciente.visualizar", "seguranca_paciente.notificar", "seguranca_paciente.gerenciar"],
  "/assistencial/obstetricia": ["obstetricia.visualizar", "obstetricia.gerenciar"],
  "/assistencial/neonatal": ["neonatal.visualizar", "neonatal.gerenciar"],
  "/assistencial/obitos": ["obitos.visualizar", "obitos.registrar"],
  "/assistencial/dialise": ["dialise.visualizar", "dialise.gerenciar"],
  "/assistencial/oncologia": ["oncologia.visualizar", "oncologia.gerenciar"],
  "/assistencial/radioterapia": ["radioterapia.visualizar", "radioterapia.gerenciar"],
  "/assistencial/hemodinamica": ["hemodinamica.visualizar", "hemodinamica.gerenciar"],
  "/assistencial/endoscopia": ["endoscopia.visualizar", "endoscopia.gerenciar"],
  "/assistencial/anatomia-patologica": ["anatomia_patologica.visualizar", "anatomia_patologica.gerenciar"],
  "/assistencial/transplantes": ["transplantes.visualizar", "transplantes.gerenciar"],
  "/assistencial/home-care": ["homecare.visualizar", "homecare.gerenciar"],
  "/assistencial/paliativos": ["paliativos.visualizar", "paliativos.gerenciar"],
  "/assistencial/imunizacao": ["imunizacao.visualizar", "imunizacao.gerenciar"],
  "/assistencial/enfermagem": ["enfermagem.visualizar"],
  "/assistencial": ["assistencial.visualizar", "prontuario.visualizar"],

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
  "/comercial/tabelas/xml": ["referencias.importar"],
  "/comercial/procedimentos": ["comercial.visualizar", "tabelas_procedimentos.visualizar"],
  "/comercial/regras": ["comercial.visualizar", "credenciamento.visualizar"],
  "/comercial/tabelas": ["comercial.visualizar", "tabelas_comerciais.visualizar", "referencias.visualizar"],
  "/comercial": ["comercial.visualizar", "credenciamento.visualizar"],
  "/relatorios": ["diretoria.visualizar", "faturamento.visualizar", "financeiro.visualizar"],
  "/diretoria": ["diretoria.visualizar"],
  "/integracoes": ["integracao.visualizar"],
  "/ged": ["ged.visualizar", "ged.enviar", "ged.gerenciar", "ged.administrar"],
  "/rh": ["rh.visualizar", "rh.gerenciar", "rh.escalas", "rh.treinamentos", "rh.documentos"],
  "/seguranca": ["seguranca.visualizar", "seguranca.portaria", "seguranca.gerenciar", "visitantes.visualizar", "visitantes.registrar", "visitantes.gerenciar"],
  "/compras": ["compras.visualizar"],
  "/almoxarifado": ["estoque.visualizar", "almoxarifado.requisitar", "almoxarifado.atender"],
  "/ti": ["ti.visualizar", "ti.chamados.abrir", "ti.admin"],
  "/engenharia-clinica": ["engenharia_clinica.visualizar", "engenharia_clinica.solicitar", "engenharia_clinica.gerenciar"],
  "/auditoria": ["auditoria.visualizar"],
  "/contas-medicas": ["contas_medicas.visualizar"],
  "/faturamento/producao": ["producao.visualizar"],
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
