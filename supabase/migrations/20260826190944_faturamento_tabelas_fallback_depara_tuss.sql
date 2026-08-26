create index if not exists idx_referencia_equivalencias_lookup
on public.referencia_equivalencias (status, upper(sistema_origem), codigo_origem, upper(sistema_destino));

create or replace function public.obter_valor_item_comercial(
  p_convenio_id uuid,
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
  v_contrato_id uuid;
  v_vinculo public.contrato_tabelas_comerciais%rowtype;
  v_edicao public.tabelas_comerciais_edicoes%rowtype;
  v_fonte public.tabelas_comerciais_fontes%rowtype;
  v_item public.tabelas_comerciais_itens%rowtype;
  v_codigo_tuss_map text;
  v_codigo_fonte_map text;
  v_base numeric := 0;
  v_final numeric := 0;
  v_usou_pontos boolean := false;
  v_ordem integer := 0;
begin
  select c.empresa_id into v_empresa from public.convenios c where c.id = p_convenio_id and c.ativo;
  if v_empresa is null or not public.tem_empresa(v_empresa) then return; end if;

  select c.id into v_contrato_id
  from public.credenciamento_contratos c
  where c.convenio_id = p_convenio_id
    and c.status = 'ativo'
    and (c.data_inicio is null or c.data_inicio <= p_data)
    and (c.data_fim is null or c.data_fim >= p_data)
  order by c.data_inicio desc nulls last, c.created_at desc
  limit 1;
  if v_contrato_id is null then return; end if;

  for v_vinculo in
    select t.*
    from public.contrato_tabelas_comerciais t
    where t.contrato_id = v_contrato_id
      and t.ativo
      and t.categoria in (p_categoria, 'geral')
    order by case when t.categoria = p_categoria then 0 else 1 end, t.prioridade, t.id
  loop
    v_ordem := v_ordem + 1;

    select f.* into v_fonte
    from public.tabelas_comerciais_fontes f
    where f.id = v_vinculo.fonte_id and f.ativo and f.empresa_id = v_empresa;
    if not found then continue; end if;

    if v_vinculo.modo_edicao = 'edicao_fixa' then
      select e.* into v_edicao
      from public.tabelas_comerciais_edicoes e
      where e.id = v_vinculo.edicao_fixa_id
        and e.fonte_id = v_vinculo.fonte_id
        and e.status <> 'cancelada'
        and (e.convenio_id is null or e.convenio_id = p_convenio_id);
    else
      select e.* into v_edicao
      from public.tabelas_comerciais_edicoes e
      where e.fonte_id = v_vinculo.fonte_id
        and e.status = 'vigente'
        and e.vigencia_inicio <= p_data
        and (e.vigencia_fim is null or e.vigencia_fim >= p_data)
        and (e.convenio_id is null or e.convenio_id = p_convenio_id)
      order by case when e.convenio_id = p_convenio_id then 0 else 1 end, e.vigencia_inicio desc
      limit 1;
    end if;
    if not found then continue; end if;

    v_codigo_tuss_map := null;
    v_codigo_fonte_map := null;

    if nullif(trim(p_codigo), '') is not null then
      select r.codigo_destino into v_codigo_tuss_map
      from public.referencia_equivalencias r
      where r.status = 'ativa'
        and r.codigo_origem = p_codigo
        and upper(r.sistema_destino) = 'TUSS'
        and upper(r.sistema_origem) in (upper(v_fonte.codigo), upper(v_fonte.tipo))
      order by case when upper(r.sistema_origem) = upper(v_fonte.codigo) then 0 else 1 end, r.updated_at desc
      limit 1;

      select r.codigo_destino into v_codigo_fonte_map
      from public.referencia_equivalencias r
      where r.status = 'ativa'
        and r.codigo_origem = p_codigo
        and upper(r.sistema_origem) = 'TUSS'
        and upper(r.sistema_destino) in (upper(v_fonte.codigo), upper(v_fonte.tipo))
      order by case when upper(r.sistema_destino) = upper(v_fonte.codigo) then 0 else 1 end, r.updated_at desc
      limit 1;
    end if;

    select i.* into v_item
    from public.tabelas_comerciais_itens i
    where i.edicao_id = v_edicao.id
      and i.ativo
      and (
        (p_item_assistencial_id is not null and i.item_assistencial_id = p_item_assistencial_id)
        or (nullif(trim(p_codigo), '') is not null and i.codigo = p_codigo)
        or (nullif(trim(p_codigo), '') is not null and i.codigo_tuss = p_codigo)
        or (nullif(trim(p_codigo), '') is not null and i.codigo_tabela_propria = p_codigo)
        or (v_codigo_tuss_map is not null and i.codigo_tuss = v_codigo_tuss_map)
        or (v_codigo_fonte_map is not null and (i.codigo = v_codigo_fonte_map or i.codigo_tabela_propria = v_codigo_fonte_map))
      )
    order by
      case when p_item_assistencial_id is not null and i.item_assistencial_id = p_item_assistencial_id then 0 else 1 end,
      case when nullif(trim(p_codigo), '') is not null and i.codigo = p_codigo then 0 else 1 end,
      case when nullif(trim(p_codigo), '') is not null and i.codigo_tuss = p_codigo then 0 else 1 end,
      case when v_codigo_tuss_map is not null and i.codigo_tuss = v_codigo_tuss_map then 0 else 1 end,
      i.id
    limit 1;
    if not found then continue; end if;

    v_usou_pontos := false;
    if v_edicao.metodo_calculo = 'ch_hm_sadt'
       and (v_vinculo.valor_ch is not null or v_vinculo.valor_hm is not null or v_vinculo.valor_sadt is not null)
       and (coalesce(v_item.pontos_ch,0) = 0 or v_vinculo.valor_ch is not null)
       and (coalesce(v_item.pontos_hm,0) = 0 or v_vinculo.valor_hm is not null)
       and (coalesce(v_item.pontos_sadt,0) = 0 or v_vinculo.valor_sadt is not null) then
      v_base := coalesce(v_item.pontos_ch,0) * coalesce(v_vinculo.valor_ch,0)
              + coalesce(v_item.pontos_hm,0) * coalesce(v_vinculo.valor_hm,0)
              + coalesce(v_item.pontos_sadt,0) * coalesce(v_vinculo.valor_sadt,0);
      v_usou_pontos := true;
    else
      v_base := coalesce(v_item.valor_referencia, 0);
    end if;

    v_final := round(v_base * (1 + coalesce(v_vinculo.percentual_ajuste, 0) / 100.0), v_vinculo.arredondamento_casas);

    return query select
      v_final,
      v_fonte.tipo,
      v_fonte.id,
      v_edicao.id,
      v_item.id,
      jsonb_build_object(
        'fonte', v_fonte.nome,
        'fonte_codigo', v_fonte.codigo,
        'fonte_tipo', v_fonte.tipo,
        'edicao', v_edicao.nome_edicao,
        'referencia', v_edicao.referencia,
        'categoria_contrato', v_vinculo.categoria,
        'prioridade_tabela', v_vinculo.prioridade,
        'ordem_fallback', v_ordem,
        'codigo_pesquisado', p_codigo,
        'codigo_fonte', v_item.codigo,
        'codigo_tuss', coalesce(v_item.codigo_tuss, v_codigo_tuss_map),
        'codigo_proprio', v_item.codigo_tabela_propria,
        'depara_tuss', v_codigo_tuss_map,
        'usou_depara_tuss', (v_codigo_tuss_map is not null and coalesce(v_item.codigo_tuss,'') = v_codigo_tuss_map),
        'tabela_tiss_codigo', v_item.tabela_tiss_codigo,
        'valor_referencia', coalesce(v_item.valor_referencia,0),
        'pontos_ch', v_item.pontos_ch,
        'pontos_hm', v_item.pontos_hm,
        'pontos_sadt', v_item.pontos_sadt,
        'valor_ch_contratual', v_vinculo.valor_ch,
        'valor_hm_contratual', v_vinculo.valor_hm,
        'valor_sadt_contratual', v_vinculo.valor_sadt,
        'calculo_por_pontos', v_usou_pontos,
        'base_calculo', v_base,
        'percentual_ajuste_contrato', v_vinculo.percentual_ajuste,
        'valor_calculado', v_final,
        'valor_fabrica', v_item.valor_fabrica,
        'valor_pmc', v_item.valor_pmc,
        'valor_maximo', v_item.valor_maximo,
        'icms_percentual', v_item.icms_percentual,
        'lista_cmed', v_item.tipo_lista_cmed
      );
    return;
  end loop;
end;
$$;

revoke all on function public.obter_valor_item_comercial(uuid,uuid,text,date,text) from public, anon;
grant execute on function public.obter_valor_item_comercial(uuid,uuid,text,date,text) to authenticated;

create or replace function public.buscar_itens_contrato_comercial(
  p_convenio_id uuid,
  p_termo text default null,
  p_categoria text default null,
  p_data date default current_date,
  p_limite integer default 60
)
returns table(
  tabela_item_id uuid,
  item_assistencial_id uuid,
  codigo_fonte text,
  descricao text,
  categoria_item text,
  tabela_tiss_codigo text,
  familia_tuss integer,
  codigo_tuss text,
  codigo_tabela_propria text,
  fonte_codigo text,
  fonte_nome text,
  edicao_id uuid,
  edicao_nome text,
  prioridade integer,
  depara_tuss text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_empresa uuid;
  v_contrato_id uuid;
  v_vinculo public.contrato_tabelas_comerciais%rowtype;
  v_edicao public.tabelas_comerciais_edicoes%rowtype;
  v_fonte public.tabelas_comerciais_fontes%rowtype;
  v_termo text := nullif(trim(coalesce(p_termo,'')), '');
  v_restante integer := greatest(1, least(coalesce(p_limite,60), 100));
  v_count integer;
begin
  select c.empresa_id into v_empresa from public.convenios c where c.id=p_convenio_id and c.ativo;
  if v_empresa is null or not public.tem_empresa(v_empresa) then return; end if;

  select c.id into v_contrato_id
  from public.credenciamento_contratos c
  where c.convenio_id=p_convenio_id and c.status='ativo'
    and (c.data_inicio is null or c.data_inicio<=p_data)
    and (c.data_fim is null or c.data_fim>=p_data)
  order by c.data_inicio desc nulls last,c.created_at desc limit 1;
  if v_contrato_id is null then return; end if;

  for v_vinculo in
    select distinct on (t.fonte_id,coalesce(t.edicao_fixa_id,'00000000-0000-0000-0000-000000000000'::uuid)) t.*
    from public.contrato_tabelas_comerciais t
    where t.contrato_id=v_contrato_id and t.ativo
    order by t.fonte_id,coalesce(t.edicao_fixa_id,'00000000-0000-0000-0000-000000000000'::uuid),t.prioridade,t.id
  loop
    select f.* into v_fonte from public.tabelas_comerciais_fontes f where f.id=v_vinculo.fonte_id and f.ativo and f.empresa_id=v_empresa;
    if not found then continue; end if;

    if v_vinculo.modo_edicao='edicao_fixa' then
      select e.* into v_edicao from public.tabelas_comerciais_edicoes e
      where e.id=v_vinculo.edicao_fixa_id and e.fonte_id=v_vinculo.fonte_id and e.status<>'cancelada'
        and (e.convenio_id is null or e.convenio_id=p_convenio_id);
    else
      select e.* into v_edicao from public.tabelas_comerciais_edicoes e
      where e.fonte_id=v_vinculo.fonte_id and e.status='vigente' and e.vigencia_inicio<=p_data
        and (e.vigencia_fim is null or e.vigencia_fim>=p_data)
        and (e.convenio_id is null or e.convenio_id=p_convenio_id)
      order by case when e.convenio_id=p_convenio_id then 0 else 1 end,e.vigencia_inicio desc limit 1;
    end if;
    if not found then continue; end if;

    return query
    select
      i.id,
      i.item_assistencial_id,
      i.codigo,
      i.descricao,
      i.categoria_item,
      case
        when i.categoria_item='pacote' then '98'
        when coalesce(i.codigo_tuss,dp.codigo_destino) is not null then
          case
            when i.categoria_item in ('diaria','taxa','gas_medicinal') then '18'
            when i.categoria_item in ('material','opme') then '19'
            when i.categoria_item='medicamento' then '20'
            when i.categoria_item='procedimento' then '22'
            else coalesce(i.tabela_tiss_codigo,'00')
          end
        else coalesce(i.tabela_tiss_codigo,'00')
      end,
      case
        when i.familia_tuss is not null then i.familia_tuss
        when coalesce(i.codigo_tuss,dp.codigo_destino) is null then null
        when i.categoria_item in ('diaria','taxa','gas_medicinal') then 18
        when i.categoria_item in ('material','opme') then 19
        when i.categoria_item='medicamento' then 20
        when i.categoria_item='procedimento' then 22
        else null
      end,
      coalesce(i.codigo_tuss,dp.codigo_destino),
      i.codigo_tabela_propria,
      v_fonte.codigo,
      v_fonte.nome,
      v_edicao.id,
      v_edicao.nome_edicao,
      v_vinculo.prioridade,
      dp.codigo_destino
    from public.tabelas_comerciais_itens i
    left join lateral (
      select r.codigo_destino
      from public.referencia_equivalencias r
      where r.status='ativa' and r.codigo_origem=i.codigo and upper(r.sistema_destino)='TUSS'
        and upper(r.sistema_origem) in (upper(v_fonte.codigo),upper(v_fonte.tipo))
      order by case when upper(r.sistema_origem)=upper(v_fonte.codigo) then 0 else 1 end,r.updated_at desc
      limit 1
    ) dp on true
    where i.edicao_id=v_edicao.id and i.ativo
      and (p_categoria is null or p_categoria='' or i.categoria_item=p_categoria)
      and (
        v_termo is null
        or i.codigo ilike '%'||v_termo||'%'
        or coalesce(i.codigo_tuss,'') ilike '%'||v_termo||'%'
        or coalesce(i.codigo_tabela_propria,'') ilike '%'||v_termo||'%'
        or i.descricao ilike '%'||v_termo||'%'
        or coalesce(dp.codigo_destino,'') ilike '%'||v_termo||'%'
      )
    order by
      case when v_termo is not null and i.codigo=v_termo then 0 else 1 end,
      case when v_termo is not null and coalesce(i.codigo_tuss,dp.codigo_destino)=v_termo then 0 else 1 end,
      i.descricao
    limit v_restante;

    get diagnostics v_count = row_count;
    v_restante := v_restante - v_count;
    exit when v_restante <= 0;
  end loop;
end;
$$;

revoke all on function public.buscar_itens_contrato_comercial(uuid,text,text,date,integer) from public, anon;
grant execute on function public.buscar_itens_contrato_comercial(uuid,text,text,date,integer) to authenticated;
