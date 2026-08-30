# Estado real da implementação

Atualizado em 2026-08-30.

Este documento registra o estado **real confirmado** do MedSync HIS. A existência de rota, tabela, migration, teste automatizado ou deploy verde **não significa homologação hospitalar**. Homologação operacional continua dependendo de validação com os setores, integrações externas e dados institucionais reais.

## Referência atual

- `main`: `28b40282fedaaf059c839137b7c5d0c4e3a36525`, merge do PR #85 — transferências interunidades no NIR.
- O head final da #85 (`3682f976ea87e7804bda5c44a207bdb4b28ea65d`) teve CI completo verde e preview Vercel `READY` no mesmo SHA antes do merge.
- O deployment de produção do merge `28b40282...` ficou bloqueado pelo limite externo de builds do Vercel. Portanto, este documento **não declara esse merge publicado em produção** enquanto o deployment correspondente não estiver `READY`.
- PRs #80, #81, #83, #84, #85, #86 e #87 estão mesclados; #82 foi fechado como superseded.
- PR #88 (`feat/urgencia-observacao-operacional`, head `093f9335...`) está aberta, CI #823 verde e Vercel bloqueado por rate limit no mesmo SHA.
- PR #89 (`feat/urgencia-indicadores-operacionais`, head `17f3c488...`) está empilhada sobre #88, CI #824 verde e Vercel bloqueado por rate limit no mesmo SHA.
- PR #90 (`chore/urgencia-sla-migration-version`, head `1bbbffa8...`) corrige somente o nome versionado da migration de SLA para a versão real `20260830195047`; CI #826 verde e Vercel bloqueado por rate limit.
- Pacote atual em desenvolvimento: `feat/urgencia-parametrizacao-sla-institucional`, baseado no head final da #90. Não deve ser mesclado antes da #90.

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
| Fundação / Auth / multiempresa | RBAC granular, contexto empresa/unidade, RLS/FORCE RLS e helpers de autorização sustentam os módulos operacionais. | ampliar testes multi-tenant, break-glass clínico controlado e hardening de RPCs legados |
| Recepção / Totem / Agenda | Totem/senhas, recepção, check-in e agenda integrados ao atendimento. | recorrência, disponibilidade, lembretes, impressão e homologação operacional |
| Prontuário longitudinal | Resumo, histórico, evolução, prescrição, documentos, LIS/RIS e cirurgia compartilham o mesmo episódio. | adendos/assinaturas adicionais, protocolos e homologação clínica/regulatória |
| Farmácia / Enfermagem | FEFO, validação, dispensação, administração, devolução, estoque e produção correlacionados. | saneamento rastreável do legado e homologação farmacêutica/assistencial |
| Laboratório / LIS | Pedido, accession, coleta, cadeia de custódia, resultados, críticos, validação e laudo longitudinal implementados. | interfaces reais com equipamentos e homologação laboratorial |
| Diagnóstico por Imagem / RIS | Pedido, agenda, execução, dose/contraste, DICOM/PACS, laudo, retificação e críticos integrados. | PACS/visualizador real e homologação radiológica |
| GED | Storage privado, upload assinado, hash, versão, assinatura e vínculo documental/laudos sob autorização setorial. | temporalidade, retenção e política documental institucional |
| Centro Cirúrgico / CME | Agendamento, checklist, anestesia, RPA, equipe ampliada, múltiplos procedimentos, OPME, CME, suprimentos por lote, consumo/estorno e produção integrados ao RA. | homologação presencial, impressos/termos e protocolos locais |
| Compras / Estoque | Cotação MATMED, alçadas configuráveis, pedido, recebimento, lote, saldo, inventário, reposição e transferências físicas transacionais. | parametrizar alçadas reais, curva ABC e inventários cíclicos |
| Internação / NIR | Admissão transacional; internação/RA/leito coordenados; censo/diária idempotentes; alta clínica não é revertida por falha de faturamento. | homologar NIR, giro/ocupação e cenários reais |
| Transferências interunidades | PR #85 mesclado. Fluxo `origem → solicitação NIR → decisão destino → reserva/leito → novo atendimento/RA + internação destino → continuidade longitudinal` implementado. O ambiente conectado possui somente **uma unidade ativa**, logo não há destino institucional real para homologação e nenhuma unidade fictícia foi criada. | validar ponta a ponta quando existir segunda unidade institucional real |
| Urgência / Emergência | Abertura/encerramento, prioridade, SLA por atendimento e reavaliação são transacionais. #88 acrescenta Observação; #89 acrescenta indicadores derivados. O pacote atual adiciona configuração institucional versionada de SLA por unidade/classificação, sem seed e sem autoaplicação. | liberar gates Vercel, cadastrar valores institucionais reais e homologar fluxos/protocolos com a operação |
| Faturamento / TISS | Produção, conta, auditoria, guia, lote, protocolo, glosa e recurso possuem integração e RPCs transacionais. | XSD/XML definitivo, adapters e retornos reais das operadoras |
| Financeiro / NFS-e | Recebível, baixa parcial/total, retenções/tarifas, conciliação, estorno auditável e NFS-e com RBAC. | adapters NFS-e reais, conciliação bancária e fechamento financeiro |
| RH / Segurança / TI / Engenharia Clínica | Workspaces e fundações setoriais existem com níveis distintos de completude. | evoluir fluxos completos e homologar por setor |

## Urgência — parametrização institucional de SLA (pacote atual)

Migration aplicada no Supabase conectado e versionada na branch:

- `20260830230050_urgencia_parametrizacao_sla_institucional`

Garantias confirmadas no banco:

- `emergencia_sla_configuracoes` com RLS + FORCE RLS e histórico de vigências;
- `emergencia_sla_aplicacoes` com RLS + FORCE RLS para trilha factual de aplicações explícitas em atendimentos;
- `authenticated` possui somente `SELECT` direto nessas tabelas; `INSERT/UPDATE/DELETE` direto permanece bloqueado;
- gravação/encerramento de vigência usam `salvar_configuracao_sla_emergencia_operacional` e `desativar_configuracao_sla_emergencia_operacional`;
- aplicação ao episódio usa `aplicar_sla_institucional_emergencia_operacional`, com autenticação, empresa/unidade e `emergencia.gerenciar` validados no banco;
- nova configuração encerra a vigência anterior e cria nova versão, sem reescrever histórico;
- configurar política não altera atendimentos existentes automaticamente;
- a fila exige ação explícita para copiar o SLA institucional vigente para o snapshot do atendimento;
- ajuste manual do SLA do atendimento continua separado da política institucional;
- após a migration existem **0 configurações** e **0 aplicações** no ambiente conectado: nenhum tempo clínico foi inventado ou pré-carregado.

## Supabase — migrations recentes confirmadas

Entre as etapas recentes presentes no projeto conectado:

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

A lista do banco é a referência para confirmar aplicação; nomes/versões descritos em PRs antigos não substituem o estado conectado atual.

## Gates e critério de merge

Para qualquer PR operacional:

1. confirmar o estado real de GitHub, Supabase e Vercel antes da escrita;
2. executar CI completo no SHA final;
3. verificar o deployment Vercel do **mesmo SHA final**;
4. corrigir erros reais e revisar reviews/threads;
5. somente mesclar quando os gates aplicáveis estiverem verdes;
6. após merge, confirmar a nova `main` e o deployment de produção correspondente;
7. nunca usar preview de commit intermediário como gate de um head diferente;
8. respeitar a ordem de PRs empilhadas e rerodar gates quando o head/base mudar.

Nenhum pacote atual de Urgência é declarado homologado. O rate limit do Vercel é um bloqueio externo de gate e não será contornado por merge manual.

Este status descreve maturidade técnica e integração confirmadas. **Não declara homologação hospitalar, clínica, TISS, financeira ou fiscal.**
