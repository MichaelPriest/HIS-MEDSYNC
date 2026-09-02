# Salvamentos em segundo plano

## Regra global

Salvamentos e mutações operacionais normais do MedSync HIS devem acontecer sem navegação automática e sem recarga completa da página.

Padrão obrigatório:

1. enviar a mutação por Server Action;
2. mostrar `Salvando…` imediatamente;
3. exibir sucesso/erro no contexto do formulário;
4. preservar campos em caso de erro;
5. manter banco/RPC como autoridade para validação, RBAC, RLS e transação;
6. usar `revalidatePath` após sucesso quando dados dependentes precisam ser atualizados;
7. não usar `redirect()`, `window.location` ou `router.refresh()` apenas para refletir uma gravação;
8. não mostrar sucesso otimista para operações clínicas, financeiras, fiscais, TISS ou de estoque antes da confirmação do banco.

O contrato compartilhado está em `src/lib/actions/background-action.ts`, com `BackgroundActionState` (`idle | success | error`). Formulários interativos usam React 19 `useActionState` e feedback acessível por `aria-live`.

## Navegação permitida

Navegação automática só é válida quando representa uma transição real de trabalho. Exemplos preservados: check-in da Agenda para Admissão/Centro Cirúrgico, abertura do RA para a próxima etapa assistencial, tomada do paciente para o prontuário, criação confirmada de laudo LIS/RIS para abrir o editor e criação confirmada de conta/lote/recurso/NFS-e para abrir o respectivo workspace. Erro ou sucesso de uma gravação comum nunca é motivo suficiente para navegar.

Filtros e buscas que alteram deliberadamente a consulta podem continuar na URL. Sucesso/erro das mutações convertidas não dependem de query string.

## Módulos convertidos

- Prontuário: alta médica e avaliações interprofissionais.
- Agenda: criação e ações de confirmação/falta/conclusão/cancelamento; check-in navega apenas para a próxima etapa real.
- Admissão/Recepção: validações e falhas inline; após criação real do atendimento/RA, segue para a próxima etapa.
- Triagem, Fila Médica e Autorizações: feedback inline; navegação somente em mudança assistencial real.
- Enfermagem: evolução e administração à beira-leito sem reload.
- Farmácia: conciliação, validação, dispensação FEFO e devolução.
- Laboratório/LIS e Diagnóstico por Imagem/RIS: operação e laudos sem reload.
- GED: assinatura e status inline, com SHA-256 antes de `assinar_documento_ged`.
- Internação/NIR: alocação de leito inline.
- Centro Cirúrgico/CME: núcleo, procedimentos, Anestesia/RPA, Suprimentos e CME.
- Ciclo da Receita: entradas, ledger financeiro, ações principais da conta, Guia TISS, Lote TISS e validação XSD.

## Ciclo da Receita / Faturamento

O workspace unifica Contas, Produção, Guias TISS, Lotes, Glosas, Recursos, Recebíveis, NFS-e e Financeiro. O frontend não substitui autoridade financeira/TISS/fiscal do banco.

### Abertura de conta

`abrirContaFaturamentoBackground` preserva atendimento/RA como origem. Se já existe conta, abre a existente. A navegação para `/faturamento/{contaId}` ocorre somente após a conta real existir.

### Conta hospitalar

Competência/desconto, sincronização de produção, recálculo contratual, validação TISS e exclusão de item usam `AccountBackgroundForm`/`AccountItemDeleteButton`. Continuam canônicos:

- `atualizar_resumo_conta_faturamento`;
- `sincronizar_producao_atendimento`;
- `recalcular_conta_contratual_avancada`;
- `validar_conta_tiss`;
- `excluir_item_conta_faturamento`.

Adicionar/editar lançamento e grupos/atos ainda são legados por concentrarem regras comerciais extensas.

### Lote TISS

Criação continua exclusivamente em `criar_lote_tiss_transacional`. No detalhe, protocolo e glosa usam seus RPCs transacionais; o registro de envio manual passou a usar `registrar_envio_manual_tiss_operacional` em vez de DML direto.

Importação XML, protocolo, glosa e registro de envio manual ficam em modais com `useActionState`.

### XSD ANS 04.03.00

A validação XSD real usa `xmllint-wasm`/libxml2 no servidor. O contrato dos schemas oficiais está versionado por manifesto e SHA-256 em `vendor/tiss/040300`; `prebuild` materializa somente bytes cujo hash coincida com o contrato.

`validarXmlLoteTissBackground`:

1. lê o XML real do lote;
2. recusa `PRELIMINAR_INTERNO`;
3. exige Comunicação `04.03.00`;
4. executa `validateTissXmlXsd` contra `tissV4_03_00.xsd` ou `tissWebServicesV4_03_00.xsd`;
5. persiste resultado/hash/erros pelo RPC `registrar_validacao_xsd_tiss_operacional`;
6. revalida lote e filas dependentes.

DTD/`ENTITY` são recusados. Dependências XSD são pré-carregadas localmente e a validação não resolve schemas pela rede. `xsd_validado=true` nunca é resultado de uma checagem superficial de XML bem-formado.

### Recebíveis

Baixa, conciliação e estorno usam `registrar_recebimento_financeiro_operacional`, `conciliar_recebimento_financeiro_operacional` e `estornar_recebimento_financeiro_operacional`. O ledger é append-only: estorno não apaga a baixa original.

### Glosas e recursos

Abertura de recurso usa `criar_recurso_glosa_tiss_transacional` e navega apenas quando o banco retorna o recurso real. Registro de glosa no lote usa `registrar_glosa_tiss_transacional` inline.

### NFS-e

A criação de rascunho usa `criar_nfse_lote_operacional`. Criar rascunho não equivale a emitir documento fiscal.

### Produção

A sincronização de contingência preserva `sincronizar_producao_atendimento`, sem criar fato clínico fictício.

## Internação / NIR

A alocação usa `BackgroundActionState` + `useActionState`; `movimentar_internacao_leito` continua autoridade final. A compatibilidade exibida é recomendação e não substitui a validação transacional.

## Centro Cirúrgico e CME

Agendamento/classificação ANS, transições, checklist, OPME, CME, múltiplos procedimentos/equipe, Anestesia/RPA e suprimentos usam feedback inline e RPCs canônicos. Medicamentos continuam no fluxo Prescrição → Farmácia → Dispensação → Administração.

## Regressão

A política global é protegida por `tests/unit/background-save-policy.test.ts`. Coberturas específicas incluem Enfermagem, Farmácia, LIS, RIS, GED, Centro Cirúrgico/CME, NIR, Ciclo da Receita e `tests/unit/tiss-xsd-ans-040300.test.ts`.

A conversão global continua incremental. Não declarar o HIS inteiro convertido enquanto existirem mutações legadas fora das exceções justificadas.
