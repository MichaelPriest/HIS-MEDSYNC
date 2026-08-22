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

## Diagnóstico do ambiente Vercel

Se o ambiente ainda não possuir as variáveis públicas do Supabase, o middleware
redireciona para `/configuracao-indisponivel` em vez de lançar uma exceção e
produzir `MIDDLEWARE_INVOCATION_FAILED`. Configure, para o ambiente correto:

- `NEXT_PUBLIC_SUPABASE_URL` com a URL HTTPS do projeto;
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` com a chave publicável;
- `SUPABASE_SECRET_KEY` apenas quando uma operação exclusivamente server-side
  realmente precisar dela.

Após alterar variáveis na Vercel, faça um novo deploy. Não reutilize o projeto de
produção em previews e nunca transforme a chave secreta em `NEXT_PUBLIC_*`.

### Nomes aceitos pela integração Supabase/Vercel

A configuração preferencial é `NEXT_PUBLIC_SUPABASE_URL` com
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Para projetos existentes, a aplicação
também reconhece `NEXT_PUBLIC_SUPABASE_PROJECT_URL`,
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` e o nome legado
`NEXT_PUBLIC_SUPABASE_ANON_KEY`. Valores são normalizados para remover espaços
acidentais, mas continuam sendo validados.

As variáveis precisam estar habilitadas especificamente para o ambiente do deploy
(`Production`, `Preview` ou `Development`). Um deploy já construído não recebe uma
variável `NEXT_PUBLIC_*` retroativamente: depois de salvar as variáveis, execute
**Redeploy** sem reaproveitar o build anterior. Se a página já estava aberta,
recarregue-a sem cache.
