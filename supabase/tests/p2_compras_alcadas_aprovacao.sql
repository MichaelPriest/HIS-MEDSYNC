begin;

select plan(30);

select ok(exists (select 1 from information_schema.tables where table_schema='public' and table_name='compras_alcadas_aprovacao'),'existe cadastro de alcadas');
select ok(exists (select 1 from information_schema.tables where table_schema='public' and table_name='compras_alcada_perfis'),'alcada possui perfis autorizadores');
select ok(exists (select 1 from information_schema.tables where table_schema='public' and table_name='compras_cotacao_aprovacao_fluxos'),'existe fluxo versionado de aprovacao');
select ok(exists (select 1 from information_schema.tables where table_schema='public' and table_name='compras_cotacao_aprovacao_fluxo_perfis'),'fluxo congela perfis autorizados');
select ok(exists (select 1 from information_schema.tables where table_schema='public' and table_name='compras_cotacao_aprovacoes'),'existe trilha de decisoes');

select ok((select relrowsecurity from pg_class where oid='public.compras_alcadas_aprovacao'::regclass),'RLS ativa em alcadas');
select ok((select relforcerowsecurity from pg_class where oid='public.compras_alcadas_aprovacao'::regclass),'RLS forcada em alcadas');
select ok((select relrowsecurity from pg_class where oid='public.compras_cotacao_aprovacao_fluxos'::regclass),'RLS ativa em fluxos');
select ok((select relforcerowsecurity from pg_class where oid='public.compras_cotacao_aprovacao_fluxos'::regclass),'RLS forcada em fluxos');
select ok((select relrowsecurity from pg_class where oid='public.compras_cotacao_aprovacoes'::regclass),'RLS ativa em decisoes');
select ok((select relforcerowsecurity from pg_class where oid='public.compras_cotacao_aprovacoes'::regclass),'RLS forcada em decisoes');

select ok(has_function_privilege('authenticated','public.salvar_alcada_compra_operacional(uuid,uuid,uuid,text,numeric,numeric,integer,uuid[],boolean)','EXECUTE'),'authenticated chama configuracao; RPC aplica gerenciar');
select ok(not has_function_privilege('anon','public.salvar_alcada_compra_operacional(uuid,uuid,uuid,text,numeric,numeric,integer,uuid[],boolean)','EXECUTE'),'anon nao configura alcada');
select ok(has_function_privilege('authenticated','public.aprovar_fornecedor_cotacao_operacional(uuid,uuid)','EXECUTE'),'authenticated chama aprovacao; RPC aplica compras.aprovar');
select ok(not has_function_privilege('anon','public.aprovar_fornecedor_cotacao_operacional(uuid,uuid)','EXECUTE'),'anon nao aprova cotacao');
select ok(has_function_privilege('authenticated','public.rejeitar_cotacao_compra_operacional(uuid,text)','EXECUTE'),'authenticated chama rejeicao; RPC aplica compras.aprovar');
select ok(not has_function_privilege('anon','public.rejeitar_cotacao_compra_operacional(uuid,text)','EXECUTE'),'anon nao rejeita cotacao');
select ok(has_function_privilege('authenticated','public.reiniciar_aprovacao_cotacao_operacional(uuid,text)','EXECUTE'),'authenticated chama reinicio; RPC aplica compras.gerenciar');
select ok(not has_function_privilege('anon','public.reiniciar_aprovacao_cotacao_operacional(uuid,text)','EXECUTE'),'anon nao reinicia aprovacao');
select ok(has_function_privilege('authenticated','public.gerar_pedido_cotacao_aprovada(uuid)','EXECUTE'),'authenticated chama emissao; RPC revalida aprovacao');
select ok(not has_function_privilege('anon','public.gerar_pedido_cotacao_aprovada(uuid)','EXECUTE'),'anon nao emite pedido');

select ok(not has_table_privilege('authenticated','public.compras_cotacoes','INSERT'),'authenticated nao insere cotacao diretamente');
select ok(not has_table_privilege('authenticated','public.compras_cotacoes','UPDATE'),'authenticated nao aprova cotacao por update direto');
select ok(not has_table_privilege('authenticated','public.compras_cotacao_fornecedores','UPDATE'),'authenticated nao troca fornecedor/valor diretamente');
select ok(not has_table_privilege('authenticated','public.compras_cotacao_item_propostas','UPDATE'),'authenticated nao altera proposta diretamente');
select ok(not has_table_privilege('authenticated','public.compras_pedidos','INSERT'),'authenticated nao cria pedido diretamente');
select ok(not has_table_privilege('authenticated','public.compras_pedido_itens','INSERT'),'authenticated nao cria item de pedido diretamente');

select ok(exists (select 1 from pg_indexes where schemaname='public' and indexname='compras_cotacao_aprovacao_fluxos_ativo_idx'),'ha apenas um ciclo ativo por cotacao');
select ok(exists (select 1 from information_schema.table_constraints where table_schema='public' and table_name='compras_cotacao_aprovacoes' and constraint_type='UNIQUE'),'decisoes impedem aprovador duplicado no fluxo');
select ok(exists (select 1 from information_schema.table_constraints where table_schema='public' and table_name='compras_alcadas_aprovacao' and constraint_name='compras_alcadas_aprovacao_faixa_check'),'faixa de valor possui check estrutural');

select * from finish();
rollback;