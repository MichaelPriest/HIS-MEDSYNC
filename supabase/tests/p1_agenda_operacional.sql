begin;

select plan(12);

select ok(
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='agendamentos' and column_name='plano_id'),
  'agenda possui plano'
);
select ok(
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='agendamentos' and column_name='estrutura_fisica_id'),
  'agenda possui local fisico'
);
select ok(
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='agendamentos' and column_name='cirurgia_eletiva'),
  'agenda identifica cirurgia eletiva'
);
select ok(
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='agendamentos' and column_name='checkin_em'),
  'agenda registra horario de check-in'
);
select ok(
  exists(select 1 from pg_constraint where conname='agendamentos_profissional_sem_sobreposicao'),
  'agenda bloqueia sobreposicao de profissional'
);
select ok(
  exists(select 1 from pg_constraint where conname='agendamentos_local_sem_sobreposicao'),
  'agenda bloqueia sobreposicao de local'
);
select ok(
  has_function_privilege('authenticated','public.criar_agendamento_operacional(jsonb)','EXECUTE'),
  'authenticated pode criar agendamento pela RPC segura'
);
select ok(
  not has_function_privilege('anon','public.criar_agendamento_operacional(jsonb)','EXECUTE'),
  'anon nao cria agendamento'
);
select ok(
  has_function_privilege('authenticated','public.atualizar_status_agendamento(uuid,text,text)','EXECUTE'),
  'authenticated pode atualizar status pela RPC segura'
);
select ok(
  not has_function_privilege('anon','public.atualizar_status_agendamento(uuid,text,text)','EXECUTE'),
  'anon nao atualiza status da agenda'
);
select ok(
  (select prosecdef from pg_proc where oid='public.criar_agendamento_operacional(jsonb)'::regprocedure),
  'RPC de criacao e SECURITY DEFINER'
);
select ok(
  (select prosecdef from pg_proc where oid='public.atualizar_status_agendamento(uuid,text,text)'::regprocedure),
  'RPC de status e SECURITY DEFINER'
);

select * from finish();
rollback;
