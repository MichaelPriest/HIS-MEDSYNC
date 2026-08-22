# Estado real da implementação

Atualizado em 2026-08-22.

| Marco | Estado | Evidência / pendência |
|---|---|---|
| 1 — Fundação | Em andamento | Implementação local entregue: Auth SSR, layout, estrutura/RBAC/auditoria, buckets privados e RLS. Validação automatizada bloqueada neste ambiente pelo acesso HTTP 403 ao npm; integração RLS requer Supabase local/externo. |
| 2–14 | Não iniciados | Planejados em `PLAN.md`; não disponíveis na aplicação. |

## Dependências externas

Ainda é necessário criar projetos Supabase separados para desenvolvimento/preview/produção, cadastrar variáveis na Vercel e configurar URLs de redirecionamento no Auth. Nenhum deploy de produção foi realizado.
