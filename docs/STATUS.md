# Estado real da implementação

Atualizado em 2026-08-24.

Este documento separa **estrutura criada**, **funcionalidade inicial** e **módulo ainda não homologado**. O MedSync HIS continua em desenvolvimento e não deve ser considerado pronto para produção hospitalar apenas porque determinado menu/tabela existe.

| Área | Estado atual | Próximos pontos críticos |
|---|---|---|
| Fundação / Auth / multiempresa | Funcional em evolução; RBAC granular, navegação por perfil, central de acessos e testes automatizados ampliados no PR #6 | proteção granular progressiva de server actions/RPCs, testes RLS multi-tenant completos e break-glass clínico |
| Interface / navegação | Funcional em evolução; áreas de trabalho, navegação contextual, contexto do episódio e redução progressiva de formulários consolidados no PR #5; filtro de navegação por permissões no PR #6 | acessibilidade, busca global ampliada e testes de usabilidade |
| Pacientes / Profissionais / Convênios | Funcional em evolução | validações, documentos, contratos e fluxos especializados |
| Totem / Senhas / Recepção | Base funcional | regras operacionais, impressão e homologação de painéis |
| Atendimento / ADT | Base funcional | completar regras de episódios e documentos |
| Central de Guias | Base funcional; UX consolidada por fila/status no PR #5 | integração automática com solicitações e operadoras |
| Triagem / Fila médica | Base funcional | protocolos/escalas e regras clínicas |
| Prontuário | Parcial; usado como workspace central do episódio no PR #5 | aprofundamento clínico completo |
| Enfermagem | Parcial | SAE, checagem, evolução, balanço, escalas |
| Farmácia | Parcial | dispensação, devolução, estoque e rastreabilidade |
| Laboratório / Imagem | Parcial | execução, resultados/laudos e liberação |
| Internação | Parcial | mapa de leitos, movimentações, diárias e alta |
| Compras | Base funcional; UX consolidada por operação no PR #5 | alçadas, pedido automático, recebimento parcial/divergência |
| Almoxarifado | Base funcional; UX consolidada em visão operacional no PR #5 | inventário, requisições, reposição, rastreabilidade |
| Comercial / Credenciamento | Base avançada | alimentar contratos reais e regras específicas |
| Tabelas comerciais | Base avançada | importar/gerenciar dados reais licenciados e versões |
| Auditoria pós-alta | Base funcional | regras automáticas, autorização RPC específica e auditoria clínica/administrativa |
| Contas Médicas | Base funcional | checklist por convênio, autorização RPC específica e automações de conferência |
| GED | Base funcional | upload/visualização/versionamento/assinaturas completos |
| Conta hospitalar | Base funcional | pacotes, consumo automático e fechamento operacional |
| Motor contratual | Base avançada | ampliar regras reais por contrato, autorização RPC específica e homologar cálculos |
| TISS | Estrutura funcional, não homologada | XSD ANS, XML definitivo, adapters de operadoras |
| Glosas / Recursos | Base funcional | importação automática de demonstrativos e XML definitivo |
| Financeiro | Parcial; integrado visualmente ao ciclo da receita no PR #5 | baixas, retenções, conciliação, contas a pagar e caixa |
| NFS-e | Estrutura | adapters reais das prefeituras/provedores utilizados |
| Diretoria | Base | KPIs, filtros, metas, drill-down e governança |
| Centro Cirúrgico / CME | Não concluído | desenvolver fluxo completo |
| Urgência/Emergência | Não concluído | desenvolver fluxo completo |
| Nutrição / Hemoterapia etc. | Não iniciado/concluído | definir escopo e implementar |

## Segurança e autorização

O PR #6 introduz catálogo granular de permissões, navegação por perfil e uma Central de Acessos em `/configuracoes/acessos`. A matriz operacional exibida pela aplicação usa `public.permissoes` como fonte de verdade; o catálogo TypeScript existe apenas para os códigos que o código da aplicação precisa referenciar estaticamente.

O CI do PR #6 executa `lint`, `typecheck`, testes unitários, `build`, instalação do Chromium e smoke E2E público com Playwright. O endurecimento dos RPCs `SECURITY DEFINER` continua sendo incremental e deve preservar apenas endpoints públicos intencionais (por exemplo, totem/painel) e exigir permissão funcional explícita nos fluxos autenticados sensíveis.

## Travas de negócio já planejadas/implementadas

O faturamento de convênio deve respeitar a cadeia:

`Alta → Auditoria → Contas Médicas → Validação da conta → Guia TISS → Lote → XML validado → envio/manual → retorno → financeiro`.

A conta não deve pular Auditoria ou Contas Médicas. XML preliminar não deve ser tratado como TISS homologado enquanto não houver validação pelos schemas oficiais aplicáveis.

## Dependências externas

- projetos Supabase corretamente configurados por ambiente;
- variáveis e segredos na Vercel;
- schemas/documentação oficial TISS aplicável;
- credenciais/endpoints de homologação das operadoras;
- certificados quando exigidos;
- contratos/tabelas comerciais reais e licenciadas;
- credenciais/layouts dos provedores NFS-e utilizados.

## Qualidade e deploy

O projeto deve continuar passando por `lint`, `typecheck`, testes, `build` e smoke E2E. O check da Vercel pode falhar por **build rate limit**; esse caso deve ser distinguido de falha real de compilação.

Consulte também [`MANUAL.md`](MANUAL.md), [`UX-CONSOLIDACAO.md`](UX-CONSOLIDACAO.md), [`MATRIZ_PERMISSOES.md`](MATRIZ_PERMISSOES.md), [`SEGURANCA.md`](SEGURANCA.md) e o módulo interno `/manual`.