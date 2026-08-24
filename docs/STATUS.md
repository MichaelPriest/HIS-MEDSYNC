# Estado real da implementação

Atualizado em 2026-08-24.

Este documento separa **estrutura criada**, **funcionalidade inicial** e **módulo ainda não homologado**. O MedSync HIS continua em desenvolvimento e não deve ser considerado pronto para produção hospitalar apenas porque determinado menu/tabela existe.

| Área | Estado atual | Próximos pontos críticos |
|---|---|---|
| Fundação / Auth / multiempresa | Funcional em evolução; RBAC granular, navegação por perfil, central de acessos, hardening inicial de RPCs sensíveis e testes automatizados ampliados desde o PR #6 | proteção granular progressiva dos RPCs restantes, testes RLS multi-tenant completos e break-glass clínico |
| Interface / navegação | Funcional em evolução; áreas de trabalho e contexto do episódio no PR #5, RBAC no shell no PR #6, reorganização de sidebar/topbar/menu no PR #8 e avatar real + atalhos contextuais no PR #9 | acessibilidade, busca global ampliada, troca controlada de unidade e testes de usabilidade autenticados |
| Pacientes / Profissionais / Convênios | Funcional em evolução | validações, documentos, contratos e fluxos especializados |
| Totem / Senhas / Recepção | Base funcional; abertura do atendimento encaminha o episódio para a fila operacional de Triagem e os atalhos contextuais aproximam cadastro de paciente/atendimento da Recepção no PR #9 | impressão, SLA, regras de prioridade, rate limit/abuso dos endpoints públicos e homologação dos painéis |
| Atendimento / ADT | Base funcional; indicador do episódio `Atendimento a RN` integrado à admissão e ao snapshot TISS no PR #9 | completar regras ADT, transferências, documentos e validações específicas por tipo de episódio |
| Central de Guias | Base funcional; UX consolidada por fila/status no PR #5 | integração automática com solicitações e operadoras |
| Triagem / Fila médica | Base funcional ampliada no PR #9; lista apenas atendimentos abertos sem triagem concluída, permite chamar/rechamar no painel e, na conclusão, retira o paciente da fila de Triagem e encaminha para a fila médica por especialidade | protocolos/escalas configuráveis, SLA, reclassificação e homologação clínica/operacional |
| Prontuário | Parcial; usado como workspace central do episódio no PR #5 e recebe registros/reavaliações da Urgência no PR #7 | aprofundamento clínico completo |
| Urgência/Emergência | Base funcional no PR #7; Central de Urgência, ABCDE, risco, reavaliações e destino vinculados ao mesmo atendimento; reavaliação endurecida por RPC autorizado e sem DELETE clínico | protocolos clínicos configuráveis, SLA, observação, indicadores e homologação operacional |
| Enfermagem | Parcial | SAE, checagem, evolução, balanço, escalas |
| Farmácia | Parcial | dispensação, devolução, estoque e rastreabilidade |
| Laboratório / Imagem | Parcial | execução, resultados/laudos e liberação |
| Internação / NIR | Parcial; admissão contextual, mapa de leitos e primeira fila NIR/gestão de leitos integrados no PR #7 | regulação interna completa, prioridades, reservas, transferências, censo, diárias e alta |
| Estrutura hospitalar | Base funcional no PR #9; hierarquia `bloco → andar → ala → setor/sala`, com tipos para UTI, centro cirúrgico, centro obstétrico, pronto-socorro, enfermaria, ambulatório e apoio, além de vínculos preparados para setores, leitos e salas cirúrgicas | mapear estrutura física real de cada unidade, vincular todos os leitos/salas, regras de capacidade e homologação operacional |
| Compras | Base funcional; UX consolidada por operação no PR #5 | alçadas, pedido automático, recebimento parcial/divergência |
| Almoxarifado | Base funcional; UX consolidada em visão operacional no PR #5 | inventário, requisições, reposição, rastreabilidade |
| Comercial / Credenciamento | Base avançada | alimentar contratos reais e regras específicas |
| Tabelas comerciais | Base avançada | importar/gerenciar dados reais licenciados e versões |
| Auditoria pós-alta | Base funcional; RPCs críticos de execução/liberação passaram a exigir permissão funcional explícita | regras automáticas adicionais, segregação de funções e testes de autorização por perfil |
| Contas Médicas | Base funcional; checklist, auditoria de preços e liberação tiveram hardening funcional de RPCs | checklist por convênio, automações de conferência e testes de autorização por perfil |
| GED | Base funcional | upload/visualização/versionamento/assinaturas completos |
| Conta hospitalar | Base funcional | pacotes, consumo automático e fechamento operacional |
| Motor contratual | Base avançada; recálculos sensíveis protegidos por wrappers autorizados | ampliar regras reais por contrato e homologar cálculos |
| TISS | Estrutura funcional, não homologada; `Atendimento a RN` é persistido no episódio e copiado para a guia como indicador próprio no PR #9 | XSD oficial ANS, XML definitivo por versão/tipo, adapters de operadoras e homologação |
| Glosas / Recursos | Base funcional | importação automática de demonstrativos e XML definitivo |
| Financeiro | Parcial; integrado visualmente ao ciclo da receita no PR #5 | baixas, retenções, conciliação, contas a pagar e caixa |
| NFS-e | Estrutura | adapters reais das prefeituras/provedores utilizados |
| Diretoria | Base | KPIs, filtros, metas, drill-down e governança |
| Centro Cirúrgico / CME | Não concluído; estrutura física já admite centro cirúrgico/obstétrico e vínculo futuro de salas | desenvolver fluxo assistencial completo, agenda, intraoperatório, RPA, CME e OPME |
| Nutrição / Hemoterapia etc. | Não iniciado/concluído | definir escopo e implementar |

## Segurança e autorização

O PR #6 introduziu catálogo granular de permissões, navegação por perfil e uma Central de Acessos em `/configuracoes/acessos`. A matriz operacional exibida pela aplicação usa `public.permissoes` como fonte de verdade; o catálogo TypeScript existe apenas para os códigos que o código da aplicação precisa referenciar estaticamente.

O shell continua usando o RBAC apenas para apresentação e descoberta das áreas. O RLS permanece como fronteira definitiva de autorização. O PR #8 adicionou requisitos explícitos de navegação para Urgência/Emergência e NIR. O PR #9 acrescenta a configuração de Estrutura Hospitalar sob `estrutura.visualizar|criar|editar`, com RLS forçado, isolamento por empresa/unidade e sem DELETE pelo cliente.

Em 2026-08-24, as migrations pendentes do P0/P1 foram aplicadas em ordem no projeto Supabase principal e validadas após aplicação. Foram verificados RLS/privilegios da nova estrutura, colunas do indicador RN, vínculos de leitos/salas/setores e EXECUTE dos wrappers sensíveis. Os endpoints públicos de Totem/Painel permanecem públicos apenas onde o fluxo de terminal exige; eles ainda precisam de revisão contínua de minimização de dados, limitação de abuso e observabilidade.

O CI executa `lint`, `typecheck`, testes unitários, `build`, instalação do Chromium e smoke E2E público com Playwright. O endurecimento dos RPCs `SECURITY DEFINER` continua sendo incremental e deve preservar apenas endpoints públicos intencionais e exigir permissão funcional explícita nos fluxos autenticados sensíveis.

## Travas de negócio já planejadas/implementadas

O faturamento de convênio deve respeitar a cadeia:

`Alta → Auditoria → Contas Médicas → Validação da conta → Guia TISS → Lote → XML validado → envio/manual → retorno → financeiro`.

A conta não deve pular Auditoria ou Contas Médicas. XML preliminar não deve ser tratado como TISS homologado enquanto não houver validação pelos schemas oficiais aplicáveis.

A jornada de atendimento ambulatorial/urgência parte do mesmo episódio:

`Totem/Senha → Recepção/abertura do atendimento → Triagem → chamada no painel → conclusão da Triagem → fila médica por especialidade → Prontuário/Assistência`.

Concluir a Triagem encerra apenas a etapa/fila de Triagem; não encerra o atendimento hospitalar.

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

A aplicação das migrations no banco principal não equivale à homologação hospitalar dos módulos: os fluxos assistenciais, TISS, operação por perfis, contingência e integrações externas ainda precisam dos respectivos testes de homologação.

Consulte também [`MANUAL.md`](MANUAL.md), [`UX-CONSOLIDACAO.md`](UX-CONSOLIDACAO.md), [`MATRIZ_PERMISSOES.md`](MATRIZ_PERMISSOES.md), [`SEGURANCA.md`](SEGURANCA.md) e o módulo interno `/manual`.
