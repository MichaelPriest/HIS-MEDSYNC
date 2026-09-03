# Faturamento — Tabelas Comerciais, Contratos e Regras de Cobrança

## Estado implementado na PR #130

A etapa comercial do Ciclo da Receita está consolidada em quatro camadas de autoridade:

1. **Contrato contextual** por empresa, unidade, convênio, plano e vigência;
2. **Vínculo de tabela comercial** por categoria, prioridade, edição e metodologia/base de preço;
3. **Regras e pacotes versionados**, com condições estruturadas e memória de aplicação;
4. **Snapshot na conta**, preservando o resultado histórico quando contrato, tabela ou regra forem alterados futuramente.

O workspace `/comercial` foi atualizado para expor plano/produto, base de preço, CH, HM, SADT, UCO, filme radiológico por m², prioridade, edição, arredondamento e adicionais contratados. Edições publicadas continuam históricas e somente uma nova versão rascunho pode ser alterada.

As mutações normais de contrato e negociação são gravadas em segundo plano por RPC (`comercial_atualizar_contrato_contextual`, `comercial_salvar_vinculo_tabela` e `comercial_salvar_negociacao_tabela_v2`). Não há `upsert` direto do navegador para o vínculo contratual. Publicação de edição permanece uma transição explícita.

O workspace `/comercial/regras` utiliza campos estruturados para urgência, horário especial, acomodação, anestesia, auxiliares, sequência/múltiplos procedimentos, via e código específico. Pacotes e seus itens também utilizam RPCs e feedback inline.

CBHPM possui valores monetários de porte versionados em `contrato_cbhpm_portes`, separados entre procedimento e anestesia, com vigência, bloqueio de sobreposição e fallback apenas para configuração legada já existente. O texto do porte nunca gera preço por si só.

Migrations desta etapa:

- `20260903014600_comercial_motor_cobranca_contextual`;
- `20260903015147_comercial_regras_background_rpc`;
- `20260903015639_comercial_negociacao_contextual_v2`;
- `20260903020319_comercial_cbhpm_portes_versionados`;
- `20260903022310_comercial_vinculo_tabela_background_rpc`.

## Princípio de autoridade

O HIS-MEDSYNC não trata TUSS, AMB, CBHPM, Brasíndice ou SIMPRO como uma tabela universal de preços.

- **TUSS** é terminologia/codificação regulatória e não define o preço negociado.
- **AMB / CBHPM** fornecem atributos e referências da edição (CH, portes, UCO, porte anestésico, auxiliares, filme e demais campos quando presentes na edição importada).
- **Brasíndice / CMED** fornecem referências de medicamento como PF/PMC e atributos regulatórios; a base escolhida e os ajustes dependem do contrato.
- **SIMPRO** é referência comercial para materiais/itens hospitalares; desconto, acréscimo, taxa ou fallback dependem do contrato.
- **Diárias, taxas e gases** devem preservar a codificação TUSS 18 quando houver vínculo oficial, ou tabela própria (00) quando o contrato usar código próprio sem DePara configurado.
- **Pacotes** utilizam tabela TISS 98 quando aplicável ao pacote próprio, preservando itens incluídos, excluídos e cobrança de excedentes.

Nunca copiar percentuais de contratos de terceiros como regra padrão do produto.

## Cadeia determinística de resolução

Para cada item da conta, na data do atendimento:

1. resolver o contrato ativo compatível com empresa, unidade, convênio/plano e vigência;
2. percorrer `contrato_tabelas_comerciais` por categoria específica antes de `geral` e depois por `prioridade` crescente;
3. resolver a edição fixa ou a edição vigente na data;
4. procurar primeiro vínculo explícito com `item_assistencial_id`/código original;
5. usar DePara somente quando existir `referencia_equivalencias` ativa e compatível com a fonte;
6. calcular a base conforme metodologia da edição + configuração contratual;
7. aplicar regras de cobrança compatíveis, em ordem determinística de prioridade;
8. registrar contrato, fonte, edição, código original, TUSS resultante, base, fatores, regra(s), fallback e valor final na memória de cálculo.

Se nenhuma combinação válida for encontrada, o resultado é **sem preço contratual**. Não usar preço aleatório e não inventar DePara.

## AMB

As edições AMB devem ser preservadas integralmente. O cálculo pode utilizar componentes como CH/HM/SADT e filme apenas quando esses componentes existirem na edição e tiverem valor contratual configurado.

O sistema não deve assumir que todas as edições AMB têm a mesma estrutura. A edição importada é a fonte dos atributos. Regras específicas (por exemplo, multiplicadores ou filme) precisam estar versionadas no contrato/edição e aparecer na memória de cálculo.

## CBHPM

CBHPM é versionada e pode alterar porte, auxiliares, porte anestésico e UCO entre revisões. O sistema deve fotografar a edição utilizada na conta.

O cálculo deve suportar, conforme o contrato:

- valor negociado do porte do procedimento;
- quantidade de UCO × valor da UCO contratada;
- porte anestésico;
- auxiliares;
- adicionais de urgência/horário/acomodação somente quando a regra contratual vigente os habilitar;
- regras de múltiplos procedimentos e vias de acesso versionadas.

Os valores de porte são cadastrados por vínculo CBHPM, tipo e vigência. Vigências ativas do mesmo porte não podem se sobrepor. O resolvedor registra na memória se utilizou a origem `versionado` ou, quando já existia configuração anterior, `legado_json`.

Nunca derivar valor monetário apenas do texto do porte sem uma tabela de valores/contrato correspondente.

## Brasíndice / CMED

A edição precisa preservar, quando disponível:

- código Brasíndice;
- EAN;
- registro ANVISA;
- GGREM;
- apresentação/fabricante;
- PF;
- PMC;
- ICMS;
- tipo de lista CMED;
- data/edição da referência.

O contrato deve declarar explicitamente a base utilizada (`valor_fabrica`, `valor_pmc`, `valor_referencia` ou `valor_maximo`, conforme os dados da edição e o instrumento contratual) e o percentual/desconto/acréscimo. O motor não escolhe PF/PMC implicitamente.

## SIMPRO

A edição SIMPRO deve ser versionada e vinculada ao item/material correto. O contrato deve declarar o tratamento comercial da referência: preço integral, desconto, acréscimo, taxa de comercialização ou fallback documental, conforme negociação.

Não existe percentual global do HIS para SIMPRO. Vínculo SIMPRO ativo sem base de preço explícita falha fechado e não participa da precificação.

## Diárias, taxas e gases

Categorias comerciais separadas:

- `diarias`;
- `taxas`;
- `gases` / `gas_medicinal`.

A ocorrência assistencial precisa resolver quantidade/unidade e o código contratado. A precificação pode ser fixa, por unidade, por hora/dia, por faixa ou por pacote, desde que a regra esteja explícita e vigente.

## Materiais, medicamentos e OPME

Categorias comerciais devem permanecer independentes para permitir cadeias diferentes:

- medicamentos → Brasíndice/CMED/tabela própria;
- materiais → SIMPRO/tabela própria;
- OPME → SIMPRO/tabela própria/NF quando o contrato expressamente permitir;
- item sem referência configurada → pendência, sem preço inventado.

## DePara TUSS

DePara é relacionamento cadastrado e auditável, nunca inferência automática.

Registrar sempre:

- sistema/tabela de origem;
- código original;
- TUSS destino;
- status/vigência quando disponível;
- sentido utilizado na resolução;
- tabela TISS final (18, 19, 20, 22, 00, 98 etc.).

Um código próprio sem vínculo TUSS permanece próprio e deve ser transmitido/armazenado conforme a configuração TISS aplicável.

## Regras de cobrança

`contrato_regras_faturamento` é a autoridade para exceções e fatores adicionais. Regras devem possuir:

- categoria;
- código estável;
- prioridade;
- vigência;
- condição explícita;
- operação (`multiplicar_percentual`, `acrescentar_percentual`, `descontar_percentual`, `somar_valor_fixo` ou `substituir_valor`);
- base de aplicação (`valor_atual` ou `valor_base`);
- percentual e/ou valor fixo quando aplicável;
- indicador opcional de encerramento do processamento;
- memória de aplicação com valor antes/depois.

Escopos previstos incluem procedimentos, cirurgia, SADT, honorários, anestesia, auxiliares, múltiplos procedimentos, via de acesso, urgência, horário especial, acomodação, diárias, taxas, gases, materiais, medicamentos e OPME.

## Histórico

Contas fechadas não são recalculadas silenciosamente quando contrato/tabela muda.

A conta mantém snapshots suficientes para reproduzir o preço histórico. Alterações futuras exigem nova edição/regra/vigência e não sobrescrevem a base usada no atendimento anterior.
