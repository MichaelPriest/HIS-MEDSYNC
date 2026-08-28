begin;

select plan(20);

select ok(exists (select 1 from information_schema.columns where table_schema='public' and table_name='compras_recebimento_itens' and column_name='pedido_item_id'),'recebimento referencia item do pedido');
select ok(exists (select 1 from information_schema.columns where table_schema='public' and table_name='compras_recebimento_itens' and column_name='estoque_lote_id'),'recebimento referencia lote fisico');
select ok(exists (select 1 from information_schema.columns where table_schema='public' and table_name='estoque_movimentos' and column_name='compra_recebimento_item_id'),'movimento referencia item recebido');
select ok(exists (select 1 from pg_constraint where conname='compras_pedido_itens_quantidade_recebida_check'),'quantidade recebida limitada ao pedido');
select ok((select relforcerowsecurity from pg_class where oid='public.compras_recebimentos'::regclass),'FORCE RLS em recebimentos');
select ok((select relforcerowsecurity from pg_class where oid='public.compras_recebimento_itens'::regclass),'FORCE RLS em itens recebidos');
select ok((select relforcerowsecurity from pg_class where oid='public.estoque_lotes'::regclass),'FORCE RLS em lotes');
select ok((select relforcerowsecurity from pg_class where oid='public.estoque_movimentos'::regclass),'FORCE RLS em movimentos');
select ok(exists (select 1 from pg_policies where schemaname='public' and tablename='compras_recebimentos' and policyname='compras_recebimentos_select'),'recebimento tem policy de leitura');
select ok(not has_table_privilege('authenticated','public.compras_recebimentos','INSERT'),'authenticated nao insere recebimento direto');
select ok(not has_table_privilege('authenticated','public.compras_recebimentos','UPDATE'),'authenticated nao altera recebimento direto');
select ok(to_regprocedure('public.receber_pedido_compra_operacional(uuid,jsonb,text,text,date,date,numeric,text)') is not null,'RPC de recebimento existe');
select ok(has_function_privilege('authenticated','public.receber_pedido_compra_operacional(uuid,jsonb,text,text,date,date,numeric,text)','EXECUTE'),'authenticated pode chamar RPC que aplica RBAC');
select ok(not has_function_privilege('anon','public.receber_pedido_compra_operacional(uuid,jsonb,text,text,date,date,numeric,text)','EXECUTE'),'anon nao recebe compra');
select ok((select prosecdef from pg_proc where oid='public.receber_pedido_compra_operacional(uuid,jsonb,text,text,date,date,numeric,text)'::regprocedure),'RPC e SECURITY DEFINER para escrita atomica protegida');
select ok(exists (select 1 from pg_indexes where schemaname='public' and indexname='ux_estoque_lote_identidade_operacional'),'lote tem identidade unica operacional');
select ok(exists (select 1 from pg_indexes where schemaname='public' and indexname='ux_estoque_produto_item_assistencial_ativo'),'produto de estoque unico por item assistencial ativo');
select ok(exists (select 1 from pg_indexes where schemaname='public' and indexname='ux_financeiro_conta_pagar_recebimento'),'recebimento gera no maximo uma conta a pagar');
select ok(exists (select 1 from pg_policies where schemaname='public' and tablename='estoque_lotes' and policyname='estoque_lotes_mutate'),'lotes exigem permissao funcional para mutacao');
select ok(exists (select 1 from pg_policies where schemaname='public' and tablename='estoque_movimentos' and policyname='estoque_movimentos_mutate'),'movimentos exigem permissao funcional para mutacao');

select * from finish();
rollback;
