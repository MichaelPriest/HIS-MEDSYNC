# Estado real da implementação

Atualizado em 2026-08-31.

Este documento registra o estado **real confirmado** do MedSync HIS. A existência de rota, tabela, migration, teste automatizado ou deploy verde **não significa homologação hospitalar**. Homologação operacional continua dependendo de validação com os setores, integrações externas e dados institucionais reais.

## Referência atual

- `main`: `9af0ecbfec2306404da31a7606e838d517d8ebc5`, merge do PR #90 — alinhamento do nome versionado da migration de SLA com o histórico real do Supabase.
- O CI pós-merge #835 da mesma `main` ficou verde, incluindo lint, typecheck, testes, build, Chromium, smoke E2E público e E2E autenticado.
- O deployment Vercel de **produção** do mesmo SHA `9af0ecbf...` ficou `READY`.
- PR #93 foi mesclada antes da #90 e corrigiu a tela `/auditoria`: o PostgREST retornava HTTP 300 por relação ambígua entre `auditoria_contas` e `contas_faturamento`, e a tela tratava a falha como fila vazia. A consulta agora explicita `auditoria_contas_conta_id_fkey` e não oculta erros de carregamento.
- PRs #80, #81, #83, #84, #85, #86, #87, #90 e #93 estão mescladas; #82 foi fechada como superseded.
- PR #88 (Observação da Urgência) continua aberta; PR #89 (indicadores operacionais) permanece empilhada sobre #88.
- Pacote atual em validação: PR #91 — parametrização institucional versionada de SLA da Urgência, reconstruída sobre a `main` atual sem carregar novamente o histórico da #90.
- PR #92 — histórico longitudinal factual das aplicações de SLA — permanece empilhada sobre #91 e deve ser sincronizada somente depois da #91.

## Princípios arquiteturais obrigatórios

- Atendimento/RA e prontuário longitudinal permanecem como eixo assistencial; módulos setoriais não criam uma segunda fonte clínica concorrente.
- A Central de Pendências é **derivada**: detecta divergências e direciona responsáveis, mas não reescreve fatos das fontes para ocultar inconsistências.
- Escritas críticas usam operações transacionais no banco com autenticação, escopo empresa/unidade e RBAC. Não reabrir `INSERT/UPDATE/DELETE` direto no cliente para contornar RLS/RPC.
- Medicamentos continuam obrigatoriamente no fluxo `Prescrição → Farmácia → Dispensação → Administração`.
- Não criar pacientes, unidades, leitos, estoques, lotes, valores, autorizações, contas, glosas, NFS-e, parâmetros institucionais ou fatos clínicos fictícios para completar cenário de homologação.
- Migrations aplicadas no Supabase devem permanecer versionadas no repositório; drift entre banco e GitHub deve ser tratado explicitamente.
- Parâmetros clínico-operacionais institucionais não devem ser inferidos de protocolos externos sem configuração explícita da instituição.

## Estado por área

| Área | Estado confirmado | Próximos pontos críticos |
|---|---|---|
| Fundação / Auth / multiempresa | RBAC granular, contexto empresa/unidade, perfis, navegação setorial, RLS/FORCE RLS e helpers de autorização sustentam os módulos operacionais. | ampliar testes multi-tenant, break-glass clínico controlado e hardening de RPCs legados |
| Navegação / Central Assistencial | Navegação por macroárea/perfil e Central de Pendências derivada, sem virar fonte concorrente. | homologar usabilidade por perfil real e melhorar acessibilidade/atalhos |
| Recepção / Totem / Agenda | Totem/senhas, recepção, check-in e agenda integrados ao atendimento. | recorrência, disponibilidade, lembretes, impressão e homologação operacional |
| Prontuário longitudinal | Resumo, histórico, evolução, prescrição, documentos, LIS/RIS e cirurgia compartilham o mesmo episódio. | adendos/assinaturas adicionais, protocolos e homologação clínica/regulatória |
| Farmácia / Enfermagem | FEFO, validação, dispensação, administração, devolução, estoque e produção correlacionados. | saneamento rastreável do legado e homologação farmacêutica/assistencial |
| Laboratório / LIS | Pedido, accession, coleta, cadeia de custódia, resultados, críticos, validação e laudo longitudinal implementados. | interfaces reais com equipamentos e homologação laboratorial |
| Diagnóstico por Imagem / RIS | Pedido, agenda, execução, dose/contraste, DICOM/PACS, laudo, retificação e críticos integrados. | PACS/visualizador real e homologação radiológica |
| GED | Storage privado, upload assinado, hash, versão, assinatura e vínculo documental/laudos sob autorização setorial. | temporalidade, retenção e política documental institucional |
| Centro Cirúrgico / CME | Agendamento, checklist, anestesia, RPA, equipe ampliada, múltiplos procedimentos, OPME, CME, suprimentos por lote, consumo/estorno e produção integrados ao RA. | homologação presencial, impressos/termos e protocolos locais |
| Compras / Estoque | Cotação MATMED, alçadas configuráveis, pedido, recebimento, lote, saldo, inventário, reposição e transferências físicas transacionais. | parametrizar alçadas reais, curva ABC e inventários cíclicos |
| Internação / NIR | Admissão transacional; internação/RA/leito coordenados; censo/diária idempotentes; alta clínica não é revertida por falha de faturamento. | homologar NIR, giro/ocupação e cenários reais |
| Transferências interunidades | PR #85 mesclada. Fluxo `origem → solicitação NIR → decisão destino → reserva/leito → novo atendimento/RA + internação destino → continuidade longitudinal` implementado. O ambiente conectado possui somente **uma unidade ativa**, logo não há destino institucional real para homologação e nenhuma unidade fictícia foi criada. | validar ponta a ponta quando existir segunda unidade institucional real |
| Urgência / Emergência | Abertura/encerramento, prioridade, SLA por atendimento e reavaliação são transacionais. #88 acrescenta Observação; #89 acrescenta indicadores derivados. A #91 adiciona configuração institucional versionada de SLA por unidade/classificação, sem seed e sem autoaplicação. | concluir gates da cadeia, cadastrar valores institucionais reais e homologar fluxos/protocolos com a operação |
| Faturamento / Auditoria | Produção e conta pós-alta estão integradas. A Auditoria recebe contas e críticas automáticas; a falha de exibição por embed PostgREST ambíguo foi corrigida na #93 e está em produção. | tratar críticas reais, ampliar precificação/fechamento e homologar ciclo com faturamento real |
| TISS | Guia + itens, lote, protocolo, glosa e recurso possuem RPCs transacionais e validação anti-glosa. | XSD oficial por versão/tipo, XML definitivo, adapters/retornos reais das operadoras e homologação TISS |
| Financeiro / NFS-e | Recebível, baixa parcial/total, retenções/tarifas, conciliação, estorno auditável, contas a pagar/caixa e base de NFS-e com RBAC. | adapters NFS-e reais, conciliação bancária e fechamento financeiro |
| RH / Segurança / TI / Engenharia Clínica | Workspaces e fundações setoriais existem com níveis distintos de completude. | evoluir fluxos completos e homologar por setor |

## Auditoria pós-alta — estado confirmado

O atendimento real usado para diagnosticar a falha de exibição foi encerrado corretamente e sua fila de consultório foi concluída. A conta permaneceu em Auditoria, como deveria; o problema era exclusivamente a consulta da página.

A auditoria permanece `aguardando` enquanto existirem críticas não tratadas. No cenário confirmado havia quatro itens automáticos abertos, incluindo um erro de valor e alertas de documentação, referência contratual e autorização. A correção de UI **não resolve nem silencia essas críticas**; elas continuam exigindo tratamento operacional apropriado.

## Urgência — parametrização institucional de SLA (PR #91)

Migration já aplicada no Supabase conectado:

- `20260830230050_urgencia_parametrizacao_sla_institucional`

Estado estrutural confirmado:

- `emergencia_sla_configuracoes` e `emergencia_sla_aplicacoes` existem com RLS/FORCE RLS;
- escrita operacional ocorre pelos RPCs `salvar_configuracao_sla_emergencia_operacional`, `desativar_configuracao_sla_emergencia_operacional` e `aplicar_sla_institucional_emergencia_operacional`;
- alterações de política preservam histórico de vigência e não reescrevem atendimentos anteriores;
- aplicar SLA institucional a um atendimento é ação explícita e gera trilha factual;
- no último estado confirmado existem **0 configurações** e **0 aplicações**. Nenhum tempo foi pré-carregado ou inferido.

## Supabase — migrations recentes confirmadas

Além das migrations históricas já versionadas, o projeto conectado contém, entre outras, as seguintes etapas recentes:

- `20260828182501_centro_cirurgico_consumo_estoque_operacional`
- `20260828194919_integracao_internacao_ponta_a_ponta`
- `20260828212958_integracao_faturamento_tiss_ponta_a_ponta`
- `20260828220121_financeiro_recebimentos_conciliacao_nfse_hardening`
- `20260829234859_financeiro_contas_pagar_caixa_operacional`
- `20260830005304_internacao_censo_diarias_operacional`
- `20260830012951_internacao_transferencia_interunidades_operacional`
- `20260830023008_internacao_transferencia_reserva_leito_hardening`
- `20260830023525_internacao_transferencia_destinos_operacionais`
- `20260830023629_internacao_transferencia_fila_operacional`
- `20260830191401_urgencia_transicoes_operacionais`
- `20260830195047_urgencia_sla_reavaliacao_operacional`
- `20260830212736_urgencia_observacao_operacional`
- `20260830230050_urgencia_parametrizacao_sla_institucional`
- `20260830231419_urgencia_sla_historico_longitudinal`

A lista do banco é a referência para confirmar aplicação. As migrations de #88, #91 e #92 já existirem no banco não significa que as respectivas UIs/branches estejam mescladas na `main`.

## Transferências interunidades — garantias atuais

O pacote do PR #85 usa RPCs transacionais para solicitar, aceitar, recusar e cancelar transferências, além das consultas operacionais de destinos e fila. Reserva ativa de leito para outro atendimento bloqueia ocupação concorrente; reserva compatível é consumida no aceite. O destino recebe somente a visão operacional necessária e a continuidade longitudinal é preservada por vínculo explícito entre os segmentos.

No estado conectado há **uma única unidade ativa**. Por isso o software pode ser validado estrutural/transacionalmente, mas o fluxo interunidades completo ainda **não pode ser homologado com destino institucional real**.

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
