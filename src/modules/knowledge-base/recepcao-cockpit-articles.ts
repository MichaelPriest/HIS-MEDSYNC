import type { KnowledgeBaseArticle } from "@/modules/knowledge-base/articles";

export const receptionCockpitKnowledgeBaseArticles: KnowledgeBaseArticle[] = [
  {
    slug: "recepcao-cockpit-operacional",
    title: "Acompanhar chegadas e admissões no Cockpit da Recepção",
    category: "Atendimento",
    audience: ["Recepção", "Admissão", "Supervisão"],
    summary: "Como acompanhar Totem, check-ins da Agenda, admissões pendentes e atendimentos ativos em uma única visão sem criar atendimento fora do fluxo correto.",
    steps: [
      "Abra Recepção e senhas e acesse o Cockpit da Recepção.",
      "Acompanhe Aguardando no Totem para identificar a demanda espontânea que ainda precisa ser chamada no guichê.",
      "Use a Fila de senhas para chamar o paciente e iniciar a admissão. O cockpit não pula essa etapa.",
      "Para pacientes agendados, faça o check-in na Agenda. Somente check-ins válidos aparecem como prontos para abertura.",
      "Na lista Próximos passos da Recepção, use Continuar admissão para uma senha já iniciada ou Abrir atendimento para um check-in da Agenda.",
      "Corrija eventuais pendências mostradas pela conferência preventiva da admissão antes de concluir a abertura.",
      "Use Atendimentos ativos para confirmar que o episódio foi criado e seguir para o prontuário integrado.",
    ],
    warnings: [
      "Não existe abertura genérica de atendimento no cockpit: toda admissão precisa continuar vinculada a uma senha do Totem ou a um check-in da Agenda.",
      "Cirurgia eletiva continua seguindo o fluxo de pré-admissão e Centro Cirúrgico e não é aberta pelo atalho de check-in deste cockpit.",
      "A atualização em tempo real é uma visão de leitura e não substitui as validações transacionais da admissão.",
    ],
    links: [
      { label: "Cockpit da Recepção", href: "/senhas/cockpit" },
      { label: "Fila de senhas", href: "/senhas" },
      { label: "Agenda", href: "/agenda" },
      { label: "Atendimentos", href: "/atendimentos" },
    ],
    keywords: ["recepção", "cockpit", "totem", "senha", "fila", "agenda", "check-in", "admissão", "atendimento", "guichê"],
    sourceDocs: ["docs/RECEPCAO_COCKPIT_OPERACIONAL.md"],
  },
];
