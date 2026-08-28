create or replace function public.buscar_procedimentos_cirurgicos_contrato(
  p_atendimento_id uuid,
  p_busca text default null,
  p_limite integer default 40
)
returns table(
  tabela_item_id uuid,
  codigo text,
  codigo_tuss text,
  descricao text,
  porte text,
  porte_anestesico text,
  tabela_tiss_codigo text,
  fonte_codigo text,
  fonte_nome text,
  edicao_nome text,
  prioridade integer,
  convenio_id uuid,
  convenio_nome text,
  contrato_id uuid,
  numero_contrato text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_at public.atendimentos%rowtype;
  v_contrato public.credenciamento_contratos%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'CC_AUTENTICACAO_OBRIGATORIA' using errcode='42501';
  end if;

  select * into v_at
  from public.atendimentos a
  where a.id = p_atendimento_id;

  if not found or not public.tem_unidade(v_at.empresa_id, v_at.unidade_id) then
    raise exception 'CC_ATENDIMENTO_NAO_LOCALIZADO' using errcode='42501';
  end if;

  if v_at.cobertura::text <> 'convenio' or v_at.convenio_id is null then
    return;
  end if;

  select c.* into v_contrato
  from public.credenciamento_contratos c
  where c.empresa_id = v_at.empresa_id
    and c.convenio_id = v_at.convenio_id
    and (c.unidade_id is null or c.unidade_id = v_at.unidade_id)
    and c.status = 'ativo'
    and (c.data_inicio is null or c.data_inicio <= current_date)
    and (c.data_fim is null or c.data_fim >= current_date)
  order by case when c.unidade_id = v_at.unidade_id then 0 else 1 end,
           c.data_inicio desc nulls last,
           c.created_at desc
  limit 1;

  if v_contrato.id is null then
    return;
  end if;

  return query
  select
    b.tabela_item_id,
    i.codigo,
    coalesce(b.codigo_tuss, i.codigo_tuss, b.depara_tuss),
    b.descricao,
    i.porte,
    i.porte_anestesico,
    b.tabela_tiss_codigo,
    b.fonte_codigo,
    b.fonte_nome,
    b.edicao_nome,
    b.prioridade,
    v_at.convenio_id,
    conv.nome_fantasia,
    v_contrato.id,
    v_contrato.numero_contrato
  from public.buscar_itens_contrato_comercial(v_at.convenio_id, p_busca, 'procedimento', current_date, greatest(1, least(coalesce(p_limite,40),80))) b
  join public.tabelas_comerciais_itens i on i.id = b.tabela_item_id
  join public.convenios conv on conv.id = v_at.convenio_id
  order by b.prioridade, b.descricao;
end;
$$;

revoke all on function public.buscar_procedimentos_cirurgicos_contrato(uuid,text,integer) from public, anon;
grant execute on function public.buscar_procedimentos_cirurgicos_contrato(uuid,text,integer) to authenticated;

comment on function public.buscar_procedimentos_cirurgicos_contrato(uuid,text,integer) is
'Resolve o contrato ativo do convenio do atendimento e retorna somente procedimentos contratados com codigo, TUSS, porte e porte anestesico.';
