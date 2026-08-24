begin;

select plan(9);

select ok(
  exists(select 1 from pg_proc where oid='public.movimentar_internacao_leito(uuid,uuid,text)'::regprocedure),
  'RPC de movimentacao de leito existe'
);
select ok(
  (select prosecdef from pg_proc where oid='public.movimentar_internacao_leito(uuid,uuid,text)'::regprocedure),
  'RPC de movimentacao permanece SECURITY DEFINER'
);
select ok(
  has_function_privilege('authenticated','public.movimentar_internacao_leito(uuid,uuid,text)','EXECUTE'),
  'authenticated pode executar movimentacao autorizada'
);
select ok(
  not has_function_privilege('anon','public.movimentar_internacao_leito(uuid,uuid,text)','EXECUTE'),
  'anon nao pode executar movimentacao'
);
select like(
  pg_get_functiondef('public.movimentar_internacao_leito(uuid,uuid,text)'::regprocedure),
  '%LEITO_INCOMPATIVEL_ISOLAMENTO%',
  'movimentacao valida isolamento'
);
select like(
  pg_get_functiondef('public.movimentar_internacao_leito(uuid,uuid,text)'::regprocedure),
  '%LEITO_INCOMPATIVEL_SEXO%',
  'movimentacao valida restricao de sexo'
);
select like(
  pg_get_functiondef('public.movimentar_internacao_leito(uuid,uuid,text)'::regprocedure),
  '%LEITO_INCOMPATIVEL_ACOMODACAO%',
  'movimentacao valida acomodacao'
);
select like(
  pg_get_functiondef('public.movimentar_internacao_leito(uuid,uuid,text)'::regprocedure),
  '%internacao.movimentar%',
  'RPC reconhece permissao funcional do NIR'
);
select like(
  pg_get_functiondef('public.movimentar_internacao_leito(uuid,uuid,text)'::regprocedure),
  '%status = ''internado''%',
  'alocacao consolida internacao ativa como internado'
);

select * from finish();
rollback;
