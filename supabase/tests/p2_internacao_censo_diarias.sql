begin;

select plan(17);

select ok(exists(select 1 from pg_extension where extname='pg_cron'),'pg_cron habilitado para censo');
select ok(exists(select 1 from cron.job where jobname='medsync-internacao-censo-horario' and active),'job horario de censo esta ativo');
select ok(exists(select 1 from cron.job where jobname='medsync-internacao-censo-horario' and command like '%gerar_censo_internacao_diario_internal%'),'job chama apenas helper interno de censo');

select ok(exists(select 1 from information_schema.columns where table_schema='public' and table_name='internacao_diarias' and column_name='origem'),'diaria registra origem');
select ok(exists(select 1 from information_schema.columns where table_schema='public' and table_name='internacao_diarias' and column_name='gerada_automaticamente'),'diaria identifica geracao automatica');
select ok(exists(select 1 from information_schema.columns where table_schema='public' and table_name='internacao_diarias' and column_name='censo_referencia_em'),'diaria registra instante do censo');
select ok(exists(select 1 from pg_indexes where schemaname='public' and indexname='internacao_diarias_internacao_id_data_referencia_key'),'diaria continua unica por internacao e data');

select ok(exists(select 1 from pg_trigger where tgrelid='public.internacoes'::regclass and tgname='trg_sincronizar_censo_por_internacao' and not tgisinternal),'internacao sincroniza censo em transicoes');
select ok(exists(select 1 from pg_trigger where tgrelid='public.movimentacoes_leitos'::regclass and tgname='trg_sincronizar_censo_movimentacao_leito' and not tgisinternal),'movimentacao atualiza censo pelo leito real');

select ok(not has_function_privilege('anon','public.sincronizar_diaria_internacao_internal(uuid,date)','EXECUTE'),'anon nao executa sincronizacao interna');
select ok(not has_function_privilege('authenticated','public.sincronizar_diaria_internacao_internal(uuid,date)','EXECUTE'),'authenticated nao fabrica diaria');
select ok(not has_function_privilege('anon','public.recompor_diarias_internacao_internal(uuid,date)','EXECUTE'),'anon nao reprocessa censo');
select ok(not has_function_privilege('authenticated','public.recompor_diarias_internacao_internal(uuid,date)','EXECUTE'),'authenticated nao reprocessa censo');
select ok(not has_function_privilege('anon','public.gerar_censo_internacao_diario_internal(date)','EXECUTE'),'anon nao executa job de censo');
select ok(not has_function_privilege('authenticated','public.gerar_censo_internacao_diario_internal(date)','EXECUTE'),'authenticated nao executa job de censo');
select ok(not has_function_privilege('authenticated','public.sincronizar_censo_por_movimentacao_leito_trigger()','EXECUTE'),'trigger de movimento nao e endpoint de cliente');
select ok(position('internacao_sem_diaria_censo' in pg_get_functiondef('public.reconciliar_pendencias_internacao_internal(uuid,uuid,uuid,uuid)'::regprocedure))>0,'Central detecta internacao sem diaria factual');

select * from finish();
rollback;
