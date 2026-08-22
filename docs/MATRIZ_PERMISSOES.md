# Matriz de permissões

Perfis são agrupadores editáveis; políticas e aplicação verificam códigos, nunca nomes.

| Domínio | Visualizar | Criar/operar | Administrar |
|---|---|---|---|
| Empresas | `empresas.visualizar` | — | `empresas.administrar` |
| Estrutura | `estrutura.visualizar` | `estrutura.criar`, `estrutura.editar` | — |
| Usuários | `usuarios.visualizar` | `usuarios.vincular` | `usuarios.administrar` |
| Pacientes | `pacientes.visualizar` | `pacientes.criar`, `pacientes.editar` | — |
| Atendimento | `atendimentos.visualizar` | `atendimentos.abrir`, `atendimentos.transferir`, `atendimentos.alta` | — |
| Prontuário | `prontuario.visualizar` | `prontuario.evoluir` | — |
| Faturamento | `faturamento.visualizar` | `faturamento.fechar` | — |
| Auditoria | `auditoria.visualizar` | — | — |

Perfis iniciais serão semeados como dados de domínio no provisionamento de cada empresa, mantendo menor privilégio.
