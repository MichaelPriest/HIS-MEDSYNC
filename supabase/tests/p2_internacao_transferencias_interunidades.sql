begin;

select plan(18);

select ok(exists(select 1 from information_schema.tables where table_schema='public' and table_name='internacao_transferencias_interunidades'),'existe trilha de transferencias interunidades');
select ok((select relrowsecurity from pg_class where oid='public.internacao_transferencias_interunidades'::regclass),'RLS ativa');
select ok((select relforcerowsecurity from pg_class where oid='public.internacao_transferencias_interunidades'::regclass),'RLS forcada');
select ok(has_table_privilege('authenticated','public.internacao_transferencias_interunidades','SELECT'),'authenticated le a fila via policy');
select ok(not has_table_privilege('authenticated','public.internacao_transferencias_interunidades','INSERT'),'authenticated nao cria transferencia diretamente');
select ok(not has_table_privilege('authenticated','public.internacao_transferencias_interunidades','UPDATE'),'authenticated nao decide transferencia por update direto');

select ok(has_function_privilege('authenticated','public.solicitar_transferencia_interunidade(uuid,uuid,text,text,text,text,text,text,text)','EXECUTE'),'authenticated chama solicitacao com RBAC interno');
select ok(not has_function_privilege('anon','public.solicitar_transferencia_interunidade(uuid,uuid,text,text,text,text,text,text,text)','EXECUTE'),'anon nao solicita transferencia');
select ok(has_function_privilege('authenticated','public.aceitar_transferencia_interunidade(uuid,uuid,text)','EXECUTE'),'authenticated chama aceite com RBAC interno');
select ok(not has_function_privilege('anon','public.aceitar_transferencia_interunidade(uuid,uuid,text)','EXECUTE'),'anon nao aceita transferencia');
select ok(has_function_privilege('authenticated','public.listar_unidades_destino_transferencia_interunidade(uuid)','EXECUTE'),'authenticated lista destinos pelo RPC controlado');
select ok(has_function_privilege('authenticated','public.listar_transferencias_interunidades_operacionais(uuid)','EXECUTE'),'authenticated le fila enriquecida pelo RPC controlado');
select ok(not has_function_privilege('anon','public.listar_transferencias_interunidades_operacionais(uuid)','EXECUTE'),'anon nao le fila interunidades');
select ok(not has_function_privilege('authenticated','public.sincronizar_cnes_transferencia_interunidade()','EXECUTE'),'trigger CNES permanece interno');
select ok(not has_function_privilege('authenticated','public.validar_ocupacao_leito_reserva_internal()','EXECUTE'),'hardening de reserva permanece interno');
select ok(exists(select 1 from pg_trigger where tgrelid='public.leitos'::regclass and tgname='trg_validar_ocupacao_leito_reserva' and not tgisinternal),'ocupacao do leito valida reserva ativa');
select ok(exists(select 1 from pg_indexes where schemaname='public' and indexname='uq_internacao_transferencia_aberta'),'uma internacao nao possui duas transferencias abertas');
select ok(exists(select 1 from pg_indexes where schemaname='public' and indexname='idx_internacao_transferencias_destino_fila'),'fila destino possui indice operacional');

select * from finish();
rollback;
