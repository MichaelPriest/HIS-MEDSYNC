# Estado real da implementação

Atualizado em 2026-08-23.

Este documento separa **estrutura criada**, **funcionalidade inicial** e **módulo ainda não homologado**. O MedSync HIS continua em desenvolvimento e não deve ser considerado pronto para produção hospitalar apenas porque determinado menu/tabela existe.

| Área | Estado atual | Próximos pontos críticos |
|---|---|---|
| Fundação / Auth / multiempresa | Funcional em evolução | permissões granulares, auditoria e testes RLS completos |
| Interface / navegação | Funcional | refinamento por perfil e acessibilidade |
| Pacientes / Profissionais / Convênios | Funcional em evolução | validações, documentos, contratos e fluxos especializados |
| Totem / Senhas / Recepção | Base funcional | regras operacionais, impressão e homologação de painéis |
| Atendimento / ADT | Base funcional | completar regras de episódios e documentos |
| Central de Guias | Base funcional | integração automática com solicitações e operadoras |
| Triagem / Fila médica | Base funcional | protocolos/escalas e regras clínicas |
| Prontuário | Parcial | aprofundamento clínico completo |
| Enfermagem | Parcial | SAE, checagem, evolução, balanço, escalas |
| Farmácia | Parcial | dispensação, devolução, estoque e rastreabilidade |
| Laboratório / Imagem | Parcial | execução, resultados/laudos e liberação |
| Internação | Parcial | mapa de leitos, movimentações, diárias e alta |
| Compras | Base funcional | alçadas, pedido automático, recebimento parcial/divergência |
| Almoxarifado | Base funcional | inventário, requisições, reposição, rastreabilidade |
| Comercial / Credenciamento | Base avançada | alimentar contratos reais e regras específicas |
| Tabelas comerciais | Base avançada | importar/gerenciar dados reais licenciados e versões |
| Auditoria pós-alta | Base funcional | regras automáticas e auditoria clínica/administrativa |
| Contas Médicas | Base funcional | checklist por convênio e automações de conferência |
| GED | Base funcional | upload/visualização/versionamento/assinaturas completos |
| Conta hospitalar | Base funcional | pacotes, consumo automático e fechamento operacional |
| Motor contratual | Base avançada | ampliar regras reais por contrato e homologar cálculos |
| TISS | Estrutura funcional, não homologada | XSD ANS, XML definitivo, adapters de operadoras |
| Glosas / Recursos | Base funcional | importação automática de demonstrativos e XML definitivo |
| Financeiro | Parcial | baixas, retenções, conciliação, contas a pagar e caixa |
| NFS-e | Estrutura | adapters reais das prefeituras/provedores utilizados |
| Diretoria | Base | KPIs, filtros, metas, drill-down e governança |
| Centro Cirúrgico / CME | Não concluído | desenvolver fluxo completo |
| Urgência/Emergência | Não concluído | desenvolver fluxo completo |
| Nutrição / Hemoterapia etc. | Não iniciado/concluído | definir escopo e implementar |

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

O projeto deve continuar passando por `lint`, `typecheck`, testes e `build`. O check da Vercel pode falhar por **build rate limit**; esse caso deve ser distinguido de falha real de compilação.

Consulte também [`MANUAL.md`](MANUAL.md) e o módulo interno `/manual`.
