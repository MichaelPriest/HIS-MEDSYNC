begin;

select plan(12);

select ok(
  exists (select 1 from information_schema.columns where table_schema='public' and table_name='compras_solicitacao_itens' and column_name='item_assistencial_id'),
  'solicitacao de compras referencia item assistencial'
);

select ok(
  exists (select 1 from information_schema.tables where table_schema='public' and table_name='compras_cotacao_itens'),
  'cotacao possui itens proprios'
);

select ok(
  (select relrowsecurity from pg_class where oid='public.compras_cotacao_itens'::regclass),
  'RLS ativa em itens da cotacao'
);

select ok(
  (select relforcerowsecurity from pg_class where oid='public.compras_cotacao_itens'::regclass),
  'RLS forçada em itens da cotacao'
);

select ok(
  exists (select 1 from information_schema.tables where table_schema='public' and table_name='compras_cotacao_item_propostas'),
  'cotacao possui propostas por item e fornecedor'
);

select ok(
  (select relrowsecurity from pg_class where oid='public.compras_cotacao_item_propostas'::regclass),
  'RLS ativa em propostas por item'
);

select ok(
  has_function_privilege('authenticated','public.gerar_cotacao_compra_catalogo(uuid,date,text)','EXECUTE'),
  'authenticated pode gerar cotacao conforme RLS/permissao da aplicacao'
);

select ok(
  not has_function_privilege('anon','public.gerar_cotacao_compra_catalogo(uuid,date,text)','EXECUTE'),
  'anon nao pode gerar cotacao'
);

select ok(
  has_function_privilege('authenticated','public.salvar_proposta_item_cotacao(uuid,uuid,numeric,numeric,text,text,text,integer,text,text)','EXECUTE'),
  'authenticated pode salvar proposta conforme RLS/permissao da aplicacao'
);

select ok(
  not has_function_privilege('anon','public.salvar_proposta_item_cotacao(uuid,uuid,numeric,numeric,text,text,text,integer,text,text)','EXECUTE'),
  'anon nao pode salvar proposta'
);

select ok(
  exists (select 1 from information_schema.columns where table_schema='public' and table_name='compras_pedido_itens' and column_name='item_assistencial_id'),
  'pedido preserva item assistencial'
);

select ok(
  exists (select 1 from information_schema.columns where table_schema='public' and table_name='compras_pedido_itens' and column_name='cotacao_item_id'),
  'pedido preserva item da cotacao de origem'
);

select * from finish();
rollback;
