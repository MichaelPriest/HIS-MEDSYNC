create table if not exists public.tiss_comunicacao_versoes_suportadas (
  codigo text primary key,
  ordem integer not null unique,
  familia text not null,
  configuravel boolean not null default true,
  adaptador_status text not null default 'catalogado' check (adaptador_status in ('catalogado','validacao','geracao')),
  fonte_oficial text not null,
  observacoes text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.tiss_comunicacao_versoes_suportadas(codigo,ordem,familia,configuravel,adaptador_status,fonte_oficial,observacoes)
values
 ('03.05.00',30500,'3.x',true,'catalogado','https://www.gov.br/ans/pt-br/assuntos/prestadores/padrao-para-troca-de-informacao-de-saude-suplementar-2013-tiss/padrao-tiss-historico-das-versoes-dos-componentes-do-padrao-tiss','Piso de compatibilidade definido para o HIS-MEDSYNC.'),
 ('04.00.00',40000,'4.x',true,'catalogado','https://www.gov.br/ans/pt-br/assuntos/prestadores/padrao-para-troca-de-informacao-de-saude-suplementar-2013-tiss/padrao-tiss-historico-das-versoes-dos-componentes-do-padrao-tiss',null),
 ('04.00.01',40001,'4.x',true,'catalogado','https://www.gov.br/ans/pt-br/assuntos/prestadores/padrao-para-troca-de-informacao-de-saude-suplementar-2013-tiss/padrao-tiss-historico-das-versoes-dos-componentes-do-padrao-tiss',null),
 ('04.01.00',40100,'4.x',true,'catalogado','https://www.gov.br/ans/pt-br/assuntos/prestadores/padrao-para-troca-de-informacao-de-saude-suplementar-2013-tiss/padrao-tiss-historico-das-versoes-dos-componentes-do-padrao-tiss',null),
 ('04.02.00',40200,'4.x',true,'catalogado','https://www.gov.br/ans/pt-br/assuntos/prestadores/padrao-para-troca-de-informacao-de-saude-suplementar-2013-tiss/padrao-tiss-historico-das-versoes-dos-componentes-do-padrao-tiss',null),
 ('04.03.00',40300,'4.x',true,'geracao','https://www.gov.br/ans/pt-br/assuntos/prestadores/padrao-para-troca-de-informacao-de-saude-suplementar-2013-tiss/padrao-tiss-julho-2026','Adaptador de geração/validação já existente no HIS-MEDSYNC.')
on conflict(codigo) do update set
 ordem=excluded.ordem,familia=excluded.familia,configuravel=excluded.configuravel,
 adaptador_status=excluded.adaptador_status,fonte_oficial=excluded.fonte_oficial,
 observacoes=coalesce(excluded.observacoes,public.tiss_comunicacao_versoes_suportadas.observacoes),ativo=true;

alter table public.tiss_guias add column if not exists versao_comunicacao_snapshot text;
alter table public.tiss_lotes add column if not exists versao_comunicacao_snapshot text;

update public.tiss_guias g
set versao_comunicacao_snapshot=tv.comunicacao_principal
from public.tiss_versoes tv
where g.versao_id=tv.id and g.versao_comunicacao_snapshot is null;

update public.tiss_lotes l
set versao_comunicacao_snapshot=tv.comunicacao_principal
from public.tiss_versoes tv
where l.versao_id=tv.id and l.versao_comunicacao_snapshot is null;

create or replace function public.tiss_resolver_versao_comunicacao_internal(p_empresa_id uuid,p_unidade_id uuid,p_convenio_id uuid)
returns text language plpgsql security definer set search_path='public','pg_catalog' as $$
declare v text;
begin
  select c.versao_comunicacao into v
  from public.tiss_webservice_configuracoes c
  where c.empresa_id=p_empresa_id and c.convenio_id=p_convenio_id and c.ativo
    and (c.unidade_id=p_unidade_id or c.unidade_id is null)
  order by case when c.unidade_id=p_unidade_id then 0 else 1 end,c.updated_at desc
  limit 1;

  if v is null then
    select tv.comunicacao_principal into v
    from public.tiss_versoes tv where tv.ativo
    order by tv.vigente_desde desc nulls last,tv.created_at desc,tv.id limit 1;
  end if;

  if not exists(select 1 from public.tiss_comunicacao_versoes_suportadas s where s.codigo=v and s.ativo and s.configuravel and s.ordem>=30500) then
    raise exception 'TISS_VERSAO_COMUNICACAO_NAO_SUPORTADA:%',coalesce(v,'NULL');
  end if;
  return v;
end $$;

create or replace function public.tiss_normalizar_versao_guia_internal()
returns trigger language plpgsql security definer set search_path='public','pg_catalog' as $$
begin
  if new.versao_comunicacao_snapshot is null then
    new.versao_comunicacao_snapshot:=public.tiss_resolver_versao_comunicacao_internal(new.empresa_id,new.unidade_id,new.convenio_id);
  end if;
  if not exists(select 1 from public.tiss_comunicacao_versoes_suportadas s where s.codigo=new.versao_comunicacao_snapshot and s.ativo and s.ordem>=30500) then
    raise exception 'TISS_GUIA_VERSAO_COMUNICACAO_NAO_SUPORTADA:%',new.versao_comunicacao_snapshot;
  end if;
  return new;
end $$;

drop trigger if exists trg_tiss_normalizar_versao_guia on public.tiss_guias;
create trigger trg_tiss_normalizar_versao_guia before insert or update of versao_comunicacao_snapshot,convenio_id,unidade_id on public.tiss_guias
for each row execute function public.tiss_normalizar_versao_guia_internal();

create or replace function public.tiss_validar_config_versao_internal()
returns trigger language plpgsql security definer set search_path='public','pg_catalog' as $$
begin
  if not exists(select 1 from public.tiss_comunicacao_versoes_suportadas s where s.codigo=new.versao_comunicacao and s.ativo and s.configuravel and s.ordem>=30500) then
    raise exception 'TISS_CONFIG_VERSAO_COMUNICACAO_NAO_SUPORTADA:%',new.versao_comunicacao;
  end if;
  return new;
end $$;

drop trigger if exists trg_tiss_validar_config_versao on public.tiss_webservice_configuracoes;
create trigger trg_tiss_validar_config_versao before insert or update of versao_comunicacao on public.tiss_webservice_configuracoes
for each row execute function public.tiss_validar_config_versao_internal();

revoke all on function public.tiss_resolver_versao_comunicacao_internal(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.tiss_normalizar_versao_guia_internal() from public,anon,authenticated;
revoke all on function public.tiss_validar_config_versao_internal() from public,anon,authenticated;

grant select on public.tiss_comunicacao_versoes_suportadas to authenticated;
alter table public.tiss_comunicacao_versoes_suportadas enable row level security;
drop policy if exists tiss_comunicacao_versoes_read on public.tiss_comunicacao_versoes_suportadas;
create policy tiss_comunicacao_versoes_read on public.tiss_comunicacao_versoes_suportadas for select to authenticated using (true);
