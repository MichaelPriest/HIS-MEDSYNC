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
8. não mostrar sucesso otimista para operações clínicas, financeiras ou de estoque antes da confirmação do banco.

O contrato compartilhado está em `src/lib/actions/background-action.ts`, com `BackgroundActionState` (`idle | success | error`). Formulários interativos usam React 19 `useActionState` e feedback acessível por `aria-live`.

## Navegação permitida

Navegação automática só é válida quando representa uma transição real de trabalho. Exemplos preservados: check-in da Agenda para Admissão/Centro Cirúrgico, abertura do RA para a próxima etapa assistencial, tomada do paciente para o prontuário, criação confirmada de laudo LIS/RIS para abrir o editor e criação confirmada de conta/lote/recurso/NFS-e para abrir o respectivo workspace. Erro ou sucesso de uma gravação comum nunca é motivo suficiente para navegar.

Filtros e buscas que alteram deliberadamente a consulta podem continuar na URL. NIR, Faturamento, Guias, Lotes, Glosas, Recursos, Produção, Recebíveis e NFS-e usam parâmetros de consulta para filtros; sucesso/erro das mutações convertidas não dependem de query string.

## Módulos convertidos

- Prontuário: alta médica e avaliações interprofissionais.
- Agenda: criação e ações de confirmação/falta/conclusão/cancelamento; check-in navega apenas para a próxima etapa real.
- Admissão/Recepção: validações e falhas permanecem inline; após criação real do atendimento/RA, segue para Autorização ou Triagem.
- Triagem e Fila Médica: feedback inline; navegação somente em mudança assistencial real.
- Autorizações: identificação, validação e guia inline; próxima etapa só abre após operação confirmada.
- Enfermagem: evolução e administração à beira-leito sem reload, mantendo `registrar_administracao_beira_leito` como autoridade.
- Farmácia: conciliação, validação farmacêutica, dispensação FEFO principal/componentes e devolução, preservando RPCs, lotes e saldos.
- Laboratório/LIS: bancada, cadeia de custódia, resultados, validação, críticos e editor de laudo sem reload.
- Diagnóstico por Imagem/RIS: agenda, execução, contraste, dose e editor de laudos sem reload.
- GED: assinatura e status inline, com SHA-256 do arquivo privado validado antes de `assinar_documento_ged`.
- Internação/NIR: alocação de leito na fila regulatória inline, preservando filtros de consulta.
- Ciclo da Receita: abertura de conta, criação de lote TISS, abertura de recurso de glosa, criação de rascunho NFS-e e sincronização de contingência da produção usam `BackgroundActionState` + `useActionState`.

## Ciclo da Receita / Faturamento

O redesign do workspace unifica Contas, Produção, Guias TISS, Lotes, Glosas, Recursos, Recebíveis, NFS-e e Financeiro em uma mesma navegação operacional. As ações com maior frequência foram movidas para modais acessíveis, sem transformar o frontend em autoridade financeira.

### Abertura de conta

`abrirContaFaturamentoBackground` preserva o atendimento/RA como origem. Antes de criar, consulta se já existe conta para o atendimento; nesse caso, apenas abre a conta existente. Nova conta usa os dados reais do episódio, cobertura, convênio e plano e mantém o encaminhamento para Auditoria pós-alta. A navegação para `/faturamento/{contaId}` ocorre somente após a conta real existir.

### Lote TISS

`criarLoteTissBackground` continua usando exclusivamente `criar_lote_tiss_transacional`. Convênio, competência, elegibilidade das guias, versão TISS e previsão financeira permanecem sob validação do banco. Erros são exibidos no modal e não criam lote parcial. A abertura do detalhe acontece somente após o RPC retornar `lote_id`.

### Glosas e recursos

A Central de Glosas não mantém mais o formulário de recurso expandido em cada linha. `GlosaAppealModal` preserva valor e justificativa em caso de erro e `criarRecursoGlosaBackground` continua usando `criar_recurso_glosa_tiss_transacional`. Só após o banco retornar o identificador real do recurso o sistema abre `/faturamento/recursos/{id}`.

### NFS-e

A criação de rascunho fiscal usa `criarNfseLoteBackground` com o RPC `criar_nfse_lote_operacional`. O modal não confunde criação de rascunho com emissão: emissão automática continua condicionada à homologação do conector municipal/nacional e às regras do módulo NFS-e. Duplicidade ativa, lote elegível e composição de ISS/deduções continuam no banco.

### Produção

A sincronização de contingência saiu do formulário aberto da página e usa `sincronizarProducaoBackground`, preservando `sincronizar_producao_atendimento`. A operação não cria fato clínico fictício; reaplica captura idempotente sobre o episódio existente. O livro ganhou filtros de consulta sem converter filtro em mutação.

As baixas, conciliações, estornos e demais operações financeiras de detalhe que ainda usam actions legadas permanecem explicitamente fora desta conversão e devem ser migradas em pacotes próprios, preservando o ledger append-only e os RPCs financeiros.

## Internação / NIR

A alocação de leito usa `BackgroundActionState` + `useActionState` em cada paciente da fila. O RPC `movimentar_internacao_leito` continua como autoridade final; a compatibilidade calculada na tela é apenas recomendação de regulação e não substitui a validação transacional.

A transação do banco mantém lock da internação e do leito, status ativo da internação, disponibilidade/ocupação concorrente, escopo empresa/unidade, permissões, isolamento, restrição de sexo, acomodação e reserva específica do atendimento. Se o leito for reservado, somente a reserva ativa do mesmo atendimento pode ser consumida. Ao alocar, o banco ocupa o novo leito, consome a reserva quando aplicável, atualiza internação/atendimento e registra `movimentacoes_leitos`.

Após sucesso, NIR, painel da Internação, mapa de leitos e prontuário do atendimento são revalidados. Se outro operador ocupar o leito antes da confirmação, o conflito é mostrado inline e a tela não inventa uma alocação bem-sucedida.

## Centro Cirúrgico e CME

### Núcleo operacional

Agendamento/classificação ANS, transições, checklist de cirurgia segura, OPME, vínculo de ciclo CME liberado, movimentação para ala, múltiplos procedimentos, composição de equipe e início/fim de procedimentos usam feedback inline. Permanecem canônicos os RPCs do domínio Centro Cirúrgico já protegidos pelos testes específicos.

### Anestesia e RPA

O autosave usa Server Actions + `useActionState`, sem RPC direto no browser e sem `router.refresh()`. Os RPCs `centro_cirurgico_salvar_anestesia_operacional` e `centro_cirurgico_salvar_rpa_operacional` continuam como autoridade; horários/status exibidos são relidos do banco.

### Suprimentos

Requisição, recebimento, consumo físico por lote e estorno permanecem no workspace da cirurgia com `useActionState`. A baixa direta no ato cirúrgico continua proibida para medicamento: Prescrição → Farmácia → Dispensação → Administração.

### CME dedicada

Criação, atualização, conclusão, reprovação e liberação definitiva usam `cme_salvar_ciclo_operacional`; o banco continua responsável por permissão, escopo, status, indicadores, profissional responsável e imutabilidade após liberação.

## Regressão

A política global é protegida por `tests/unit/background-save-policy.test.ts`. Coberturas específicas incluem testes de Enfermagem, Farmácia, LIS, RIS, GED, Centro Cirúrgico/CME, NIR e `tests/unit/faturamento-redesign-workspace.test.ts`.

A conversão global do HIS continua incremental. Não declarar o sistema inteiro convertido enquanto existirem mutações legadas fora das exceções de navegação justificadas acima.
