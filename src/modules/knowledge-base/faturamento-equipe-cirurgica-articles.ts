import type { KnowledgeBaseArticle } from "@/modules/knowledge-base/articles";

export const surgicalBillingKnowledgeBaseArticles: KnowledgeBaseArticle[] = [
  {
    slug: "faturamento-equipe-cirurgica-amb-cbhpm",
    title: "Faturar equipe médica de procedimento cirúrgico",
    category: "Receita",
    audience: ["Faturamento", "Auditoria", "Centro Cirúrgico", "Comercial"],
    summary: "Como sincronizar cirurgião, auxiliares, instrumentador e anestesista com a regra AMB/CBHPM, mantendo equipe clínica, cobrança e repasse separados.",
    steps: [
      "Confirme no Centro Cirúrgico que o procedimento e os profissionais participantes foram registrados na equipe clínica correta.",
      "Abra Faturamento / Contas, entre na conta e acesse Cirurgia / SADT.",
      "Na seção Equipe médica e honorários, confira a quantidade de auxiliares e a informação anestésica lidas do item da tabela contratual.",
      "Use Sincronizar equipe e honorários. O HIS cria ou atualiza o snapshot financeiro sem modificar a equipe assistencial.",
      "Confira o cálculo de cada membro: cirurgião principal, auxiliares permitidos pela tabela, instrumentador e anestesista.",
      "Use Cobrar para definir se o honorário participa da conta e Repasse para registrar a decisão financeira de remuneração. As duas decisões são independentes.",
      "Se alterar Cobrar em relação à regra automática, informe uma justificativa. O sistema preserva o ajuste e registra auditoria.",
      "Revise os lançamentos da conta antes de validar ou gerar a Guia TISS.",
    ],
    warnings: [
      "O faturamento não cria profissional nem corrige silenciosamente a equipe clínica. Ausência de equipe deve ser tratada no Centro Cirúrgico.",
      "A quantidade de auxiliares cobrados nunca ultrapassa a quantidade prevista no item da tabela.",
      "Em AMB 90/92, CH de anestesista explícito no item tem prioridade sobre qualquer fallback por porte.",
      "AMB 96/99 não usa valores monetários históricos aproximados embutidos. O contrato precisa definir conversão por CH ou valor de tabela reajustado.",
      "Conta faturada, cancelada ou com Guia TISS ativa não permite alteração dos honorários da equipe.",
    ],
    links: [
      { label: "Relação de contas", href: "/faturamento/contas" },
      { label: "Central de faturamento", href: "/faturamento" },
      { label: "Centro Cirúrgico", href: "/assistencial/centro-cirurgico" },
      { label: "Contratos comerciais", href: "/comercial" },
    ],
    keywords: ["equipe", "cirurgião", "auxiliar", "instrumentador", "anestesista", "AMB", "CBHPM", "CH", "porte", "repasse", "honorário"],
    sourceDocs: ["docs/FATURAMENTO_EQUIPE_CIRURGICA_AMB_CBHPM.md", "docs/FATURAMENTO_UX_OPERACIONAL_V2.md"],
  },
];
