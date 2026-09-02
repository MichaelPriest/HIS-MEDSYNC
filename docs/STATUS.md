# Estado real da implementação

Atualizado em 2026-09-02.

Este documento registra o estado **real confirmado** do MedSync HIS. Rota, tabela, migration, teste ou deploy verde não equivalem a homologação hospitalar; homologação depende de validação operacional, integrações externas e dados institucionais reais.

## Referência atual

- `main`: `202326decbd3a2ab88196b4288d79da9d8754b18`, merge da PR #121, que consolidou a cadeia cumulativa #116–#121.
- O head cumulativo da #121, `fe4ddccb8b39903c7bce491942631356434060d9`, passou CI #896 completamente verde e Vercel `success` antes do merge, sem reviews/threads bloqueantes.
- A produção do merge SHA `202326de...` ainda não está confirmada: o pós-merge retornou `Deployment rate limited`. A última produção de `main` confirmada por SHA permanece `c91d2ebccb1a549b9bae8db24b24c3d6877db04c` até existir deployment de produção do merge atual ou posterior.
- PR #122 — Internação/NIR continua aberta sobre `main`; head-base confirmado `1b513a0cf898728b44c894b7d322c3a58eff2768` após receber o redesign do Ciclo da Receita.
- PR #123 — redesign do Ciclo da Receita foi mesclada na branch da #122 como merge commit `1b513a0cf898728b44c894b7d322c3a58eff2768`; portanto não deve ser mesclada separadamente em `main`.
- PR #124 — `feat(tiss): concluir mensagem final e XSD ANS 4.03.00` está aberta e empilhada sobre a #122. O pacote implementa a mensagem final `ENVIO_LOTE_GUIAS`, MD5 TISS, XSD oficial fail-closed, staging/promoção transacional, domínios wire e saída ISO-8859-1.
- O CI #954 chegou aos testes XSD reais e expôs duas incompatibilidades de domínio: UF do conselho em sigla versus `dm_UF` numérico e um fixture SP/SADT com `tipoAtendimento=05`, não aceito pelo schema. O wire agora converte deterministicamente UF válida (`SP → 35`) sem alterar o snapshot, recusa valores desconhecidos e o banco também bloqueia domínios inválidos. O fixture positivo foi corrigido para código aceito em vez de afrouxar o XSD.
- Os status Vercel dos heads recentes da #124 continuam falhando somente por `build-rate-limit`; isso bloqueia merge, mas não autoriza empty commit ou promoção de um SHA diferente.
- PR #111 permanece aberta para fallback comercial TUSS; a migration correspondente já está aplicada no Supabase e não deve ser confundida com homologação da PR.

## Princípios obrigatórios

- Atendimento/RA e prontuário longitudinal permanecem como eixo do episódio.
- Escritas críticas usam RPCs/transações com autenticação, escopo empresa/unidade, RBAC e RLS; não abrir DML paralelo para contornar segurança.
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
| Centro Cirúrgico / CME | Núcleo/procedimentos, Anestesia/RPA, Suprimentos e CME dedicada consolidados pela #121, ligados ao mesmo RA e RPCs canônicos. | homologação presencial de cirurgia/CME, equipamentos, indicadores e protocolos locais |
| Internação / NIR | A #122 converte a alocação NIR para feedback inline e mantém `movimentar_internacao_leito` como autoridade. | concluir cadeia #124 → #122, Vercel/merge e homologação NIR |
| Compras / Almoxarifado / Estoque | Cotação, pedido, recebimento, lote, saldo, inventário, reposição e transferências transacionais. | alçadas reais, curva ABC, inventários e mutações legadas |
| Comercial / Contratos / Tabelas | Contratos, versões, itens, auditoria e AMB estruturada. | referências reais, precificação e mapeamentos |
| Urgência / Emergência | Transições, prioridade, SLA, reavaliação e observação com base operacional. | parametrização e homologação |
| Faturamento / TISS / Financeiro | Workspace unificado e redesign #123 incorporado à #122. A #124 implementa `mensagemTISS/ENVIO_LOTE_GUIAS`, MD5 regulatório, XSD oficial, solicitante SP/SADT separado, origem/unidade por item, domínios `dm_UF`/tipo atendimento, staging transacional e saída ISO-8859-1. | CI completo do candidato final; Vercel rate-limited; merge cumulativo; lançamentos/grupos/atos ainda legados; homologação com operadoras |
| Auditoria / Contas Médicas | Fila pós-alta, revalidação e handoff corrigidos nas PRs #108/#109. | homologar ciclo pós-alta ponta a ponta |

## Supabase — referência confirmada

A migration mais recente aplicada é `20260902191102_tiss_dominios_wire_040300`.

Ela instala `uf_ans_tiss_040300`, preservando a UF original no snapshot e permitindo converter apenas na borda para o domínio numérico do XSD. Também endurece `validar_guia_tiss_comunicacao_040300_internal`: UF do executante/solicitante inválida, tipo de consulta fora de `dm_tipoConsulta` e `tipoAtendimento` SP/SADT fora do domínio `01,02,03,04,08,09,10,13,23` viram críticas impeditivas.

Uma verificação read-only após a migration encontrou `0` guias reais com UF do executante inválida, `0` SP/SADT com tipo de atendimento inválido e `0` com UF do solicitante inválida. Nenhum fato assistencial foi alterado para obter esse resultado.

A cadeia TISS 04.03.00 aplicada nesta evolução inclui:

- `20260902144511_tiss_xsd_ans_040300` — autoridade transacional do resultado XSD;
- `20260902153013_tiss_xsd_ans_040300_fix_lote_columns` — correção e endurecimento de erros/hash;
- `20260902164216_tiss_lote_xsd_040300_hardening` — lote homogêneo, limite de 100 guias e número compatível com XSD;
- `20260902165336_tiss_guia_complemento_comunicacao_040300` — campos de Comunicação não inferíveis;
- `20260902173406_tiss_xml_final_040300_transacional` — staging e promoção da mensagem final;
- `20260902173810_tiss_guia_item_reducao_snapshot_040300` — fator redução/acréscimo no snapshot;
- `20260902175402_tiss_guia_solicitante_validacao_integrada_040300` — solicitante SP/SADT e integração da validação 04.03.00 à validação principal;
- `20260902180109_tiss_guia_item_origem_snapshot_040300` — origem do item para separar procedimento de despesa;
- `20260902180256_tiss_item_unidade_despesa_040300` — unidade de medida TISS para outras despesas;
- `20260902183026_tiss_envio_final_only_040300` — envio manual final-only;
- `20260902191102_tiss_dominios_wire_040300` — domínios UF/Consulta/SP-SADT alinhados ao XSD.

A tabela `tiss_versoes` mantém a versão ativa Julho/2026: Organizacional `202607`, Conteúdo/Estrutura `202511`, TUSS `202607`, Segurança/Privacidade `202511`, Comunicação principal interna `04.03.00` e secundária `01.06.00`.

## XSD ANS — Comunicação interna 04.03.00 / wire 4.03.00

O contrato de schemas está em `vendor/tiss/040300/manifest.json` e documentado em `docs/TISS_XSD_ANS.md`.

O conjunto operacional contém sete arquivos:

- `tissSimpleTypesV4_03_00.xsd`;
- `tissComplexTypesV4_03_00.xsd`;
- `tissGuiasV4_03_00.xsd`;
- `tissV4_03_00.xsd`;
- `tissWebServicesV4_03_00.xsd`;
- `tissAssinaturaDigital_v1.01.xsd`;
- `xmldsig-core-schema.xsd`.

Os bytes são materializados por `scripts/sync-tiss-ans-xsd.mjs` no `pretest` e novamente no `prebuild`. O script aceita cada arquivo somente se o SHA-256 coincidir com o manifesto; divergência interrompe testes/build. O pacote original de referência possui SHA-256 `db8640e1c3b87085892f54f838bfcea9934439ff365798c8428559f88c13d62d`.

A validação real está em `src/modules/tiss/xsd-validator.ts`, usando `xmllint-wasm` 5.3.0/libxml2. DTD e `ENTITY` são recusados, dependências são pré-carregadas localmente e o XML recebe SHA-256 antes da persistência do resultado.

A mensagem final usa `src/modules/tiss/mensagem-final-040300.ts` + `mensagem-final-wire-040300.ts`. O catálogo interno continua `04.03.00`, enquanto a tag XML `Padrao` usa `4.03.00`, conforme `dm_versao` oficial.

O fluxo final:

1. carrega lote, guias, itens e críticas reais;
2. impede lote misto e campos obrigatórios ausentes;
3. diferencia procedimentos e outras despesas pela origem fotografada;
4. exige unidade TISS das despesas sem inventar unidade padrão;
5. normaliza UF válida apenas no wire e recusa domínios incompatíveis;
6. gera Consulta, SP/SADT ou Resumo de Internação;
7. calcula MD5 TISS sobre valores das tags em ordem física/LATIN1;
8. valida `mensagemTISS` contra `tissV4_03_00.xsd`;
9. salva apenas candidato XSD válido;
10. PostgreSQL recalcula SHA-256/MD5 e confere número/tipo de guia;
11. promove para `ENVIO_LOTE_GUIAS` somente após o RPC de validação.

Os testes executam XSD real dos três tipos atualmente suportados. O download e o transporte HTTP/SOAP convertem para bytes ISO-8859-1 quando esse charset é declarado. O SOAP remove a declaração XML da mensagem interna antes do envelope.

## Redesign do Ciclo da Receita — PR #123 incorporada à #122

A arquitetura compartilha `BillingWorkspaceNav` entre `/faturamento` e `/financeiro`, com navegação única para Visão Geral, Produção, Guias TISS, Lotes, Glosas, Recursos, Recebíveis, Notas fiscais e Financeiro.

Mudanças implementadas incluem:

- Central do Ciclo da Receita com KPIs, fila de ação, atalhos, lotes recentes, pós-alta pendente, busca e filtros de contas;
- criação de conta em modal pesquisável por paciente/CPF/RA/registro/atendimento;
- índices próprios para Guias, Recursos e Recebíveis;
- Glosas, Lotes, Recursos, Guias, Produção, Recebíveis e NFS-e redesenhados;
- Resumo Financeiro com prioridades, agenda de recebimento, glosas, saldo e NFS-e;
- subnavegação da conta hospitalar com ícones;
- `BillingModal` reutilizável e acessível;
- detalhe do lote com protocolo, glosa, importação XML, XSD e registro de envio manual.

Ações convertidas para `BackgroundActionState` + `useActionState` incluem abertura de conta, criação de lote/recurso/NFS-e, sincronização de produção, ledger financeiro, operações principais da conta, revalidação da Guia TISS, protocolo/glosa/importação/envio manual e validação XSD.

Ainda legados no detalhe da conta: adicionar/editar lançamento e gestão dos grupos/atos, que concentram regras comerciais extensas e devem ser convertidos sem duplicar a autoridade do banco.

## Mensagem final TISS — PR #124

A #124 substitui a ação operacional preliminar do lote pelo gerador final sem apagar o histórico `PRELIMINAR_INTERNO`.

Novos pontos principais:

- `TissFinalMessageForm` + `gerarMensagemTissFinalBackground` com feedback inline;
- complementos da Guia TISS e unidades de despesa via `useActionState`;
- serializer canônico + wire-format ANS;
- MD5 TISS em LATIN1 e SHA-256 técnico;
- validação de domínios em duas camadas: Guia/RPC e serializer wire;
- XSD antes do staging e dupla conferência de hash no banco;
- promoção `ENVIO_LOTE_GUIAS_CANDIDATO → ENVIO_LOTE_GUIAS` somente após validação;
- download e webservice em bytes compatíveis com a declaração ISO-8859-1;
- envio manual e webservice restritos à mensagem final validada.

A PR ainda está em gate. O CI completo e o Vercel do **mesmo SHA final** precisam estar verdes antes de incorporar a #124 à #122. Rate limit do Vercel mantém a PR aberta mesmo se o CI concluir verde.

## Gates e critério de merge

1. confirmar GitHub, Supabase e Vercel antes da escrita;
2. executar CI completo no SHA final;
3. verificar Vercel no **mesmo SHA final**;
4. revisar threads/reviews;
5. mesclar #124 na #122 somente com gates verdes;
6. executar novamente os gates do novo head cumulativo da #122;
7. mesclar #122 em `main` somente com o head cumulativo verde;
8. após merge, confirmar nova `main` e produção correspondente;
9. nunca usar preview intermediário como gate de outro head;
10. rate limit externo do Vercel não justifica empty commit.

Este status descreve maturidade técnica e integração confirmadas. **Não declara homologação hospitalar, clínica, TISS, financeira ou fiscal.**
