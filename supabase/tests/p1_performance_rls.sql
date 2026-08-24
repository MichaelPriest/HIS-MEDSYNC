begin;

select plan(8);

select ok(
  (select prosecdef from pg_proc where oid = 'public.usuario_ativo()'::regprocedure),
  'usuario_ativo executa como SECURITY DEFINER'
);

select ok(
  (select prosecdef from pg_proc where oid = 'public.tem_empresa(uuid)'::regprocedure),
  'tem_empresa executa como SECURITY DEFINER'
);

select ok(
  (select prosecdef from pg_proc where oid = 'public.tem_unidade(uuid,uuid)'::regprocedure),
  'tem_unidade executa como SECURITY DEFINER'
);

select ok(
  (select prosecdef from pg_proc where oid = 'public.tem_permissao(uuid,uuid,text)'::regprocedure),
  'tem_permissao executa como SECURITY DEFINER'
);

select is(
  (select provolatile::text from pg_proc where oid = 'public.usuario_ativo()'::regprocedure),
  's',
  'usuario_ativo permanece STABLE'
);

select is(
  (select provolatile::text from pg_proc where oid = 'public.tem_permissao(uuid,uuid,text)'::regprocedure),
  's',
  'tem_permissao permanece STABLE'
);

select ok(
  (select coalesce(proconfig, '{}'::text[]) @> array['search_path='] from pg_proc where oid = 'public.tem_empresa(uuid)'::regprocedure),
  'tem_empresa usa search_path vazio'
);

select ok(
  (select coalesce(proconfig, '{}'::text[]) @> array['search_path='] from pg_proc where oid = 'public.tem_permissao(uuid,uuid,text)'::regprocedure),
  'tem_permissao usa search_path vazio'
);

select * from finish();
rollback;
