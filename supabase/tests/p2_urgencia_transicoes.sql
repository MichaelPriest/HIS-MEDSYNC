begin;

select plan(9);

select ok(exists(select 1 from information_schema.columns where table_schema='public' and table_name='emergencia_registros' and column_name='encerrado_em'),'urgencia registra encerramento');
select ok(exists(select 1 from information_schema.columns where table_schema='public' and table_name='emergencia_registros' and column_name='encerrado_por'),'urgencia registra responsavel pelo encerramento');
select ok(exists(select 1 from pg_indexes where schemaname='public' and indexname='emergencia_registros_um_ativo_por_atendimento'),'apenas um registro ativo por atendimento');
select ok(exists(select 1 from pg_indexes where schemaname='public' and indexname='emergencia_registros_reavaliacao_ativa_idx'),'fila de reavaliacao ativa possui indice');

select ok(has_function_privilege('authenticated','public.abrir_registro_emergencia_operacional(uuid,text,text,text,text,text,text,text,text,text,text,text,jsonb,timestamptz,text,text)','EXECUTE'),'authenticated pode abrir urgencia via RPC');
select ok(not has_function_privilege('anon','public.abrir_registro_emergencia_operacional(uuid,text,text,text,text,text,text,text,text,text,text,text,jsonb,timestamptz,text,text)','EXECUTE'),'anon nao abre urgencia');
select ok(has_function_privilege('authenticated','public.encerrar_registro_emergencia_operacional(uuid,text,text)','EXECUTE'),'authenticated pode encerrar urgencia via RPC');
select ok(not has_function_privilege('anon','public.encerrar_registro_emergencia_operacional(uuid,text,text)','EXECUTE'),'anon nao encerra urgencia');
select ok(position('emergencia.gerenciar' in pg_get_functiondef('public.encerrar_registro_emergencia_operacional(uuid,text,text)'::regprocedure))>0,'encerramento valida RBAC no banco');

select * from finish();
rollback;
