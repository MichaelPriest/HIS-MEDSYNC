import type { KnowledgeBaseArticle } from "@/modules/knowledge-base/articles";

export const admissionReadinessKnowledgeBaseArticles: KnowledgeBaseArticle[] = [
  {
    slug: "admissao-prontidao-operacional",
    title: "Abrir atendimento sem pendências para o faturamento",
    category: "Atendimento",
    audience: ["Recepção", "Admissão", "Faturamento", "Auditoria"],
    summary: "Como usar a conferência preventiva da admissão para corrigir dados do paciente, cobertura, profissional e atendimento antes da abertura.",
    steps: [
      "Inicie a admissão pela senha do Totem ou pelo check-in da Agenda e confirme o paciente correto.",
      "Revise identificação, telefone e endereço. A conferência preventiva mostra imediatamente o que ainda impede a abertura.",
      "Em atendimento por convênio, selecione operadora, plano e carteirinha e informe validade quando o plano exigir.",
      "Selecione o profissional responsável e confira se o cadastro profissional está completo.",
      "Defina onde o paciente será atendido, a finalidade do atendimento e o procedimento principal quando necessário.",
      "Quando a operadora exigir token ou biometria, informe o método e a referência no campo próprio. A conferência preventiva verifica somente se a informação foi fornecida; o conteúdo bruto não é enviado para essa checagem.",
      "Corrija todas as pendências em vermelho. Alertas em amarelo permitem revisão do fluxo sem esconder informações importantes.",
      "Quando o cartão indicar Pronto para abrir o atendimento, conclua a admissão. O número gerado será usado também como Número da guia do prestador.",
    ],
    warnings: [
      "A conferência preventiva é somente leitura e não cria atendimento, autorização ou conta.",
      "A transação final continua validando todas as regras. Se a conferência preventiva estiver temporariamente indisponível, nenhuma validação obrigatória é desativada.",
      "Token ou referência biométrica não são enviados em texto puro para a conferência preventiva. No registro final, a evidência é armazenada pela rotina segura já existente.",
      "Não altere dados apenas para eliminar um alerta. Corrija o cadastro de origem quando a pendência pertencer à unidade, operadora, plano ou profissional.",
    ],
    links: [
      { label: "Atendimentos", href: "/atendimentos" },
      { label: "Relação de contas", href: "/faturamento/contas" },
      { label: "Base de Conhecimento", href: "/manual" },
    ],
    keywords: ["admissão", "recepção", "atendimento", "guia", "carteirinha", "convênio", "profissional", "procedimento", "token", "biometria", "faturamento", "pendência"],
    sourceDocs: ["docs/ADMISSAO_PRONTIDAO_OPERACIONAL.md"],
  },
];
