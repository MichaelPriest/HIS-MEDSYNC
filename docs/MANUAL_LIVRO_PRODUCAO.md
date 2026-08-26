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
- exames laboratoriais liberados;
- exames de imagem liberados;
- diárias de internação;
- materiais entregues;
- OPME entregues;
- gases medicinais entregues;
- medicamentos dispensados, descontadas as devoluções;
- sessões TEA/ABA, quando o módulo de sessão estiver vinculado ao motor;
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

## Pacotes

Um pacote **explicitamente aplicado ao atendimento** tem prioridade sobre a cobrança individual.

Fluxo de resolução:

1. identificar o contrato vigente do convênio;
2. procurar mapeamento contratual específico para o tipo de evento, acomodação e/ou setor;
3. obter o código técnico candidato;
4. verificar se existe pacote ativo aplicado ao atendimento contendo esse código;
5. se houver pacote, absorver a quantidade prevista no pacote;
6. se o contrato permitir, lançar apenas o excedente separadamente;
7. somente na ausência de pacote, seguir para cobrança individual.

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
- `estornado`: evento revertido por processo formal.

## Consolidação pós-alta

Na alta médica:

1. a consulta principal é registrada no Livro;
2. materiais e medicamentos são sincronizados;
3. todos os fatos do episódio são sincronizados de forma idempotente;
4. a conta de pré-faturamento é criada ou reutilizada;
5. cada evento é resolvido por pacote/contrato/catálogo/fallback;
6. itens individuais e absorvidos por pacote são gravados na conta;
7. a precificação contratual é executada;
8. o valor da conta é recalculado;
9. a conta é encaminhada para Auditoria.

Contas `pronta`, `faturada` ou `cancelada` são protegidas contra reprocessamento automático destrutivo.

## Sincronização manual

A tela **Faturamento → Livro de produção** possui uma sincronização manual de contingência. Ela serve para:

- recuperar episódios antigos;
- repetir a captura após correção de cadastro/fluxo;
- conferir idempotência.

Ela **não cria fatos clínicos arbitrários**. A RPC apenas relê as fontes assistenciais válidas e sincroniza o Livro.

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
- metadados da execução;
- status e data de consolidação.

Cada item da conta pode apontar de volta para `producao_evento_id`, guardar `pacote_id` e `memoria_calculo`. Assim Auditoria, Contas Médicas e Faturamento conseguem explicar de onde veio cada cobrança e por que ela foi absorvida, cobrada individualmente ou bloqueada.
