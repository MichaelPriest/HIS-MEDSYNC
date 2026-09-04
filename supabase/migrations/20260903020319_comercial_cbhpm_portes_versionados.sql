create table if not exists public.contrato_cbhpm_portes (
  id uuid primary key default gen_random_uuid(),
  vinculo_id uuid not null references public.contrato_tabelas_comerciais(id) on delete cascade,
  tipo text not null,
  porte text not null,
  valor numeric not null,
  vigencia_inicio date,
  vigencia_fim date,
  ativo boolean not null default true,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  constraint contrato_cbhpm_portes_tipo_check check (tipo in ('procedimento','anestesia')),
  constraint contrato_cbhpm_portes_valor_check check (valor >= 0),
  constraint contrato_cbhpm_portes_vigencia_check check (vigencia_inicio is null or vigencia_fim is null or vigencia_fim >= vigencia_inicio)
);

create index if not exists contrato_cbhpm_portes_resolucao_idx
  on public.contrato_cbhpm_portes(vinculo_id,tipo,porte,ativo,vigencia_inicio,vigencia_fim);

alter table public.contrato_cbhpm_portes enable row level security;
alter table public.contrato_cbhpm_portes force row level security;

revoke all on table public.contrato_cbhpm_portes from public, anon, authenticated;
grant select on table public.contrato_cbhpm_portes to authenticated;

drop policy if exists contrato_cbhpm_portes_select_funcional on public.contrato_cbhpm_portes;
create policy contrato_cbhpm_portes_select_funcional
on public.contrato_cbhpm_portes
for select
to authenticated
using (
  exists (
    select 1
      from public.contrato_tabelas_comerciais v
      join public.credenciamento_contratos c on c.id=v.contrato_id
     where v.id=contrato_cbhpm_portes.vinculo_id
       and public.comercial_pode_visualizar(c.empresa_id,c.unidade_id)
  )
);

create or replace function public.comercial_salvar_porte_cbhpm(
  p_id uuid,
  p_vinculo_id uuid,
  p_tipo text,
  p_porte text,
  p_valor numeric,
  p_vigencia_inicio date,
  p_vigencia_fim date,
  p_observacoes text,
  p_ativo boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_vinculo public.contrato_tabelas_comerciais%rowtype;
  v_contrato public.credenciamento_contratos%rowtype;
  v_fonte public.tabelas_comerciais_fontes%rowtype;
  v_id uuid;
  v_inicio date := coalesce(p_vigencia_inicio,'0001-01-01'::date);
  v_fim date := coalesce(p_vigencia_fim,'9999-12-31'::date);
begin
  if auth.uid() is null then
    raise exception 'COMERCIAL_AUTENTICACAO_OBRIGATORIA' using errcode='42501';
  end if;

  select * into v_vinculo
    from public.contrato_tabelas_comerciais
   where id=p_vinculo_id;
  if not found then raise exception 'COMERCIAL_VINCULO_NAO_LOCALIZADO'; end if;

  select * into v_contrato
    from public.credenciamento_contratos
   where id=v_vinculo.contrato_id;
  select * into v_fonte
    from public.tabelas_comerciais_fontes
   where id=v_vinculo.fonte_id;

  if v_fonte.tipo <> 'cbhpm' then
    raise exception 'COMERCIAL_VINCULO_NAO_CBHPM';
  end if;
  if not (public.comercial_pode_editar(v_contrato.empresa_id,v_contrato.unidade_id)
          or public.tabelas_comerciais_pode_editar(v_contrato.empresa_id,v_contrato.unidade_id)) then
    raise exception 'COMERCIAL_SEM_PERMISSAO_EDITAR' using errcode='42501';
  end if;
  if p_tipo not in ('procedimento','anestesia') then
    raise exception 'COMERCIAL_TIPO_PORTE_INVALIDO';
  end if;
  if nullif(btrim(p_porte),'') is null then
    raise exception 'COMERCIAL_PORTE_OBRIGATORIO';
  end if;
  if p_valor is null or p_valor < 0 then
    raise exception 'COMERCIAL_VALOR_PORTE_INVALIDO';
  end if;
  if v_fim < v_inicio then
    raise exception 'COMERCIAL_VIGENCIA_INVALIDA';
  end if;

  if coalesce(p_ativo,true) and exists (
    select 1
      from public.contrato_cbhpm_portes r
     where r.vinculo_id=p_vinculo_id
       and r.tipo=p_tipo
       and upper(btrim(r.porte))=upper(btrim(p_porte))
       and r.ativo
       and r.id is distinct from p_id
       and daterange(coalesce(r.vigencia_inicio,'0001-01-01'::date),coalesce(r.vigencia_fim,'9999-12-31'::date),'[]')
           && daterange(v_inicio,v_fim,'[]')
  ) then
    raise exception 'COMERCIAL_PORTE_VIGENCIA_SOBREPOSTA';
  end if;

  if p_id is null then
    insert into public.contrato_cbhpm_portes(
      vinculo_id,tipo,porte,valor,vigencia_inicio,vigencia_fim,ativo,observacoes,created_by,updated_by
    ) values (
      p_vinculo_id,p_tipo,upper(btrim(p_porte)),p_valor,p_vigencia_inicio,p_vigencia_fim,
      coalesce(p_ativo,true),nullif(btrim(p_observacoes),''),auth.uid(),auth.uid()
    ) returning id into v_id;
  else
    update public.contrato_cbhpm_portes
       set tipo=p_tipo,
           porte=upper(btrim(p_porte)),
           valor=p_valor,
           vigencia_inicio=p_vigencia_inicio,
           vigencia_fim=p_vigencia_fim,
           ativo=coalesce(p_ativo,true),
           observacoes=nullif(btrim(p_observacoes),''),
           updated_at=now(),
           updated_by=auth.uid()
     where id=p_id and vinculo_id=p_vinculo_id
     returning id into v_id;
    if v_id is null then raise exception 'COMERCIAL_PORTE_NAO_LOCALIZADO'; end if;
  end if;

  return v_id;
end;
$$;
revoke all on function public.comercial_salvar_porte_cbhpm(uuid,uuid,text,text,numeric,date,date,text,boolean) from public, anon;
grant execute on function public.comercial_salvar_porte_cbhpm(uuid,uuid,text,text,numeric,date,date,text,boolean) to authenticated;

create or replace function public.resolver_valor_porte_cbhpm_internal(
  p_vinculo_id uuid,
  p_tipo text,
  p_porte text,
  p_data date
)
returns table(valor numeric, regra_id uuid, origem text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_data date := coalesce(p_data,current_date);
  v_legacy jsonb;
begin
  if nullif(btrim(p_porte),'') is null then return; end if;

  return query
  select r.valor,r.id,'versionado'::text
    from public.contrato_cbhpm_portes r
   where r.vinculo_id=p_vinculo_id
     and r.tipo=p_tipo
     and upper(btrim(r.porte))=upper(btrim(p_porte))
     and r.ativo
     and (r.vigencia_inicio is null or r.vigencia_inicio<=v_data)
     and (r.vigencia_fim is null or r.vigencia_fim>=v_data)
   order by r.vigencia_inicio desc nulls last,r.updated_at desc,r.id
   limit 1;
  if found then return; end if;

  select case when p_tipo='anestesia'
              then v.regras_adicionais->'valores_porte_anestesico'
              else v.regras_adicionais->'valores_porte' end
    into v_legacy
    from public.contrato_tabelas_comerciais v
   where v.id=p_vinculo_id;

  if coalesce(v_legacy->>upper(btrim(p_porte)),'') ~ '^-?[0-9]+([\\.,][0-9]+)?$' then
    return query select replace(v_legacy->>upper(btrim(p_porte)),',','.')::numeric,null::uuid,'legado_json'::text;
  elsif coalesce(v_legacy->>btrim(p_porte),'') ~ '^-?[0-9]+([\\.,][0-9]+)?$' then
    return query select replace(v_legacy->>btrim(p_porte),',','.')::numeric,null::uuid,'legado_json'::text;
  end if;
end;
$$;
revoke all on function public.resolver_valor_porte_cbhpm_internal(uuid,text,text,date) from public, anon, authenticated;

create or replace function public.obter_valor_item_cbhpm_contextual_internal(
  p_convenio_id uuid,
  p_plano_id uuid,
  p_unidade_id uuid,
  p_item_assistencial_id uuid,
  p_codigo text,
  p_data date,
  p_categoria text
)
returns table(valor numeric, metodologia text, fonte_id uuid, edicao_id uuid, item_id uuid, memoria jsonb)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_empresa uuid;
  v_data date := coalesce(p_data,current_date);
  v_contrato public.credenciamento_contratos%rowtype;
  v_vinculo public.contrato_tabelas_comerciais%rowtype;
  v_edicao public.tabelas_comerciais_edicoes%rowtype;
  v_fonte public.tabelas_comerciais_fontes%rowtype;
  v_item public.tabelas_comerciais_itens%rowtype;
  v_porte record;
  v_codigo_tuss_map text;
  v_codigo_fonte_map text;
  v_codigo_tuss_resolvido text;
  v_ordem integer := 0;
  v_tipo_porte text;
  v_porte_codigo text;
  v_valor_porte numeric := 0;
  v_parcela_uco numeric := 0;
  v_base numeric := 0;
  v_final numeric := 0;
begin
  select c.empresa_id into v_empresa
    from public.convenios c
   where c.id=p_convenio_id and c.ativo;
  if v_empresa is null or not public.tem_empresa(v_empresa) then return; end if;

  select c.* into v_contrato
    from public.credenciamento_contratos c
   where c.convenio_id=p_convenio_id
     and c.status='ativo'
     and (c.plano_id is null or c.plano_id=p_plano_id)
     and (c.unidade_id is null or c.unidade_id=p_unidade_id)
     and (c.data_inicio is null or c.data_inicio<=v_data)
     and (c.data_fim is null or c.data_fim>=v_data)
   order by ((c.plano_id is not null)::int*2+(c.unidade_id is not null)::int) desc,
            c.data_inicio desc nulls last,c.created_at desc,c.id
   limit 1;
  if not found then return; end if;

  for v_vinculo in
    select t.*
      from public.contrato_tabelas_comerciais t
     where t.contrato_id=v_contrato.id
       and t.ativo
       and t.categoria in (p_categoria,'geral')
     order by case when t.categoria=p_categoria then 0 else 1 end,t.prioridade,t.id
  loop
    v_ordem:=v_ordem+1;
    select f.* into v_fonte
      from public.tabelas_comerciais_fontes f
     where f.id=v_vinculo.fonte_id and f.ativo and f.empresa_id=v_empresa;
    if not found or v_fonte.tipo<>'cbhpm' or v_vinculo.base_preco is not null then continue; end if;

    if v_vinculo.modo_edicao='edicao_fixa' then
      select e.* into v_edicao
        from public.tabelas_comerciais_edicoes e
       where e.id=v_vinculo.edicao_fixa_id
         and e.fonte_id=v_vinculo.fonte_id
         and e.status<>'cancelada'
         and (e.convenio_id is null or e.convenio_id=p_convenio_id);
    else
      select e.* into v_edicao
        from public.tabelas_comerciais_edicoes e
       where e.fonte_id=v_vinculo.fonte_id
         and e.status='vigente'
         and e.vigencia_inicio<=v_data
         and (e.vigencia_fim is null or e.vigencia_fim>=v_data)
         and (e.convenio_id is null or e.convenio_id=p_convenio_id)
       order by case when e.convenio_id=p_convenio_id then 0 else 1 end,e.vigencia_inicio desc,e.id
       limit 1;
    end if;
    if not found or v_edicao.metodo_calculo<>'cbhpm' then continue; end if;

    v_codigo_tuss_map:=null;
    v_codigo_fonte_map:=null;
    if nullif(btrim(p_codigo),'') is not null then
      select r.codigo_destino into v_codigo_tuss_map
        from public.referencia_equivalencias r
       where r.status='ativa' and r.codigo_origem=p_codigo and upper(r.sistema_destino)='TUSS'
         and upper(r.sistema_origem) in (upper(v_fonte.codigo),upper(v_fonte.tipo))
       order by case when upper(r.sistema_origem)=upper(v_fonte.codigo) then 0 else 1 end,r.updated_at desc,r.id
       limit 1;
      select r.codigo_destino into v_codigo_fonte_map
        from public.referencia_equivalencias r
       where r.status='ativa' and r.codigo_origem=p_codigo and upper(r.sistema_origem)='TUSS'
         and upper(r.sistema_destino) in (upper(v_fonte.codigo),upper(v_fonte.tipo))
       order by case when upper(r.sistema_destino)=upper(v_fonte.codigo) then 0 else 1 end,r.updated_at desc,r.id
       limit 1;
    end if;

    select i.* into v_item
      from public.tabelas_comerciais_itens i
     where i.edicao_id=v_edicao.id and i.ativo
       and (
         (p_item_assistencial_id is not null and i.item_assistencial_id=p_item_assistencial_id)
         or (nullif(btrim(p_codigo),'') is not null and i.codigo=p_codigo)
         or (nullif(btrim(p_codigo),'') is not null and i.codigo_tuss=p_codigo)
         or (nullif(btrim(p_codigo),'') is not null and i.codigo_tabela_propria=p_codigo)
         or (v_codigo_tuss_map is not null and i.codigo_tuss=v_codigo_tuss_map)
         or (v_codigo_fonte_map is not null and (i.codigo=v_codigo_fonte_map or i.codigo_tabela_propria=v_codigo_fonte_map))
       )
     order by
       case when p_item_assistencial_id is not null and i.item_assistencial_id=p_item_assistencial_id then 0 else 1 end,
       case when nullif(btrim(p_codigo),'') is not null and i.codigo=p_codigo then 0 else 1 end,
       case when nullif(btrim(p_codigo),'') is not null and i.codigo_tuss=p_codigo then 0 else 1 end,
       i.id
     limit 1;
    if not found then continue; end if;

    v_codigo_tuss_resolvido:=coalesce(v_item.codigo_tuss,v_codigo_tuss_map,case when p_codigo ~ '^[0-9]{8}$' then p_codigo end);
    v_tipo_porte:=case when p_categoria='anestesia' then 'anestesia' else 'procedimento' end;
    v_porte_codigo:=case when v_tipo_porte='anestesia' then v_item.porte_anestesico else v_item.porte end;
    v_valor_porte:=0;
    v_parcela_uco:=0;

    select * into v_porte
      from public.resolver_valor_porte_cbhpm_internal(v_vinculo.id,v_tipo_porte,v_porte_codigo,v_data)
     limit 1;
    if v_porte.valor is not null then v_valor_porte:=v_porte.valor; end if;

    if v_tipo_porte='procedimento' and coalesce(v_item.quantidade_uco,0)<>0 then
      if v_vinculo.valor_uco_contratual is null then continue; end if;
      v_parcela_uco:=coalesce(v_item.quantidade_uco,0)*v_vinculo.valor_uco_contratual;
    end if;
    if v_tipo_porte='anestesia' and v_porte.valor is null then continue; end if;
    if v_tipo_porte='procedimento' and v_porte.valor is null and v_parcela_uco=0 then continue; end if;

    v_base:=coalesce(v_valor_porte,0)+coalesce(v_parcela_uco,0);
    v_final:=round(v_base*(1+coalesce(v_vinculo.percentual_ajuste,0)/100.0),v_vinculo.arredondamento_casas);

    return query select
      v_final,
      case when v_tipo_porte='anestesia' then 'cbhpm_porte_anestesico_versionado' else 'cbhpm_porte_uco_versionado' end,
      v_fonte.id,v_edicao.id,v_item.id,
      jsonb_build_object(
        'contrato_id',v_contrato.id,'plano_id',v_contrato.plano_id,'unidade_id',v_contrato.unidade_id,
        'vinculo_tabela_id',v_vinculo.id,'fonte',v_fonte.nome,'fonte_codigo',v_fonte.codigo,'fonte_tipo',v_fonte.tipo,
        'edicao',v_edicao.nome_edicao,'categoria_contrato',v_vinculo.categoria,'prioridade_tabela',v_vinculo.prioridade,
        'ordem_fallback',v_ordem,'codigo_pesquisado',p_codigo,'codigo_fonte',v_item.codigo,'codigo_tuss',v_codigo_tuss_resolvido,
        'depara_tuss',v_codigo_tuss_map,'tabela_tiss_codigo',v_item.tabela_tiss_codigo,'metodo_base','cbhpm_porte_versionado',
        'tipo_porte',v_tipo_porte,'porte',v_item.porte,'porte_anestesico',v_item.porte_anestesico,
        'porte_regra_id',v_porte.regra_id,'porte_origem',v_porte.origem,'valor_porte',v_valor_porte,
        'quantidade_uco',v_item.quantidade_uco,'valor_uco_contratual',v_vinculo.valor_uco_contratual,'parcela_uco',v_parcela_uco,
        'base_calculo',v_base,'percentual_ajuste_contrato',v_vinculo.percentual_ajuste,'valor_calculado',v_final
      );
    return;
  end loop;
end;
$$;
revoke all on function public.obter_valor_item_cbhpm_contextual_internal(uuid,uuid,uuid,uuid,text,date,text) from public, anon, authenticated;

do $$
begin
  if to_regprocedure('public.obter_valor_item_comercial_contextual_base_internal(uuid,uuid,uuid,uuid,text,date,text)') is null
     and to_regprocedure('public.obter_valor_item_comercial_contextual_internal(uuid,uuid,uuid,uuid,text,date,text)') is not null then
    alter function public.obter_valor_item_comercial_contextual_internal(uuid,uuid,uuid,uuid,text,date,text)
      rename to obter_valor_item_comercial_contextual_base_internal;
  end if;
end $$;

revoke all on function public.obter_valor_item_comercial_contextual_base_internal(uuid,uuid,uuid,uuid,text,date,text) from public, anon, authenticated;

create or replace function public.obter_valor_item_comercial_contextual_internal(
  p_convenio_id uuid,
  p_plano_id uuid,
  p_unidade_id uuid,
  p_item_assistencial_id uuid,
  p_codigo text,
  p_data date,
  p_categoria text
)
returns table(valor numeric, metodologia text, fonte_id uuid, edicao_id uuid, item_id uuid, memoria jsonb)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_base record;
  v_cbhpm record;
  v_ordem_base integer := 2147483647;
  v_ordem_cbhpm integer := 2147483647;
begin
  select * into v_base
    from public.obter_valor_item_comercial_contextual_base_internal(
      p_convenio_id,p_plano_id,p_unidade_id,p_item_assistencial_id,p_codigo,p_data,p_categoria
    ) limit 1;
  if v_base.memoria is not null and coalesce(v_base.memoria->>'ordem_fallback','') ~ '^[0-9]+$' then
    v_ordem_base:=(v_base.memoria->>'ordem_fallback')::integer;
  end if;

  select * into v_cbhpm
    from public.obter_valor_item_cbhpm_contextual_internal(
      p_convenio_id,p_plano_id,p_unidade_id,p_item_assistencial_id,p_codigo,p_data,p_categoria
    ) limit 1;
  if v_cbhpm.memoria is not null and coalesce(v_cbhpm.memoria->>'ordem_fallback','') ~ '^[0-9]+$' then
    v_ordem_cbhpm:=(v_cbhpm.memoria->>'ordem_fallback')::integer;
  end if;

  if v_cbhpm.valor is not null and (v_base.valor is null or v_ordem_cbhpm<=v_ordem_base) then
    return query select v_cbhpm.valor,v_cbhpm.metodologia,v_cbhpm.fonte_id,v_cbhpm.edicao_id,v_cbhpm.item_id,v_cbhpm.memoria;
  elsif v_base.valor is not null then
    return query select v_base.valor,v_base.metodologia,v_base.fonte_id,v_base.edicao_id,v_base.item_id,v_base.memoria;
  end if;
end;
$$;
revoke all on function public.obter_valor_item_comercial_contextual_internal(uuid,uuid,uuid,uuid,text,date,text) from public, anon, authenticated;

create or replace function public.audit_comercial_mutacao()
returns trigger
language plpgsql
security definer
set search_path = 'public','pg_catalog','extensions'
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
    select f.empresa_id into v_empresa from public.tabelas_comerciais_fontes f where f.id=(v_ref->>'fonte_id')::uuid;
  elsif tg_table_name='tabelas_comerciais_itens' then
    v_edicao:=(v_ref->>'edicao_id')::uuid;
    select f.empresa_id into v_empresa
      from public.tabelas_comerciais_edicoes e
      join public.tabelas_comerciais_fontes f on f.id=e.fonte_id
     where e.id=v_edicao;
  elsif tg_table_name in ('contrato_tabelas_comerciais','contrato_regras_procedimentos','contrato_regras_faturamento','contrato_pacotes') then
    v_contrato:=(v_ref->>'contrato_id')::uuid;
    select c.empresa_id,c.unidade_id into v_empresa,v_unidade from public.credenciamento_contratos c where c.id=v_contrato;
    if tg_table_name='contrato_tabelas_comerciais' then v_edicao:=nullif(v_ref->>'edicao_fixa_id','')::uuid; end if;
  elsif tg_table_name='contrato_pacote_itens' then
    select c.id,c.empresa_id,c.unidade_id into v_contrato,v_empresa,v_unidade
      from public.contrato_pacotes p
      join public.credenciamento_contratos c on c.id=p.contrato_id
     where p.id=(v_ref->>'pacote_id')::uuid;
  elsif tg_table_name='contrato_cbhpm_portes' then
    select c.id,c.empresa_id,c.unidade_id,v.edicao_fixa_id
      into v_contrato,v_empresa,v_unidade,v_edicao
      from public.contrato_tabelas_comerciais v
      join public.credenciamento_contratos c on c.id=v.contrato_id
     where v.id=(v_ref->>'vinculo_id')::uuid;
  else
    return coalesce(new,old);
  end if;

  if v_empresa is not null then
    insert into public.comercial_eventos(
      empresa_id,unidade_id,entidade_tipo,entidade_id,acao,antes,depois,usuario_id,
      contexto_contrato_id,contexto_edicao_id
    ) values(
      v_empresa,v_unidade,tg_table_name,v_entidade,lower(tg_op),v_old,v_new,auth.uid(),v_contrato,v_edicao
    );
  end if;
  return coalesce(new,old);
end;
$$;
revoke all on function public.audit_comercial_mutacao() from public, anon;

drop trigger if exists trg_audit_comercial on public.contrato_cbhpm_portes;
create trigger trg_audit_comercial
after insert or update or delete on public.contrato_cbhpm_portes
for each row execute function public.audit_comercial_mutacao();