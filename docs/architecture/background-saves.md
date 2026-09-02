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

Navegação automática só é válida quando representa uma transição real de trabalho. Exemplos já preservados: check-in da Agenda para Admissão/Centro Cirúrgico, abertura do RA para a próxima etapa assistencial, tomada do paciente para o prontuário e criação confirmada de um novo laudo LIS/RIS para abrir o editor. Erro ou sucesso de uma gravação comum nunca é motivo suficiente para navegar.

## Módulos convertidos

- Prontuário: alta médica e avaliações interprofissionais.
- Agenda: criação e ações de confirmação/falta/conclusão/cancelamento; check-in navega apenas para a próxima etapa real.
- Admissão/Recepção: validações e falhas permanecem inline; após criação real do atendimento/RA, segue para Autorização ou Triagem.
- Triagem e Fila Médica: feedback inline; navegação somente em mudança assistencial real.
- Autorizações: identificação, validação e guia inline; próxima etapa só abre após operação confirmada.
- Enfermagem: evolução e administração à beira-leito sem reload, mantendo `registrar_administracao_beira_leito` como autoridade.
- Farmácia: conciliação, validação farmacêutica, dispensação FEFO principal/componentes e devolução, preservando RPCs, lotes e saldos.
- Laboratório/LIS: bancada, cadeia de custódia, resultados, validação, críticos e editor de laudo sem reload; criação do laudo pode abrir o editor após confirmação.
- Diagnóstico por Imagem/RIS: agenda, execução, contraste, dose e editor de laudos sem reload; criação do laudo pode abrir o editor após confirmação.
- GED: assinatura e status inline, com SHA-256 do arquivo privado validado antes de `assinar_documento_ged`.

## Centro Cirúrgico e CME

### Núcleo operacional

Agendamento/classificação ANS, transições, checklist de cirurgia segura, OPME, vínculo de ciclo CME liberado, movimentação para ala, múltiplos procedimentos, composição de equipe e início/fim de procedimentos usam feedback inline. Permanecem canônicos os RPCs `centro_cirurgico_classificar_internacao_ans`, `centro_cirurgico_agendar_operacional`, `centro_cirurgico_transicionar_operacional`, `centro_cirurgico_salvar_checklist_operacional`, `centro_cirurgico_registrar_opme_operacional`, `centro_cirurgico_vincular_ciclo_cme_operacional`, `centro_cirurgico_movimentar_para_ala_operacional`, `centro_cirurgico_adicionar_procedimento_operacional`, `centro_cirurgico_salvar_membro_equipe_operacional` e `centro_cirurgico_acionar_procedimento_operacional`.

Se o agendamento principal for confirmado e um procedimento adicional falhar, a interface informa persistência parcial e mantém a cirurgia disponível para correção; não apresenta a operação inteira como se tivesse falhado.

### Anestesia e RPA

O autosave continua com debounce de 1,2 segundo, agora por Server Actions + `useActionState`, sem RPC direto no browser e sem `router.refresh()`. Os RPCs `centro_cirurgico_salvar_anestesia_operacional` e `centro_cirurgico_salvar_rpa_operacional` continuam como autoridade. Início/fim da anestesia e alta da RPA usam `inicio_em`, `fim_em`, `status` e `alta_em` relidos do banco, em vez de fabricar horários locais. Rascunhos automáticos não executam `revalidatePath` a cada ciclo; a revalidação ocorre nas transições temporais reais.

### Suprimentos

Requisição, confirmação de recebimento, consumo físico por lote e estorno permanecem no workspace da cirurgia com `useActionState` e feedback inline. Continuam canônicos `centro_cirurgico_requisitar_suprimentos_operacional`, `centro_cirurgico_receber_suprimentos_operacional`, `centro_cirurgico_consumir_suprimento_operacional` e `centro_cirurgico_estornar_consumo_operacional`.

A requisição pode conter material, OPME, medicamento e gás medicinal porque a separação permanece setorial. A **baixa direta no ato cirúrgico continua proibida para medicamento**: medicamento segue Prescrição → Farmácia → Dispensação → Administração. Consumo direto continua restrito a material, OPME e gás medicinal, exige cirurgia em andamento, lote real disponível, validade e saldo. Vínculo com item de requisição respeita produto/local/quantidade atendida. OPME preserva catálogo, série única e estorno integral. Após conclusão/cancelamento, estorno continua exigindo Auditoria. Nenhum lote, saldo, local ou produto fictício é criado pela interface.

### CME dedicada

Criação, atualização, conclusão, reprovação e liberação definitiva de ciclos permanecem no workspace CME com `useActionState`. O RPC `cme_salvar_ciclo_operacional` continua como única autoridade de escrita para permissão `cme.gerenciar`, escopo empresa/unidade, status, indicadores, profissional responsável e imutabilidade após liberação.

A interface mantém as validações anteriores: liberação exige resultado técnico e pelo menos um indicador marcado como conforme. Após o RPC, a camada de servidor relê `status`, `inicio_em`, `fim_em` e `liberado_em`; o formulário só apresenta liberação definitiva e bloqueia novas edições quando o estado persistido confirma `liberado`. Ciclos já liberados continuam protegidos também pelo banco. Para novos ciclos, o formulário é limpo apenas após criação confirmada. Não há redirect/query string para feedback e não há schema ou RPC novo.

Com este pacote, os workspaces Centro Cirúrgico/CME mapeados nesta frente deixam de ter mutações de feedback por reload. Isso **não** representa homologação presencial dos protocolos, equipamentos, indicadores ou rotinas locais.

## Regressão

A política global é protegida por `tests/unit/background-save-policy.test.ts`. Coberturas específicas incluem:

- `tests/unit/enfermagem-background-saves.test.ts`;
- `tests/unit/farmacia-background-actions.test.ts`;
- `tests/unit/laboratorio-background-saves.test.ts`;
- `tests/unit/laboratorio-laudo-background-saves.test.ts`;
- `tests/unit/imagem-background-saves.test.ts`;
- `tests/unit/imagem-laudo-background-saves.test.ts`;
- `tests/unit/ged-background-saves.test.ts`;
- `tests/unit/centro-cirurgico-background-saves.test.ts`;
- `tests/unit/centro-cirurgico-anestesia-rpa-background-saves.test.ts`;
- `tests/unit/centro-cirurgico-suprimentos-background-saves.test.ts`;
- `tests/unit/centro-cirurgico-cme-background-saves.test.ts`.

A conversão global do HIS continua incremental. Não declarar o sistema inteiro convertido enquanto existirem mutações legadas fora das exceções de navegação justificadas acima.
