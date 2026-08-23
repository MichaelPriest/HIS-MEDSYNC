begin;

create or replace function public.recalcular_item_contratual_avancado(p_item_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_item record;
  v_preco record;
  v_contrato_id uuid;
  v_regra record;
  v_base numeric := 0;
  v_final numeric := 0;
  v_percentual numeric := 100;
  v_valor_fixo numeric := 0;
  v_categoria text := 'procedimentos';
  v_memoria jsonb := '{}'::jsonb;
  v_grupo_codigo text := null;
  v_via_acesso text := null;
  v_acomodacao text := null;
  v_urgencia boolean := false;
begin
  select i.*, c.convenio_id
    into v_item
  from public.conta_faturamento_itens i
  join public.contas_faturamento c on c.id=i.conta_id
  where i.id=p_item_id;
  if v_item.id is null or v_item.convenio_id is null or v_item.codigo is null then return null; end if;

  if v_item.grupo_ato_id is not null then
    select g.codigo_grupo,g.via_acesso,g.acomodacao,g.urgencia
      into v_grupo_codigo,v_via_acesso,v_acomodacao,v_urgencia
    from public.conta_faturamento_grupos_ato g where g.id=v_item.grupo_ato_id;
  end if;

  v_categoria := case
    when v_item.origem_tipo in ('exame','laboratorio','imagem') then 'exames'
    when v_item.origem_tipo='honorario' then 'honorarios'
    when v_item.origem_tipo='diaria' then 'diarias'
    when v_item.origem_tipo='taxa' then 'taxas'
    else 'procedimentos' end;

  select * into v_preco from public.obter_valor_procedimento_contratual(
    v_item.convenio_id,v_item.codigo,coalesce(v_item.data_execucao::date,current_date),v_categoria,
    coalesce(v_urgencia,false),lower(coalesce(v_acomodacao,'')) in ('apartamento','individual','quarto')
  ) limit 1;
  if v_preco.valor is null then return null; end if;

  v_base:=v_preco.valor; v_final:=v_base;
  select c.id into v_contrato_id from public.credenciamento_contratos c
   where c.convenio_id=v_item.convenio_id and c.status='ativo'
    and (c.data_inicio is null or c.data_inicio<=coalesce(v_item.data_execucao::date,current_date))
    and (c.data_fim is null or c.data_fim>=coalesce(v_item.data_execucao::date,current_date))
   order by c.data_inicio desc nulls last,c.created_at desc limit 1;

  if v_contrato_id is not null and coalesce(v_item.sequencia_ato,1)>1 then
    select * into v_regra from public.contrato_regras_faturamento r
     where r.contrato_id=v_contrato_id and r.ativo=true
      and r.codigo_regra in ('MULTIPLO_'||v_item.sequencia_ato::text,'MULTIPLO_N')
      and (r.vigencia_inicio is null or r.vigencia_inicio<=coalesce(v_item.data_execucao::date,current_date))
      and (r.vigencia_fim is null or r.vigencia_fim>=coalesce(v_item.data_execucao::date,current_date))
     order by case when r.codigo_regra='MULTIPLO_'||v_item.sequencia_ato::text then 0 else 1 end,r.prioridade limit 1;
    if v_regra.id is not null then
      if v_regra.percentual is not null then v_percentual:=v_regra.percentual; v_final:=v_final*(v_percentual/100.0); end if;
      if v_regra.valor_fixo is not null then v_valor_fixo:=v_regra.valor_fixo; v_final:=v_final+v_valor_fixo; end if;
    end if;
  end if;

  v_memoria:=coalesce(v_preco.memoria,'{}'::jsonb)||jsonb_build_object(
    'valor_base',round(v_base,2),'sequencia_ato',coalesce(v_item.sequencia_ato,1),'grupo_ato',v_grupo_codigo,
    'via_acesso',v_via_acesso,'acomodacao',v_acomodacao,'urgencia',v_urgencia,
    'regra_multiplo',case when v_regra.id is null then null else v_regra.codigo_regra end,
    'percentual_sequencia',v_percentual,'adicional_fixo',v_valor_fixo,'valor_final',round(v_final,2));

  update public.conta_faturamento_itens set metodologia_preco=v_preco.metodologia,
    tabela_procedimento_edicao_id=v_preco.edicao_id,tabela_procedimento_item_id=v_preco.item_id,
    valor_referencia=v_base,valor_contratual_calculado=round(v_final,2),percentual_aplicado=v_percentual,
    regra_contratual_id=case when v_regra.id is null then null else v_regra.id end,memoria_calculo=v_memoria
   where id=p_item_id;
  return v_memoria;
end;$$;

grant execute on function public.recalcular_item_contratual_avancado(uuid) to authenticated;
commit;
