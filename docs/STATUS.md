# Estado real da implementação

Atualizado em 2026-09-02.

Este documento registra o estado **real confirmado** do MedSync HIS. Rota, tabela, migration, teste ou deploy verde não equivalem a homologação hospitalar; homologação depende de validação operacional, integrações externas e dados institucionais reais.

## Referência atual

- `main`: `202326decbd3a2ab88196b4288d79da9d8754b18`, merge da PR #121, que consolidou a cadeia cumulativa #116–#121.
- O head cumulativo da #121, `fe4ddccb8b39903c7bce491942631356434060d9`, passou CI #896 completamente verde e Vercel `success` antes do merge, sem reviews/threads bloqueantes.
- A produção do merge SHA `202326de...` ainda não está confirmada: o pós-merge retornou `Deployment rate limited`. A última produção de `main` confirmada por SHA permanece `c91d2ebccb1a549b9bae8db24b24c3d6877db04c` até existir deployment de produção do merge atual ou posterior.
- PR #122 — Internação/NIR: head `d92c8132373d79372ed0ae89b7a4fa6d6324d30d`, CI #898 completamente verde, sem reviews/threads bloqueantes; Vercel do mesmo SHA falhou somente por rate limit. A PR permanece aberta e não recebeu empty commit para retry.
- Pacote atual — Redesign do Ciclo da Receita: branch `feat/faturamento-redesign-workspace`, empilhada sobre a #122. A PR #123 amplia o redesign para detalhes operacionais e instala validação XSD real do Padrão TISS Comunicação 04.03.00.
- O CI #917, no SHA `e3382e648954636871cd71e6c1a5f2f36f4ff964`, falhou somente por warnings de parâmetros não usados sob `eslint --max-warnings=0`; esses warnings foram corrigidos nos commits posteriores. O novo head ainda precisa passar o CI completo antes de merge.
- PR #111 permanece aberta para fallback comercial TUSS; a migration correspondente já está aplicada no Supabase e não deve ser confundida com homologação da PR.

## Princípios obrigatórios

- Atendimento/RA e prontuário longitudinal permanecem como eixo do episódio.
- Escritas críticas usam RPCs/transações existentes com autenticação, escopo empresa/unidade, RBAC e RLS; não reabrir DML paralelo para contornar segurança.
- Medicamentos seguem `Prescrição → Farmácia → Dispensação → Administração`.
- Não criar pacientes, unidades, leitos, estoques, lotes, valores, autorizações, contas, glosas, NFS-e ou fatos clínicos fictícios para completar fluxo.
- Migrations aplicadas no Supabase devem permanecer versionadas; drift deve ser explícito.
- Salvamentos normais usam feedback inline. `redirect()`, `window.location` e `router.refresh()` não são mecanismos de sucesso/erro.
- A Base de Conhecimento em `/manual` ensina o fluxo implementado, sem substituir protocolo institucional ou homologação.
- XML TISS não é considerado válido apenas por ser XML bem-formado: envio exige resultado XSD real persistido pelo banco.

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
| Faturamento / TISS / Financeiro | Workspace unificado; ledger de recebíveis, operações principais da conta, revalidação da guia e operações de lote foram migrados para feedback inline. XSD ANS 04.03.00 foi integrado com validação libxml2/WASM e persistência transacional. | CI/Vercel do SHA final; salvar lançamentos/grupos/atos ainda legados; gerar mensagem TISS final completa; homologação com operadoras |
| Auditoria / Contas Médicas | Fila pós-alta, revalidação e handoff corrigidos nas PRs #108/#109. | homologar ciclo pós-alta ponta a ponta |

## Supabase — referência confirmada

A migration mais recente é `20260902144511_tiss_xsd_ans_040300`. Ela adiciona `registrar_validacao_xsd_tiss_operacional`, RPC `SECURITY DEFINER` que persiste o resultado XSD em `tiss_xmls` e `tiss_lotes`, exige escopo/permissão, confere versão e proíbe validar o artefato `PRELIMINAR_INTERNO`.

Imediatamente anteriores: `20260901225717_faturamento_fallback_comercial_tuss` e `20260901223840_auditoria_trigger_liberacao_finalizado_em`.

A tabela `tiss_versoes` já possui a versão ativa `2026-07`: Organizacional `202607`, Conteúdo/Estrutura `202511`, TUSS `202607`, Segurança/Privacidade `202511`, Comunicação principal `04.03.00` e secundária `01.06.00`.

## XSD ANS — Comunicação 04.03.00

O contrato de schemas está em `vendor/tiss/040300/manifest.json` e documentado em `docs/TISS_XSD_ANS.md`.

O conjunto operacional contém sete arquivos:

- `tissSimpleTypesV4_03_00.xsd`;
- `tissComplexTypesV4_03_00.xsd`;
- `tissGuiasV4_03_00.xsd`;
- `tissV4_03_00.xsd`;
- `tissWebServicesV4_03_00.xsd`;
- `tissAssinaturaDigital_v1.01.xsd`;
- `xmldsig-core-schema.xsd`.

Os bytes são materializados no `prebuild` por `scripts/sync-tiss-ans-xsd.mjs`. O script aceita o arquivo somente se o SHA-256 coincidir com o manifesto; divergência interrompe o build. O pacote original de referência possui SHA-256 `db8640e1c3b87085892f54f838bfcea9934439ff365798c8428559f88c13d62d`.

A validação real está em `src/modules/tiss/xsd-validator.ts`, usando `xmllint-wasm` 5.3.0/libxml2. DTD e `ENTITY` são recusados, dependências são pré-carregadas localmente e o resultado recebe SHA-256 antes de ser persistido.

`xsd_validado=true` só pode ser gravado pelo fluxo transacional. `registrar_envio_manual_tiss_operacional` continua exigindo XSD válido e recusando `PRELIMINAR_INTERNO`.

## Redesign do Ciclo da Receita — pacote atual

A arquitetura visual/operacional compartilha `BillingWorkspaceNav` entre `/faturamento` e `/financeiro`, mantendo uma navegação única para Visão Geral, Produção, Guias TISS, Lotes, Glosas, Recursos, Recebíveis, Notas fiscais e Financeiro.

Mudanças implementadas:

- nova **Central do Ciclo da Receita** com KPIs, fila de ação, atalhos, lotes recentes, pós-alta pendente, busca e filtros de contas;
- criação de conta em modal pesquisável por paciente/CPF/RA/registro/atendimento;
- índices próprios para Guias, Recursos e Recebíveis;
- Glosas, Lotes, Recursos, Guias, Produção, Recebíveis e NFS-e redesenhados;
- Resumo Financeiro com prioridades, agenda de recebimento, glosas, saldo e NFS-e;
- subnavegação da conta hospitalar com ícones;
- `BillingModal` reutilizável e acessível;
- detalhe do lote com protocolo, glosa, importação XML e registro de envio manual em modais.

Ações já convertidas para `BackgroundActionState` + `useActionState` incluem:

- abertura de conta hospitalar;
- criação de lote;
- criação de recurso de glosa;
- criação de rascunho NFS-e;
- sincronização de contingência da produção;
- baixa, conciliação e estorno do recebível;
- competência/desconto, sincronização, recálculo, validação e exclusão de item na conta hospitalar;
- revalidação da Guia TISS;
- protocolo, glosa, importação XML e registro de envio manual do lote;
- validação XSD de artefato TISS.

A geração da Guia TISS e demais mudanças genuínas de etapa podem navegar após confirmação do banco. Erros de salvamento normal permanecem inline.

Ainda legados no detalhe da conta: adicionar/editar lançamento e gestão dos grupos/atos, que concentram regras comerciais extensas e devem ser convertidos sem duplicar a autoridade do banco.

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
