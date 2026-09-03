# Faturamento da equipe cirúrgica — AMB / CBHPM

## Objetivo

O faturamento cirúrgico passa a consumir a equipe clínica registrada no Centro Cirúrgico e criar um **snapshot de cobrança separado**. O faturista não recria a equipe assistencial: ele sincroniza os profissionais já vinculados ao procedimento, confere o cálculo e decide `Cobrar` e `Repasse` sem alterar o fato clínico.

## Autoridade dos dados

A ordem de autoridade é:

1. procedimento e equipe clínica em `cirurgia_procedimentos` / `cirurgia_equipe`;
2. item da tabela comercial vinculado ao procedimento;
3. contrato e vínculo comercial vigentes;
4. snapshot de faturamento em `faturamento_equipe_cirurgica`;
5. item financeiro/honorário materializado na conta.

A quantidade de auxiliares e o CH do anestesista são lidos primeiro das colunas estruturadas `quantidade_auxiliares` e `ch_anestesista` do item da tabela. Metadados antigos são apenas fallback.

## Percentuais da equipe

No pacote atual, conforme regra operacional definida para o HIS:

- cirurgião principal: 100% da base profissional do procedimento;
- 1º auxiliar: 30%;
- 2º, 3º e 4º auxiliares: 20% cada;
- instrumentador: 10%;
- anestesista: cálculo próprio pela informação anestésica da tabela/contrato.

Auxiliares só são cobrados até a quantidade permitida pelo item da tabela. Um profissional registrado clinicamente além da quantidade contratual continua no histórico clínico, mas o snapshot fica não cobravel pela regra automática.

## AMB 90 e AMB 92

Para honorários profissionais, o motor usa os pontos/CH do item e o `valor_ch` negociado no vínculo contratual.

Para anestesia, a prioridade é o `ch_anestesista` explícito importado no item. Somente quando essa informação estiver ausente e existir porte anestésico, o sistema admite o fallback de porte informado para a implantação:

| Porte | CH fallback |
| --- | ---: |
| 1 | 70 |
| 2 | 110 |
| 3 | 170 |
| 4 | 250 |
| 5 | 380 |
| 6 | 550 |
| 7 | 780 |

O fallback **não substitui CH explícito da tabela importada**. Exemplo verificado na base atual: procedimento AMB90 com 1 auxiliar e `ch_anestesista = 370` mantém 370 CH como autoridade.

## AMB 96 e AMB 99

Nenhum valor histórico aproximado em reais é embutido no motor. Esses contratos exigem configuração explícita em `regras_adicionais.amb96_99_metodo`:

- `conversao_ch`: usa os pontos/CH presentes na tabela e o valor de CH do contrato;
- `valor_tabela_reajustado`: usa valor monetário explícito do item/porte e o reajuste contratual.

Sem uma dessas autoridades, o honorário fica pendente e não pode ser marcado como cobravel automaticamente.

## CBHPM e demais tabelas

O motor reaproveita o resolvedor comercial contextual. Para anestesia, usa a categoria `anestesia`, permitindo que porte anestésico e valores contratados sejam resolvidos pelas regras comerciais já existentes. Não é criado um segundo catálogo de preços.

## Cobrar e Repasse

`Cobrar` controla a inclusão do honorário na conta. `Repasse` é armazenado separadamente para a futura/atual cadeia de remuneração profissional e não muda sozinho o valor cobrado à operadora.

Se o usuário alterar `Cobrar` em relação à decisão automática (`cobrar_regra`), a justificativa é obrigatória. A alteração é auditada com antes/depois.

## Segurança e histórico

- `faturamento_equipe_cirurgica` usa RLS + FORCE RLS;
- `authenticated` não possui INSERT/UPDATE/DELETE direto;
- escrita ocorre somente pelos RPCs de sincronização/ajuste;
- uma Guia TISS ativa bloqueia alterações;
- contas faturadas/canceladas ficam protegidas;
- remoção de membro da equipe clínica não apaga o snapshot: ele fica inativo e não cobravel;
- eventos são registrados em `auditoria_eventos`.

## Tela

A área **Faturamento → Conta → Cirurgia / SADT → Equipe médica e honorários** mostra, por procedimento:

- tabela e código;
- quantidade de auxiliares prevista;
- porte/CH anestésico quando disponível;
- equipe clínica registrada;
- percentual ou CH aplicado;
- base de cálculo;
- honorário calculado;
- opções `Cobrar` e `Repasse`;
- pendências de configuração contratual.
