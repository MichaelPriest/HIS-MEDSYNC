begin;

select plan(12);

select ok(
  exists (
    select 1 from information_schema.tables
    where table_schema='public' and table_name='itens_assistenciais'
  ),
  'cadastro mestre de itens assistenciais existe'
);

select ok(
  (select relrowsecurity from pg_class where oid='public.itens_assistenciais'::regclass),
  'RLS ativa no cadastro mestre de itens'
);

select ok(
  has_table_privilege('authenticated','public.itens_assistenciais','SELECT'),
  'authenticated pode consultar itens conforme RLS'
);

select ok(
  has_table_privilege('authenticated','public.itens_assistenciais','INSERT'),
  'authenticated pode cadastrar itens conforme RLS/permissao'
);

select ok(
  not has_table_privilege('authenticated','public.itens_assistenciais','DELETE'),
  'itens assistenciais sao inativados e nao excluidos pelo cliente'
);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='itens_assistenciais' and column_name='tabela_tiss_codigo'
  ),
  'item mestre preserva codigo da tabela TISS usado na guia'
);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='itens_assistenciais' and column_name='familia_tuss'
  ),
  'familia TUSS fica separada do codigo de tabela TISS'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname='itens_assistenciais_tabela_tiss_check'
      and pg_get_constraintdef(oid) like '%00%18%19%20%22%98%'
  ),
  'catalogo admite tabelas TISS 00, 18, 19, 20, 22 e 98'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname='itens_assistenciais_pacote_codigo_check'
      and pg_get_constraintdef(oid) like '%pacote%98%'
      and pg_get_constraintdef(oid) like '%codigo_tabela_propria%'
  ),
  'pacote exige tabela 98 e codigo proprio'
);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='estoque_produtos' and column_name='item_assistencial_id'
  ),
  'estoque referencia o cadastro mestre'
);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='conta_faturamento_itens' and column_name='item_assistencial_id'
  ),
  'conta hospitalar referencia o cadastro mestre'
);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='prescricoes' and column_name='item_assistencial_id'
  ),
  'prescricao pode referenciar o cadastro mestre'
);

select * from finish();
rollback;
