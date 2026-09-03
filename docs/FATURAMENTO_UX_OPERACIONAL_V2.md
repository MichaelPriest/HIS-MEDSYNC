# Faturamento — UX operacional V2

Este pacote moderniza o faturamento tomando como referência funcional telas hospitalares legadas fornecidas para comparação, sem copiar identidade visual, componentes proprietários ou fluxos que conflitem com o HIS-MEDSYNC.

## Princípios aplicados

- contexto da conta/paciente permanece visível durante o trabalho;
- menu da conta passa a ser orientado por tarefas, reduzindo navegação por telas desconectadas;
- relação de contas ganha filtros avançados por convênio, plano, competência, tipo de atendimento, status e período;
- visão analítica separa Internação, Ambulatório e Pronto-socorro/Urgência sem alterar a classificação persistida no atendimento;
- grades priorizam conferência financeira e abertura rápida da conta;
- alterações transacionais continuam nos RPCs e formulários background já existentes; a nova relação de contas é read-only;
- layout continua responsivo e navegável em telas menores.

## Referências funcionais reaproveitadas

As telas de referência destacavam lançamento de conta, alteração de valores, dados da internação, prontuário, relação de contas, baixa/fechamento e consulta por paciente. No HIS, esses conceitos foram reorganizados em um cockpit moderno, mantendo a integração com Produção Assistencial, TISS, Glosas, Recursos e Financeiro.

## Rotas afetadas

- `/faturamento` — navegação do workspace atualizada;
- `/faturamento/contas` — nova relação de contas com filtros e totais;
- `/faturamento/[contaId]/*` — cockpit contextual da conta com atalhos operacionais.

## Segurança

Nenhum novo DML foi criado. A relação de contas usa apenas SELECT sob RLS. O cockpit apenas consulta o contexto da conta e direciona para fluxos já existentes. Escritas continuam usando as ações/RPCs canônicos do módulo.
