create table if not exists public.tiss_recurso_retornos (
  id uuid primary key default extensions.gen_random_uuid(),
  recurso_id uuid not null references public.tiss_recursos_glosa(id),
  empresa_id uuid not null references public.empresas(id),
  unidade_id uuid not null references public.unidades(id),
  protocolo_operadora text,
  recebido_em timestamptz not null default now(),
  observacao text,
  origem text not null default 'manual' check (origem in ('manual','integracao')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create index if not exists idx_tiss_recurso_retornos_recurso
  on public.tiss_recurso_retornos(recurso_id, recebido_em desc);

create table if not exists public.tiss_recurso_retorno_itens (
  id uuid primary key default extensions.gen_random_uuid(),
  retorno_id uuid not null references public.tiss_recurso_retornos(id),
  recurso_item_id uuid not null references public.tiss_recurso_itens(id),
  valor_deferido numeric not null default 0 check (valor_deferido >= 0),
  valor_indeferido numeric not null default 0 check (valor_indeferido >= 0),
  created_at timestamptz not null default now(),
  constraint tiss_recurso_retorno_itens_valor_check check (valor_deferido + valor_indeferido > 0),
  constraint tiss_recurso_retorno_itens_retorno_id_recurso_item_id_key unique (retorno_id,recurso_item_id)
);

create index if not exists idx_tiss_recurso_retorno_itens_retorno
  on public.tiss_recurso_retorno_itens(retorno_id);
create index if not exists idx_tiss_recurso_retorno_itens_item
  on public.tiss_recurso_retorno_itens(recurso_item_id);

alter table public.tiss_recurso_retornos enable row level security;
alter table public.tiss_recurso_retorno_itens enable row level security;

drop policy if exists tiss_recurso_retornos_select on public.tiss_recurso_retornos;
create policy tiss_recurso_retornos_select
on public.tiss_recurso_retornos
for select to authenticated
using (
  exists (
    select 1
    from public.tiss_recursos_glosa r
    where r.id = tiss_recurso_retornos.recurso_id
      and public.tem_unidade(r.empresa_id,r.unidade_id)
  )
);

drop policy if exists tiss_recurso_retorno_itens_select on public.tiss_recurso_retorno_itens;
create policy tiss_recurso_retorno_itens_select
on public.tiss_recurso_retorno_itens
for select to authenticated
using (
  exists (
    select 1
    from public.tiss_recurso_retornos rt
    join public.tiss_recursos_glosa r on r.id=rt.recurso_id
    where rt.id=tiss_recurso_retorno_itens.retorno_id
      and public.tem_unidade(r.empresa_id,r.unidade_id)
  )
);

revoke all on public.tiss_recurso_retornos from public, anon, authenticated;
revoke all on public.tiss_recurso_retorno_itens from public, anon, authenticated;
grant select on public.tiss_recurso_retornos to authenticated;
grant select on public.tiss_recurso_retorno_itens to authenticated;

create or replace function public.registrar_retorno_recurso_glosa_transacional(
  p_recurso_id uuid,
  p_protocolo_operadora text,
  p_retorno_em timestamptz,
  p_itens jsonb,
  p_observacao text default null,
  p_origem text default 'manual'
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user uuid:=auth.uid();
  v_recurso public.tiss_recursos_glosa%rowtype;
  v_retorno uuid;
  v_json jsonb;
  v_item_id_text text;
  v_item_id uuid;
  v_deferido numeric;
  v_indeferido numeric;
  v_item public.tiss_recurso_itens%rowtype;
  v_glosa public.tiss_glosas%rowtype;
  v_total_deferido_glosa numeric;
  v_total_recursado numeric;
  v_total_deferido numeric;
  v_total_indeferido numeric;
  v_status text;
  v_lote uuid;
  v_recebido_em timestamptz:=coalesce(p_retorno_em,now());
begin
  if v_user is null then raise exception 'TISS_RECURSO_RETORNO_NAO_AUTENTICADO' using errcode='42501'; end if;
  if p_origem not in ('manual','integracao') then raise exception 'TISS_RECURSO_RETORNO_ORIGEM_INVALIDA'; end if;
  if p_itens is null or jsonb_typeof(p_itens)<>'array' or jsonb_array_length(p_itens)=0 then raise exception 'TISS_RECURSO_RETORNO_SEM_ITENS'; end if;

  select * into v_recurso from public.tiss_recursos_glosa where id=p_recurso_id for update;
  if not found then raise exception 'TISS_RECURSO_RETORNO_NAO_LOCALIZADO'; end if;
  if not public.tem_unidade(v_recurso.empresa_id,v_recurso.unidade_id)
     or not public.tem_permissao(v_recurso.empresa_id,v_recurso.unidade_id,'tiss.retorno') then
    raise exception 'TISS_RECURSO_RETORNO_SEM_PERMISSAO' using errcode='42501';
  end if;

  insert into public.tiss_recurso_retornos(
    recurso_id,empresa_id,unidade_id,protocolo_operadora,recebido_em,observacao,origem,created_by
  ) values (
    v_recurso.id,v_recurso.empresa_id,v_recurso.unidade_id,
    nullif(btrim(coalesce(p_protocolo_operadora,'')),''),v_recebido_em,
    nullif(btrim(coalesce(p_observacao,'')),''),p_origem,v_user
  ) returning id into v_retorno;

  for v_json in select value from jsonb_array_elements(p_itens) loop
    v_item_id_text:=coalesce(v_json->>'item_id','');
    if v_item_id_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      raise exception 'TISS_RECURSO_RETORNO_ITEM_INVALIDO';
    end if;
    v_item_id:=v_item_id_text::uuid;
    if coalesce(v_json->>'valor_deferido','') !~ '^[0-9]+([.][0-9]+)?$'
       or coalesce(v_json->>'valor_indeferido','') !~ '^[0-9]+([.][0-9]+)?$' then
      raise exception 'TISS_RECURSO_RETORNO_VALOR_INVALIDO';
    end if;
    v_deferido:=(v_json->>'valor_deferido')::numeric;
    v_indeferido:=(v_json->>'valor_indeferido')::numeric;
    if v_deferido<0 or v_indeferido<0 or v_deferido+v_indeferido<=0 then raise exception 'TISS_RECURSO_RETORNO_VALOR_INVALIDO'; end if;

    select * into v_item from public.tiss_recurso_itens where id=v_item_id and recurso_id=v_recurso.id for update;
    if not found then raise exception 'TISS_RECURSO_RETORNO_ITEM_FORA_RECURSO'; end if;
    if v_item.valor_deferido+v_item.valor_indeferido+v_deferido+v_indeferido>v_item.valor_recursado then
      raise exception 'TISS_RECURSO_RETORNO_EXCEDE_RECURSADO';
    end if;

    select * into v_glosa from public.tiss_glosas where id=v_item.glosa_id for update;
    if not found then raise exception 'TISS_RECURSO_RETORNO_GLOSA_NAO_LOCALIZADA'; end if;
    select coalesce(sum(ri.valor_deferido),0) into v_total_deferido_glosa from public.tiss_recurso_itens ri where ri.glosa_id=v_glosa.id;
    if v_total_deferido_glosa+v_deferido>v_glosa.valor_glosado then raise exception 'TISS_RECURSO_RETORNO_DEFERIDO_EXCEDE_GLOSA'; end if;

    insert into public.tiss_recurso_retorno_itens(retorno_id,recurso_item_id,valor_deferido,valor_indeferido)
    values(v_retorno,v_item.id,v_deferido,v_indeferido);

    update public.tiss_recurso_itens
       set valor_deferido=valor_deferido+v_deferido,
           valor_indeferido=valor_indeferido+v_indeferido
     where id=v_item.id returning * into v_item;

    select coalesce(sum(ri.valor_deferido),0) into v_total_deferido_glosa from public.tiss_recurso_itens ri where ri.glosa_id=v_glosa.id;
    if v_item.valor_deferido+v_item.valor_indeferido<v_item.valor_recursado then v_status:='em_recurso';
    elsif v_total_deferido_glosa>=v_glosa.valor_glosado then v_status:='deferida';
    elsif v_total_deferido_glosa>0 then v_status:='parcial';
    else v_status:='indeferida'; end if;
    update public.tiss_glosas set status=v_status where id=v_glosa.id;
  end loop;

  select coalesce(sum(valor_recursado),0),coalesce(sum(valor_deferido),0),coalesce(sum(valor_indeferido),0)
    into v_total_recursado,v_total_deferido,v_total_indeferido
    from public.tiss_recurso_itens where recurso_id=v_recurso.id;

  if v_total_deferido+v_total_indeferido<v_total_recursado then v_status:='parcial';
  elsif v_total_deferido=v_total_recursado then v_status:='deferido';
  elsif v_total_indeferido=v_total_recursado then v_status:='indeferido';
  else v_status:='parcial'; end if;

  update public.tiss_recursos_glosa
     set status=v_status,
         protocolo_operadora=coalesce(nullif(btrim(coalesce(p_protocolo_operadora,'')),''),protocolo_operadora),
         retorno_em=greatest(coalesce(retorno_em,v_recebido_em),v_recebido_em),
         updated_at=now(),updated_by=v_user
   where id=v_recurso.id;

  for v_lote in
    select distinct g.lote_id
    from public.tiss_recurso_itens ri
    join public.tiss_glosas g on g.id=ri.glosa_id
    where ri.recurso_id=v_recurso.id and g.lote_id is not null
  loop
    perform public.recalcular_recebivel_glosa_tiss_internal(v_lote,v_user);
  end loop;

  return v_retorno;
end
$function$;

revoke all on function public.registrar_retorno_recurso_glosa_transacional(uuid,text,timestamptz,jsonb,text,text) from public, anon;
grant execute on function public.registrar_retorno_recurso_glosa_transacional(uuid,text,timestamptz,jsonb,text,text) to authenticated;

do $do$
begin
  if to_regprocedure('public.capturar_integracao_recurso_retorno_item()') is not null then
    drop trigger if exists trg_capturar_integracao_recurso_retorno_item on public.tiss_recurso_retorno_itens;
    create trigger trg_capturar_integracao_recurso_retorno_item
      after insert on public.tiss_recurso_retorno_itens
      for each row execute function public.capturar_integracao_recurso_retorno_item();
  end if;
end
$do$;
