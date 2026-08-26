# Manual — Livro de Produção Assistencial

## Objetivo

O Livro de Produção Assistencial registra automaticamente os fatos executados durante o episódio clínico antes de qualquer decisão de faturamento. Ele é a ponte rastreável entre o atendimento e a conta hospitalar.

A regra central é: **o fato clínico não é o código de cobrança**. O setor registra o que realmente ocorreu; o motor contratual decide depois como aquele fato será faturado.

## Eventos automáticos

O Livro recebe, de forma idempotente, eventos originados de:

- consulta médica ambulatorial concluída;
- consulta de pronto atendimento concluída;
- visita/avaliação médica e interconsulta concluída;
- procedimentos realizados;
- sessões TEA/ABA realizadas;
- exames laboratoriais liberados;
- exames de imagem liberados;
- diárias de internação;
- materiais entregues;
- OPME entregues;
- gases medicinais entregues;
- medicamentos dispensados, descontadas as devoluções;
- taxas e outros eventos configurados por contrato.

Cancelamento, estorno ou mudança da origem também é refletido no Livro. Se uma origem cancelada voltar legitimamente para um estado executado, o evento é reativado sem gerar duplicidade.

## Consultas e visitas — TUSS de fallback

Os seguintes códigos funcionam como **fallback padrão quando não existe pacote ou regra contratual específica aplicável**:

| Evento | TUSS fallback |
| --- | --- |
| Consulta médica ambulatorial | `10101012` |
| Consulta de pronto atendimento | `10101039` |
| Visita/avaliação médica hospitalar | `10102019` |

A classificação não depende do texto livre de `tipo_atendimento`. O sistema usa a origem operacional do episódio: agenda/check-in para ambulatório e demanda espontânea/Totem/PS/urgência/emergência para pronto atendimento.

## Sessões TEA / ABA

A sessão clínica continua sendo registrada na fonte assistencial `procedimentos_assistenciais`. O Livro não cria uma segunda fonte clínica concorrente; ele **classifica o fato realizado** como `sessao_tea_aba` quando houver evidência suficiente.

A classificação pode ocorrer por:

1. metadados do item assistencial (`tipo_producao`, `linha_cuidado` ou `programa_assistencial`);
2. códigos de compatibilidade TEA/TGD já usados no projeto (`66600480`, `66600499`, `66600502`, `66600510`);
3. descrição assistencial contendo marcadores TEA, TGD, ABA ou autismo.

A prioridade recomendada é cadastrar corretamente o item e o contrato. A detecção por descrição serve como compatibilidade e não substitui parametrização comercial.

Quando o atendimento é por convênio, sessões TEA/ABA exigem autorização por padrão, salvo regra contratual explícita em `contrato_producao_mapeamentos.exige_autorizacao`.

## Autorizações e consumo de guia

A consolidação do Livro consome autorização por **quantidade**, em ordem determinística, sem ultrapassar a quantidade autorizada da guia.

Para cada evento são registrados:

- guia utilizada;
- código e tabela conciliados;
- quantidade produzida;
- quantidade efetivamente alocada na autorização;
- status da autorização: `autorizada`, `ausente`, `insuficiente`, `codigo_pendente` ou `nao_exigida`.

Se a autorização for ausente ou insuficiente, o fato clínico permanece preservado, porém a cobrança fica bloqueada. O usuário deve corrigir autorização/contrato; não deve alterar o prontuário para contornar a pendência.

A tabela `producao_autorizacao_consumos` mantém essa trilha. Reprocessamentos apagam apenas os registros **derivados** e os reconstruem a partir da produção e das guias válidas, evitando dupla utilização da mesma quantidade autorizada.

## Pacotes

Um pacote **explicitamente aplicado ao atendimento** tem prioridade sobre a cobrança individual.

Fluxo de resolução:

1. identificar o contrato vigente do convênio;
2. procurar mapeamento contratual específico para o tipo de evento, acomodação e/ou setor;
3. obter o código técnico candidato;
4. verificar se existe pacote ativo aplicado ao atendimento contendo esse código;
5. consumir a quantidade incluída no pacote de forma **acumulada entre os eventos**;
6. registrar a quantidade absorvida e a quantidade excedente;
7. se o contrato permitir cobrança de excedente e houver autorização suficiente, lançar somente o excedente;
8. somente na ausência de pacote, seguir para cobrança individual.

Exemplo: um pacote com `quantidade_inclusa=10` não absorve 12 sessões apenas porque cada evento possui quantidade 1. As dez primeiras unidades consomem a cota; as demais passam a excedente.

A tabela `atendimento_pacote_consumos` registra, por evento:

- quantidade total produzida;
- quantidade absorvida pelo pacote;
- quantidade excedente;
- vínculo de pacote e item contratual utilizados.

O item absorvido pelo pacote permanece registrado com valor zero e `cobravel=false`, mantendo a trilha de auditoria da produção real.

## Diárias e taxas

Diárias e taxas **não possuem um único TUSS fixo no HIS**. O código varia conforme contrato, acomodação, setor, vigência e regra comercial.

Por isso:

- o evento de diária/taxa nasce automaticamente sem inventar código;
- `contrato_producao_mapeamentos` resolve o código correto;
- se não houver mapeamento válido, o item fica `pendente_codigo` e não é cobrado;
- faturamento/auditoria deve corrigir o contrato, e não editar o prontuário para forçar um código.

## Materiais, medicamentos e devoluções

Materiais só entram quando entregues. Medicamentos entram pela dispensação líquida:

`quantidade líquida = quantidade dispensada/atendida - devoluções`

Uma devolução integral cancela a produção financeira daquele medicamento, sem apagar o histórico da origem.

## Estados do Livro

- `registrado`: fato capturado e aguardando consolidação;
- `consolidado`: evento já foi associado à conta;
- `cancelado`: origem deixou de ser válida;
- `estornado`: evento revertido por processo formal ou reclassificação.

## Consolidação pós-alta

Na alta médica:

1. a consulta principal é registrada no Livro;
2. materiais e medicamentos são sincronizados;
3. todos os fatos do episódio são sincronizados de forma idempotente;
4. a conta de pré-faturamento é criada ou reutilizada;
5. cada evento é resolvido por pacote/contrato/catálogo/fallback;
6. cotas de pacote e autorizações são consumidas cronologicamente;
7. itens individuais, absorvidos e excedentes são gravados na conta;
8. produção sem autorização suficiente fica bloqueada e rastreável;
9. a precificação contratual é executada;
10. o valor da conta é recalculado;
11. a conta é encaminhada para Auditoria.

Contas `pronta`, `faturada` ou `cancelada` são protegidas contra reprocessamento automático destrutivo.

## Reconstrução determinística

Os registros de `atendimento_pacote_consumos`, `producao_autorizacao_consumos` e os itens derivados do Livro são reconstruíveis.

Ao reprocessar uma conta ainda editável, o sistema:

1. remove somente derivados do Livro;
2. preserva os fatos clínicos originais;
3. relê contrato, pacote e guias autorizadas atuais;
4. recalcula consumo acumulado e excedentes;
5. recria a memória de cálculo.

Isso permite corrigir parametrização sem gerar duplicidade ou alterar fatos assistenciais.

## Sincronização manual

A tela **Faturamento → Livro de produção** possui uma sincronização manual de contingência. Ela serve para:

- recuperar episódios antigos;
- repetir a captura após correção de cadastro/fluxo;
- conferir idempotência.

Ela **não cria fatos clínicos arbitrários**. A RPC apenas relê as fontes assistenciais válidas e sincroniza o Livro.

A mesma tela mostra:

- total de sessões TEA/ABA;
- autorizações pendentes;
- consumo e excedente de pacote;
- quantidade alocada por autorização;
- bloqueios de cobrança.

Permissões:

- `producao.visualizar` — consultar o Livro;
- `producao.reprocessar` — executar a sincronização de contingência.

Por padrão, Administrador, Faturamento e Auditoria recebem essas permissões.

## Rastreabilidade

Cada evento guarda:

- empresa e unidade;
- atendimento e paciente;
- internação quando aplicável;
- profissional e setor;
- tipo do evento;
- tabela/origem e ID do registro que gerou o fato;
- data/hora real;
- quantidade;
- item assistencial e fallback TUSS quando houver;
- autorização conciliada quando aplicável;
- metadados da execução e do consumo de autorização;
- status e data de consolidação.

Cada item da conta pode apontar de volta para `producao_evento_id`, guardar `pacote_id` e `memoria_calculo`. Assim Auditoria, Contas Médicas e Faturamento conseguem explicar de onde veio cada cobrança e por que ela foi absorvida, cobrada individualmente, transformada em excedente ou bloqueada.
