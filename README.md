# MedSync HIS

Fundação de um HIS multiempresa/multiunidade em Next.js e Supabase. O estado real está em [`docs/STATUS.md`](docs/STATUS.md); módulos não implementados não são simulados.

## Requisitos

Node.js 20+, npm, Supabase CLI/Docker para o banco local.

## Instalação

```bash
cp .env.example .env.local
npm ci
supabase start
supabase db reset
npm run dev
```

Substitua os valores fictícios localmente. Nunca envie segredos ao repositório. No Supabase Auth configure `http://localhost:3000` como Site URL e a rota de recuperação autorizada.

## Qualidade

```bash
npm run lint
npm run typecheck
npm test
npm run build
supabase test db
npm run test:e2e
```

## Ambientes e deploy

Use projetos Supabase distintos para development, preview e production. Na Vercel cadastre `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` e `NEXT_PUBLIC_APP_ENV` por ambiente. Uma preview nunca pode receber URL/chave do banco produtivo. O workflow valida o código; deploy de produção exige autorização explícita.
