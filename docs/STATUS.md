# Estado real da implementação

Atualizado em 2026-08-30.

Este documento registra o estado **real confirmado** do MedSync HIS. A existência de rota, tabela, migration, teste automatizado ou deploy verde **não significa homologação hospitalar**. Homologação operacional continua dependendo de validação com os setores, integrações externas e dados institucionais reais.

## Referência atual

- `main` confirmada antes desta atualização: `ab623449e498efaccd5de97e02d79374f934ee81`, merge do PR #87.
- A produção Vercel desse mesmo SHA estava `READY`.
- A cadeia que começou nos PRs #80 → #81 → #82 → #83 já foi consolidada: #80 e #81 foram mesclados; #82 foi fechado como superseded; #83 foi corrigido, validado e mesclado.
- O erro de Next.js 16 do PR #83 em `src/modules/tiss/lote-financeiro-actions.ts` foi resolvido mantendo o anexo de documentos por uma server action `async` explícita; não existe mais a reexportação inválida em arquivo `"use server"`.
- PR #84 (censo/diárias de internação), PR #86 (transições de Urgência) e PR #87 (SLA/reavaliação de Urgência) já foram mesclados.
- O pacote de transferências interunidades originado no PR #85 está implementado e sincronizado com a `main` atual. Seu merge só pode ocorrer com CI e Vercel verdes no **mesmo SHA final**.

## Princípios arquiteturais obrigatórios

- O atendimento/RA e o prontuário longitudinal permanecem como eixo assistencial; módulos setoriais não criam uma segunda fonte clínica concorrente.
- A Central de Pendências é **derivada**: detecta divergências e direciona responsáveis, mas não reescreve fatos de prontuário, estoque, laudo, cirurgia, TISS ou financeiro para ocultar inconsistências.
- Escritas críticas usam operações transacionais no banco com autenticação, escopo de empresa/unidade e RBAC. Não reabrir `INSERT/UPDATE/DELETE` direto no cliente para contornar RLS/RPC.
- Medicamentos continuam obrigatoriamente no fluxo `Prescrição → Farmácia → Dispensação → Administração`; consumo cirúrgico direto não substitui esse ciclo.
- Não criar pacientes, unidades, leitos, estoques, lotes, valores, autorizações, contas, glosas, NFS-e ou fatos clínicos fictícios para “completar” cenário de homologação.
- Migrations aplicadas no Supabase devem permanecer versionadas no repositório; drift entre banco e GitHub deve ser tratado explicitamente.

## Estado por área

| Área | Estado confirmado | Próximos pontos críticos |
|---|---|---|
| Fundação / Auth / multiempresa | RBAC granular, contexto empresa/unidade, perfis, navegação setorial, RLS/FORCE RLS e helpers de autorização já sustentam os módulos operacionais. | ampliar testes multi-tenant, break-glass clínico controlado e continuar hardening dos RPCs legados apontados pelos Advisors |
| Navegação / Central Assistencial | Navegação organizada por macroárea e perfil; `/integracoes` concentra pendências intersetoriais sem virar fonte de dados. | homologar usabilidade por perfil real e melhorar acessibilidade/atalhos |
| Recepção / Totem / Agenda | Totem/senhas, recepção, check-in e agenda possuem bases operacionais integradas ao atendimento. | SLA, recorrência, disponibilidade, lembretes, impressão e homologação do painel de chamada |
| Prontuário longitudinal | Resumo, histórico, anamnese/evolução com autosave, prescrição, documentos, LIS/RIS e cirurgia compartilham o episódio. Impressão clínica e rascunho único foram endurecidos. | adendos/assinaturas adicionais, protocolos e homologação clínica/regulatória |
| Farmácia / Enfermagem / medicamentos | FEFO, validação, dispensação, administração, devolução, estoque e produção estão correlacionados pela integração ponta a ponta. Divergências históricas não são corrigidas artificialmente. | saneamento rastreável do legado, regras clínicas adicionais e homologação farmacêutica/assistencial |
| Laboratório / LIS | Pedido, accession, coleta, cadeia de custódia, resultados, críticos, validação e laudo longitudinal estão implementados; anexos GED podem acompanhar laudos liberados. | interfaces reais com equipamentos, protocolos de bancada e homologação laboratorial |
| Diagnóstico por Imagem / RIS | Pedido, agenda, execução, dose/contraste, identificadores DICOM/PACS, laudo, retificação e críticos estão integrados ao prontuário. | PACS/visualizador real, storage DICOM e homologação radiológica |
| GED | Storage privado, upload assinado, hash, versão, assinatura e vínculo com documentos/laudos estão disponíveis sob autorização setorial. | temporalidade, retenção/descarte e política documental institucional |
| Centro Cirúrgico / CME | Fluxo transacional de agendamento, checklist, anestesia, RPA, equipe ampliada, múltiplos procedimentos, OPME, CME, suprimentos por lote, consumo/estorno e produção está integrado ao mesmo RA. | homologação presencial, estoque satélite real quando existir, impressos/termos e protocolos locais |
| Compras / Almoxarifado / Estoque | Cotação MATMED, alçadas configuráveis, pedido, recebimento, lote, saldo, inventário, reposição e transferências físicas possuem operações transacionais. Nenhuma alçada monetária institucional foi inventada. | parametrizar alçadas reais, curva ABC/planejamento, inventários cíclicos e saneamento de divergências históricas |
| Comercial / Contratos / Tabelas | Contratos, negociações, edições imutáveis/versionadas, itens, auditoria e importação AMB estruturada estão no workspace comercial. | revisar contratos reais, vínculos sem itens, novas bases licenciadas e precificação contratual |
| Internação / NIR | Admissão é transacional; internação/RA/leito são coordenados; alta preserva o fato clínico mesmo se faturamento falhar; censo factual e diária idempotente foram adicionados no PR #84. | concluir merge/gates do pacote interunidades, homologar NIR e validar giro/ocupação com operação real |
| Transferências interunidades | Fluxo `origem → solicitação NIR → decisão destino → leito destino → novo atendimento/RA + internação destino → continuidade longitudinal` implementado com RPCs, reserva de leito e fila enriquecida. O ambiente conectado possui apenas **uma unidade ativa**, portanto não há destino real para homologação interunidades e nenhuma unidade fictícia foi criada. | validar o fluxo completo quando existir segunda unidade institucional real; manter RBAC/RLS e vínculo longitudinal |
| Urgência / Emergência | PR #86 tornou abertura/encerramento transacionais com unicidade e auditoria. PR #87 acrescentou prioridade, SLA institucional configurável, reavaliação operacional e fila derivada, sem hardcode de tempos clínicos. | parametrizar SLA institucional real, protocolos locais, observação, indicadores e homologação |
| Faturamento / Livro de Produção | Produção assistencial está integrada a cirurgia, internação, medicamentos e conta. Falhas pós-alta viram pendência em vez de desfazer a alta clínica. | ampliar fechamento/precificação e homologar ciclo de conta com faturamento real |
| TISS | Guia + itens, lote, protocolo, glosa e recurso possuem RPCs transacionais e validação anti-glosa. A anomalia histórica global sem tenant confiável foi preservada tecnicamente em vez de receber escopo inventado. | XSD oficial por versão/tipo, XML definitivo, adapters/retornos reais das operadoras e homologação TISS |
| Financeiro / NFS-e | PR #83 integrou recebível, baixa parcial/total, retenções/tarifas, conciliação, estorno auditável e NFS-e com RBAC. Mutações críticas do lote TISS deixaram de usar DML financeiro direto. Migration posterior adicionou contas a pagar/caixa operacional. | adapters NFS-e reais, conciliação bancária/retornos, fechamento financeiro e homologação com processos reais |
| RH / Segurança / TI / Engenharia Clínica | Workspaces e fundações setoriais existem, com níveis de completude diferentes. | evoluir fluxos completos, integrações de dispositivos/ativos e homologação por setor |

## Supabase — migrations recentes confirmadas

Além das migrations históricas já versionadas, o projeto conectado contém, entre outras, as seguintes etapas recentes:

- `20260828182501_centro_cirurgico_consumo_estoque_operacional`
- `20260828183329_centro_cirurgico_consumo_catalogo_legado`
- `20260828183446_centro_cirurgico_producao_consumo_canonica`
- `20260828194919_integracao_internacao_ponta_a_ponta`
- `20260828202327_internacao_admissao_leito_internal_paridade`
- `20260828212958_integracao_faturamento_tiss_ponta_a_ponta`
- `20260828213116_faturamento_tiss_protocolo_glosa_recurso_transacional`
- `20260828220121_financeiro_recebimentos_conciliacao_nfse_hardening`
- `20260828221406_financeiro_lote_tiss_mutacoes_transacionais`
- `20260829224450_tiss_operacoes_manuais_transacionais`
- `20260829234859_financeiro_contas_pagar_caixa_operacional`
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

A lista do banco é a referência para confirmar aplicação; nomes/versões descritos em PRs antigos não substituem o estado conectado atual.

## Transferências interunidades — garantias atuais

O pacote do PR #85 usa os RPCs `solicitar_transferencia_interunidade`, `aceitar_transferencia_interunidade`, `recusar_transferencia_interunidade` e `cancelar_transferencia_interunidade`, além das consultas operacionais de destinos e fila. A tabela de transferências e esses RPCs foram confirmados no Supabase conectado.

Uma reserva ativa de leito para outro atendimento bloqueia ocupação concorrente; reserva compatível é consumida no aceite. A unidade de destino recebe somente a visão operacional necessária, sem liberar globalmente o prontuário da origem. O aceite preserva a continuidade longitudinal por vínculo explícito entre segmento de origem e novo atendimento/RA/internação destino.

No estado conectado de 2026-08-30 há **uma única unidade ativa**. Por isso o software pode ser validado estrutural/transacionalmente, mas o fluxo interunidades completo ainda **não pode ser homologado com destino institucional real**.

## Gates e critério de merge

Para qualquer PR operacional:

1. confirmar o estado real de GitHub, Supabase e Vercel antes da escrita;
2. executar CI completo no SHA final;
3. verificar o deployment Vercel do **mesmo SHA final**;
4. corrigir erros reais e revisar reviews/threads;
5. somente mesclar quando os gates aplicáveis estiverem verdes;
6. após merge, confirmar a nova `main` e o deployment de produção correspondente;
7. nunca usar preview de commit intermediário como gate de um head diferente.

Este status descreve maturidade técnica e integração confirmadas. **Não declara homologação hospitalar, clínica, TISS, financeira ou fiscal.**
