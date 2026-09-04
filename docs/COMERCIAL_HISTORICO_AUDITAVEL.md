# Comercial — Histórico auditável

## Objetivo

A Central de Histórico em `/comercial/historico` expõe a trilha de auditoria comercial já registrada em `comercial_eventos` sem criar uma segunda fonte de eventos.

A tela permite localizar alterações de:

- contratos (`credenciamento_contratos`);
- vínculos de tabelas comerciais;
- DePara TUSS;
- regras de faturamento e procedimentos;
- pacotes e itens de pacote;
- portes CBHPM vinculados;
- fontes, edições e itens de tabelas comerciais.

## Segurança

A tela é somente leitura e reutiliza o RLS existente de `comercial_eventos`. A policy de SELECT exige usuário autenticado dentro do escopo permitido por `comercial_pode_visualizar(empresa_id, unidade_id)`.

Nenhum RPC de escrita foi criado para o histórico e a página não executa `INSERT`, `UPDATE`, `DELETE` ou `UPSERT`.

## Filtros e desempenho

Como importações e manutenções de itens podem gerar milhares de eventos, a consulta é paginada em 50 registros e pode ser filtrada por:

- contrato;
- entidade;
- ação (`insert`, `update`, `delete`);
- data inicial;
- data final.

A tela nunca carrega toda a trilha de auditoria em uma única consulta.

## Leitura do evento

Cada cartão informa:

- tipo da entidade;
- ação executada;
- data e hora em `America/Sao_Paulo`;
- entidade alterada;
- contrato de contexto quando disponível;
- usuário responsável quando a leitura do cadastro do usuário estiver autorizada;
- comparação campo a campo entre `antes` e `depois`.

Campos técnicos de atualização (`updated_at` e `updated_by`) são omitidos do resumo visual para destacar mudanças comerciais relevantes, mas permanecem armazenados no evento original.

## Uso recomendado

1. Filtre o contrato quando a investigação estiver relacionada a uma negociação específica.
2. Restrinja por entidade e período em tabelas com grande volume de eventos.
3. Compare os valores Antes e Depois.
4. Identifique o usuário/processo que executou a alteração.
5. Faça qualquer correção no módulo operacional correspondente; o histórico não deve ser editado.
6. Após mudanças comerciais relevantes, execute novamente Prontidão, Simulador/Matriz e Homologação conforme aplicável.

## Preservação histórica

A edição atual do Comercial não deve apagar versões anteriores para aparentar que uma regra sempre existiu. Desvínculos, reativações, alterações de contrato, mudanças de DePara e ajustes de tabela permanecem rastreáveis pelos eventos e pelos snapshots financeiros/assistenciais que cada domínio já preserva.
