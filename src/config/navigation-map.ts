export type ProfileAccessLevel = "operacional" | "supervisao" | "gestao" | "administrador";

export type ProfileNavigationMeta = {
  id: string;
  nome: string;
  setorChave: string | null;
  nivelAcesso: ProfileAccessLevel;
  paginaInicial: string | null;
};

export type NavigationIconKey =
  | "activity"
  | "bed"
  | "book"
  | "boxes"
  | "building"
  | "cable"
  | "calendar"
  | "clipboard-check"
  | "clipboard-list"
  | "droplets"
  | "file"
  | "flask"
  | "folder"
  | "handshake"
  | "heart"
  | "hospital"
  | "landmark"
  | "layout"
  | "monitor"
  | "pill"
  | "receipt"
  | "scan"
  | "scissors"
  | "settings"
  | "shield-alert"
  | "shield-check"
  | "shopping-cart"
  | "siren"
  | "stethoscope"
  | "syringe"
  | "ticket"
  | "truck"
  | "user-cog"
  | "users"
  | "wallet"
  | "wind";

export type NavigationItemConfig = {
  href: string;
  label: string;
  icon: NavigationIconKey;
};

export type NavigationAreaConfig = {
  key: string;
  label: string;
  shortLabel: string;
  icon: NavigationIconKey;
  items: readonly NavigationItemConfig[];
};

export const inicioItem: NavigationItemConfig = {
  href: "/painel",
  label: "Visão geral",
  icon: "layout",
};

export const navigationAreas: readonly NavigationAreaConfig[] = [
  {
    key: "atendimento-recepcao",
    label: "Atendimento e Recepção",
    shortLabel: "Atendimento",
    icon: "heart",
    items: [
      { href: "/agenda", label: "Agenda", icon: "calendar" },
      { href: "/senhas", label: "Recepção e senhas", icon: "ticket" },
      { href: "/atendimentos", label: "Atendimentos / ADT", icon: "clipboard-list" },
      { href: "/triagem", label: "Triagem", icon: "heart" },
    ],
  },
  {
    key: "medico-prontuario",
    label: "Médico e Prontuário",
    shortLabel: "Médico",
    icon: "stethoscope",
    items: [
      { href: "/fila-medica", label: "Fila médica", icon: "stethoscope" },
      { href: "/prontuario", label: "Prontuário longitudinal", icon: "clipboard-check" },
      { href: "/prescricao", label: "Prescrição", icon: "pill" },
      { href: "/assistencial/urgencia", label: "Urgência / Emergência", icon: "siren" },
      { href: "/assistencial", label: "Mapa assistencial", icon: "activity" },
    ],
  },
  {
    key: "enfermagem-internacao",
    label: "Enfermagem e Internação",
    shortLabel: "Enfermagem / Internação",
    icon: "bed",
    items: [
      { href: "/setores/enfermagem", label: "Fila da Enfermagem", icon: "activity" },
      { href: "/assistencial/sae", label: "SAE de Enfermagem", icon: "activity" },
      { href: "/assistencial/medicamentos", label: "Administração de medicamentos", icon: "pill" },
      { href: "/internacao", label: "Painel da internação", icon: "bed" },
      { href: "/internacao/leitos", label: "Mapa de leitos", icon: "bed" },
      { href: "/internacao/nir", label: "NIR / Gestão de leitos", icon: "hospital" },
      { href: "/internacao/altas", label: "Central de altas", icon: "clipboard-check" },
      { href: "/setores/internacao", label: "Fila da internação", icon: "bed" },
      { href: "/assistencial/uti", label: "UTI", icon: "wind" },
    ],
  },
  {
    key: "farmacia-diagnostico-terapias",
    label: "Farmácia, Diagnóstico e Terapias",
    shortLabel: "Diagnóstico / Terapias",
    icon: "flask",
    items: [
      { href: "/setores/farmacia", label: "Fila da Farmácia", icon: "pill" },
      { href: "/setores/laboratorio", label: "Fila do Laboratório", icon: "flask" },
      { href: "/assistencial/laboratorio", label: "Laboratório Clínico", icon: "flask" },
      { href: "/assistencial/laboratorio/laudos", label: "Laudos laboratoriais", icon: "file" },
      { href: "/setores/imagem", label: "Fila de Diagnóstico por Imagem", icon: "scan" },
      { href: "/assistencial/imagem", label: "Diagnóstico por Imagem", icon: "scan" },
      { href: "/assistencial/imagem/laudos", label: "Laudos de imagem", icon: "file" },
      { href: "/assistencial/nutricao", label: "Nutrição", icon: "activity" },
      { href: "/assistencial/hemoterapia", label: "Hemoterapia", icon: "droplets" },
      { href: "/assistencial/multiprofissional", label: "Equipe Multiprofissional", icon: "stethoscope" },
      { href: "/assistencial/procedimentos", label: "Procedimentos assistenciais", icon: "clipboard-check" },
      { href: "/assistencial/dialise", label: "Hemodiálise", icon: "droplets" },
    ],
  },
  {
    key: "cirurgico-especialidades",
    label: "Bloco Cirúrgico e Especialidades",
    shortLabel: "Especialidades",
    icon: "scissors",
    items: [
      { href: "/assistencial/centro-cirurgico", label: "Centro Cirúrgico / CME", icon: "scissors" },
      { href: "/assistencial/obstetricia", label: "Obstetrícia", icon: "heart" },
      { href: "/assistencial/neonatal", label: "Neonatal", icon: "heart" },
      { href: "/assistencial/oncologia", label: "Oncologia", icon: "stethoscope" },
      { href: "/assistencial/radioterapia", label: "Radioterapia", icon: "scan" },
      { href: "/assistencial/hemodinamica", label: "Hemodinâmica", icon: "heart" },
      { href: "/assistencial/endoscopia", label: "Endoscopia", icon: "activity" },
      { href: "/assistencial/anatomia-patologica", label: "Anatomia Patológica", icon: "flask" },
      { href: "/assistencial/transplantes", label: "Transplantes", icon: "shield-check" },
      { href: "/assistencial/home-care", label: "Home Care", icon: "truck" },
      { href: "/assistencial/paliativos", label: "Cuidados Paliativos", icon: "shield-check" },
      { href: "/assistencial/imunizacao", label: "Imunização", icon: "syringe" },
    ],
  },
  {
    key: "qualidade-seguranca",
    label: "Qualidade e Segurança Assistencial",
    shortLabel: "Qualidade",
    icon: "shield-alert",
    items: [
      { href: "/assistencial/ccih", label: "CCIH", icon: "shield-alert" },
      { href: "/assistencial/antimicrobianos", label: "Antimicrobianos", icon: "syringe" },
      { href: "/assistencial/seguranca-paciente", label: "Segurança do Paciente", icon: "shield-alert" },
      { href: "/assistencial/transportes", label: "Transportes", icon: "truck" },
      { href: "/assistencial/alta", label: "Transição / Alta", icon: "clipboard-check" },
      { href: "/assistencial/obitos", label: "Óbitos", icon: "shield-check" },
      { href: "/seguranca", label: "Segurança / Portaria", icon: "shield-check" },
    ],
  },
  {
    key: "faturamento-receita",
    label: "Faturamento e Receita",
    shortLabel: "Receita",
    icon: "wallet",
    items: [
      { href: "/central-guias", label: "Central de Guias", icon: "clipboard-check" },
      { href: "/autorizacoes", label: "Autorizações", icon: "shield-check" },
      { href: "/auditoria", label: "Auditoria", icon: "shield-check" },
      { href: "/contas-medicas", label: "Contas médicas", icon: "clipboard-check" },
      { href: "/faturamento/producao", label: "Livro de produção", icon: "clipboard-list" },
      { href: "/faturamento", label: "Pré-faturamento", icon: "receipt" },
      { href: "/faturamento/lotes", label: "Lotes TISS", icon: "receipt" },
      { href: "/faturamento/glosas", label: "Glosas e recursos", icon: "receipt" },
      { href: "/financeiro", label: "Financeiro / Recebimentos", icon: "wallet" },
      { href: "/financeiro/notas-fiscais", label: "Notas fiscais", icon: "file" },
    ],
  },
  {
    key: "cadastros-comercial",
    label: "Cadastros e Comercial",
    shortLabel: "Cadastros",
    icon: "folder",
    items: [
      { href: "/pacientes", label: "Pacientes", icon: "users" },
      { href: "/profissionais", label: "Profissionais", icon: "stethoscope" },
      { href: "/convenios", label: "Convênios", icon: "building" },
      { href: "/catalogos", label: "Catálogos", icon: "book" },
      { href: "/comercial", label: "Credenciamento", icon: "handshake" },
      { href: "/comercial/procedimentos", label: "Procedimentos", icon: "clipboard-list" },
      { href: "/comercial/regras", label: "Regras contratuais", icon: "shield-check" },
      { href: "/comercial/tabelas", label: "Tabelas comerciais", icon: "receipt" },
    ],
  },
  {
    key: "suprimentos-apoio",
    label: "Suprimentos e Apoio",
    shortLabel: "Apoio",
    icon: "boxes",
    items: [
      { href: "/compras", label: "Compras", icon: "shopping-cart" },
      { href: "/almoxarifado", label: "Almoxarifado / Estoque", icon: "boxes" },
      { href: "/engenharia-clinica", label: "Engenharia Clínica", icon: "activity" },
      { href: "/ti", label: "Tecnologia / TI", icon: "monitor" },
      { href: "/rh", label: "Recursos Humanos", icon: "users" },
      { href: "/ged", label: "GED", icon: "file" },
    ],
  },
  {
    key: "gestao-configuracoes",
    label: "Gestão e Configurações",
    shortLabel: "Gestão",
    icon: "settings",
    items: [
      { href: "/diretoria", label: "Diretoria / Indicadores", icon: "layout" },
      { href: "/integracoes", label: "Pendências intersetoriais", icon: "cable" },
      { href: "/configuracoes/acessos", label: "Usuários e acessos", icon: "user-cog" },
      { href: "/configuracoes/estrutura", label: "Estrutura hospitalar", icon: "building" },
      { href: "/configuracoes/paineis", label: "Painéis e chamadas", icon: "monitor" },
      { href: "/configuracoes/tiss-webservices", label: "Webservices TISS", icon: "cable" },
      { href: "/configuracoes/nfse", label: "Prefeituras / NFS-e", icon: "landmark" },
    ],
  },
] as const;

export const allNavigationItems = navigationAreas.flatMap((area) => area.items);

const personalPathsBySector: Record<string, readonly string[]> = {
  recepcao: ["/senhas", "/atendimentos", "/agenda", "/pacientes", "/central-guias", "/autorizacoes"],
  medico: ["/fila-medica", "/prontuario", "/prescricao", "/assistencial/urgencia", "/assistencial"],
  enfermagem: ["/setores/enfermagem", "/assistencial/sae", "/assistencial/medicamentos", "/integracoes", "/internacao", "/prontuario"],
  farmacia: ["/setores/farmacia", "/assistencial/medicamentos", "/integracoes", "/almoxarifado", "/ged"],
  laboratorio: ["/setores/laboratorio", "/assistencial/laboratorio", "/assistencial/laboratorio/laudos", "/ged"],
  imagem: ["/setores/imagem", "/assistencial/imagem", "/assistencial/imagem/laudos", "/ged"],
  faturamento: ["/faturamento", "/faturamento/producao", "/integracoes", "/faturamento/lotes", "/faturamento/glosas", "/contas-medicas", "/central-guias"],
  financeiro: ["/financeiro", "/financeiro/notas-fiscais", "/faturamento", "/ged"],
  auditoria: ["/auditoria", "/integracoes", "/contas-medicas", "/faturamento", "/ged"],
  suprimentos: ["/compras", "/almoxarifado", "/ged"],
  comercial: ["/comercial", "/comercial/procedimentos", "/comercial/regras", "/comercial/tabelas", "/convenios"],
  engenharia_clinica: ["/engenharia-clinica", "/ged"],
  rh: ["/rh", "/ged"],
  seguranca: ["/seguranca"],
  ti: ["/ti", "/integracoes", "/configuracoes/acessos", "/configuracoes/estrutura"],
  centro_cirurgico: ["/assistencial/centro-cirurgico", "/prontuario"],
  cme: ["/assistencial/centro-cirurgico"],
  nutricao: ["/assistencial/nutricao", "/prontuario"],
  ccih: ["/assistencial/ccih", "/assistencial/antimicrobianos", "/assistencial/seguranca-paciente"],
  anatomia_patologica: ["/assistencial/anatomia-patologica", "/prontuario", "/ged"],
  dialise: ["/assistencial/dialise", "/prontuario"],
  hemoterapia: ["/assistencial/hemoterapia", "/prontuario"],
  hemodinamica: ["/assistencial/hemodinamica", "/prontuario"],
  endoscopia: ["/assistencial/endoscopia", "/prontuario"],
  oncologia: ["/assistencial/oncologia", "/prontuario"],
  radioterapia: ["/assistencial/radioterapia", "/prontuario"],
  transplantes: ["/assistencial/transplantes", "/prontuario"],
  paliativos: ["/assistencial/paliativos", "/prontuario"],
  homecare: ["/assistencial/home-care", "/prontuario"],
  multiprofissional: ["/assistencial/multiprofissional", "/prontuario"],
};

const areaKeysBySector: Record<string, readonly string[]> = {
  recepcao: ["atendimento-recepcao", "cadastros-comercial", "faturamento-receita"],
  medico: ["medico-prontuario", "enfermagem-internacao", "farmacia-diagnostico-terapias", "cirurgico-especialidades", "qualidade-seguranca"],
  enfermagem: ["enfermagem-internacao", "medico-prontuario", "farmacia-diagnostico-terapias", "qualidade-seguranca"],
  farmacia: ["farmacia-diagnostico-terapias", "enfermagem-internacao", "suprimentos-apoio", "qualidade-seguranca"],
  laboratorio: ["farmacia-diagnostico-terapias", "medico-prontuario", "suprimentos-apoio"],
  imagem: ["farmacia-diagnostico-terapias", "medico-prontuario", "suprimentos-apoio"],
  faturamento: ["faturamento-receita", "cadastros-comercial", "gestao-configuracoes"],
  financeiro: ["faturamento-receita", "gestao-configuracoes", "suprimentos-apoio"],
  auditoria: ["faturamento-receita", "qualidade-seguranca", "gestao-configuracoes"],
  suprimentos: ["suprimentos-apoio", "cadastros-comercial", "gestao-configuracoes"],
  comercial: ["cadastros-comercial", "faturamento-receita", "gestao-configuracoes"],
  engenharia_clinica: ["suprimentos-apoio", "gestao-configuracoes"],
  rh: ["suprimentos-apoio", "gestao-configuracoes"],
  seguranca: ["qualidade-seguranca", "suprimentos-apoio"],
  ti: ["suprimentos-apoio", "gestao-configuracoes"],
  centro_cirurgico: ["cirurgico-especialidades", "medico-prontuario", "enfermagem-internacao", "farmacia-diagnostico-terapias"],
  cme: ["cirurgico-especialidades", "suprimentos-apoio"],
  nutricao: ["farmacia-diagnostico-terapias", "medico-prontuario", "enfermagem-internacao"],
  ccih: ["qualidade-seguranca", "farmacia-diagnostico-terapias", "enfermagem-internacao"],
  anatomia_patologica: ["cirurgico-especialidades", "farmacia-diagnostico-terapias", "medico-prontuario"],
  dialise: ["farmacia-diagnostico-terapias", "medico-prontuario", "enfermagem-internacao"],
  hemoterapia: ["farmacia-diagnostico-terapias", "medico-prontuario", "enfermagem-internacao"],
  hemodinamica: ["cirurgico-especialidades", "medico-prontuario", "farmacia-diagnostico-terapias"],
  endoscopia: ["cirurgico-especialidades", "medico-prontuario", "farmacia-diagnostico-terapias"],
  oncologia: ["cirurgico-especialidades", "medico-prontuario", "farmacia-diagnostico-terapias"],
  radioterapia: ["cirurgico-especialidades", "medico-prontuario", "farmacia-diagnostico-terapias"],
  transplantes: ["cirurgico-especialidades", "medico-prontuario", "enfermagem-internacao"],
  paliativos: ["cirurgico-especialidades", "medico-prontuario", "enfermagem-internacao"],
  homecare: ["cirurgico-especialidades", "medico-prontuario", "enfermagem-internacao"],
  multiprofissional: ["farmacia-diagnostico-terapias", "medico-prontuario", "enfermagem-internacao"],
};

export function personalNavigationItems(setorChave: string | null) {
  if (!setorChave) return [];
  const wanted = new Set(personalPathsBySector[setorChave] ?? []);
  return allNavigationItems.filter((item) => wanted.has(item.href));
}

export function navigationAreaKeysForProfile(profile: ProfileNavigationMeta | null) {
  if (!profile || profile.nivelAcesso === "administrador" || profile.setorChave === "administracao") {
    return navigationAreas.map((area) => area.key);
  }

  const base = [...(areaKeysBySector[profile.setorChave ?? ""] ?? [])];
  if (profile.nivelAcesso === "supervisao" && !base.includes("qualidade-seguranca")) {
    base.push("qualidade-seguranca");
  }
  if (profile.nivelAcesso === "gestao" && !base.includes("gestao-configuracoes")) {
    base.push("gestao-configuracoes");
  }
  return base.length ? base : navigationAreas.map((area) => area.key);
}
