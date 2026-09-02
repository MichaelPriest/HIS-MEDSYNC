# Estado real da implementação

Atualizado em 2026-09-01.

Este documento registra o estado **real confirmado** do MedSync HIS. A existência de rota, tabela, migration, teste automatizado ou deploy verde **não significa homologação hospitalar**. Homologação operacional depende de validação com setores, integrações externas e dados institucionais reais.

## Referência atual

- `main`: `b539a4e8b568cc3cfa6aa32d99cf593be22c0028`, merge da PR #115 — Base de Conhecimento pesquisável.
- A última produção confirmada continua sendo `c91d2ebccb1a549b9bae8db24b24c3d6877db04c`, merge da PR #113, em estado `READY`. O status Vercel do merge `b539a4e8...` falhou exclusivamente por build rate limit externo; não houve deployment de produção confirmado para esse merge SHA.
- PR #104 consolidou Agenda, Admissão/Recepção, Triagem e Fila Médica sem reload.
- PR #105 consolidou Autorizações sem reload.
- PR #106 consolidou Enfermagem sem reload, incluindo evolução e administração à beira-leito.
- PR #107 consolidou Farmácia sem reload, incluindo conciliação, validação farmacêutica, dispensação FEFO e devolução.
- PR #108 corrigiu a fila de Auditoria, separando pendências atuais de histórico resolvido e removendo feedback por reload.
- PR #109 corrigiu a liberação da Auditoria, o trigger de integração e a persistência da revalidação antes do handoff para Contas Médicas.
- PR #110 consolidou a bancada Laboratório/LIS sem reload: preparo de amostra, cadeia de custódia, encaminhamento, resultado, validação técnica e comunicação de crítico.
- PR #112 consolidou o editor de laudos Laboratório/LIS: abertura confirmada do editor, rascunho, validação, comunicação crítica, assinatura/liberação e retificação sem reload.
- PR #113 consolidou a operação do Diagnóstico por Imagem/RIS: agenda, transições da agenda, início/conclusão de execução, contraste e dose com feedback inline. CI #882 e Vercel do head final ficaram verdes; a produção do merge está `READY`.
- PR #115 consolidou a Base de Conhecimento pesquisável em `/manual`, com 17 guias operacionais, busca, categorias, público-alvo, passo a passo, alertas, links diretos e governança editorial. CI #886 e Vercel do head `2902113d...` ficaram verdes antes do merge; o deployment pós-merge da `main` foi bloqueado posteriormente pelo rate limit externo do Vercel.
- PR #116 é o pacote do editor/liberação de laudos RIS. O head final reconfirmado é `5489a5f52b9152bf6ac85eee157df2175702137e`; CI #891 terminou `success`, mas o check Vercel do mesmo SHA falhou exclusivamente por `Deployment rate limited — retry in 24 hours.`. Portanto a PR permanece aberta e não deve ser mesclada.
- PR #117 é o pacote de governança do GED, empilhado sobre a #116. O head final `d0f81642636a5baf0771f0928a9eb13794cf1c7c` passou o CI #892 completamente verde. O Vercel do mesmo SHA foi bloqueado exclusivamente por build rate limit externo; portanto a PR permanece aberta. Arquivar, reativar, cancelar e assinar documentos usam `BackgroundActionState` + `useActionState`; a assinatura continua recalculando SHA-256 do arquivo no Storage privado antes do RPC `assinar_documento_ged`, e alterações de status continuam no RPC `atualizar_status_documento_ged`.
- O pacote atual do Centro Cirúrgico está empilhado sobre a PR #117. O workspace principal e a tela de procedimentos/equipe estão sendo convertidos para salvamento inline: agendamento com classificação ANS, transições, checklist, OPME, vínculo CME liberado, movimentação para ala, inclusão de procedimentos, equipe e tempos de procedimento. Os RPCs canônicos foram preservados e não há migration/schema/RLS/RPC novo. Anestesia/RPA, Suprimentos e o workspace próprio da CME permanecem fora deste subpacote e serão tratados separadamente; seus fluxos legados não devem ser declarados convertidos ainda.
- PR #111 permanece aberta para o fallback comercial TUSS; a migration correspondente já consta no Supabase conectado e não deve ser confundida com merge/homologação da PR.

## Princípios arquiteturais obrigatórios

- O atendimento/RA e o prontuário longitudinal permanecem como eixo assistencial; módulos setoriais não criam fonte clínica concorrente.
- A Central de Pendências é **derivada**: detecta divergências e direciona responsáveis, mas não reescreve fatos para ocultar inconsistências.
- Escritas críticas usam operações transacionais no banco com autenticação, escopo empresa/unidade e RBAC. Não reabrir DML direto para contornar RLS/RPC.
- Medicamentos seguem `Prescrição → Farmácia → Dispensação → Administração`.
- Não criar pacientes, unidades, leitos, estoques, lotes, valores, autorizações, contas, glosas, NFS-e ou fatos clínicos fictícios para “completar” homologação.
- Migrations aplicadas no Supabase devem permanecer versionadas no GitHub; drift deve ser tratado explicitamente.
- Salvamentos normais devem usar feedback inline em segundo plano. `redirect()`, `window.location` e `router.refresh()` não devem ser usados apenas para mostrar sucesso/erro ou refletir gravação.
- A Base de Conhecimento ensina o fluxo implementado, mas não substitui protocolo institucional, treinamento clínico ou homologação externa.

## Estado por área

| Área | Estado confirmado | Próximos pontos críticos |
|---|---|---|
| Fundação / Auth / multiempresa | RBAC granular, contexto empresa/unidade, RLS/FORCE RLS, helpers de autorização e `BackgroundActionState` sustentam os módulos. | ampliar testes multi-tenant e break-glass clínico controlado |
| Recepção / Agenda / Autorizações / Triagem / Fila Médica | Fluxos principais foram consolidados sem reload pelas PRs #104 e #105. Navegação é preservada apenas para transições reais, como check-in, abertura do RA e entrada no prontuário. | Totem/senhas restantes, recorrência, lembretes e homologação de painel |
| Prontuário longitudinal | Resumo, histórico, anamnese/evolução, prescrição, documentos, LIS/RIS e cirurgia compartilham o episódio. Alta e avaliações médicas usam salvamento em segundo plano. | adendos, assinaturas adicionais, protocolos e homologação clínica |
| Farmácia / Enfermagem / medicamentos | FEFO, validação, dispensação, administração, devolução, lote, contingência sem etiqueta e dupla checagem estão integrados e os fluxos principais salvam inline. | saneamento rastreável do legado e homologação farmacêutica/assistencial |
| Laboratório / LIS | Bancada e editor de laudos estão consolidados sem reload pelas PRs #110 e #112, preservando RPCs de amostra, resultado, criticidade, validação, assinatura/liberação e retificação. | interfaces reais com analisadores, protocolos de bancada e homologação laboratorial |
| Diagnóstico por Imagem / RIS | A operação RIS foi consolidada sem reload na PR #113. A PR #116 converte também criação do laudo, rascunho, criticidade/comunicação, assinatura/liberação e retificação, preservando os RPCs de laudo e a integração PACS/DICOM já existente. | concluir gate Vercel/merge do editor, PACS/visualizador real e homologação por modalidade |
| Base de Conhecimento | A rota `/manual` foi consolidada pela PR #115 com busca por módulo/tarefa, filtros, público-alvo, passos, alertas e links diretos, referenciando manuais versionados existentes. | confirmar produção do merge quando o rate limit permitir, ampliar ajuda contextual, trilhas por setor e governança de revisão |
| GED | Storage privado, hash, versão, assinatura e vínculos com documentos/laudos estão disponíveis. A PR #117 converte assinatura e mudanças de status para feedback inline sem reload e mantém validação SHA-256/RPCs. | concluir gate Vercel/merge, retenção, temporalidade e ampliar demais mutações legadas |
| Centro Cirúrgico / CME | Agendamento, checklist, anestesia, RPA, equipe, procedimentos, OPME, CME e consumo/estorno integram o mesmo RA. O subpacote atual converte o núcleo do workspace e procedimentos/equipe para feedback inline, preservando RPCs e explicitando persistência parcial quando um adicional falha após o agendamento principal. | concluir gates do subpacote; depois converter Anestesia/RPA sem `router.refresh`, Suprimentos e workspace CME; homologação presencial, termos e protocolos locais |
| Compras / Almoxarifado / Estoque | Cotação, alçadas, pedido, recebimento, lote, saldo, inventário, reposição e transferências possuem operações transacionais. | alçadas reais, curva ABC, inventários e mutações legadas sem reload |
| Comercial / Contratos / Tabelas | Contratos, negociações, versões, itens, auditoria e AMB estruturada estão no workspace comercial. | referências reais, precificação e mapeamentos contratuais |
| Internação / NIR | Admissão/RA/leito, alta, censo e diárias estão integrados; transferências interunidades possuem base operacional. | homologação NIR, segunda unidade real e mutações restantes sem reload |
| Urgência / Emergência | Abertura/encerramento, prioridade, SLA, reavaliação e observação possuem fundação operacional. | concluir/sincronizar cadeia antiga de PRs quando os gates permitirem, parametrização real e homologação |
| Faturamento / TISS / Financeiro | Produção, conta, TISS, glosa/recurso, recebíveis, conciliação e NFS-e possuem fundações transacionais. | XSD/adapters reais, fechamento, precificação e homologação financeira/fiscal |
| Auditoria / Contas Médicas | Fila pós-alta, histórico resolvido, revalidação e handoff para Contas Médicas foram corrigidos nas PRs #108/#109. | homologar ciclo pós-alta ponta a ponta com operação real |
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
- `20260901225717_faturamento_fallback_comercial_tuss`

A lista do Supabase conectado é a referência para aplicação. A Base de Conhecimento e os pacotes de background saves do RIS, GED e Centro Cirúrgico não adicionam migration.

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
- bancada Laboratório/LIS: preparo de amostra, cadeia de custódia, encaminhamento, resultado, validação técnica e comunicação de crítico;
- editor de laudos Laboratório/LIS: abertura pós-criação confirmada, rascunho, validação, comunicação de crítico, assinatura/liberação e retificação inline;
- operação Diagnóstico por Imagem/RIS: agendamento, transições da agenda, início/conclusão de execução, contraste e dose;
- editor de laudos Diagnóstico por Imagem/RIS na PR #116: criação com navegação pós-confirmação, rascunho, criticidade/comunicação, assinatura/liberação e retificação inline;
- governança do GED na PR #117: arquivar, reativar, cancelar e assinar com feedback inline, preservando validação de integridade e RPCs;
- núcleo do Centro Cirúrgico no pacote atual: agendamento/classificação ANS, transições, checklist, OPME, vínculo CME, movimentação para ala, procedimentos e equipe. Anestesia/RPA, Suprimentos e o workspace CME permanecem pendentes de seus próprios pacotes.

Exceções de navegação permanecem somente quando representam mudança real de etapa. Em LIS e RIS, **Iniciar laudo** cria/confirma o laudo no banco e só então abre o editor pelo cliente.

## Gates e critério de merge

1. confirmar GitHub, Supabase e Vercel antes da escrita;
2. executar CI completo no SHA final;
3. verificar Vercel do **mesmo SHA final**;
4. revisar threads/reviews;
5. mesclar somente com gates verdes;
6. após merge, confirmar nova `main` e produção correspondente;
7. nunca usar preview de commit intermediário como gate de outro head.

Este status descreve maturidade técnica e integração confirmadas. **Não declara homologação hospitalar, clínica, TISS, financeira ou fiscal.**
