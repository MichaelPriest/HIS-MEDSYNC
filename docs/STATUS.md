# Estado real da implementação

Atualizado em 2026-08-24.

Este documento separa **estrutura criada**, **funcionalidade inicial** e **módulo ainda não homologado**. O MedSync HIS continua em desenvolvimento e não deve ser considerado pronto para produção hospitalar apenas porque determinado menu/tabela existe.

| Área | Estado atual | Próximos pontos críticos |
|---|---|---|
| Fundação / Auth / multiempresa | Funcional em evolução; catálogo RBAC granular, perfis por empresa/unidade, central de acessos e auditoria de alterações adicionados no P0 | aplicar permissões granulares a todas as server actions/RPCs, ampliar testes RLS entre tenants e implementar break-glass clínico |
| Interface / navegação | Funcional em evolução; áreas de trabalho, navegação contextual, contexto do episódio e menu filtrado pelas permissões efetivas | acessibilidade, busca global móvel, testes de usabilidade e tratamento dedicado de acesso negado |
| Usuários / Perfis / Acessos | Base funcional P0; criação de perfil, matriz de permissões, vínculo por empresa/unidade e bloqueio de auto-revogação | convite/provisionamento de usuário, bloqueio/desbloqueio administrativo, revisão periódica de acessos e segregação de funções |
| Pacientes / Profissionais / Convênios | Funcional em evolução | validações, documentos, contratos, MPI/duplicidade e fluxos especializados |
| Totem / Senhas / Recepção | Base funcional | regras operacionais, impressão e homologação de painéis |
| Atendimento / ADT | Base funcional | completar regras de episódios e documentos |
| Central de Guias | Base funcional; UX consolidada por fila/status no PR #5 | integração automática com solicitações e operadoras |
| Triagem / Fila médica | Base funcional | protocolos/escalas e regras clínicas |
| Prontuário | Parcial; usado como workspace central do episódio no PR #5 | aprofundamento clínico, assinatura/adendo e alertas de segurança |
| Enfermagem | Parcial avançando | completar SAE, escalas, balanço, dispositivos e evolução operacional |
| Farmácia | Parcial avançando | CDS automático, dispensação/devolução completa e rastreabilidade |
| Laboratório / Imagem | Parcial avançando | interfaceamento LIS/analisadores, PACS/RIS/DICOM e homologação de liberação |
| Internação | Parcial | NIR/regulação, censo, movimentações, diárias e alta integrada |
| Compras | Base funcional; UX consolidada por operação no PR #5 | alçadas, pedido automático, recebimento parcial/divergência |
| Almoxarifado | Base funcional; UX consolidada em visão operacional no PR #5 | inventário, requisições, reposição, rastreabilidade e recall |
| Comercial / Credenciamento | Base avançada | alimentar contratos reais e regras específicas |
| Tabelas comerciais | Base avançada | importar/gerenciar dados reais licenciados e versões |
| Auditoria pós-alta | Base funcional | regras automáticas e auditoria clínica/administrativa |
| Contas Médicas | Base funcional | checklist por convênio e automações de conferência |
| GED | Base funcional | upload/visualização/versionamento/assinaturas completos |
| Conta hospitalar | Base funcional | pacotes, consumo automático e fechamento operacional |
| Motor contratual | Base avançada | ampliar regras reais por contrato e homologar cálculos |
| TISS | Estrutura funcional, não homologada | XSD ANS, XML definitivo, adapters de operadoras e homologação |
| Glosas / Recursos | Base funcional | importação automática de demonstrativos e XML definitivo |
| Financeiro | Parcial; integrado visualmente ao ciclo da receita no PR #5 | baixas, retenções, conciliação, contas a pagar, tesouraria e caixa |
| NFS-e | Estrutura | adapters reais das prefeituras/provedores utilizados |
| Diretoria | Base | KPIs, filtros, metas, drill-down e governança |
| Centro Cirúrgico / CME | Não concluído | desenvolver fluxo completo |
| Urgência/Emergência | Não concluído | desenvolver fluxo completo |
| Nutrição / Hemoterapia / UTI / CCIH | Estrutura/base assistencial, não concluída | desenvolver fluxos operacionais completos e indicadores |
| Especialidades avançadas | Registro inicial integrado ao episódio | completar ciclos clínicos de hemodiálise, oncologia, radioterapia, hemodinâmica, endoscopia, anatomia patológica, transplantes, home care, paliativos e imunização |

## Travas de negócio já planejadas/implementadas

O faturamento de convênio deve respeitar a cadeia:

`Alta → Auditoria → Contas Médicas → Validação da conta → Guia TISS → Lote → XML validado → envio/manual → retorno → financeiro`.

A conta não deve pular Auditoria ou Contas Médicas. XML preliminar não deve ser tratado como TISS homologado enquanto não houver validação pelos schemas oficiais aplicáveis.

## Segurança P0

A matriz de permissões passa a cobrir domínios assistenciais, operacionais, financeiros e corporativos. O layout carrega as permissões efetivas do usuário e mostra somente as áreas compatíveis com seus perfis. Essa filtragem é apenas uma camada de UX: o RLS do banco permanece a fronteira de segurança.

A central `/configuracoes/acessos` permite criar perfis personalizados, editar capacidades e vincular perfil a usuário no escopo da empresa ou unidade. Alterações são registradas em `auditoria_eventos`, e o perfil Administrador permanece sincronizado com o catálogo ativo para reduzir risco de lockout.

O CI passa a incluir smoke E2E público com Playwright além de lint, typecheck, testes unitários e build. Jornadas autenticadas completas ainda dependem de um projeto Supabase exclusivo de testes com dados fictícios e permanecem pendentes.

## Dependências externas

- projetos Supabase corretamente configurados por ambiente;
- projeto Supabase isolado para E2E autenticado/homologação;
- variáveis e segredos na Vercel;
- schemas/documentação oficial TISS aplicável;
- credenciais/endpoints de homologação das operadoras;
- certificados quando exigidos;
- contratos/tabelas comerciais reais e licenciadas;
- credenciais/layouts dos provedores NFS-e utilizados.

## Qualidade e deploy

O projeto deve continuar passando por `lint`, `typecheck`, testes, `build` e smoke E2E público. O check da Vercel pode falhar por **build rate limit**; esse caso deve ser distinguido de falha real de compilação.

Consulte também [`MANUAL.md`](MANUAL.md), [`MATRIZ_PERMISSOES.md`](MATRIZ_PERMISSOES.md), [`UX-CONSOLIDACAO.md`](UX-CONSOLIDACAO.md) e o módulo interno `/manual`.
