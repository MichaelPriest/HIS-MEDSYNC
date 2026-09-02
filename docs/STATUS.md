# Estado real da implementação

Atualizado em 2026-09-01.

Este documento registra o estado **real confirmado** do MedSync HIS. Rota, tabela, migration, teste ou deploy verde não equivalem a homologação hospitalar; homologação depende de validação operacional, integrações externas e dados institucionais reais.

## Referência atual

- `main`: `202326decbd3a2ab88196b4288d79da9d8754b18`, merge da PR #121, que consolidou a cadeia cumulativa #116–#121.
- O head cumulativo da #121, `fe4ddccb8b39903c7bce491942631356434060d9`, passou CI #896 completamente verde e Vercel `success` antes do merge, sem reviews/threads bloqueantes.
- A produção do **merge SHA** `202326de...` ainda não está confirmada: o GitHub/Vercel do pós-merge retornou novamente `Deployment rate limited`. A listagem do Vercel mostra `READY` apenas para o preview do head `fe4ddccb...`, não para o merge SHA. Portanto não declarar a nova `main` em produção ainda.
- A última produção de `main` confirmada por SHA continua `c91d2ebccb1a549b9bae8db24b24c3d6877db04c` (PR #113), até que exista deployment de produção do merge `202326de...` ou posterior.
- As PRs intermediárias #116–#120 foram incorporadas pela PR cumulativa #121; o GitHub já reconhece os commits como mesclados na `main`.
- Pacote atual — Internação/NIR: branch `feat/internacao-nir-background-saves`, baseada no head consolidado da #121. A alocação de leito passa a usar `BackgroundActionState` + `useActionState`, preservando `movimentar_internacao_leito` como autoridade transacional. Sem migration, schema, RLS ou RPC novo.
- PR #111 permanece aberta para fallback comercial TUSS; a migration correspondente já está aplicada no Supabase e não deve ser confundida com homologação da PR.

## Princípios obrigatórios

- Atendimento/RA e prontuário longitudinal permanecem como eixo do episódio.
- Escritas críticas usam RPCs/transações existentes com autenticação, escopo empresa/unidade, RBAC e RLS; não reabrir DML paralelo para contornar segurança.
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
| Diagnóstico por Imagem / RIS | Operação e editor/liberação de laudos consolidados em `main` pela #121. | PACS/visualizador real e homologação por modalidade |
| Base de Conhecimento | `/manual` com 17 guias, busca, filtros, público, passos, alertas e fontes versionadas. | confirmar produção da `main`, ampliar ajuda contextual e governança |
| GED | Storage privado, versões, hash, assinatura e mudanças de status inline consolidadas pela #121. | retenção, temporalidade e governança documental |
| Centro Cirúrgico / CME | Núcleo/procedimentos, Anestesia/RPA, Suprimentos e CME dedicada consolidados pela #121, ligados ao mesmo RA e RPCs canônicos. | homologação presencial de cirurgia/CME, equipamentos, indicadores, termos e protocolos locais |
| Internação / NIR | Admissão/leito, alta, censo, diárias e transferências interunidades existem. Pacote atual converte a alocação NIR para feedback inline. | concluir gate/merge do NIR; depois gestão operacional de leitos, transferências e alta sem reload; homologação NIR |
| Compras / Almoxarifado / Estoque | Cotação, pedido, recebimento, lote, saldo, inventário, reposição e transferências transacionais. | alçadas reais, curva ABC, inventários e mutações legadas |
| Comercial / Contratos / Tabelas | Contratos, versões, itens, auditoria e AMB estruturada. | referências reais, precificação e mapeamentos |
| Urgência / Emergência | Transições, prioridade, SLA, reavaliação e observação com base operacional. | sincronizar cadeia de PRs, parametrização e homologação |
| Faturamento / TISS / Financeiro | Produção, conta, TISS, glosa/recurso, recebíveis, conciliação e NFS-e têm fundações transacionais. | XSD/adapters reais, fechamento, precificação e homologação |
| Auditoria / Contas Médicas | Fila pós-alta, revalidação e handoff corrigidos nas PRs #108/#109. | homologar ciclo pós-alta ponta a ponta |

## Supabase — referência confirmada

A migration mais recente continua `20260901225717_faturamento_fallback_comercial_tuss`; entre as imediatamente anteriores estão `20260901223840_auditoria_trigger_liberacao_finalizado_em` e `20260831035056_auditoria_autorizacao_unificada`. A cadeia #116–#121 e o pacote NIR atual não adicionam migration.

## Internação/NIR — pacote atual

A alocação da fila regulatória preserva o RPC `movimentar_internacao_leito(uuid,uuid,text)`. O banco continua responsável por:

- autenticação, escopo empresa/unidade e permissões `leitos.gerenciar` / `internacao.movimentar` / `internacao.gerenciar`;
- lock da internação e do leito;
- internação ativa e ausência/transferência de leito;
- disponibilidade e ocupação concorrente;
- isolamento, restrição de sexo e acomodação;
- reserva ativa vinculada ao mesmo atendimento quando o leito está reservado;
- ocupação do destino, consumo da reserva, atualização de internação/atendimento e registro em `movimentacoes_leitos`.

A tela mantém prioridade por risco/espera, compatibilidade visual e filtros `q`, `risco` e `setor`. Esses filtros continuam na URL por serem consulta deliberada. Sucesso/erro de alocação deixa de usar query string e passa a ser inline por paciente. NIR, Internação, mapa de leitos e prontuário são revalidados após confirmação.

## Gates e critério de merge

1. confirmar GitHub, Supabase e Vercel antes da escrita;
2. executar CI completo no SHA final;
3. verificar Vercel no **mesmo SHA final**;
4. revisar threads/reviews;
5. mesclar somente com gates verdes;
6. após merge, confirmar nova `main` e produção correspondente;
7. nunca usar preview intermediário como gate de outro head;
8. rate limit externo do Vercel não justifica empty commit.

Este status descreve maturidade técnica e integração confirmadas. **Não declara homologação hospitalar, clínica, TISS, financeira ou fiscal.**
