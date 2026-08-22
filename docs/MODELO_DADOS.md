# Modelo de dados

## Fundação

- `empresas`: tenant raiz.
- `unidades`: unidade hospitalar e dados CNES opcionais.
- `setores`: agrupamento assistencial/administrativo.
- `locais`: consultório, sala, quarto ou leito, com hierarquia opcional.
- `usuarios`: extensão bloqueável de `auth.users`.
- `perfis`, `permissoes`, `perfil_permissoes`: RBAC granular.
- `usuario_empresas`, `usuario_unidades`, `usuario_perfis`: escopo da autorização.
- `auditoria_eventos`: trilha append-only.

Todas as chaves são UUID, horários são `timestamptz`, FKs possuem índices nos caminhos frequentes. Entidades clínicas futuras sempre referenciarão `empresa_id`, `unidade_id` quando aplicável e `atendimento_id`.
