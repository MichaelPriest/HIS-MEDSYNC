create or replace function public.obter_valor_item_comercial_contextual_base_internal(
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
  v_depara record;
  v_codigo_tuss_map text;
  v_codigo_fonte_map text;
  v_depara_forward_id uuid;
  v_depara_reverse_id uuid;
  v_depara_origem text;
  v_codigo_tuss_resolvido text;
  v_base numeric := 0;
  v_final numeric := 0;
  v_usou_pontos boolean := false;
  v_ordem integer := 0;
  v_filme_qtd numeric := 0;
  v_valor_filme numeric;
  v_ch_mult numeric := 1;
  v_ch_parcela numeric := 0;
  v_filme_parcela numeric := 0;
  v_base_preco_resolvida text;
  v_valor_porte numeric;
  v_valor_uco numeric;
  v_mapa_porte jsonb;
  v_metodo_base text;
begin
  select c.empresa_id into v_empresa
    from public.convenios c
   where c.id = p_convenio_id and c.ativo;
  if v_empresa is null or not public.tem_empresa(v_empresa) then return; end if;

  select c.* into v_contrato
    from public.credenciamento_contratos c
   where c.convenio_id = p_convenio_id
     and c.status = 'ativo'
     and (c.plano_id is null or c.plano_id = p_plano_id)
     and (c.unidade_id is null or c.unidade_id = p_unidade_id)
     and (c.data_inicio is null or c.data_inicio <= v_data)
     and (c.data_fim is null or c.data_fim >= v_data)
   order by ((c.plano_id is not null)::int * 2 + (c.unidade_id is not null)::int) desc,
            c.data_inicio desc nulls last, c.created_at desc, c.id
   limit 1;
  if not found then return; end if;

  for v_vinculo in
    select t.*
      from public.contrato_tabelas_comerciais t
     where t.contrato_id = v_contrato.id
       and t.ativo
       and t.categoria in (p_categoria,'geral')
     order by case when t.categoria=p_categoria then 0 else 1 end,
              t.prioridade, t.id
  loop
    v_ordem := v_ordem + 1;

    select f.* into v_fonte
      from public.tabelas_comerciais_fontes f
     where f.id=v_vinculo.fonte_id and f.ativo and f.empresa_id=v_empresa;
    if not found then continue; end if;

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
       order by case when e.convenio_id=p_convenio_id then 0 else 1 end,
                e.vigencia_inicio desc, e.id
       limit 1;
    end if;
    if not found then continue; end if;

    v_codigo_tuss_map:=null;
    v_codigo_fonte_map:=null;
    v_depara_forward_id:=null;
    v_depara_reverse_id:=null;
    v_depara_origem:=null;
    if nullif(trim(p_codigo),'') is not null then
      select * into v_depara
        from public.resolver_depara_tuss_contrato_internal(v_contrato.id,v_fonte.id,p_codigo,v_data)
       limit 1;
      if found then
        v_codigo_tuss_map:=v_depara.codigo_tuss;
        v_codigo_fonte_map:=v_depara.codigo_fonte;
        v_depara_forward_id:=v_depara.forward_id;
        v_depara_reverse_id:=v_depara.reverse_id;
        if v_depara.forward_id is not null or v_depara.reverse_id is not null then
          v_depara_origem:='contrato';
        end if;
      end if;

      if v_codigo_tuss_map is null then
        select r.codigo_destino into v_codigo_tuss_map
          from public.referencia_equivalencias r
         where r.status='ativa'
           and r.codigo_origem=p_codigo
           and upper(r.sistema_destino)='TUSS'
           and (
             upper(r.sistema_origem) in (upper(v_fonte.codigo),upper(v_fonte.tipo))
             or (v_fonte.tipo like 'amb%' and upper(r.sistema_origem)='AMB')
           )
         order by case
                    when upper(r.sistema_origem)=upper(v_fonte.codigo) then 0
                    when upper(r.sistema_origem)=upper(v_fonte.tipo) then 1
                    else 2
                  end, r.updated_at desc, r.id
         limit 1;
        if found then v_depara_origem:=coalesce(v_depara_origem,'referencia_equivalencias'); end if;
      end if;

      if v_codigo_fonte_map is null then
        select r.codigo_destino into v_codigo_fonte_map
          from public.referencia_equivalencias r
         where r.status='ativa'
           and r.codigo_origem=p_codigo
           and upper(r.sistema_origem)='TUSS'
           and (
             upper(r.sistema_destino) in (upper(v_fonte.codigo),upper(v_fonte.tipo))
             or (v_fonte.tipo like 'amb%' and upper(r.sistema_destino)='AMB')
           )
         order by case
                    when upper(r.sistema_destino)=upper(v_fonte.codigo) then 0
                    when upper(r.sistema_destino)=upper(v_fonte.tipo) then 1
                    else 2
                  end, r.updated_at desc, r.id
         limit 1;
        if found then v_depara_origem:=coalesce(v_depara_origem,'referencia_equivalencias'); end if;
      end if;
    end if;

    select i.* into v_item
      from public.tabelas_comerciais_itens i
     where i.edicao_id=v_edicao.id
       and i.ativo
       and (
         (p_item_assistencial_id is not null and i.item_assistencial_id=p_item_assistencial_id)
         or (nullif(trim(p_codigo),'') is not null and i.codigo=p_codigo)
         or (nullif(trim(p_codigo),'') is not null and i.codigo_tuss=p_codigo)
         or (nullif(trim(p_codigo),'') is not null and i.codigo_tabela_propria=p_codigo)
         or (v_codigo_tuss_map is not null and i.codigo_tuss=v_codigo_tuss_map)
         or (v_codigo_fonte_map is not null and (i.codigo=v_codigo_fonte_map or i.codigo_tabela_propria=v_codigo_fonte_map))
       )
     order by
       case when p_item_assistencial_id is not null and i.item_assistencial_id=p_item_assistencial_id then 0 else 1 end,
       case when nullif(trim(p_codigo),'') is not null and i.codigo=p_codigo then 0 else 1 end,
       case when nullif(trim(p_codigo),'') is not null and i.codigo_tuss=p_codigo then 0 else 1 end,
       case when v_codigo_tuss_map is not null and i.codigo_tuss=v_codigo_tuss_map then 0 else 1 end,
       i.id
     limit 1;
    if not found then continue; end if;

    v_codigo_tuss_resolvido:=coalesce(v_item.codigo_tuss,v_codigo_tuss_map,case when p_codigo ~ '^[0-9]{8}$' then p_codigo end);
    v_usou_pontos:=false;
    v_ch_mult:=1;
    v_ch_parcela:=0;
    v_filme_parcela:=0;
    v_base_preco_resolvida:=v_vinculo.base_preco;
    v_valor_porte:=null;
    v_valor_uco:=0;
    v_mapa_porte:=null;
    v_metodo_base:=null;

    if v_fonte.tipo in ('amb90','amb92','amb96','amb99') then
      v_filme_qtd:=coalesce(v_item.quantidade_filme,0);
      v_valor_filme:=v_vinculo.valor_filme_m2;
      if v_valor_filme is null
         and coalesce(v_vinculo.regras_adicionais->>'valor_filme_m2','') ~ '^[0-9]+([\\.,][0-9]+)?$' then
        v_valor_filme:=replace(v_vinculo.regras_adicionais->>'valor_filme_m2',',','.')::numeric;
      end if;
      if (v_vinculo.regras_adicionais->'doppler_tuss_codes') @> to_jsonb(array[v_codigo_tuss_resolvido]::text[]) then
        if coalesce(v_vinculo.regras_adicionais->>'doppler_ch_multiplicador','') ~ '^[0-9]+([\\.,][0-9]+)?$' then
          v_ch_mult:=replace(v_vinculo.regras_adicionais->>'doppler_ch_multiplicador',',','.')::numeric;
        end if;
      end if;
      if coalesce(v_item.pontos_ch,0)<>0 and v_vinculo.valor_sadt is null then continue; end if;
      if v_filme_qtd<>0 and v_valor_filme is null then continue; end if;
      v_ch_parcela:=coalesce(v_item.pontos_ch,0)*coalesce(v_vinculo.valor_sadt,0)*v_ch_mult;
      v_filme_parcela:=v_filme_qtd*coalesce(v_valor_filme,0);
      v_base:=v_ch_parcela+v_filme_parcela;
      v_usou_pontos:=true;
      v_metodo_base:='amb_ch_sadt_filme';
    elsif v_edicao.metodo_calculo='ch_hm_sadt' then
      if (coalesce(v_item.pontos_ch,0)<>0 and v_vinculo.valor_ch is null)
         or (coalesce(v_item.pontos_hm,0)<>0 and v_vinculo.valor_hm is null)
         or (coalesce(v_item.pontos_sadt,0)<>0 and v_vinculo.valor_sadt is null) then continue; end if;
      v_base:=coalesce(v_item.pontos_ch,0)*coalesce(v_vinculo.valor_ch,0)
            + coalesce(v_item.pontos_hm,0)*coalesce(v_vinculo.valor_hm,0)
            + coalesce(v_item.pontos_sadt,0)*coalesce(v_vinculo.valor_sadt,0);
      v_usou_pontos:=true;
      v_metodo_base:='ch_hm_sadt';
    elsif v_edicao.metodo_calculo='cbhpm' and v_vinculo.base_preco is null then
      if p_categoria='anestesia' then
        v_mapa_porte:=v_vinculo.regras_adicionais->'valores_porte_anestesico';
        if nullif(v_item.porte_anestesico,'') is not null then
          if v_mapa_porte is null or coalesce(v_mapa_porte->>v_item.porte_anestesico,'') !~ '^-?[0-9]+([\\.,][0-9]+)?$' then continue; end if;
          v_valor_porte:=replace(v_mapa_porte->>v_item.porte_anestesico,',','.')::numeric;
        end if;
        if v_valor_porte is null then continue; end if;
        v_base:=v_valor_porte;
        v_metodo_base:='cbhpm_porte_anestesico';
      else
        v_mapa_porte:=v_vinculo.regras_adicionais->'valores_porte';
        if nullif(v_item.porte,'') is not null then
          if v_mapa_porte is null or coalesce(v_mapa_porte->>v_item.porte,'') !~ '^-?[0-9]+([\\.,][0-9]+)?$' then continue; end if;
          v_valor_porte:=replace(v_mapa_porte->>v_item.porte,',','.')::numeric;
        end if;
        if coalesce(v_item.quantidade_uco,0)<>0 then
          if v_vinculo.valor_uco_contratual is null then continue; end if;
          v_valor_uco:=coalesce(v_item.quantidade_uco,0)*v_vinculo.valor_uco_contratual;
        end if;
        if v_valor_porte is null and v_valor_uco=0 then continue; end if;
        v_base:=coalesce(v_valor_porte,0)+v_valor_uco;
        v_metodo_base:='cbhpm_porte_uco';
      end if;
    else
      if v_vinculo.base_preco='valor_fabrica' then
        if v_item.valor_fabrica is null then continue; end if; v_base:=v_item.valor_fabrica; v_base_preco_resolvida:='valor_fabrica';
      elsif v_vinculo.base_preco='valor_pmc' then
        if v_item.valor_pmc is null then continue; end if; v_base:=v_item.valor_pmc; v_base_preco_resolvida:='valor_pmc';
      elsif v_vinculo.base_preco='valor_maximo' then
        if v_item.valor_maximo is null then continue; end if; v_base:=v_item.valor_maximo; v_base_preco_resolvida:='valor_maximo';
      elsif v_vinculo.base_preco='valor_referencia' then
        if v_item.valor_referencia is null then continue; end if; v_base:=v_item.valor_referencia; v_base_preco_resolvida:='valor_referencia';
      elsif v_fonte.tipo in ('brasindice','cmed','simpro') then continue;
      else
        if v_item.valor_referencia is null then continue; end if; v_base:=v_item.valor_referencia; v_base_preco_resolvida:='valor_referencia';
      end if;
      v_metodo_base:='base_monetaria_explicita';
    end if;

    v_final:=round(v_base*(1+coalesce(v_vinculo.percentual_ajuste,0)/100.0),v_vinculo.arredondamento_casas);

    return query select v_final, v_fonte.tipo, v_fonte.id, v_edicao.id, v_item.id,
      jsonb_build_object(
        'contrato_id',v_contrato.id,'plano_id',v_contrato.plano_id,'unidade_id',v_contrato.unidade_id,
        'vinculo_tabela_id',v_vinculo.id,'fonte',v_fonte.nome,'fonte_codigo',v_fonte.codigo,'fonte_tipo',v_fonte.tipo,
        'edicao',v_edicao.nome_edicao,'categoria_contrato',v_vinculo.categoria,'prioridade_tabela',v_vinculo.prioridade,
        'ordem_fallback',v_ordem,'codigo_pesquisado',p_codigo,'codigo_fonte',v_item.codigo,'codigo_tuss',v_codigo_tuss_resolvido,
        'depara_tuss',v_codigo_tuss_map,'depara_codigo_fonte',v_codigo_fonte_map,
        'depara_tuss_id',coalesce(v_depara_forward_id,v_depara_reverse_id),'depara_origem',v_depara_origem,
        'tabela_tiss_codigo',coalesce(v_depara.tabela_tiss_codigo,v_item.tabela_tiss_codigo),
        'metodo_base',v_metodo_base,'base_preco',v_base_preco_resolvida,'pontos_ch',v_item.pontos_ch,
        'pontos_hm',v_item.pontos_hm,'pontos_sadt',v_item.pontos_sadt,'porte',v_item.porte,'porte_anestesico',v_item.porte_anestesico,
        'quantidade_uco',v_item.quantidade_uco,'valor_porte',v_valor_porte,'valor_uco_contratual',v_vinculo.valor_uco_contratual,
        'parcela_uco',v_valor_uco,'quantidade_filme',v_filme_qtd,'valor_sadt_contratual',v_vinculo.valor_sadt,
        'valor_filme_m2',v_valor_filme,'doppler_ch_multiplicador',v_ch_mult,'parcela_ch',v_ch_parcela,'parcela_filme',v_filme_parcela,
        'calculo_por_pontos',v_usou_pontos,'base_calculo',v_base,'percentual_ajuste_contrato',v_vinculo.percentual_ajuste,'valor_calculado',v_final
      );
    return;
  end loop;
end;
$$;

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
  v_depara record;
  v_codigo_tuss_map text;
  v_codigo_fonte_map text;
  v_depara_forward_id uuid;
  v_depara_reverse_id uuid;
  v_depara_origem text;
  v_codigo_tuss_resolvido text;
  v_ordem integer := 0;
  v_tipo_porte text;
  v_porte_codigo text;
  v_valor_porte numeric := 0;
  v_parcela_uco numeric := 0;
  v_base numeric := 0;
  v_final numeric := 0;
begin
  select c.empresa_id into v_empresa from public.convenios c where c.id=p_convenio_id and c.ativo;
  if v_empresa is null or not public.tem_empresa(v_empresa) then return; end if;

  select c.* into v_contrato from public.credenciamento_contratos c
   where c.convenio_id=p_convenio_id and c.status='ativo'
     and (c.plano_id is null or c.plano_id=p_plano_id)
     and (c.unidade_id is null or c.unidade_id=p_unidade_id)
     and (c.data_inicio is null or c.data_inicio<=v_data)
     and (c.data_fim is null or c.data_fim>=v_data)
   order by ((c.plano_id is not null)::int*2+(c.unidade_id is not null)::int) desc,
            c.data_inicio desc nulls last,c.created_at desc,c.id limit 1;
  if not found then return; end if;

  for v_vinculo in select t.* from public.contrato_tabelas_comerciais t
     where t.contrato_id=v_contrato.id and t.ativo and t.categoria in (p_categoria,'geral')
     order by case when t.categoria=p_categoria then 0 else 1 end,t.prioridade,t.id
  loop
    v_ordem:=v_ordem+1;
    select f.* into v_fonte from public.tabelas_comerciais_fontes f
     where f.id=v_vinculo.fonte_id and f.ativo and f.empresa_id=v_empresa;
    if not found or v_fonte.tipo<>'cbhpm' or v_vinculo.base_preco is not null then continue; end if;

    if v_vinculo.modo_edicao='edicao_fixa' then
      select e.* into v_edicao from public.tabelas_comerciais_edicoes e
       where e.id=v_vinculo.edicao_fixa_id and e.fonte_id=v_vinculo.fonte_id and e.status<>'cancelada'
         and (e.convenio_id is null or e.convenio_id=p_convenio_id);
    else
      select e.* into v_edicao from public.tabelas_comerciais_edicoes e
       where e.fonte_id=v_vinculo.fonte_id and e.status='vigente' and e.vigencia_inicio<=v_data
         and (e.vigencia_fim is null or e.vigencia_fim>=v_data) and (e.convenio_id is null or e.convenio_id=p_convenio_id)
       order by case when e.convenio_id=p_convenio_id then 0 else 1 end,e.vigencia_inicio desc,e.id limit 1;
    end if;
    if not found or v_edicao.metodo_calculo<>'cbhpm' then continue; end if;

    v_codigo_tuss_map:=null; v_codigo_fonte_map:=null; v_depara_forward_id:=null; v_depara_reverse_id:=null; v_depara_origem:=null;
    if nullif(btrim(p_codigo),'') is not null then
      select * into v_depara from public.resolver_depara_tuss_contrato_internal(v_contrato.id,v_fonte.id,p_codigo,v_data) limit 1;
      if found then
        v_codigo_tuss_map:=v_depara.codigo_tuss; v_codigo_fonte_map:=v_depara.codigo_fonte;
        v_depara_forward_id:=v_depara.forward_id; v_depara_reverse_id:=v_depara.reverse_id;
        if v_depara.forward_id is not null or v_depara.reverse_id is not null then v_depara_origem:='contrato'; end if;
      end if;
      if v_codigo_tuss_map is null then
        select r.codigo_destino into v_codigo_tuss_map from public.referencia_equivalencias r
         where r.status='ativa' and r.codigo_origem=p_codigo and upper(r.sistema_destino)='TUSS'
           and upper(r.sistema_origem) in (upper(v_fonte.codigo),upper(v_fonte.tipo))
         order by case when upper(r.sistema_origem)=upper(v_fonte.codigo) then 0 else 1 end,r.updated_at desc,r.id limit 1;
        if found then v_depara_origem:=coalesce(v_depara_origem,'referencia_equivalencias'); end if;
      end if;
      if v_codigo_fonte_map is null then
        select r.codigo_destino into v_codigo_fonte_map from public.referencia_equivalencias r
         where r.status='ativa' and r.codigo_origem=p_codigo and upper(r.sistema_origem)='TUSS'
           and upper(r.sistema_destino) in (upper(v_fonte.codigo),upper(v_fonte.tipo))
         order by case when upper(r.sistema_destino)=upper(v_fonte.codigo) then 0 else 1 end,r.updated_at desc,r.id limit 1;
        if found then v_depara_origem:=coalesce(v_depara_origem,'referencia_equivalencias'); end if;
      end if;
    end if;

    select i.* into v_item from public.tabelas_comerciais_itens i
     where i.edicao_id=v_edicao.id and i.ativo and (
       (p_item_assistencial_id is not null and i.item_assistencial_id=p_item_assistencial_id)
       or (nullif(btrim(p_codigo),'') is not null and i.codigo=p_codigo)
       or (nullif(btrim(p_codigo),'') is not null and i.codigo_tuss=p_codigo)
       or (nullif(btrim(p_codigo),'') is not null and i.codigo_tabela_propria=p_codigo)
       or (v_codigo_tuss_map is not null and i.codigo_tuss=v_codigo_tuss_map)
       or (v_codigo_fonte_map is not null and (i.codigo=v_codigo_fonte_map or i.codigo_tabela_propria=v_codigo_fonte_map))
     ) order by
       case when p_item_assistencial_id is not null and i.item_assistencial_id=p_item_assistencial_id then 0 else 1 end,
       case when nullif(btrim(p_codigo),'') is not null and i.codigo=p_codigo then 0 else 1 end,
       case when nullif(btrim(p_codigo),'') is not null and i.codigo_tuss=p_codigo then 0 else 1 end,
       i.id limit 1;
    if not found then continue; end if;

    v_codigo_tuss_resolvido:=coalesce(v_item.codigo_tuss,v_codigo_tuss_map,case when p_codigo ~ '^[0-9]{8}$' then p_codigo end);
    v_tipo_porte:=case when p_categoria='anestesia' then 'anestesia' else 'procedimento' end;
    v_porte_codigo:=case when v_tipo_porte='anestesia' then v_item.porte_anestesico else v_item.porte end;
    v_valor_porte:=0; v_parcela_uco:=0;

    select * into v_porte from public.resolver_valor_porte_cbhpm_internal(v_vinculo.id,v_tipo_porte,v_porte_codigo,v_data) limit 1;
    if v_porte.valor is not null then v_valor_porte:=v_porte.valor; end if;
    if v_tipo_porte='procedimento' and coalesce(v_item.quantidade_uco,0)<>0 then
      if v_vinculo.valor_uco_contratual is null then continue; end if;
      v_parcela_uco:=coalesce(v_item.quantidade_uco,0)*v_vinculo.valor_uco_contratual;
    end if;
    if v_tipo_porte='anestesia' and v_porte.valor is null then continue; end if;
    if v_tipo_porte='procedimento' and v_porte.valor is null and v_parcela_uco=0 then continue; end if;

    v_base:=coalesce(v_valor_porte,0)+coalesce(v_parcela_uco,0);
    v_final:=round(v_base*(1+coalesce(v_vinculo.percentual_ajuste,0)/100.0),v_vinculo.arredondamento_casas);
    return query select v_final,
      case when v_tipo_porte='anestesia' then 'cbhpm_porte_anestesico_versionado' else 'cbhpm_porte_uco_versionado' end,
      v_fonte.id,v_edicao.id,v_item.id,
      jsonb_build_object(
        'contrato_id',v_contrato.id,'plano_id',v_contrato.plano_id,'unidade_id',v_contrato.unidade_id,
        'vinculo_tabela_id',v_vinculo.id,'fonte',v_fonte.nome,'fonte_codigo',v_fonte.codigo,'fonte_tipo',v_fonte.tipo,
        'edicao',v_edicao.nome_edicao,'categoria_contrato',v_vinculo.categoria,'prioridade_tabela',v_vinculo.prioridade,
        'ordem_fallback',v_ordem,'codigo_pesquisado',p_codigo,'codigo_fonte',v_item.codigo,'codigo_tuss',v_codigo_tuss_resolvido,
        'depara_tuss',v_codigo_tuss_map,'depara_codigo_fonte',v_codigo_fonte_map,
        'depara_tuss_id',coalesce(v_depara_forward_id,v_depara_reverse_id),'depara_origem',v_depara_origem,
        'tabela_tiss_codigo',coalesce(v_depara.tabela_tiss_codigo,v_item.tabela_tiss_codigo),'metodo_base','cbhpm_porte_versionado',
        'tipo_porte',v_tipo_porte,'porte',v_item.porte,'porte_anestesico',v_item.porte_anestesico,
        'porte_regra_id',v_porte.regra_id,'porte_origem',v_porte.origem,'valor_porte',v_valor_porte,
        'quantidade_uco',v_item.quantidade_uco,'valor_uco_contratual',v_vinculo.valor_uco_contratual,'parcela_uco',v_parcela_uco,
        'base_calculo',v_base,'percentual_ajuste_contrato',v_vinculo.percentual_ajuste,'valor_calculado',v_final
      );
    return;
  end loop;
end;
$$;

revoke all on function public.obter_valor_item_comercial_contextual_base_internal(uuid,uuid,uuid,uuid,text,date,text) from public, anon, authenticated;
grant execute on function public.obter_valor_item_comercial_contextual_base_internal(uuid,uuid,uuid,uuid,text,date,text) to postgres;
revoke all on function public.obter_valor_item_cbhpm_contextual_internal(uuid,uuid,uuid,uuid,text,date,text) from public, anon, authenticated;
grant execute on function public.obter_valor_item_cbhpm_contextual_internal(uuid,uuid,uuid,uuid,text,date,text) to postgres;
