# Manual do Laboratório Clínico (LIS)

## Objetivo

O módulo de Laboratório Clínico funciona como um LIS integrado ao HIS. A solicitação nasce no episódio assistencial e permanece vinculada ao paciente, atendimento, autorização/guia, produção assistencial e faturamento. O operador não deve redigitar dados administrativos já existentes no HIS.

## Fluxo operacional

1. O profissional solicita o exame no prontuário.
2. A solicitação chega à fila do Laboratório.
3. O laboratório gera a amostra, accession e etiqueta.
4. A coleta é confirmada com data, profissional e cadeia de custódia.
5. A amostra é recebida ou rejeitada com motivo.
6. O resultado é registrado manualmente ou associado ao analisador/equipamento.
7. Cada analito recebe referência, flag e criticidade conforme o catálogo técnico.
8. O analito pode ser validado tecnicamente por profissional autorizado.
9. Valor crítico exige comunicação registrada e read-back quando aplicável.
10. O laudo é aberto na Bancada de Laudos.
11. O responsável revisa resultados estruturados e, quando necessário, digita interpretação, conclusão e observações.
12. A assinatura do laudo final encerra a solicitação como `liberado`.
13. Laudo liberado é imutável. Alteração exige retificação formal com motivo e nova versão.
14. O documento pode ser impresso ou salvo em PDF. A publicação no Portal do Paciente será controlada pela camada de portal.

## Regra de liberação

A validação de um analito não equivale à liberação do exame. Um resultado individual pode ser marcado como tecnicamente validado, mas a solicitação laboratorial somente passa para `liberado` quando o laudo final é assinado.

Essa separação evita que um exame entre no prontuário externo, Portal do Paciente ou fluxo de cobrança antes da conclusão documental.

## Valores críticos

Resultados configurados abaixo de `critico_min` ou acima de `critico_max` são marcados como críticos. Antes da assinatura do laudo é obrigatório registrar:

- destinatário da comunicação;
- meio utilizado;
- horário;
- profissional responsável;
- confirmação de read-back quando aplicável;
- observações relevantes.

O banco bloqueia a liberação final se existir valor crítico ainda não comunicado.

## Amostras e rastreabilidade

A amostra mantém:

- código da amostra;
- accession number;
- etiqueta;
- material e recipiente;
- coleta prevista e realizada;
- recebimento;
- responsáveis pela coleta/recebimento;
- temperatura no recebimento;
- cadeia de custódia;
- rejeição e motivo;
- prioridade.

## Catálogo técnico

`laboratorio_catalogo_exames` armazena dados como TUSS, material, recipiente, volume mínimo, preparo, jejum e prazo. `laboratorio_catalogo_analitos` armazena analitos, unidade, referência, limites críticos, método e ordenação.

## Equipamentos e interfaces

O LIS possui cadastro de analisadores e vínculo com Engenharia Clínica. Um equipamento indisponível não deve ser utilizado para registrar processamento. `laboratorio_interfaces_mensagens` é a base para integração bidirecional futura com analisadores, mantendo protocolo, conteúdo, status e erro.

## Laudos

Tabela principal: `laboratorio_laudos`.

Características:

- um laudo por solicitação;
- rascunho editável;
- assinatura eletrônica com hash SHA-256;
- responsável técnico;
- versão;
- histórico integral;
- motivo obrigatório de retificação;
- impressão/PDF;
- campos preparados para publicação controlada no portal.

Tabela de histórico: `laboratorio_laudos_historico`.

## Permissões principais

- `laboratorio.visualizar`: visualizar o módulo;
- `laboratorio.coletar`: coleta/recebimento de amostras;
- `laboratorio.resultar`: registrar resultados;
- `laboratorio.laudar`: criar e editar laudos em rascunho;
- `laboratorio.liberar`: validar/liberar resultados e laudos conforme regras;
- `laboratorio.notificar_critico`: registrar comunicação de valor crítico;
- `laboratorio.gerenciar_catalogo`: catálogo técnico;
- `laboratorio.interface_equipamento`: interfaces de analisadores.

As RPCs de laudo e validação não possuem `EXECUTE` para `anon`/`PUBLIC`; o acesso é autenticado e as permissões são verificadas dentro das funções.

## Integração com o prontuário e faturamento

O exame liberado permanece vinculado a `solicitacoes_exames`. A produção para faturamento deve considerar a execução/documentação concluída e nunca apenas a solicitação. A precificação continua sendo resolvida pelo contrato vigente, pacote ou regra comercial, sem alterar o registro clínico.

## Impressão e contingência

O HIS é digital por padrão. A versão impressa/PDF existe para contingência, entrega externa ou necessidade operacional. O documento apresenta paciente, atendimento, exame/TUSS, amostra/accession, resultados e referências, interpretação/conclusão, responsável, versão e hash de assinatura.
