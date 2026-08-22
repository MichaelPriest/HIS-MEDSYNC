# Arquitetura

## Visão

Monólito modular Next.js (App Router) com componentes server-first. O PostgreSQL/Supabase é a fonte de verdade; Auth emite a identidade, RLS aplica autorização definitiva e a aplicação repete verificações para falhar cedo.

## Camadas

- `src/app`: rotas, layouts e composição.
- `src/components`: UI sem regras de domínio.
- `src/modules`: schemas Zod, repositórios e casos de uso por domínio.
- `src/lib/supabase`: clientes browser/server e renovação de sessão.
- `src/lib/permissions`: catálogo e verificações RBAC.
- `src/lib/audit`: contrato de eventos sem dados sensíveis.
- `supabase/migrations`: esquema, constraints, índices, RLS e Storage.

O contexto de empresa/unidade nunca é aceito como autorização isolada: é cruzado no banco com vínculos ativos do usuário. Realtime será adotado apenas em filas/painéis quando estes marcos forem implementados.

## Operação

Vercel executa a aplicação; Supabase gerencia Auth, PostgreSQL e Storage. Preview deve apontar para projeto Supabase não produtivo. Datas são persistidas em `timestamptz` e apresentadas em `America/Sao_Paulo`; valores monetários usam centavos inteiros ou `numeric`, nunca ponto flutuante.
