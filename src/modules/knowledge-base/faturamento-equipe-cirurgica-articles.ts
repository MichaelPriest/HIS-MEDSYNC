import type { KnowledgeBaseArticle } from "@/modules/knowledge-base/articles";

export const surgicalBillingKnowledgeBaseArticles: KnowledgeBaseArticle[] = [
  {
    slug: "faturamento-equipe-cirurgica-amb-cbhpm",
    title: "Faturar equipe médica de procedimento cirúrgico",
    category: "Receita",
    audience: ["Faturamento", "Auditoria", "Centro Cirúrgico", "Comercial"],
    summary: "Como usar automaticamente a equipe do Centro Cirúrgico, complementar papéis ausentes e calcular cirurgião, auxiliares, instrumentador e anestesista pelas regras AMB/CBHPM.",
    steps: [
      "Registre no Centro Cirúrgico os procedimentos e a equipe que participou do ato. Esses profissionais são a fonte automática do faturamento.",
      "Abra Faturamento / Contas, entre na conta e acesse Cirurgia / SADT.",
      "Na seção Equipe médica e honorários, confira a quantidade de auxiliares, instrumentador e informação anestésica lidas do item da tabela contratual.",
      "Se a tabela exigir um papel que não foi informado no Centro Cirúrgico, use o bloco Equipe incompleta, selecione o profissional e informe uma justificativa. O complemento é registrado na própria equipe com origem Faturamento e fica pendente de confirmação assistencial.",
      "Use Sincronizar equipe e honorários. O HIS cria ou atualiza o snapshot financeiro e os lançamentos de honorários sem duplicar o procedimento principal.",
      "Confira o cálculo: cirurgião 100%, 1º auxiliar 30%, 2º a 4º auxiliares 20%, instrumentador 10% e anestesista conforme CH/porte e contrato.",
      "Use Cobrar para definir se o honorário participa da conta e Repasse para registrar a decisão financeira de remuneração. As duas decisões são independentes.",
      "Antes de gerar TISS, confira também a Natureza faturável da conta: Pronto Atendimento, Ambulatório, Internação ou SADT.",
      "Na criação do lote TISS selecione a mesma natureza faturável. O sistema bloqueia a mistura de tipos diferentes no mesmo lote.",
    ],
    warnings: [
      "Complementar no faturamento não significa confirmar presença assistencial. O registro fica claramente marcado como origem Faturamento até confirmação pelo Centro Cirúrgico.",
      "A quantidade de auxiliares cobrados nunca ultrapassa a quantidade prevista no item da tabela.",
      "Em AMB 90/92, CH de anestesista explícito no item tem prioridade sobre qualquer fallback por porte.",
      "AMB 96/99 não usa valores monetários históricos aproximados embutidos. O contrato precisa definir conversão por CH ou valor de tabela reajustado.",
      "SADT é usado para exames/laboratório/imagem eletivos fora do Pronto Atendimento e fora da Internação.",
      "Conta faturada, cancelada ou com Guia TISS ativa não permite alteração da equipe nem reclassificação de atendimento.",
    ],
    links: [
      { label: "Relação de contas", href: "/faturamento/contas" },
      { label: "Lotes TISS", href: "/faturamento/lotes" },
      { label: "Central de faturamento", href: "/faturamento" },
      { label: "Centro Cirúrgico", href: "/assistencial/centro-cirurgico" },
      { label: "Procedimentos e equipe do Centro Cirúrgico", href: "/assistencial/centro-cirurgico/procedimentos" },
      { label: "Contratos comerciais", href: "/comercial" },
    ],
    keywords: ["equipe", "cirurgião", "auxiliar", "instrumentador", "anestesista", "AMB", "CBHPM", "CH", "porte", "repasse", "honorário", "pronto atendimento", "ambulatório", "internação", "SADT", "lote TISS"],
    sourceDocs: ["docs/FATURAMENTO_EQUIPE_CIRURGICA_AMB_CBHPM.md", "docs/FATURAMENTO_UX_OPERACIONAL_V2.md"],
  },
];
