begin;

select plan(8);

select ok(
  exists(select 1 from pg_extension where extname = 'pg_trgm'),
  'pg_trgm disponivel para busca textual da admissao'
);

select ok(
  to_regclass('public.pacientes_nome_ativo_trgm_idx') is not null,
  'indice trigram ativo para nome de paciente'
);

select ok(
  to_regclass('public.atendimentos_senha_id_unique') is not null,
  'uma senha nao pode originar mais de um atendimento'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.buscar_pacientes_admissao(uuid,text,integer)',
    'EXECUTE'
  ),
  'busca de pacientes disponivel ao usuario autenticado'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.buscar_pacientes_admissao(uuid,text,integer)',
    'EXECUTE'
  ),
  'busca de pacientes nao e anonima'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.abrir_atendimento_por_senha(uuid,jsonb)',
    'EXECUTE'
  ),
  'abertura transacional disponivel ao usuario autenticado'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.abrir_atendimento_por_senha(uuid,jsonb)',
    'EXECUTE'
  ),
  'abertura transacional nao e anonima'
);

select ok(
  exists(
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'abrir_atendimento_por_senha'
      and p.prosecdef
  ),
  'RPC de admissao usa boundary SECURITY DEFINER controlada'
);

select * from finish();
rollback;
