alter table public.comercial_eventos
  add column if not exists contexto_contrato_id uuid null references public.credenciamento_contratos(id) on delete set null,
  add column if not exists contexto_edicao_id uuid null references public.tabelas_comerciais_edicoes(id) on delete set null;

create index if not exists idx_comercial_eventos_contexto_contrato
  on public.comercial_eventos(contexto_contrato_id, created_at desc)
  where contexto_contrato_id is not null;
create index if not exists idx_comercial_eventos_contexto_edicao
  on public.comercial_eventos(contexto_edicao_id, created_at desc)
  where contexto_edicao_id is not null;

update public.comercial_eventos ev
set contexto_edicao_id = ev.entidade_id
where ev.entidade_tipo = 'tabelas_comerciais_edicoes'
  and ev.contexto_edicao_id is null
  and exists(select 1 from public.tabelas_comerciais_edicoes e where e.id=ev.entidade_id);

create or replace function public.audit_comercial_mutacao()
returns trigger
language plpgsql
security definer
set search_path=public,pg_catalog,extensions
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_ref jsonb;
  v_empresa uuid;
  v_unidade uuid;
  v_entidade uuid;
  v_contrato uuid;
  v_edicao uuid;
begin
  v_old:=case when tg_op<>'INSERT' then to_jsonb(old) else null end;
  v_new:=case when tg_op<>'DELETE' then to_jsonb(new) else null end;
  v_ref:=coalesce(v_new,v_old);
  v_entidade:=(v_ref->>'id')::uuid;

  if tg_table_name='credenciamento_contratos' then
    v_empresa:=(v_ref->>'empresa_id')::uuid;
    v_unidade:=nullif(v_ref->>'unidade_id','')::uuid;
    v_contrato:=v_entidade;
  elsif tg_table_name='tabelas_comerciais_fontes' then
    v_empresa:=(v_ref->>'empresa_id')::uuid;
  elsif tg_table_name='tabelas_comerciais_edicoes' then
    v_edicao:=v_entidade;
    select f.empresa_id into v_empresa
    from public.tabelas_comerciais_fontes f
    where f.id=(v_ref->>'fonte_id')::uuid;
  elsif tg_table_name='tabelas_comerciais_itens' then
    v_edicao:=(v_ref->>'edicao_id')::uuid;
    select f.empresa_id into v_empresa
    from public.tabelas_comerciais_edicoes e
    join public.tabelas_comerciais_fontes f on f.id=e.fonte_id
    where e.id=v_edicao;
  elsif tg_table_name in ('contrato_tabelas_comerciais','contrato_regras_procedimentos','contrato_regras_faturamento','contrato_pacotes') then
    v_contrato:=(v_ref->>'contrato_id')::uuid;
    select c.empresa_id,c.unidade_id into v_empresa,v_unidade
    from public.credenciamento_contratos c where c.id=v_contrato;
    if tg_table_name='contrato_tabelas_comerciais' then
      v_edicao:=nullif(v_ref->>'edicao_fixa_id','')::uuid;
    end if;
  elsif tg_table_name='contrato_pacote_itens' then
    select c.id,c.empresa_id,c.unidade_id into v_contrato,v_empresa,v_unidade
    from public.contrato_pacotes p
    join public.credenciamento_contratos c on c.id=p.contrato_id
    where p.id=(v_ref->>'pacote_id')::uuid;
  else
    return coalesce(new,old);
  end if;

  if v_empresa is not null then
    insert into public.comercial_eventos(
      empresa_id,unidade_id,entidade_tipo,entidade_id,acao,antes,depois,usuario_id,
      contexto_contrato_id,contexto_edicao_id
    ) values(
      v_empresa,v_unidade,tg_table_name,v_entidade,lower(tg_op),v_old,v_new,auth.uid(),
      v_contrato,v_edicao
    );
  end if;
  return coalesce(new,old);
end
$$;

revoke execute on function public.audit_comercial_mutacao() from public,anon,authenticated;

drop trigger if exists trg_audit_comercial on public.tabelas_comerciais_itens;
create trigger trg_audit_comercial
after insert or update or delete on public.tabelas_comerciais_itens
for each row execute function public.audit_comercial_mutacao();

comment on column public.comercial_eventos.contexto_contrato_id is 'Contrato comercial relacionado ao evento, quando aplicavel, para navegacao e auditoria contextual.';
comment on column public.comercial_eventos.contexto_edicao_id is 'Edicao de tabela comercial relacionada ao evento, inclusive alteracoes de itens.';