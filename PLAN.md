# Plano de implementação

O produto será entregue incrementalmente como monólito modular, sem ocultar dependências externas.

| Marco | Escopo | Estado |
|---|---|---|
| 1 | Fundação: Next.js, Auth SSR, estrutura hospitalar, RBAC, auditoria e RLS | Em andamento |
| 2 | Cadastros mestres: pacientes, profissionais, convênios e catálogos | Planejado |
| 3 | Atendimento/ADT e movimentações | Planejado |
| 4 | Agenda, recepção e fila | Planejado |
| 5 | Triagem | Planejado |
| 6 | Prontuário médico versionado | Planejado |
| 7 | Prescrição e solicitações | Planejado |
| 8 | Documentos médicos | Planejado |
| 9 | Internação e enfermagem | Planejado |
| 10 | Farmácia e estoque | Planejado |
| 11 | Laboratório e imagem | Planejado |
| 12 | Conta hospitalar | Planejado |
| 13 | Autorizações, TISS, faturamento e glosas | Planejado |
| 14 | Financeiro e BI | Planejado |

## Critério de passagem de marco

Migration aplicável em banco limpo, RLS testada, fluxos implementados sem mocks de produção, lint, tipos, testes e build aprovados, revisão de segurança e atualização do status.
