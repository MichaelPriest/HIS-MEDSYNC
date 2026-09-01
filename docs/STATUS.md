# Estado real da implementação

Atualizado em 2026-09-01.

Este documento registra o estado **real confirmado** do MedSync HIS. A existência de rota, tabela, migration, teste automatizado ou deploy verde **não significa homologação hospitalar**. Homologação operacional depende de validação com setores, integrações externas e dados institucionais reais.

## Referência atual

- `main`: `e5243e3ef5779c58e1b97fb4a2925ff29934fee8`, merge da PR #109.
- A produção anterior `4b5c21e3b615e77ac13c16283b6092a077438d1b` estava `READY`; o deployment de produção de `e5243e3e...` foi criado e estava `QUEUED` na última verificação deste pacote, portanto deve ser reconfirmado antes de qualquer nova promoção/merge.
- PR #104 consolidou Agenda, Admissão/Recepção, Triagem e Fila Médica sem reload.
- PR #105 consolidou Autorizações sem reload.
- PR #106 consolidou Enfermagem sem reload, incluindo evolução e administração à beira-leito.
- PR #107 consolidou Farmácia sem reload, incluindo conciliação, validação farmacêutica, dispensação FEFO e devolução.
- PR #108 publicou a correção da fila de Auditoria, separando pendências atuais de histórico resolvido e removendo feedback por reload.
- PR #109 corrigiu a liberação da Auditoria, o trigger de integração e a persistência da revalidação antes da liberação para Contas Médicas. CI #875 e preview Vercel do head `dc7fc8fa...` ficaram verdes antes do merge.
- O pacote atual reconstrói a bancada Laboratório/LIS diretamente sobre a `main` atual, sem migration e sem alterações de schema.

## Princípios arquiteturais obrigatórios

- O atendimento/RA e o prontuário longitudinal permanecem como eixo assistencial; módulos setoriais não criam fonte clínica concorrente.
- A Central de Pendências é **derivada**: detecta divergências e direciona responsáveis, mas não reescreve fatos para ocultar inconsistências.
- Escritas críticas usam operações transacionais no banco com autenticação, escopo empresa/unidade e RBAC. Não reabrir DML direto para contornar RLS/RPC.
- Medicamentos seguem `Prescrição → Farmácia → Dispensação → Administração`.
- Não criar pacientes, unidades, leitos, estoques, lotes, valores, autorizações, contas, glosas, NFS-e ou fatos clínicos fictícios para “completar” homologação.
- Migrations aplicadas no Supabase devem permanecer versionadas no GitHub; drift deve ser tratado explicitamente.
- Salvamentos normais devem usar feedback inline em segundo plano. `redirect()`, `window.location` e `router.refresh()` não devem ser usados apenas para mostrar sucesso/erro ou refletir gravação.

## Estado por área

| Área | Estado confirmado | Próximos pontos críticos |
|---|---|---|
| Fundação / Auth / multiempresa | RBAC granular, contexto empresa/unidade, RLS/FORCE RLS, helpers de autorização e `BackgroundActionState` sustentam os módulos. | ampliar testes multi-tenant e break-glass clínico controlado |
| Recepção / Agenda / Autorizações / Triagem / Fila Médica | Fluxos principais foram consolidados sem reload pelas PRs #104 e #105. Navegação é preservada apenas para transições reais, como check-in, abertura do RA e entrada no prontuário. | Totem/senhas restantes, recorrência, lembretes e homologação de painel |
| Prontuário longitudinal | Resumo, histórico, anamnese/evolução, prescrição, documentos, LIS/RIS e cirurgia compartilham o episódio. Alta e avaliações médicas usam salvamento em segundo plano. | adendos, assinaturas adicionais, protocolos e homologação clínica |
| Farmácia / Enfermagem / medicamentos | FEFO, validação, dispensação, administração, devolução, lote, contingência sem etiqueta e dupla checagem estão integrados e os fluxos principais salvam inline. | saneamento rastreável do legado e homologação farmacêutica/assistencial |
| Laboratório / LIS | Pedido, accession, cadeia de custódia, resultados, críticos, validação e laudo longitudinal existem. No pacote atual, preparo de amostra, status/cadeia, encaminhamento, registro de resultado, validação técnica e comunicação de crítico usam `useActionState` sem reload. | migrar editor/liberação/retificação de laudos, interfaces reais com analisadores, protocolos de bancada e homologação laboratorial |
| Diagnóstico por Imagem / RIS | Pedido, agenda, execução, dose/contraste, DICOM/PACS hooks, laudo, retificação e críticos estão integrados. | PACS/visualizador real e migração das mutações legadas sem reload |
| GED | Storage privado, hash, versão, assinatura e vínculos com documentos/laudos estão disponíveis. | retenção, temporalidade e revisão de mutações legadas |
| Centro Cirúrgico / CME | Agendamento, checklist, anestesia, RPA, equipe, procedimentos, OPME, CME e consumo/estorno integram o mesmo RA. | homologação presencial, termos e protocolos locais |
| Compras / Almoxarifado / Estoque | Cotação, alçadas, pedido, recebimento, lote, saldo, inventário, reposição e transferências possuem operações transacionais. | alçadas reais, curva ABC, inventários e mutações legadas sem reload |
| Comercial / Contratos / Tabelas | Contratos, negociações, versões, itens, auditoria e AMB estruturada estão no workspace comercial. | referências reais, precificação e mapeamentos contratuais |
| Internação / NIR | Admissão/RA/leito, alta, censo e diárias estão integrados; transferências interunidades possuem base operacional. | homologação NIR, segunda unidade real e mutações restantes sem reload |
| Urgência / Emergência | Abertura/encerramento, prioridade, SLA, reavaliação e observação possuem fundação operacional. | concluir cadeia de PRs #91/#92, parametrização real e homologação |
| Faturamento / TISS / Financeiro | Produção, conta, TISS, glosa/recurso, recebíveis, conciliação e NFS-e possuem fundações transacionais. | XSD/adapters reais, fechamento, precificação e homologação financeira/fiscal |
| Auditoria / Contas Médicas | Fila pós-alta, histórico resolvido, revalidação e handoff para Contas Médicas foram corrigidos nas PRs #108/#109. A migration `20260901223840_auditoria_trigger_liberacao_finalizado_em` está aplicada. | confirmar produção do merge #109 e homologar ciclo pós-alta ponta a ponta |
| RH / Segurança / TI / Engenharia Clínica | Workspaces e fundações setoriais existem em níveis diferentes de completude. | evoluir fluxos completos e integrações reais |

## Supabase — migrations recentes confirmadas

Além das migrations históricas, o banco conectado contém entre as mais recentes:

- `20260830005304_internacao_censo_diarias_operacional`
- `20260830005630_internacao_censo_sincronizar_movimentacao_leito`
- `20260830005713_internacao_censo_movimentacao_leito_deterministica`
- `20260830012951_internacao_transferencia_interunidades_operacional`
- `20260830013036_internacao_transferencia_cnes_destino`
- `20260830023008_internacao_transferencia_reserva_leito_hardening`
- `20260830023525_internacao_transferencia_destinos_operacionais`
- `20260830023629_internacao_transferencia_fila_operacional`
- `20260830191401_urgencia_transicoes_operacionais`
- `20260830195047_urgencia_sla_reavaliacao_operacional`
- `20260830212736_urgencia_observacao_operacional`
- `20260830230050_urgencia_parametrizacao_sla_institucional`
- `20260830231419_urgencia_sla_historico_longitudinal`
- `20260831035056_auditoria_autorizacao_unificada`
- `20260901223840_auditoria_trigger_liberacao_finalizado_em`

A lista do Supabase conectado é a referência para aplicação. O pacote atual do Laboratório não adiciona migration.

## Salvamentos em segundo plano — estado da migração

A política está documentada em `docs/architecture/background-saves.md` e protegida por testes unitários por módulo.

Já convertidos e protegidos contra regressão:

- alta médica e avaliações médicas;
- Agenda;
- validações/falhas da Admissão;
- Triagem;
- Fila Médica;
- Autorizações;
- evolução e administração de Enfermagem;
- conciliação, validação farmacêutica, dispensação FEFO e devolução na Farmácia;
- bancada Laboratório/LIS: preparo de amostra, cadeia de custódia, encaminhamento, resultado, validação técnica e comunicação de crítico.

Exceções de navegação permanecem somente quando representam mudança real de etapa. No Laboratório, abrir um laudo novo pode levar ao editor; salvar, validar, liberar ou retificar dentro do editor deve ser migrado separadamente para feedback inline.

## Gates e critério de merge

1. confirmar GitHub, Supabase e Vercel antes da escrita;
2. executar CI completo no SHA final;
3. verificar Vercel do **mesmo SHA final**;
4. revisar threads/reviews;
5. mesclar somente com gates verdes;
6. após merge, confirmar nova `main` e produção correspondente;
7. nunca usar preview de commit intermediário como gate de outro head.

Este status descreve maturidade técnica e integração confirmadas. **Não declara homologação hospitalar, clínica, TISS, financeira ou fiscal.**
