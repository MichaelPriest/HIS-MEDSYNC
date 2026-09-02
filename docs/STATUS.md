# Estado real da implementação

Atualizado em 2026-09-02.

Este documento registra o estado **real confirmado** do MedSync HIS. Rota, tabela, migration, teste ou deploy verde não equivalem a homologação hospitalar; homologação depende de validação operacional, integrações externas e dados institucionais reais.

## Referência atual

- `main`: `202326decbd3a2ab88196b4288d79da9d8754b18`, merge da PR #121, que consolidou a cadeia cumulativa #116–#121.
- O head cumulativo da #121, `fe4ddccb8b39903c7bce491942631356434060d9`, passou CI #896 completamente verde e Vercel `success` antes do merge, sem reviews/threads bloqueantes.
- A produção do merge SHA `202326de...` ainda não está confirmada: o pós-merge retornou `Deployment rate limited`. A última produção de `main` confirmada por SHA permanece `c91d2ebccb1a549b9bae8db24b24c3d6877db04c` até existir deployment de produção do merge atual ou posterior.
- PR #122 — Internação/NIR: head `d92c8132373d79372ed0ae89b7a4fa6d6324d30d`, CI #898 completamente verde, sem reviews/threads bloqueantes; Vercel do mesmo SHA falhou somente por rate limit. A PR permanece aberta e não recebeu empty commit para retry.
- Pacote atual — Redesign do Ciclo da Receita: branch `feat/faturamento-redesign-workspace`, empilhada sobre a #122. O objetivo é reorganizar Faturamento/TISS/Glosas/Recursos/Recebíveis/NFS-e/Financeiro em um workspace único, com ícones, grids, filtros e modais, preservando regras financeiras e RPCs existentes.
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
| Internação / NIR | A #122 converte a alocação NIR para feedback inline e mantém `movimentar_internacao_leito` como autoridade. | Vercel/merge; depois gestão operacional de leitos, transferências e alta sem reload; homologação NIR |
| Compras / Almoxarifado / Estoque | Cotação, pedido, recebimento, lote, saldo, inventário, reposição e transferências transacionais. | alçadas reais, curva ABC, inventários e mutações legadas |
| Comercial / Contratos / Tabelas | Contratos, versões, itens, auditoria e AMB estruturada. | referências reais, precificação e mapeamentos |
| Urgência / Emergência | Transições, prioridade, SLA, reavaliação e observação com base operacional. | parametrização e homologação |
| Faturamento / TISS / Financeiro | Fundações transacionais já existiam. O pacote atual redesenha as centrais de Contas, Produção, Guias, Lotes, Glosas, Recursos, Recebíveis, NFS-e e Financeiro em um Ciclo da Receita único. | validar CI; migrar depois as mutações legadas de detalhes/ledger; XSD/adapters reais, fechamento e homologação |
| Auditoria / Contas Médicas | Fila pós-alta, revalidação e handoff corrigidos nas PRs #108/#109. | homologar ciclo pós-alta ponta a ponta |

## Supabase — referência confirmada

A migration mais recente continua `20260901225717_faturamento_fallback_comercial_tuss`; entre as imediatamente anteriores estão `20260901223840_auditoria_trigger_liberacao_finalizado_em` e `20260831035056_auditoria_autorizacao_unificada`. A #122 e o redesign atual não adicionam migration, schema, RLS ou RPC.

## Redesign do Ciclo da Receita — pacote atual

A arquitetura visual/operacional passa a compartilhar `BillingWorkspaceNav` entre `/faturamento` e `/financeiro`, mantendo uma navegação única para Visão Geral, Produção, Guias TISS, Lotes, Glosas, Recursos, Recebíveis, Notas fiscais e Financeiro.

Mudanças implementadas neste pacote:

- nova **Central do Ciclo da Receita** com KPIs, fila de ação, atalhos, lotes recentes, pós-alta pendente, busca e filtros de contas;
- criação de conta em modal pesquisável por paciente/CPF/RA/registro/atendimento;
- nova rota/index **`/faturamento/guias`**, antes inexistente, com filtros, críticas abertas e status de validação;
- nova rota/index **`/faturamento/recursos`**, antes inexistente, com acompanhamento por paciente, guia, operadora, protocolo e valores recursados/deferidos;
- Central de Glosas em grid/tabela operacional, com recurso aberto em modal em vez de formulário permanente em cada item;
- Central de Lotes com filtros por status/competência, KPIs e criação em modal;
- Livro de Produção com busca/filtros e sincronização de contingência em modal;
- nova rota/index **`/financeiro/recebiveis`**, antes inexistente, com vencidos, competência, status, saldo e acesso ao ledger;
- Resumo Financeiro redesenhado com prioridades, agenda de recebimento, glosas, saldo e NFS-e;
- Central de NFS-e com filtros, indicadores e criação de rascunho em modal;
- subnavegação da conta hospitalar redesenhada com ícones para Resumo, Lançamentos, Catálogo e Cirurgia/SADT;
- componente `BillingModal` reutilizável com `role="dialog"`, `aria-modal`, fechamento por Escape e bloqueio de scroll.

Ações convertidas para `BackgroundActionState` + `useActionState`:

- abertura de conta hospitalar;
- criação de lote via `criar_lote_tiss_transacional`;
- criação de recurso via `criar_recurso_glosa_tiss_transacional`;
- criação de rascunho NFS-e via `criar_nfse_lote_operacional`;
- sincronização de contingência via `sincronizar_producao_atendimento`.

Navegação após essas ações só ocorre quando existe uma nova etapa real: conta, lote, recurso ou nota confirmados pelo banco. Erros permanecem inline e os campos do modal não são descartados.

Ainda não convertidos neste pacote: baixas, conciliações, estornos e demais mutações de detalhe financeiro/NFS-e que permanecem em actions legadas. Devem ser migradas em pacotes posteriores sem romper o ledger append-only nem os RPCs fiscais/financeiros.

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
