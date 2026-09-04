# Faturamento da equipe cirúrgica — AMB / CBHPM

## Objetivo

O faturamento cirúrgico consome a equipe registrada no Centro Cirúrgico e cria um **snapshot de cobrança separado**. Médicos, auxiliares, anestesista e instrumentador informados assistencialmente são carregados automaticamente na conta. Se um papel exigido pela tabela não tiver sido registrado no ato, o faturista pode complementar o profissional sem criar uma equipe paralela.

## Autoridade dos dados e integração com Centro Cirúrgico

A ordem de autoridade é:

1. procedimento e equipe em `cirurgia_procedimentos` / `cirurgia_equipe`;
2. item da tabela comercial vinculado ao procedimento;
3. contrato e vínculo comercial vigentes;
4. snapshot de faturamento em `faturamento_equipe_cirurgica`;
5. item financeiro/honorário materializado na conta.

O Centro Cirúrgico continua sendo a origem clínica. Registros feitos ali ficam com `origem_registro = centro_cirurgico` e `confirmado_assistencial = true`.

Quando o faturamento precisa completar um papel ausente, o RPC `faturamento_complementar_membro_equipe_cirurgica` insere o profissional na própria `cirurgia_equipe` com:

- `origem_registro = faturamento`;
- `confirmado_assistencial = false`;
- usuário e data da inclusão administrativa;
- justificativa obrigatória;
- evento auditável em `cirurgia_eventos`.

Isso torna o complemento visível ao fluxo do Centro Cirúrgico sem fingir que ele foi registrado pela equipe assistencial. Se o Centro Cirúrgico posteriormente salvar o mesmo profissional/papel, o registro passa a ser confirmado assistencialmente.

A quantidade de auxiliares e o CH do anestesista são lidos primeiro das colunas estruturadas `quantidade_auxiliares` e `ch_anestesista` do item da tabela. Metadados antigos são apenas fallback.

## Percentuais da equipe

No pacote atual, conforme regra operacional definida para o HIS:

- cirurgião principal: 100% da base profissional do procedimento;
- 1º auxiliar: 30%;
- 2º, 3º e 4º auxiliares: 20% cada;
- instrumentador: 10%;
- anestesista: cálculo próprio pela informação anestésica da tabela/contrato.

Auxiliares só são cobrados até a quantidade permitida pelo item da tabela. Um profissional registrado além da quantidade contratual continua no histórico, mas o snapshot fica não cobravel pela regra automática.

## AMB 90 e AMB 92

Para honorários profissionais, o motor usa os pontos/CH do item e o `valor_ch` negociado no vínculo contratual.

Para anestesia, a prioridade é o `ch_anestesista` explícito importado no item. Somente quando essa informação estiver ausente e existir porte anestésico, o sistema admite o fallback definido para a implantação:

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

`Cobrar` controla a inclusão do honorário na conta. `Repasse` é armazenado separadamente e não muda sozinho o valor cobrado à operadora.

Se o usuário alterar `Cobrar` em relação à decisão automática (`cobrar_regra`), a justificativa é obrigatória. A alteração é auditada com antes/depois.

## Separação do faturamento por tipo de atendimento

Cada `contas_faturamento` possui uma natureza canônica própria em `tipo_atendimento_faturamento`:

- `pronto_atendimento` — urgência, emergência, PS e demanda espontânea compatível com Pronto Atendimento;
- `ambulatorio` — consulta, terapia ou procedimento ambulatorial eletivo;
- `internacao` — qualquer episódio que possua internação hospitalar vinculada;
- `sadt` — laboratório, imagem e exames/procedimentos diagnósticos eletivos realizados **fora do Pronto Atendimento e fora da Internação**.

A classificação automática segue a precedência:

`Internação > Pronto Atendimento > SADT eletivo > Ambulatório`.

A conta guarda a memória da classificação. Exceções podem ser reclassificadas manualmente pelo faturamento antes da Guia TISS, com justificativa e auditoria. Na alta do atendimento, contas ainda automáticas são classificadas novamente para incorporar fatos que surgiram depois da abertura da conta, como uma internação posterior.

## Guias e lotes TISS

A separação não é apenas visual:

- Internação gera contexto de `resumo_internacao`;
- Pronto Atendimento e SADT usam contexto `sp_sadt` quando aplicável;
- Ambulatório preserva a regra TISS do episódio, como consulta quando correspondente;
- `tiss_lotes` grava `tipo_atendimento_faturamento`;
- o novo RPC `criar_lote_tiss_por_tipo_transacional` seleciona somente guias da natureza escolhida;
- um trigger impede vincular ao mesmo lote guias de naturezas diferentes.

Portanto, para a mesma operadora e competência, PA, Ambulatório, Internação e SADT são gerados em lotes separados.

## Segurança e histórico

- `faturamento_equipe_cirurgica` usa RLS + FORCE RLS;
- `authenticated` não possui INSERT/UPDATE/DELETE direto no snapshot;
- escrita ocorre somente pelos RPCs de sincronização/ajuste/complementação;
- uma Guia TISS ativa bloqueia alterações da equipe ou da classificação;
- contas faturadas/canceladas ficam protegidas;
- remoção de membro da equipe clínica não apaga o snapshot: ele fica inativo e não cobravel;
- complementos do faturamento e alterações da classificação são auditados;
- funções internas de classificação/trigger não são executáveis diretamente por `anon` ou `authenticated`.

## Tela

A área **Faturamento → Conta → Cirurgia / SADT → Equipe médica e honorários** mostra, por procedimento:

- tabela e código;
- quantidade de auxiliares prevista;
- porte/CH anestésico quando disponível;
- equipe registrada no Centro Cirúrgico;
- somente os papéis faltantes para complementação pelo faturamento;
- percentual ou CH aplicado;
- base de cálculo;
- honorário calculado;
- opções `Cobrar` e `Repasse`;
- pendências de configuração contratual.

A área **Faturamento → Contas** separa os quatro tipos de atendimento, e **Faturamento → Lotes** exige a natureza faturável ao criar um novo lote TISS.
