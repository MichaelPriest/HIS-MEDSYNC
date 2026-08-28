begin;

select plan(18);

select ok(exists (select 1 from information_schema.columns where table_schema='public' and table_name='compras_solicitacao_itens' and column_name='item_assistencial_id'),'solicitacao referencia item assistencial');
select ok(exists (select 1 from information_schema.tables where table_schema='public' and table_name='compras_cotacao_itens'),'cotacao possui itens proprios');
select ok((select relrowsecurity from pg_class where oid='public.compras_cotacao_itens'::regclass),'RLS ativa em itens da cotacao');
select ok((select relforcerowsecurity from pg_class where oid='public.compras_cotacao_itens'::regclass),'RLS forcada em itens da cotacao');
select ok(exists (select 1 from pg_policies where schemaname='public' and tablename='compras_cotacao_itens' and policyname='compras_cotacao_itens_select'),'politica separada de leitura em itens');
select ok(exists (select 1 from pg_policies where schemaname='public' and tablename='compras_cotacao_itens' and policyname='compras_cotacao_itens_mutate'),'politica separada de mutacao em itens');
select ok(exists (select 1 from information_schema.tables where table_schema='public' and table_name='compras_cotacao_item_propostas'),'cotacao possui propostas item-fornecedor');
select ok((select relrowsecurity from pg_class where oid='public.compras_cotacao_item_propostas'::regclass),'RLS ativa em propostas por item');
select ok(has_function_privilege('authenticated','public.gerar_cotacao_compra_catalogo(uuid,date,text)','EXECUTE'),'authenticated pode chamar geracao; RPC aplica RBAC');
select ok(not has_function_privilege('anon','public.gerar_cotacao_compra_catalogo(uuid,date,text)','EXECUTE'),'anon nao gera cotacao');
select ok(has_function_privilege('authenticated','public.adicionar_fornecedor_cotacao_operacional(uuid,uuid,numeric,integer,text,text)','EXECUTE'),'authenticated pode chamar vinculo de fornecedor; RPC aplica RBAC');
select ok(not has_function_privilege('anon','public.adicionar_fornecedor_cotacao_operacional(uuid,uuid,numeric,integer,text,text)','EXECUTE'),'anon nao vincula fornecedor');
select ok(has_function_privilege('authenticated','public.salvar_proposta_item_cotacao(uuid,uuid,numeric,numeric,text,text,text,integer,text,text)','EXECUTE'),'authenticated pode chamar proposta; RPC aplica RBAC');
select ok(not has_function_privilege('anon','public.salvar_proposta_item_cotacao(uuid,uuid,numeric,numeric,text,text,text,integer,text,text)','EXECUTE'),'anon nao salva proposta');
select ok(not has_function_privilege('anon','public.aprovar_fornecedor_cotacao_operacional(uuid,uuid)','EXECUTE'),'anon nao aprova fornecedor');
select ok(not has_function_privilege('anon','public.gerar_pedido_cotacao_aprovada(uuid)','EXECUTE'),'anon nao gera pedido');
select ok(exists (select 1 from information_schema.columns where table_schema='public' and table_name='compras_pedidos' and column_name='cotacao_id'),'pedido preserva cotacao de origem');
select ok(exists (select 1 from information_schema.columns where table_schema='public' and table_name='compras_pedido_itens' and column_name='cotacao_item_id'),'pedido preserva item da cotacao');

select * from finish();
rollback;
