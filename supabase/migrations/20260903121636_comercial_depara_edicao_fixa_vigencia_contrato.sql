alter table public.contrato_depara_tuss
  add column if not exists referencia_equivalencia_id uuid;

alter table public.contrato_depara_tuss
  drop constraint if exists contrato_depara_tuss_referencia_equivalencia_id_fkey;
alter table public.contrato_depara_tuss
  add constraint contrato_depara_tuss_referencia_equivalencia_id_fkey
  foreign key (referencia_equivalencia_id)
  references public.referencia_equivalencias(id)
  on delete set null;

alter table public.contrato_depara_tuss
  drop constraint if exists contrato_depara_tuss_origem_mapeamento_check;
alter table public.contrato_depara_tuss
  add constraint contrato_depara_tuss_origem_mapeamento_check
  check (origem_mapeamento in ('manual','automatico_tabela','automatico_equivalencia'));

create index if not exists idx_contrato_depara_tuss_equivalencia
  on public.contrato_depara_tuss(referencia_equivalencia_id)
  where referencia_equivalencia_id is not null;

create or replace function public.comercial_normalizar_depara_before()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if new.origem_mapeamento='manual' then
    new.vinculo_id:=null;
    new.tabela_item_id:=null;
    new.referencia_equivalencia_id:=null;
    new.sincronizado_em:=null;
  end if;
  return new;
end;
$$;

revoke all on function public.comercial_normalizar_depara_before()
from public,anon,authenticated;

drop trigger if exists trg_comercial_normalizar_depara
on public.contrato_depara_tuss;
create trigger trg_comercial_normalizar_depara
before insert or update on public.contrato_depara_tuss
for each row execute function public.comercial_normalizar_depara_before();

create or replace function public.comercial_sincronizar_depara_vinculo_internal(
  p_vinculo_id uuid,
  p_data date default current_date
)
returns integer
language plpgsql
security definer
set search_path=''
as $$
declare
  v_v public.contrato_tabelas_comerciais%rowtype;
  v_c public.credenciamento_contratos%rowtype;
  v_e public.tabelas_comerciais_edicoes%rowtype;
  v_f public.tabelas_comerciais_fontes%rowtype;
  v_item record;
  v_id uuid;
  v_inicio date;
  v_fim date;
  v_count integer:=0;
  v_sistema_origem text;
begin
  select * into v_v
  from public.contrato_tabelas_comerciais
  where id=p_vinculo_id;
  if not found then return 0; end if;

  select * into v_c
  from public.credenciamento_contratos
  where id=v_v.contrato_id;

  select * into v_f
  from public.tabelas_comerciais_fontes
  where id=v_v.fonte_id;

  v_sistema_origem:=case
    when upper(coalesce(v_f.codigo,'')) like 'AMB%'
      or lower(coalesce(v_f.tipo,'')) like 'amb%'
      then 'AMB'
    else upper(coalesce(v_f.codigo,''))
  end;

  if not v_v.ativo then
    update public.contrato_depara_tuss d
    set ativo=false,
        vigencia_fim=case
          when current_date<d.vigencia_inicio then d.vigencia_inicio
          else least(coalesce(d.vigencia_fim,current_date),current_date)
        end,
        updated_at=now(),
        updated_by=auth.uid(),
        sincronizado_em=now()
    where d.vinculo_id=p_vinculo_id
      and d.origem_mapeamento in ('automatico_tabela','automatico_equivalencia')
      and d.ativo;
    return 0;
  end if;

  select * into v_e
  from public.tabelas_comerciais_edicoes
  where id=public.comercial_resolver_edicao_vinculo_internal(
    p_vinculo_id,
    coalesce(p_data,current_date)
  );
  if not found then return 0; end if;

  if v_v.modo_edicao='edicao_fixa' then
    v_inicio:=coalesce(v_c.data_inicio,v_e.vigencia_inicio,current_date);
    v_fim:=v_c.data_fim;
  else
    v_inicio:=greatest(
      coalesce(v_c.data_inicio,v_e.vigencia_inicio),
      v_e.vigencia_inicio
    );
    if v_c.data_fim is null then
      v_fim:=v_e.vigencia_fim;
    elsif v_e.vigencia_fim is null then
      v_fim:=v_c.data_fim;
    else
      v_fim:=least(v_c.data_fim,v_e.vigencia_fim);
    end if;
  end if;

  if v_fim is not null and v_fim<v_inicio then
    return 0;
  end if;

  update public.contrato_depara_tuss d
  set ativo=false,
      updated_at=now(),
      updated_by=auth.uid(),
      sincronizado_em=now()
  where d.vinculo_id=p_vinculo_id
    and d.origem_mapeamento in ('automatico_tabela','automatico_equivalencia')
    and d.ativo;

  for v_item in
    select
      i.id,
      i.codigo,
      i.descricao,
      i.tabela_tiss_codigo,
      coalesce(nullif(btrim(i.codigo_tuss),''),eq.codigo_destino) as codigo_tuss_resolvido,
      coalesce(eq.descricao_destino,i.descricao) as descricao_tuss_resolvida,
      case
        when nullif(btrim(i.codigo_tuss),'') is not null then 'automatico_tabela'
        else 'automatico_equivalencia'
      end as origem_auto,
      case
        when nullif(btrim(i.codigo_tuss),'') is not null then null::uuid
        else eq.id
      end as equivalencia_id
    from public.tabelas_comerciais_itens i
    left join lateral (
      select r.id,r.codigo_destino,r.descricao_destino
      from public.referencia_equivalencias r
      where r.status='ativa'
        and upper(r.sistema_origem)=v_sistema_origem
        and upper(r.sistema_destino)='TUSS'
        and r.codigo_origem=i.codigo
      order by r.updated_at desc nulls last,r.id
      limit 1
    ) eq on true
    where i.edicao_id=v_e.id
      and i.ativo
      and nullif(btrim(i.codigo),'') is not null
      and (
        nullif(btrim(i.codigo_tuss),'') is not null
        or eq.codigo_destino is not null
      )
  loop
    if exists(
      select 1
      from public.contrato_depara_tuss d
      where d.contrato_id=v_v.contrato_id
        and d.fonte_id=v_v.fonte_id
        and d.codigo_origem=btrim(v_item.codigo)
        and d.ativo
        and d.origem_mapeamento='manual'
        and d.vigencia_inicio<=coalesce(v_fim,'infinity'::date)
        and coalesce(d.vigencia_fim,'infinity'::date)>=v_inicio
    ) then
      continue;
    end if;

    select d.id into v_id
    from public.contrato_depara_tuss d
    where d.vinculo_id=p_vinculo_id
      and d.origem_mapeamento in ('automatico_tabela','automatico_equivalencia')
      and d.codigo_origem=btrim(v_item.codigo)
    order by d.updated_at desc,d.id
    limit 1;

    if v_id is null then
      insert into public.contrato_depara_tuss(
        contrato_id,fonte_id,codigo_origem,descricao_origem,
        codigo_tuss,descricao_tuss,tabela_tiss_codigo,
        vigencia_inicio,vigencia_fim,ativo,observacoes,
        created_by,updated_by,origem_mapeamento,vinculo_id,
        tabela_item_id,sincronizado_em,referencia_equivalencia_id
      ) values (
        v_v.contrato_id,v_v.fonte_id,btrim(v_item.codigo),
        nullif(btrim(v_item.descricao),''),
        btrim(v_item.codigo_tuss_resolvido),
        nullif(btrim(v_item.descricao_tuss_resolvida),''),
        nullif(btrim(v_item.tabela_tiss_codigo),''),
        v_inicio,v_fim,true,
        case
          when v_item.origem_auto='automatico_tabela'
            then 'Gerado automaticamente a partir do codigo_tuss explícito do item da tabela comercial.'
          else 'Gerado automaticamente a partir de equivalência explícita cadastrada para a tabela comercial.'
        end,
        auth.uid(),auth.uid(),v_item.origem_auto,p_vinculo_id,
        v_item.id,now(),v_item.equivalencia_id
      )
      returning id into v_id;
    else
      update public.contrato_depara_tuss d
      set codigo_tuss=btrim(v_item.codigo_tuss_resolvido),
          descricao_origem=nullif(btrim(v_item.descricao),''),
          descricao_tuss=nullif(btrim(v_item.descricao_tuss_resolvida),''),
          tabela_tiss_codigo=nullif(btrim(v_item.tabela_tiss_codigo),''),
          vigencia_inicio=v_inicio,
          vigencia_fim=v_fim,
          ativo=true,
          tabela_item_id=v_item.id,
          origem_mapeamento=v_item.origem_auto,
          referencia_equivalencia_id=v_item.equivalencia_id,
          updated_at=now(),
          updated_by=auth.uid(),
          sincronizado_em=now()
      where d.id=v_id;
    end if;

    v_count:=v_count+1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.comercial_sincronizar_depara_vinculo_internal(uuid,date)
from public,anon,authenticated;

do $$
declare r record;
begin
  for r in
    select id from public.contrato_tabelas_comerciais where ativo
  loop
    perform public.comercial_sincronizar_depara_vinculo_internal(r.id,current_date);
  end loop;
end
$$;
