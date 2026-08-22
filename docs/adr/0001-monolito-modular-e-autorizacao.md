# ADR 0001 — Monólito modular e autorização em profundidade

**Estado:** aceito — 2026-08-22

## Decisão

Usar componentes server-first em monólito modular. Permissões são validadas na aplicação para feedback e novamente por RLS no PostgreSQL. Contexto do tenant deriva de vínculos persistidos, não de metadados editáveis do JWT.

## Consequências

Reduz superfície operacional e impede que uma falha da UI atravesse tenants. Consultas exigem índices e helpers SQL estáveis; funções auxiliares `security definer` só serão admitidas com `search_path` fixo e validação interna documentada.
