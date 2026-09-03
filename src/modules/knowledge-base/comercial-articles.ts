import type { KnowledgeBaseArticle } from "@/modules/knowledge-base/articles";

export const commercialKnowledgeBaseArticles: KnowledgeBaseArticle[] = [
  {
    slug: "comercial-contratos-tabelas",
    title: "Configurar contratos, tabelas e DePara TUSS",
    category: "Receita",
    audience: ["Comercial", "Credenciamento", "Faturamento", "Auditoria"],
    summary: "Como definir a abrangência do contrato, vincular a tabela correta e registrar metodologia e DePara de cobrança sem criar preço ou equivalência implícitos.",
    steps: [
      "Abra Comercial / Contratos e selecione o convênio e o contrato que deseja parametrizar.",
      "Na aba Contrato, confira vigência e selecione o plano/produto quando a negociação não valer para todos os planos do convênio.",
      "Na aba Tabelas / negociação, vincule a fonte correta e escolha a categoria de cobrança; use uma categoria específica antes de Geral quando o contrato exigir cadeias diferentes.",
      "Defina se a edição será fixa ou vigente na data do serviço. Para Brasíndice, CMED ou SIMPRO, informe explicitamente a base de preço prevista no contrato.",
      "Preencha somente os componentes negociados, como CH, HM, SADT, UCO, filme radiológico por m², ajuste, prioridade, arredondamento e adicionais.",
      "Use Itens da tabela para conferir códigos, TUSS, atributos e quantidade de itens da edição. Edições publicadas são históricas; crie uma nova versão para alterações futuras.",
      "Quando a fonte usar código diferente do TUSS, abra DePara TUSS, selecione o mesmo contrato e a fonte vinculada e registre código de origem, TUSS confirmado e vigência. Se a equivalência mudar, encerre a vigência anterior e crie uma nova versão.",
      "Revise os alertas de edição ausente, tabela vazia ou base de preço pendente antes de liberar o contrato para uso no faturamento.",
    ],
    warnings: [
      "Tabela comercial fornece referência e atributos; o contrato define a cobrança. Não cadastre um preço apenas para remover um alerta.",
      "DePara TUSS deve existir como equivalência explícita e auditável. O sistema não sugere nem infere um código equivalente.",
      "Uma fonte precisa estar vinculada ao contrato antes de receber DePara. Vigências ativas do mesmo código/fonte não podem se sobrepor.",
      "Alterações futuras de contrato, tabela ou DePara não devem recalcular silenciosamente contas históricas fechadas.",
    ],
    links: [
      { label: "Contratos comerciais", href: "/comercial" },
      { label: "Fontes e edições", href: "/comercial/tabelas" },
      { label: "DePara TUSS", href: "/comercial/depara" },
      { label: "Regras, CBHPM e pacotes", href: "/comercial/regras" },
    ],
    keywords: ["comercial", "contrato", "credenciamento", "tabela", "amb", "cbhpm", "brasindice", "cmed", "simpro", "tuss", "depara", "ch", "uco", "filme"],
    sourceDocs: ["docs/FATURAMENTO_TABELAS_CONTRATOS.md"],
  },
  {
    slug: "comercial-regras-cbhpm-pacotes",
    title: "Cadastrar regras, portes CBHPM e pacotes",
    category: "Receita",
    audience: ["Comercial", "Credenciamento", "Faturamento", "Auditoria"],
    summary: "Como versionar exceções de cobrança, valores monetários de porte CBHPM e pacotes preservando prioridade, vigência e memória de cálculo.",
    steps: [
      "Abra Regras, CBHPM e pacotes a partir do workspace Comercial.",
      "Para uma regra contratual, selecione contrato e categoria, informe um código estável, descrição, operação, prioridade e vigência.",
      "Preencha apenas as condições que realmente constam do contrato, como urgência, horário especial, acomodação individual, anestesia, sequência, auxiliares, via, origem ou código específico.",
      "Para CBHPM, selecione o vínculo CBHPM correto, escolha Procedimento ou Anestesia e informe exatamente o porte, valor monetário negociado e sua vigência.",
      "Quando houver reajuste ou aditivo de porte, encerre a vigência anterior e crie uma nova versão; vigências ativas sobrepostas são bloqueadas.",
      "Para pacote, cadastre código, nome, valor, vigência, inclusões e exclusões e depois detalhe os itens e a regra de cobrança de excedente.",
      "Confirme o feedback inline de salvamento e use o histórico/a memória de cálculo para auditar qual regra ou valor foi aplicado.",
    ],
    warnings: [
      "O texto do porte CBHPM não possui valor monetário universal; o valor precisa estar cadastrado no vínculo contratual e na vigência correta.",
      "Não copie percentuais de contratos de terceiros como padrão do HIS.",
      "Se faltar configuração contratual válida, o resultado correto é sem preço contratual, não um fallback inventado.",
    ],
    links: [
      { label: "Regras, CBHPM e pacotes", href: "/comercial/regras" },
      { label: "Contratos comerciais", href: "/comercial" },
      { label: "DePara TUSS", href: "/comercial/depara" },
    ],
    keywords: ["regra", "cbhpm", "porte", "anestesia", "urgencia", "acomodacao", "multiplo", "via", "pacote", "vigencia", "faturamento"],
    sourceDocs: ["docs/FATURAMENTO_TABELAS_CONTRATOS.md"],
  },
];
