-- Evolui a conta hospitalar para categorias MATMED/TISS e cria resolução de preço
-- por tabela comercial (Brasíndice, SIMPRO, CMED, OPME e tabelas próprias).

alter table public.contrato_tabelas_comerciais
  drop constraint if exists contrato_tabelas_comerciais_categoria_check;
alter table public.contrato_tabelas_comerciais
  add constraint contrato_tabelas_comerciais_categoria_check check (
    categoria = any (array[
      'geral','opme','medicamentos','materiais','taxas','diarias','gases','pacotes','procedimentos','outra'
    ])
  );

alter table public.conta_faturamento_itens
  drop constraint if exists conta_faturamento_itens_origem_tipo_check;
alter table public.conta_faturamento_itens
  add constraint conta_faturamento_itens_origem_tipo_check check (
    origem_tipo = any (array[
      'procedimento','medicamento','material','opme','gas_medicinal','pacote','taxa','diaria',
      'honorario','laboratorio','imagem','exame','outro'
    ])
  );

create or replace function public.obter_valor_item_comercial(
  p_convenio_id uuid,
  p_item_assistencial_id uuid,
  p_codigo text,
  p_data date,
  p_categoria text
)
returns table(
  valor numeric,
  metodologia text,
  fonte_id uuid,
  edicao_id uuid,
  item_id uuid,
  memoria jsonb
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
  v_item public.tabelas_comerciais_itens%rowtype;
  v_base numeric := 0;
  v_final numeric := 0;
begin
  select c.empresa_id into v_empresa from public.convenios c where c.id = p_convenio_id;
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

  select t.* into v_vinculo
  from public.contrato_tabelas_comerciais t
  where t.contrato_id = v_contrato_id
    and t.ativo
    and t.categoria in (p_categoria, 'geral')
  order by case when t.categoria = p_categoria then 0 else 1 end, t.prioridade, t.id
  limit 1;
  if v_vinculo.id is null then return; end if;

  select f.* into v_fonte from public.tabelas_comerciais_fontes f where f.id = v_vinculo.fonte_id and f.ativo;
  if v_fonte.id is null then return; end if;

  if v_vinculo.modo_edicao = 'edicao_fixa' then
    select e.* into v_edicao from public.tabelas_comerciais_edicoes e
    where e.id = v_vinculo.edicao_fixa_id and e.status <> 'cancelada';
  else
    select e.* into v_edicao from public.tabelas_comerciais_edicoes e
    where e.fonte_id = v_vinculo.fonte_id
      and e.status = 'vigente'
      and e.vigencia_inicio <= p_data
      and (e.vigencia_fim is null or e.vigencia_fim >= p_data)
      and (e.convenio_id is null or e.convenio_id = p_convenio_id)
    order by case when e.convenio_id = p_convenio_id then 0 else 1 end, e.vigencia_inicio desc
    limit 1;
  end if;
  if v_edicao.id is null then return; end if;

  select i.* into v_item
  from public.tabelas_comerciais_itens i
  where i.edicao_id = v_edicao.id
    and i.ativo
    and (
      (p_item_assistencial_id is not null and i.item_assistencial_id = p_item_assistencial_id)
      or (p_codigo is not null and i.codigo = p_codigo)
      or (p_codigo is not null and i.codigo_tuss = p_codigo)
      or (p_codigo is not null and i.codigo_tabela_propria = p_codigo)
    )
  order by case when p_item_assistencial_id is not null and i.item_assistencial_id = p_item_assistencial_id then 0 else 1 end,
           case when p_codigo is not null and i.codigo = p_codigo then 0 else 1 end
  limit 1;
  if v_item.id is null then return; end if;

  v_base := coalesce(v_item.valor_referencia, 0);
  v_final := round(v_base * (1 + coalesce(v_vinculo.percentual_ajuste, 0) / 100.0), v_vinculo.arredondamento_casas);

  return query select
    v_final,
    v_fonte.tipo,
    v_fonte.id,
    v_edicao.id,
    v_item.id,
    jsonb_build_object(
      'fonte', v_fonte.nome,
      'fonte_tipo', v_fonte.tipo,
      'edicao', v_edicao.nome_edicao,
      'referencia', v_edicao.referencia,
      'categoria_contrato', v_vinculo.categoria,
      'valor_referencia', v_base,
      'percentual_ajuste_contrato', v_vinculo.percentual_ajuste,
      'valor_calculado', v_final,
      'codigo_fonte', v_item.codigo,
      'codigo_tuss', v_item.codigo_tuss,
      'codigo_proprio', v_item.codigo_tabela_propria,
      'valor_fabrica', v_item.valor_fabrica,
      'valor_pmc', v_item.valor_pmc,
      'valor_maximo', v_item.valor_maximo,
      'icms_percentual', v_item.icms_percentual,
      'lista_cmed', v_item.tipo_lista_cmed
    );
end;
$$;

revoke all on function public.obter_valor_item_comercial(uuid,uuid,text,date,text) from public, anon;
grant execute on function public.obter_valor_item_comercial(uuid,uuid,text,date,text) to authenticated;
