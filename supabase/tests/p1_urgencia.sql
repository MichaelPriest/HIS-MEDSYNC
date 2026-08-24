begin;

select plan(6);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.emergencia_registros'::regclass),
  'RLS ativa em registros de emergencia'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.emergencia_reavaliacoes'::regclass),
  'RLS ativa em reavaliacoes de emergencia'
);

select ok(
  not has_table_privilege('authenticated', 'public.emergencia_registros', 'DELETE'),
  'registro assistencial de emergencia nao pode ser apagado pelo cliente'
);

select ok(
  not has_table_privilege('authenticated', 'public.emergencia_reavaliacoes', 'DELETE'),
  'reavaliacao de emergencia nao pode ser apagada pelo cliente'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.registrar_reavaliacao_emergencia(uuid,text,text,jsonb,jsonb,integer,text,text,text,timestamptz)',
    'EXECUTE'
  ),
  'RPC controlado de reavaliacao permanece disponivel ao usuario autenticado'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.registrar_reavaliacao_emergencia(uuid,text,text,jsonb,jsonb,integer,text,text,text,timestamptz)',
    'EXECUTE'
  ),
  'RPC de reavaliacao nao e anonimo'
);

select * from finish();
rollback;
