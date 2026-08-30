# Estado real da implementação

Atualizado em 2026-08-30.

Este documento registra o estado **real confirmado** do MedSync HIS. A existência de rota, tabela, migration, teste automatizado ou deploy verde **não significa homologação hospitalar**. Homologação operacional continua dependendo de validação com os setores, integrações externas e dados institucionais reais.

## Referência atual

- `main`: `28b40282fedaaf059c839137b7c5d0c4e3a36525`, merge do PR #85 — transferências interunidades no NIR.
- O head final da #85 (`3682f976ea87e7804bda5c44a207bdb4b28ea65d`) teve CI completo verde e preview Vercel `READY` no **mesmo SHA** antes do merge.
- O deployment de produção criado para o merge `28b40282...` segue marcado pelo GitHub/Vercel como bloqueado pelo limite externo de builds. Portanto, este documento **não declara esse merge publicado em produção** enquanto o deployment correspondente não estiver `READY`.
- PRs #80, #81, #83, #84, #85, #86 e #87 já foram mesclados; #82 foi fechado como superseded pela cadeia consolidada.
- O erro de Next.js 16 do antigo PR #83 em `src/modules/tiss/lote-financeiro-actions.ts` permanece corrigido por server action `async`, sem reexport inválido em arquivo `"use server"`.
- PR #88 (`feat/urgencia-observacao-operacional`) está aberto e mergeável no head `093f9335a9db145b8623ac5c2a44bc48a3c093ac`; CI #823 está verde, mas o status Vercel do mesmo SHA permanece `failure` por `Deployment rate limited — retry in 24 hours`. Por isso a #88 não foi mesclada.
- Pacote seguinte em desenvolvimento: branch `feat/urgencia-indicadores-operacionais`, empilhada sobre a #88 para não misturar o gate pendente da Observação.

## Princípios arquiteturais obrigatórios

- Atendimento/RA e prontuário longitudinal permanecem como eixo assistencial; módulos setoriais não criam uma segunda fonte clínica concorrente.
- A Central de Pendências é **derivada**: detecta divergências e direciona responsáveis, mas não reescreve fatos das fontes para ocultar inconsistências.
- Escritas críticas usam operações transacionais no banco com autenticação, escopo empresa/unidade e RBAC. Não reabrir `INSERT/UPDATE/DELETE` direto no cliente para contornar RLS/RPC.
- Medicamentos continuam obrigatoriamente no fluxo `Prescrição → Farmácia → Dispensação → Administração`.
- Não criar pacientes, unidades, leitos, estoques, lotes, valores, autorizações, contas, glosas, NFS-e ou fatos clínicos fictícios para completar cenário de homologação.
- Migrations aplicadas no Supabase devem permanecer versionadas no repositório; drift entre banco e GitHub deve ser tratado explicitamente.

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
| Urgência / Emergência | Abertura/encerramento, prioridade, SLA institucional configurável e reavaliação são transacionais. A #88 acrescenta Observação operacional no mesmo RA. A branch seguinte acrescenta indicadores derivados de SLA, reavaliação, classificação, destino e permanência em Observação, sem escrita e sem inferência clínica. | liberar gate Vercel da #88, validar UX/fluxo com operação real, parametrizar SLA institucional e evoluir protocolos locais |
| Faturamento / TISS | Produção, conta, auditoria, guia, lote, protocolo, glosa e recurso possuem integração e RPCs transacionais. | XSD/XML definitivo, adapters e retornos reais das operadoras |
| Financeiro / NFS-e | Recebível, baixa parcial/total, retenções/tarifas, conciliação, estorno auditável e NFS-e com RBAC. | adapters NFS-e reais, conciliação bancária e fechamento financeiro |
| RH / Segurança / TI / Engenharia Clínica | Workspaces e fundações setoriais existem com níveis distintos de completude. | evoluir fluxos completos e homologar por setor |

## Urgência — Observação operacional (PR #88)

Migration aplicada no Supabase conectado e versionada na branch:

- `20260830212736_urgencia_observacao_operacional`

Garantias já confirmadas no banco:

- tabela `emergencia_observacoes` com RLS + FORCE RLS;
- somente leitura direta para `authenticated`; início e encerramento são feitos pelos RPCs `iniciar_observacao_emergencia_operacional` e `encerrar_observacao_emergencia_operacional`;
- `authenticated` não possui mais `INSERT/UPDATE/DELETE` direto em `emergencia_registros` nem `emergencia_reavaliacoes`;
- uma única Observação ativa por registro de emergência e por atendimento;
- encerramento da Urgência é bloqueado se ainda existir Observação ativa;
- o encerramento da Observação fecha a permanência e o registro de Urgência na mesma transação, com destino final explícito;
- início e saída geram `integracao_eventos` vinculados ao mesmo atendimento/paciente;
- reavaliações permanecem no fluxo clínico já existente da Urgência, sem criar uma segunda fonte assistencial;
- nenhum dado clínico, paciente, leito ou localização fictícia foi inserido para validar o pacote;
- CI #823 do head `093f9335...` está verde;
- gate Vercel desse mesmo SHA segue bloqueado por limite externo, portanto a PR permanece aberta e não homologada.

## Urgência — Indicadores operacionais (pacote empilhado)

Nova rota em desenvolvimento:

- `/assistencial/urgencia/indicadores`

O painel é deliberadamente **read-only** e deriva apenas fatos persistidos, sempre sob escopo `empresa_id` + `unidade_id` e permissões da Urgência. Ele consolida:

- volume de registros ativos/encerrados em janelas móveis de 7, 30 e 90 dias;
- cobertura de SLA institucional configurado;
- cumprimento do SLA quando existe desfecho mensurável;
- SLA vencido ainda aberto;
- tempo médio entre classificação e primeiro cumprimento registrado;
- reavaliações atrasadas e atraso médio registrado;
- Observações ativas/encerradas e permanência média;
- distribuição de classificação de risco;
- destinos assistenciais e saídas da Observação.

O painel não cria SLA clínico, não presume intervalo de protocolo e não preenche lacunas de classificação/desfecho. Denominadores que exigem um fato ausente excluem explicitamente o registro em vez de inventar valor.

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

### Drift de versionamento identificado

O Supabase conectado registra a migration de SLA como `20260830195047_urgencia_sla_reavaliacao_operacional`, enquanto o arquivo introduzido pelo PR #87 no GitHub está nomeado `20260830194712_urgencia_sla_reavaliacao_operacional.sql`. O conteúdo já está aplicado no banco; **não reaplicar DDL para esconder o drift**. A normalização do histórico do repositório deve preservar exatamente o SQL efetivamente aplicado e alinhar o versionamento sem executar novamente a migration em produção.

A lista do banco é a referência para confirmar aplicação; nomes/versões descritos em PRs antigos não substituem o estado conectado atual.

## Gates e critério de merge

Para qualquer PR operacional:

1. confirmar o estado real de GitHub, Supabase e Vercel antes da escrita;
2. executar CI completo no SHA final;
3. verificar o deployment Vercel do **mesmo SHA final**;
4. corrigir erros reais e revisar reviews/threads;
5. somente mesclar quando os gates aplicáveis estiverem verdes;
6. após merge, confirmar a nova `main` e o deployment de produção correspondente;
7. nunca usar preview de commit intermediário como gate de um head diferente.

A #88 de Observação **não está homologada** e **não deve ser mesclada** enquanto CI e Vercel não estiverem verdes no mesmo SHA final. A branch de Indicadores é empilhada sobre a #88 e também não deve ser levada à `main` fora dessa ordem.

Este status descreve maturidade técnica e integração confirmadas. **Não declara homologação hospitalar, clínica, TISS, financeira ou fiscal.**