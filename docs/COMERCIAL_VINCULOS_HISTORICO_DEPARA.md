# Comercial — vínculos editáveis, histórico e DePara TUSS automático

## Objetivo

A área comercial permite alterar a configuração vigente sem destruir a configuração anterior. Vínculos de tabelas não são excluídos para representar uma troca contratual: eles são desvinculados, permanecem auditáveis e podem ser reativados.

## Gestão de vínculos

A tela `/comercial/vinculos` permite:

- criar vínculo de tabela por contrato e categoria;
- editar modo de edição, edição fixa, base de preço, ajuste, prioridade, CH, HM, SADT, UCO, filme/m², adicionais, arredondamento e observações;
- desvincular uma tabela com motivo obrigatório;
- consultar vínculos históricos;
- reativar a mesma configuração histórica;
- sincronizar novamente o DePara TUSS do vínculo;
- consultar os eventos de vínculo, regra e DePara no mesmo contexto do contrato.

Fonte e categoria representam a identidade histórica do vínculo. Para trocar uma delas, desvincule o vínculo antigo e crie o novo. Isso evita reescrever o passado.

## DePara TUSS automático

O HIS não inventa equivalências. O sincronizador usa somente duas autoridades explícitas:

1. `codigo_tuss` já informado no item da edição comercial;
2. `referencia_equivalencias` ativa para o sistema de origem da tabela e destino TUSS.

Para tabelas AMB, as fontes AMB90/AMB92/AMB96/AMB99 compartilham o sistema de origem `AMB` no catálogo explícito de equivalências.

O DePara automático registra sua origem:

- `automatico_tabela`: veio do `codigo_tuss` do item;
- `automatico_equivalencia`: veio de uma equivalência explícita cadastrada;
- `manual`: cadastrado ou revisado por usuário.

Um DePara manual vigente sempre prevalece e nunca é sobrescrito pela sincronização automática. Quando um DePara automático é editado pelo fluxo manual, ele passa a ser manual e perde os vínculos técnicos de sincronização automática.

## Vigência

- Em `edicao_fixa`, a edição identifica qual versão da tabela deve ser usada, e a vigência do DePara automático acompanha a vigência do contrato.
- Em `vigente_na_data`, a vigência automática usa a interseção entre contrato e edição resolvida.

## Desvínculo

`comercial_desvincular_tabela`:

- exige autenticação e permissão comercial/tabelas;
- exige motivo;
- marca o vínculo como inativo;
- registra data e usuário do desvínculo;
- desativa regras derivadas daquele vínculo;
- encerra os DeParas automáticos ligados ao vínculo;
- não exclui o vínculo nem os eventos históricos.

`comercial_reativar_vinculo_tabela` reativa a mesma configuração, limpa os marcadores operacionais de desvínculo pelo trigger e dispara novamente a sincronização automática.

## Auditoria

A auditoria existente de `contrato_tabelas_comerciais` e `contrato_depara_tuss` continua registrando `antes` e `depois` em `comercial_eventos`. As contas históricas fechadas continuam protegidas pelos snapshots e não são recalculadas silenciosamente por uma alteração comercial futura.
