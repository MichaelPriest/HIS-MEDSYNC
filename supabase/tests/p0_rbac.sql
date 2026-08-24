begin;

select plan(12);

select ok(
  (select relrowsecurity from pg_class where oid='public.perfis'::regclass),
  'RLS ativa em perfis'
);
select ok(
  (select relrowsecurity from pg_class where oid='public.perfil_permissoes'::regclass),
  'RLS ativa em perfil_permissoes'
);
select ok(
  (select relrowsecurity from pg_class where oid='public.usuario_perfis'::regclass),
  'RLS ativa em usuario_perfis'
);
select ok(
  (select relrowsecurity from pg_class where oid='public.usuario_empresas'::regclass),
  'RLS ativa em usuario_empresas'
);
select ok(
  (select relrowsecurity from pg_class where oid='public.usuario_unidades'::regclass),
  'RLS ativa em usuario_unidades'
);

select ok(
  exists(select 1 from public.permissoes where codigo='usuarios.administrar' and ativo),
  'permissão administrativa de usuários existe'
);
select ok(
  exists(select 1 from public.permissoes where codigo='farmacia.validar' and ativo),
  'permissão granular de farmácia existe'
);
select ok(
  exists(select 1 from public.permissoes where codigo='laboratorio.liberar' and ativo),
  'permissão granular de laboratório existe'
);

select is(
  has_function_privilege('anon','public.pode_visualizar_acessos(uuid)','EXECUTE'),
  false,
  'anon não executa helper de visualização de acessos'
);
select is(
  has_function_privilege('anon','public.pode_administrar_acessos(uuid)','EXECUTE'),
  false,
  'anon não executa helper de administração de acessos'
);
select is(
  has_function_privilege('authenticated','public.pode_visualizar_acessos(uuid)','EXECUTE'),
  true,
  'authenticated pode executar helper booleano de visualização'
);
select is(
  has_function_privilege('authenticated','public.pode_administrar_acessos(uuid)','EXECUTE'),
  true,
  'authenticated pode executar helper booleano de administração'
);

select * from finish();
rollback;
