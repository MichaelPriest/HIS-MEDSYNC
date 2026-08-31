# Estado real da implementação

Atualizado em 2026-08-31.

Este documento registra o estado **real confirmado** do MedSync HIS. A existência de rota, tabela, migration, teste automatizado ou deploy verde **não significa homologação hospitalar**. Homologação operacional continua dependendo de validação com os setores, integrações externas e dados institucionais reais.

## Referência atual

- `main` confirmada antes deste pacote: `845771fa4795cc56a99931dfebaf281250bf5bbe`, merge do PR #95.
- A produção Vercel desse mesmo SHA estava `READY`, e o CI pós-merge #843 estava verde.
- O PR #95 estabeleceu a política global de salvamentos em segundo plano e converteu alta médica e solicitação de avaliação médica.
- O pacote de Agenda está no PR #96 e permanece fora da `main` enquanto não houver CI + Vercel verdes no mesmo SHA final.
- O Supabase conectado está saudável e possui a migration `20260831035056_auditoria_autorizacao_unificada` aplicada. Este pacote de Auditoria versiona essa mesma migration no Git, sem reaplicá-la.
- O pacote atual de Auditoria substitui a abordagem antiga do PR #94 por uma branch limpa sobre a `main`: mantém a revalidação transacional antes da liberação, reconhece autorização válida de `central_guias` ou `autorizacoes_atendimento`, separa pendências atuais do histórico resolvido e converte as ações da tela para feedback inline sem reload.

## Princípios arquiteturais obrigatórios

- O atendimento/RA e o prontuário longitudinal permanecem como eixo assistencial; módulos setoriais não criam uma segunda fonte clínica concorrente.
- A Central de Pendências é **derivada**: detecta divergências e direciona responsáveis, mas não reescreve fatos de prontuário, estoque, laudo, cirurgia, TISS ou financeiro para ocultar inconsistências.
- Escritas críticas usam autenticação, escopo de empresa/unidade, RBAC e, quando aplicável, RPC transacional no banco.
- Medicamentos continuam obrigatoriamente no fluxo `Prescrição → Farmácia → Dispensação → Administração`; consumo cirúrgico direto não substitui esse ciclo.
- Não criar pacientes, unidades, leitos, estoques, lotes, valores, autorizações, contas, glosas, NFS-e ou fatos clínicos fictícios para “completar” cenário de homologação.
- Migrations aplicadas no Supabase devem permanecer versionadas no repositório; drift entre banco e GitHub deve ser tratado explicitamente.
- Salvamentos e mutações operacionais normais devem usar feedback inline em segundo plano. `redirect()`, `window.location` e `router.refresh()` não devem ser usados apenas para exibir sucesso/erro ou refletir uma gravação; navegação continua permitida quando é a própria próxima etapa do fluxo.

## Estado por área

| Área | Estado confirmado | Próximos pontos críticos |
|---|---|---|
| Fundação / Auth / multiempresa | RBAC granular, contexto empresa/unidade, perfis, navegação setorial, RLS/FORCE RLS e fundação `BackgroundActionState` + React 19 `useActionState`. | ampliar testes multi-tenant, break-glass controlado e continuar migração das ações legadas sem reload |
| Recepção / Totem / Agenda | Totem/senhas, recepção, check-in e agenda integram o atendimento. O PR #96 contém a conversão da Agenda para feedback inline, ainda não mesclada. | concluir gates do PR #96; concluir pacote de Admissão/Recepção; recorrência, disponibilidade e lembretes |
| Prontuário longitudinal | Resumo, histórico, anamnese/evolução, prescrição, documentos, LIS/RIS e cirurgia compartilham o episódio. Alta e solicitação de avaliação médica já salvam sem reload. | adendos/assinaturas adicionais, protocolos e migração das ações legadas restantes |
| Farmácia / Enfermagem / medicamentos | FEFO, validação, dispensação, administração, devolução, estoque e produção estão integrados. | saneamento rastreável, regras clínicas adicionais e migração das mutações legadas sem reload |
| Laboratório / LIS | Pedido, coleta, cadeia de custódia, resultados, críticos, validação e laudo longitudinal implementados. | interfaces reais com equipamentos, protocolos de bancada e homologação |
| Diagnóstico por Imagem / RIS | Pedido, agenda, execução, dose/contraste, DICOM/PACS hooks, laudo e retificação integrados ao prontuário. | PACS/visualizador real, storage DICOM e homologação |
| GED | Storage privado, upload, hash, versão, assinatura e vínculo com documentos/laudos disponíveis. | temporalidade, retenção/descarte e política documental institucional |
| Centro Cirúrgico / CME | Agendamento, equipe ampliada, anestesia, RPA, múltiplos procedimentos, OPME, CME, consumo/estorno e produção integrados ao mesmo RA. | homologação presencial, protocolos e impressos |
| Compras / Almoxarifado / Estoque | Cotação, alçadas configuráveis, pedido, recebimento, lote, saldo, inventário, reposição e transferências físicas possuem operações transacionais. | parametrizar alçadas reais, curva ABC, inventários cíclicos e migrar mutações legadas sem reload |
| Internação / NIR | Admissão, internação/RA/leito, alta, censo e diária idempotente possuem fundação operacional; transferências interunidades estão implementadas. | homologar NIR e fluxo interunidades quando existir segunda unidade institucional real |
| Urgência / Emergência | Abertura/encerramento transacionais, prioridade, SLA, reavaliação, observação e histórico longitudinal de SLA possuem fundação versionada no banco. | parametrizar SLA institucional real, protocolos, indicadores e homologação |
| Faturamento / Livro de Produção | Produção assistencial integrada a cirurgia, internação, medicamentos e conta. Falhas pós-alta viram pendência em vez de desfazer a alta clínica. | ampliar fechamento/precificação e homologar ciclo real |
| Auditoria / Contas Médicas | Auditoria pós-alta possui motor automático e RPC transacional de liberação. O pacote atual corrige a fila para mostrar apenas pendências abertas, agrupa histórico resolvido, evita “duplicados” visuais, reconhece autorização válida nas duas fontes e converte executar/iniciar/adicionar/resolver/reabrir/liberar para feedback inline. | validar CI/Vercel do pacote; depois homologar Auditoria → Contas Médicas → TISS ponta a ponta com dados reais |
| TISS | Guia + itens, lote, protocolo, glosa e recurso possuem RPCs transacionais e validação anti-glosa. | XSD oficial por versão/tipo, XML definitivo e adapters reais das operadoras |
| Financeiro / NFS-e | Recebível, baixa, retenções/tarifas, conciliação, estorno e NFS-e possuem fundação com RBAC. | adapters NFS-e reais, conciliação bancária e fechamento financeiro |
| RH / Segurança / TI / Engenharia Clínica | Workspaces e fundações setoriais existem com níveis de completude diferentes. | evoluir fluxos completos e homologar por setor |

## Supabase — migrations recentes confirmadas

Entre as etapas recentes do banco conectado estão:

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

A lista do banco é a referência para confirmar aplicação. O arquivo `20260831035056_auditoria_autorizacao_unificada.sql` neste pacote espelha a migration já aplicada e não deve ser reaplicado manualmente fora do fluxo normal de migration tracking.

## Auditoria — garantias deste pacote

- Pendências atuais são somente registros `resolvida = false`.
- Histórico resolvido permanece auditável, mas execuções repetidas da mesma regra automática são agrupadas visualmente.
- Críticas automáticas resolvidas não recebem ação manual de “reabrir”; uma nova execução do motor decide se a condição voltou a existir.
- Pendências manuais resolvidas continuam podendo ser reabertas.
- `liberar_auditoria_conta` continua sendo a autoridade final: reexecuta o motor e só libera quando não existem `erro`/`bloqueio` atuais.
- A tela não transforma qualquer erro técnico em “pendências”; erros de permissão, sessão e bloqueio por pendência são diferenciados.
- Executar, iniciar, adicionar pendência, resolver, reabrir e liberar usam `useActionState`/`BackgroundActionState`, sem query string usada como feedback de salvamento.

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
