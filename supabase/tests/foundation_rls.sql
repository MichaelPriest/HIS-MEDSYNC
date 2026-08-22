begin;
select plan(4);
select ok((select relrowsecurity from pg_class where oid='public.empresas'::regclass),'RLS ativa em empresas');
select ok((select relrowsecurity from pg_class where oid='public.auditoria_eventos'::regclass),'RLS ativa em auditoria');
set local role anon; select is((select count(*) from public.empresas),0::bigint,'anônimo não lê tenants'); reset role;
set local role authenticated; select throws_ok('update public.auditoria_eventos set operacao=''x''','42501',null,'auditoria não pode ser alterada pelo cliente'); reset role;
select * from finish(); rollback;
