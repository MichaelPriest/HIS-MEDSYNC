# Estado real da implementação

Atualizado em 2026-08-24.

Este documento separa **estrutura criada**, **funcionalidade inicial** e **módulo ainda não homologado**. O MedSync HIS continua em desenvolvimento e não deve ser considerado pronto para produção hospitalar apenas porque determinado menu/tabela existe.

| Área | Estado atual | Próximos pontos críticos |
|---|---|---|
| Fundação / Auth / multiempresa | Funcional em evolução; RBAC granular, navegação por perfil, central de acessos e testes automatizados ampliados no PR #6 | proteção granular progressiva de server actions/RPCs, testes RLS multi-tenant completos e break-glass clínico |
| Interface / navegação | Funcional em evolução; áreas de trabalho e contexto do episódio no PR #5, RBAC no shell no PR #6 e reorganização de sidebar/topbar/menu do usuário no PR #8 | acessibilidade, busca global ampliada, troca controlada de unidade e testes de usabilidade autenticados |
| Pacientes / Profissionais / Convênios | Funcional em evolução | validações, documentos, contratos e fluxos especializados |
| Totem / Senhas / Recepção | Base funcional | regras operacionais, impressão e homologação de painéis |
| Atendimento / ADT | Base funcional | completar regras de episódios e documentos |
| Central de Guias | Base funcional; UX consolidada por fila/status no PR #5 | integração automática com solicitações e operadoras |
| Triagem / Fila médica | Base funcional | protocolos/escalas e regras clínicas |
| Prontuário | Parcial; usado como workspace central do episódio no PR #5 e recebe registros/reavaliações da Urgência no PR #7 | aprofundamento clínico completo |
| Urgência/Emergência | Base funcional no PR #7; Central de Urgência, ABCDE, risco, reavaliações e destino vinculados ao mesmo atendimento | protocolos clínicos configuráveis, SLA, observação, indicadores e homologação operacional |
| Enfermagem | Parcial | SAE, checagem, evolução, balanço, escalas |
| Farmácia | Parcial | dispensação, devolução, estoque e rastreabilidade |
| Laboratório / Imagem | Parcial | execução, resultados/laudos e liberação |
| Internação / NIR | Parcial; admissão contextual, mapa de leitos e primeira fila NIR/gestão de leitos integrados no PR #7 | regulação interna completa, prioridades, reservas, transferências, censo, diárias e alta |
| Compras | Base funcional; UX consolidada por operação no PR #5 | alçadas, pedido automático, recebimento parcial/divergência |
| Almoxarifado | Base funcional; UX consolidada em visão operacional no PR #5 | inventário, requisições, reposição, rastreabilidade |
| Comercial / Credenciamento | Base avançada | alimentar contratos reais e regras específicas |
| Tabelas comerciais | Base avançada | importar/gerenciar dados reais licenciados e versões |
| Auditoria pós-alta | Base funcional | regras automáticas e ampliar autorização granular |
| Contas Médicas | Base funcional | checklist por convênio e automações de conferência |
| GED | Base funcional | upload/visualização/versionamento/assinaturas completos |
| Conta hospitalar | Base funcional | pacotes, consumo automático e fechamento operacional |
| Motor contratual | Base avançada | ampliar regras reais por contrato e homologar cálculos |
| TISS | Estrutura funcional, não homologada | XSD ANS, XML definitivo, adapters de operadoras |
| Glosas / Recursos | Base funcional | importação automática de demonstrativos e XML definitivo |
| Financeiro | Parcial; integrado visualmente ao ciclo da receita no PR #5 | baixas, retenções, conciliação, contas a pagar e caixa |
| NFS-e | Estrutura | adapters reais das prefeituras/provedores utilizados |
| Diretoria | Base | KPIs, filtros, metas, drill-down e governança |
| Centro Cirúrgico / CME | Não concluído | desenvolver fluxo completo |
| Nutrição / Hemoterapia etc. | Não iniciado/concluído | definir escopo e implementar |

## Segurança e autorização

O PR #6 introduz catálogo granular de permissões, navegação por perfil e uma Central de Acessos em `/configuracoes/acessos`. A matriz operacional exibida pela aplicação usa `public.permissoes` como fonte de verdade; o catálogo TypeScript existe apenas para os códigos que o código da aplicação precisa referenciar estaticamente.

O shell continua usando o RBAC apenas para apresentação e descoberta das áreas. O RLS permanece como fronteira definitiva de autorização. O PR #8 adiciona requisitos explícitos de navegação para Urgência/Emergência e NIR e passa a mostrar no cabeçalho somente ações compatíveis com as permissões efetivas do usuário.

O CI executa `lint`, `typecheck`, testes unitários, `build`, instalação do Chromium e smoke E2E público com Playwright. O endurecimento dos RPCs `SECURITY DEFINER` continua sendo incremental e deve preservar apenas endpoints públicos intencionais (por exemplo, totem/painel) e exigir permissão funcional explícita nos fluxos autenticados sensíveis.

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
