begin;

select plan(30);

select ok(to_regclass('public.estoque_parametros_local') is not null,'parametros de reposicao por local existem');
select ok(to_regclass('public.estoque_inventarios') is not null,'inventarios existem');
select ok(to_regclass('public.estoque_inventario_itens') is not null,'itens de inventario existem');
select ok((select relforcerowsecurity from pg_class where oid='public.estoque_parametros_local'::regclass),'FORCE RLS em parametros de reposicao');
select ok((select relforcerowsecurity from pg_class where oid='public.estoque_inventarios'::regclass),'FORCE RLS em inventarios');
select ok((select relforcerowsecurity from pg_class where oid='public.estoque_inventario_itens'::regclass),'FORCE RLS em itens de inventario');
select ok(exists (select 1 from pg_indexes where schemaname='public' and indexname='ux_estoque_inventario_aberto_local'),'um inventario aberto por local');
select ok(exists (select 1 from information_schema.columns where table_schema='public' and table_name='estoque_movimentos' and column_name='inventario_id'),'movimento referencia inventario');
select ok(exists (select 1 from information_schema.columns where table_schema='public' and table_name='estoque_movimentos' and column_name='inventario_item_id'),'movimento referencia item de inventario');
select ok(not has_table_privilege('authenticated','public.estoque_inventarios','INSERT'),'inventario nao aceita insert direto');
select ok(not has_table_privilege('authenticated','public.estoque_inventarios','UPDATE'),'inventario nao aceita update direto');
select ok(not has_table_privilege('authenticated','public.estoque_inventario_itens','INSERT'),'item de inventario nao aceita insert direto');
select ok(not has_table_privilege('authenticated','public.estoque_inventario_itens','UPDATE'),'item de inventario nao aceita update direto');

select ok(to_regprocedure('public.movimentar_estoque_operacional(uuid,text,numeric,uuid,uuid,text)') is not null,'RPC de movimento operacional existe');
select ok(to_regprocedure('public.abrir_inventario_estoque(uuid,text)') is not null,'RPC de abertura de inventario existe');
select ok(to_regprocedure('public.registrar_contagem_inventario_estoque(uuid,jsonb)') is not null,'RPC de contagem existe');
select ok(to_regprocedure('public.concluir_inventario_estoque(uuid,text)') is not null,'RPC de conciliacao existe');
select ok(to_regprocedure('public.cancelar_inventario_estoque(uuid,text)') is not null,'RPC de cancelamento existe');
select ok(to_regprocedure('public.configurar_parametro_reposicao_estoque(uuid,uuid,numeric,numeric,numeric)') is not null,'RPC de parametro de reposicao existe');
select ok(to_regprocedure('public.listar_necessidades_reposicao_estoque(uuid)') is not null,'RPC de necessidades de reposicao existe');
select ok(to_regprocedure('public.gerar_requisicao_reposicao_estoque(uuid,jsonb,text)') is not null,'RPC de gerar reposicao existe');

select ok(has_function_privilege('authenticated','public.movimentar_estoque_operacional(uuid,text,numeric,uuid,uuid,text)','EXECUTE'),'authenticated chama movimento protegido');
select ok(not has_function_privilege('anon','public.movimentar_estoque_operacional(uuid,text,numeric,uuid,uuid,text)','EXECUTE'),'anon nao movimenta estoque');
select ok(has_function_privilege('authenticated','public.concluir_inventario_estoque(uuid,text)','EXECUTE'),'authenticated chama conciliacao protegida');
select ok(not has_function_privilege('anon','public.concluir_inventario_estoque(uuid,text)','EXECUTE'),'anon nao concilia inventario');
select ok(has_function_privilege('authenticated','public.gerar_requisicao_reposicao_estoque(uuid,jsonb,text)','EXECUTE'),'authenticated chama reposicao protegida');
select ok(not has_function_privilege('anon','public.gerar_requisicao_reposicao_estoque(uuid,jsonb,text)','EXECUTE'),'anon nao gera reposicao');
select ok((select prosecdef from pg_proc where oid='public.movimentar_estoque_operacional(uuid,text,numeric,uuid,uuid,text)'::regprocedure),'movimento e SECURITY DEFINER');
select ok((select prosecdef from pg_proc where oid='public.concluir_inventario_estoque(uuid,text)'::regprocedure),'conciliacao e SECURITY DEFINER');
select ok((select prosecdef from pg_proc where oid='public.gerar_requisicao_reposicao_estoque(uuid,jsonb,text)'::regprocedure),'reposicao e SECURITY DEFINER');

select * from finish();
rollback;
