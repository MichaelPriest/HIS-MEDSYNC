# Estado real da implementação

Atualizado em 2026-08-31.

Este documento registra o estado **real confirmado** do MedSync HIS. A existência de rota, tabela, migration, teste automatizado ou deploy verde **não significa homologação hospitalar**. Homologação operacional continua dependendo de validação com os setores, integrações externas e dados institucionais reais.

## Referência atual

- `main` confirmada antes do pacote atual: `845771fa4795cc56a99931dfebaf281250bf5bbe`, merge do PR #95.
- A produção Vercel desse mesmo SHA estava `READY`.
- O PR #95 estabeleceu a política global de salvamentos em segundo plano e converteu inicialmente alta médica ambulatorial e solicitação de avaliação médica interprofissional.
- O PR #100 consolida Agenda, Admissão/Recepção, Triagem e Fila Médica diretamente contra `main`. O head consolidado `5cea54b8e33802bb04fa899089310424df6e5392` passou o CI #858, mas o Vercel desse mesmo SHA foi bloqueado por limite externo de builds; portanto o pacote permanece aberto e não deve ser mesclado usando preview de SHA anterior.
- As PRs #96, #98 e #99 estão funcionalmente contidas no head da #100 e não devem ser mescladas separadamente após a consolidação.
- O PR #101, empilhado sobre a branch da #100, converte Autorizações: biometria/token, validações e salvamento de guia usam feedback inline; após liberação confirmada, a navegação ocorre somente quando a jornada precisa seguir para Triagem, Fila Médica ou Pronto-Socorro. O CI #857 do head `c2194398d6c8ac71bea911fe0fc997a81de9bda0` está verde; o Vercel desse mesmo SHA foi bloqueado por limite externo de builds.
- O PR #102, empilhado sobre a #101, converte Enfermagem: evolução em Andares/Pronto-Socorro e administração à beira-leito usam `useActionState`, feedback inline e não recarregam a página. O RPC `registrar_administracao_beira_leito` e os campos de identificação, dispensação/lote, contingência sem etiqueta e dupla checagem foram preservados. O CI #859 do head `9ee87ccef59106812b5042c495c3a06e8bfbc28f` está verde; o Vercel desse mesmo SHA foi bloqueado por limite externo de builds.
- O PR #103, empilhado sobre a #102, converte a Farmácia Clínica: conciliação, validação farmacêutica, dispensação FEFO principal/componente e devolução usam feedback inline sem reload. O CI #863 do head anterior `c9d4e85527fce1d5230f79ffb5a6b7d682170190` ficou totalmente verde; o Vercel desse SHA foi bloqueado por limite externo de builds. Este `STATUS.md` é a atualização documental final do pacote e exige novo CI no novo head antes de qualquer gate final.
- O histórico consolidado inclui PR #84 (censo/diárias de internação), PR #86 (transições de Urgência), PR #87 (SLA/reavaliação de Urgência), PR #90 (alinhamento da migration de SLA), PR #93 (correção da fila de Auditoria), PR #95 (fundação de salvamentos sem recarga) e os pacotes posteriores ainda abertos, conforme estado confirmado no repositório e no banco.
- O pacote de transferências interunidades originado no PR #85 permanece implementado. Homologação completa continua dependente de uma segunda unidade institucional real.

## Princípios arquiteturais obrigatórios

- O atendimento/RA e o prontuário longitudinal permanecem como eixo assistencial; módulos setoriais não criam uma segunda fonte clínica concorrente.
- A Central de Pendências é **derivada**: detecta divergências e direciona responsáveis, mas não reescreve fatos de prontuário, estoque, laudo, cirurgia, TISS ou financeiro para ocultar inconsistências.
- Escritas críticas usam operações transacionais no banco com autenticação, escopo de empresa/unidade e RBAC. Não reabrir `INSERT/UPDATE/DELETE` direto no cliente para contornar RLS/RPC.
- Medicamentos continuam obrigatoriamente no fluxo `Prescrição → Farmácia → Dispensação → Administração`; consumo cirúrgico direto não substitui esse ciclo.
- Não criar pacientes, unidades, leitos, estoques, lotes, valores, autorizações, contas, glosas, NFS-e ou fatos clínicos fictícios para “completar” cenário de homologação.
- Migrations aplicadas no Supabase devem permanecer versionadas no repositório; drift entre banco e GitHub deve ser tratado explicitamente.
- Salvamentos e mutações operacionais normais devem usar feedback inline em segundo plano. `redirect()`, `window.location` e `router.refresh()` não devem ser usados apenas para exibir sucesso/erro ou refletir uma gravação; navegação continua permitida quando é a própria próxima etapa do fluxo.

## Estado por área

| Área | Estado confirmado | Próximos pontos críticos |
|---|---|---|
| Fundação / Auth / multiempresa | RBAC granular, contexto empresa/unidade, perfis, navegação setorial, RLS/FORCE RLS e helpers de autorização já sustentam os módulos operacionais. A fundação de `BackgroundActionState` + React 19 `useActionState` passou a ser o padrão para mutações sem recarga. | ampliar testes multi-tenant, break-glass clínico controlado, continuar hardening dos RPCs legados e migrar as ações legadas para o novo padrão sem reload |
| Navegação / Central Assistencial | Navegação organizada por macroárea e perfil; `/integracoes` concentra pendências intersetoriais sem virar fonte de dados. | homologar usabilidade por perfil real e melhorar acessibilidade/atalhos |
| Recepção / Totem / Agenda / Autorizações / Triagem / Fila Médica | Totem/senhas, recepção, check-in, agenda, autorizações, triagem e fila médica possuem bases operacionais integradas ao atendimento. A PR #100 consolida Agenda, Admissão, Triagem e Fila Médica no padrão sem reload; check-in, abertura efetiva do RA e tomada confirmada do paciente preservam navegação por representarem mudança real de etapa. A PR #101 converte identificação e guia de Autorizações, preservando navegação apenas após liberação/dispensa confirmada. | concluir gates Vercel/merge da pilha; revisar mutações restantes de Totem/senhas/recepção; evoluir recorrência, disponibilidade, lembretes, impressão e homologação do painel de chamada |
| Prontuário longitudinal | Resumo, histórico, anamnese/evolução com autosave, prescrição, documentos, LIS/RIS e cirurgia compartilham o episódio. Impressão clínica e rascunho único foram endurecidos; alta e solicitação de avaliação médica já usam salvamento em segundo plano. | adendos/assinaturas adicionais, protocolos, migração das ações legadas restantes e homologação clínica/regulatória |
| Farmácia / Enfermagem / medicamentos | FEFO, validação, dispensação, administração, devolução, estoque e produção estão correlacionados pela integração ponta a ponta. Na PR #102, evolução assistencial e administração à beira-leito usam feedback inline sem reload; o RPC `registrar_administracao_beira_leito` continua validando prescrição, Farmácia, identificação do paciente, dispensação, lote, contingência e dupla checagem. Na PR #103, conciliação medicamentosa, validação farmacêutica, dispensação FEFO principal/componente e devolução também passam a operar inline, preservando os RPCs canônicos e a autoridade do estoque/lote. | concluir gates Vercel/merge da pilha, saneamento rastreável do legado, regras clínicas adicionais e homologação farmacêutica/assistencial |
| Laboratório / LIS | Pedido, accession, coleta, cadeia de custódia, resultados, críticos, validação e laudo longitudinal estão implementados; anexos GED podem acompanhar laudos liberados. | interfaces reais com equipamentos, protocolos de bancada, migração das mutações legadas sem reload e homologação laboratorial |
| Diagnóstico por Imagem / RIS | Pedido, agenda, execução, dose/contraste, identificadores DICOM/PACS, laudo, retificação e críticos estão integrados ao prontuário. | PACS/visualizador real, storage DICOM, migração de mutações legadas sem reload e homologação radiológica |
| GED | Storage privado, upload assinado, hash, versão, assinatura e vínculo com documentos/laudos estão disponíveis sob autorização setorial. | temporalidade, retenção/descarte, política documental institucional e revisão das mutações legadas |
| Centro Cirúrgico / CME | Fluxo transacional de agendamento, checklist, anestesia, RPA, equipe ampliada, múltiplos procedimentos, OPME, CME, suprimentos por lote, consumo/estorno e produção está integrado ao mesmo RA. | homologação presencial, estoque satélite real quando existir, impressos/termos, protocolos locais e revisão das mutações legadas |
| Compras / Almoxarifado / Estoque | Cotação MATMED, alçadas configuráveis, pedido, recebimento, lote, saldo, inventário, reposição e transferências físicas possuem operações transacionais. Nenhuma alçada monetária institucional foi inventada. | parametrizar alçadas reais, curva ABC/planejamento, inventários cíclicos, saneamento de divergências históricas e revisão das mutações legadas |
| Comercial / Contratos / Tabelas | Contratos, negociações, edições imutáveis/versionadas, itens, auditoria e importação AMB estruturada estão no workspace comercial. | revisar contratos reais, vínculos sem itens, novas bases licenciadas, precificação contratual e revisão das mutações legadas |
| Internação / NIR | Admissão é transacional; internação/RA/leito são coordenados; alta preserva o fato clínico mesmo se faturamento falhar; censo factual e diária idempotente foram adicionados no PR #84. | homologar NIR, validar giro/ocupação com operação real e migrar ações legadas de Internação para o padrão sem reload quando não houver navegação funcional |
| Transferências interunidades | Fluxo `origem → solicitação NIR → decisão destino → leito destino → novo atendimento/RA + internação destino → continuidade longitudinal` implementado com RPCs, reserva de leito e fila enriquecida. O último cenário institucional confirmado possuía apenas **uma unidade ativa**, portanto não havia destino real para homologação interunidades e nenhuma unidade fictícia foi criada. | validar o fluxo completo quando existir segunda unidade institucional real; manter RBAC/RLS e vínculo longitudinal |
| Urgência / Emergência | Abertura/encerramento transacionais, prioridade, SLA institucional, reavaliação, observação e histórico longitudinal de SLA possuem fundação operacional versionada no banco. | parametrizar SLA institucional real, protocolos locais, indicadores, homologação e revisão das mutações legadas de tela |
| Faturamento / Livro de Produção | Produção assistencial está integrada a cirurgia, internação, medicamentos e conta. Falhas pós-alta viram pendência em vez de desfazer a alta clínica. | ampliar fechamento/precificação, migrar mutações legadas sem reload e homologar ciclo de conta com faturamento real |
| Auditoria / Contas Médicas | Fluxos de Auditoria e liberação financeira vêm sendo endurecidos para reconhecer vínculos e autorizações reais do atendimento, sem falsificar liberações formais. O PR #97 corrige a separação entre pendências atuais e histórico resolvido e converte operações da Auditoria para feedback em segundo plano. | concluir gate Vercel do PR #97, homologar o fluxo pós-alta ponta a ponta e migrar Contas Médicas restantes sem reload |
| TISS | Guia + itens, lote, protocolo, glosa e recurso possuem RPCs transacionais e validação anti-glosa. A anomalia histórica global sem tenant confiável foi preservada tecnicamente em vez de receber escopo inventado. | XSD oficial por versão/tipo, XML definitivo, adapters/retornos reais das operadoras, migração de mutações legadas sem reload e homologação TISS |
| Financeiro / NFS-e | Recebível, baixa parcial/total, retenções/tarifas, conciliação, estorno auditável e NFS-e possuem fundação com RBAC; mutações críticas do lote TISS deixaram de usar DML financeiro direto e contas a pagar/caixa operacional foram adicionados posteriormente. | adapters NFS-e reais, conciliação bancária/retornos, fechamento financeiro, revisão das mutações legadas e homologação com processos reais |
| RH / Segurança / TI / Engenharia Clínica | Workspaces e fundações setoriais existem, com níveis de completude diferentes. | evoluir fluxos completos, integrações de dispositivos/ativos, revisar mutações legadas e homologar por setor |

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
- `20260830212736_urgencia_observacao_operacional`
- `20260830230050_urgencia_parametrizacao_sla_institucional`
- `20260830231419_urgencia_sla_historico_longitudinal`
- `20260831035056_auditoria_autorizacao_unificada`

A lista do banco é a referência para confirmar aplicação; nomes/versões descritos em PRs antigos não substituem o estado conectado atual. Os pacotes atuais de Agenda, Admissão, Triagem, Fila Médica, Autorizações, Enfermagem e Farmácia não alteram schema e não adicionam migration.

## Transferências interunidades — garantias atuais

O pacote originado no PR #85 usa os RPCs `solicitar_transferencia_interunidade`, `aceitar_transferencia_interunidade`, `recusar_transferencia_interunidade` e `cancelar_transferencia_interunidade`, além das consultas operacionais de destinos e fila. A tabela de transferências e esses RPCs foram confirmados no Supabase conectado.

Uma reserva ativa de leito para outro atendimento bloqueia ocupação concorrente; reserva compatível é consumida no aceite. A unidade de destino recebe somente a visão operacional necessária, sem liberar globalmente o prontuário da origem. O aceite preserva a continuidade longitudinal por vínculo explícito entre segmento de origem e novo atendimento/RA/internação destino.

No último cenário institucional confirmado havia **uma única unidade ativa**. Por isso o software pode ser validado estrutural/transacionalmente, mas o fluxo interunidades completo ainda **não pode ser homologado com destino institucional real** sem nova confirmação desse cenário.

## Salvamentos em segundo plano — estado da migração

A política está documentada em `docs/architecture/background-saves.md` e protegida por `tests/unit/background-save-policy.test.ts`, `tests/unit/enfermagem-background-saves.test.ts` e `tests/unit/farmacia-background-actions.test.ts`.

Já convertidos e protegidos contra regressão:

- alta médica ambulatorial;
- solicitação de avaliação médica interprofissional;
- criação de agendamento;
- confirmação, falta, conclusão e cancelamento de agendamento;
- validações e falhas de abertura da Admissão/Recepção;
- chamada/rechamada e registro da Triagem;
- tomada de paciente na Fila Médica;
- identificação do beneficiário e atualização de Autorizações;
- evolução de Enfermagem em Andares e Pronto-Socorro;
- administração de medicamentos à beira-leito;
- conciliação medicamentosa na Farmácia;
- validação farmacêutica;
- dispensação FEFO do item principal e de componentes;
- devolução de medicamento dispensado.

A Agenda preserva dois redirects semânticos de `check-in`: atendimento comum segue para abertura do atendimento e cirurgia eletiva segue para Centro Cirúrgico. Eles não são usados como mecanismo de feedback de salvamento.

A Admissão preserva a navegação somente após o banco confirmar a criação real do atendimento/RA: convênio segue para Autorização e particular segue para Triagem. Erros permanecem no formulário e não usam redirect como feedback.

A Triagem permanece na própria página para chamada/rechamada, erros e conclusão comum. Após confirmação do save, a interface só navega quando o fluxo assistencial exige Autorização ou Pronto-Socorro.

A Fila Médica mantém erros e concorrência no próprio cartão do paciente. O componente cliente só abre o prontuário após a action confirmar que o profissional assumiu o encaminhamento e o atendimento foi atualizado.

Autorizações mantém biometria/token, validações e edição da guia na própria tela. A interface só navega após uma liberação/dispensa confirmada quando a próxima etapa assistencial for Triagem, Fila Médica ou Pronto-Socorro; falha posterior de encaminhamento não apaga nem mascara uma guia já persistida.

Na Enfermagem, evolução e checagem medicamentosa retornam sucesso/erro inline. A administração continua condicionada ao RPC `registrar_administracao_beira_leito`, incluindo identificação do paciente, dispensação/lote, confirmação manual auditável quando sem etiqueta, dose/via e dupla checagem.

Na Farmácia, conciliação, validação, dispensação FEFO e devolução retornam sucesso/erro inline e preservam os RPCs transacionais existentes. A administração não foi duplicada na Farmácia e continua exclusiva da Enfermagem.

A migração do restante do sistema continua incremental. Não declarar todos os módulos convertidos até que as ações legadas tenham sido inventariadas e removidas da lista.

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