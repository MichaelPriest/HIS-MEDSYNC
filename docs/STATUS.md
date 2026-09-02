# Estado real da implementação

Atualizado em 2026-09-01.

Este documento registra o estado **real confirmado** do MedSync HIS. Rota, tabela, migration, teste ou deploy verde não equivalem a homologação hospitalar; homologação depende de validação operacional, integrações externas e dados institucionais reais.

## Referência atual

- `main`: `b539a4e8b568cc3cfa6aa32d99cf593be22c0028`, merge da PR #115 — Base de Conhecimento pesquisável.
- Última produção confirmada `READY`: `c91d2ebccb1a549b9bae8db24b24c3d6877db04c`, merge da PR #113. Não há produção confirmada do merge `b539a4e8...` porque o Vercel passou a bloquear novos builds por rate limit.
- PR #116 — laudos RIS: head `5489a5f52b9152bf6ac85eee157df2175702137e`, CI #891 verde, Vercel do mesmo SHA rate-limited; aberta.
- PR #117 — governança GED: head `d0f81642636a5baf0771f0928a9eb13794cf1c7c`, CI #892 verde, Vercel do mesmo SHA rate-limited; aberta.
- PR #118 — núcleo do Centro Cirúrgico: head `fbe4c8145277c2dc9b91237a5109fafa411dc8f8`, CI #893 completamente verde, reviews/threads limpos, Vercel do mesmo SHA rate-limited; aberta.
- PR #119 — Anestesia/RPA: head `7003ba48056bcc1c906013383be3b96bd9ad7c6d`, CI #894 verde, reviews/threads limpos, Vercel do mesmo SHA rate-limited; aberta.
- PR #120 — Suprimentos do Centro Cirúrgico: head `1e378291ae8252fc064136ce436f066b62ee3dcb`, CI #895 completamente verde (lint, typecheck, unitários, build e E2E), reviews/threads limpos na abertura e Vercel do mesmo SHA rate-limited; aberta.
- Pacote atual — CME dedicada: empilhado sobre a PR #120. Criação, atualização, conclusão/reprovação e liberação definitiva de ciclos passam para `BackgroundActionState` + `useActionState`, preservando `cme_salvar_ciclo_operacional`, permissão `cme.gerenciar`, imutabilidade após liberação e releitura do estado persistido. Sem migration, schema, RLS ou RPC novo.
- PR #111 permanece aberta para fallback comercial TUSS; a migration correspondente já está aplicada no Supabase e não deve ser confundida com merge/homologação da PR.

## Princípios obrigatórios

- Atendimento/RA e prontuário longitudinal permanecem como eixo do episódio.
- Escritas críticas devem usar RPCs/transações existentes com autenticação, escopo empresa/unidade, RBAC e RLS; não reabrir DML paralelo para contornar segurança.
- Medicamentos seguem `Prescrição → Farmácia → Dispensação → Administração`.
- Não criar pacientes, unidades, leitos, estoques, lotes, valores, autorizações, contas, glosas, NFS-e ou fatos clínicos fictícios para completar fluxo.
- Migrations aplicadas no Supabase devem permanecer versionadas; drift deve ser explícito.
- Salvamentos normais usam feedback inline. `redirect()`, `window.location` e `router.refresh()` não são mecanismos de sucesso/erro.
- A Base de Conhecimento em `/manual` ensina o fluxo implementado, sem substituir protocolo institucional ou homologação.

## Estado por área

| Área | Estado confirmado | Próximos pontos críticos |
|---|---|---|
| Fundação / Auth / multiempresa | RBAC granular, contexto empresa/unidade, RLS/FORCE RLS e `BackgroundActionState`. | ampliar testes multi-tenant e break-glass controlado |
| Recepção / Agenda / Autorizações / Triagem / Fila Médica | Fluxos principais sem reload; navegação apenas em transições reais. | Totem/senhas restantes, recorrência, lembretes, homologação |
| Prontuário longitudinal | Resumo, histórico, evolução, prescrição, documentos, LIS/RIS e cirurgia compartilham o episódio. | adendos, assinaturas, protocolos e homologação clínica |
| Farmácia / Enfermagem | FEFO, validação, dispensação, administração, devolução, lote e dupla checagem integrados. | saneamento legado e homologação farmacêutica/assistencial |
| Laboratório / LIS | Bancada e editor de laudos sem reload, preservando rastreabilidade e RPCs. | analisadores reais e homologação laboratorial |
| Diagnóstico por Imagem / RIS | Operação RIS consolidada; PR #116 converte editor/liberação de laudos. | gate Vercel/merge, PACS/visualizador real, homologação por modalidade |
| Base de Conhecimento | `/manual` com 17 guias, busca, filtros, público, passos, alertas e fontes versionadas. | confirmar produção do merge, ampliar ajuda contextual e governança |
| GED | Storage privado, versões, hash e assinatura; PR #117 converte status/assinatura inline. | gate Vercel/merge, retenção e temporalidade |
| Centro Cirúrgico / CME | PR #118 converte núcleo/procedimentos; PR #119 Anestesia/RPA; PR #120 Suprimentos; pacote atual converte a CME dedicada. Tudo permanece ligado ao mesmo RA e aos RPCs canônicos. | concluir gates da cadeia; homologação presencial de cirurgia/CME, equipamentos, indicadores, termos e protocolos locais |
| Compras / Almoxarifado / Estoque | Cotação, pedido, recebimento, lote, saldo, inventário, reposição e transferências transacionais. | alçadas reais, curva ABC, inventários e mutações legadas |
| Comercial / Contratos / Tabelas | Contratos, versões, itens, auditoria e AMB estruturada. | referências reais, precificação e mapeamentos |
| Internação / NIR | Admissão/leito, alta, censo, diárias e transferências interunidades. | homologação NIR, segunda unidade real, mutações restantes |
| Urgência / Emergência | Transições, prioridade, SLA, reavaliação e observação com base operacional. | sincronizar cadeia de PRs, parametrização e homologação |
| Faturamento / TISS / Financeiro | Produção, conta, TISS, glosa/recurso, recebíveis, conciliação e NFS-e têm fundações transacionais. | XSD/adapters reais, fechamento, precificação e homologação |
| Auditoria / Contas Médicas | Fila pós-alta, revalidação e handoff corrigidos nas PRs #108/#109. | homologar ciclo pós-alta ponta a ponta |

## Supabase — referência confirmada

A migration mais recente continua `20260901225717_faturamento_fallback_comercial_tuss`; entre as imediatamente anteriores estão `20260901223840_auditoria_trigger_liberacao_finalizado_em` e `20260831035056_auditoria_autorizacao_unificada`. Os pacotes RIS, GED e Centro Cirúrgico/CME desta cadeia não adicionam migration.

## Salvamentos em segundo plano

Já convertidos e protegidos contra regressão: alta/avaliações médicas, Agenda, Admissão, Triagem, Fila Médica, Autorizações, Enfermagem, Farmácia, bancada e laudos LIS, operação e laudos RIS, governança GED, núcleo/procedimentos do Centro Cirúrgico, Anestesia/RPA e Suprimentos.

No pacote atual da CME:

- novo ciclo exige código real;
- criação/atualização usa o RPC `cme_salvar_ciclo_operacional`;
- status permanece limitado a `em_processamento`, `concluido`, `reprovado` ou `liberado` no banco;
- liberação definitiva exige resultado e ao menos um indicador conforme na interface, além das validações do RPC;
- liberação exige profissional vinculado e permanece imutável no banco;
- após salvar, a Server Action relê `status`, `inicio_em`, `fim_em` e `liberado_em` antes de mostrar confirmação;
- após `status=liberado` confirmado, o formulário é bloqueado sem `router.refresh()`;
- novo formulário só é limpo após criação confirmada;
- não há feedback por query string/redirect.

Com este pacote, os workspaces Centro Cirúrgico/CME mapeados nesta frente ficam convertidos para feedback em segundo plano. Isso **não** declara homologação presencial nem valida protocolos/equipamentos institucionais.

## Gates e critério de merge

1. confirmar GitHub, Supabase e Vercel antes da escrita;
2. executar CI completo no SHA final;
3. verificar Vercel no **mesmo SHA final**;
4. revisar threads/reviews;
5. mesclar somente com gates verdes;
6. após merge, confirmar nova `main` e produção correspondente;
7. nunca usar preview intermediário como gate de outro head;
8. rate limit externo do Vercel mantém a PR aberta e não justifica empty commit.

Este status descreve maturidade técnica e integração confirmadas. **Não declara homologação hospitalar, clínica, TISS, financeira ou fiscal.**
