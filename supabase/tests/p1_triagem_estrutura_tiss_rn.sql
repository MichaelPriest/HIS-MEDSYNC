begin;

select plan(11);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='atendimentos' and column_name='atendimento_rn'
  ),
  'atendimento possui indicador TISS de RN'
);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='tiss_guias' and column_name='atendimento_rn'
  ),
  'guia TISS possui snapshot do indicador RN'
);

select ok(
  exists (
    select 1 from public.setores_chamada where codigo='triagem' and ativo=true
  ),
  'setor de chamada da triagem está disponível'
);

select ok(
  exists (
    select 1 from information_schema.tables
    where table_schema='public' and table_name='estruturas_fisicas'
  ),
  'tabela de estrutura física hospitalar existe'
);

select ok(
  (select relrowsecurity from pg_class where oid='public.estruturas_fisicas'::regclass),
  'RLS ativa em estruturas_fisicas'
);

select ok(
  has_table_privilege('authenticated','public.estruturas_fisicas','SELECT'),
  'authenticated pode consultar estrutura conforme RLS'
);

select ok(
  has_table_privilege('authenticated','public.estruturas_fisicas','INSERT'),
  'authenticated pode criar estrutura conforme RLS/permissão'
);

select ok(
  has_table_privilege('authenticated','public.estruturas_fisicas','UPDATE'),
  'authenticated pode editar estrutura conforme RLS/permissão'
);

select ok(
  not has_table_privilege('authenticated','public.estruturas_fisicas','DELETE'),
  'estrutura física é inativada e não apagada pelo cliente'
);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='leitos' and column_name='estrutura_fisica_id'
  ),
  'leitos podem ser vinculados à estrutura física'
);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='salas_cirurgicas' and column_name='estrutura_fisica_id'
  ),
  'salas cirúrgicas podem ser vinculadas à estrutura física'
);

select * from finish();
rollback;
