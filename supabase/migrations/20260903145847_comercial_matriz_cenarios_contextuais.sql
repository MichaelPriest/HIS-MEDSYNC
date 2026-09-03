create or replace function public.comercial_simular_matriz_cenarios(
  p_contrato_id uuid,
  p_codigo text,
  p_data date default null,
  p_categoria text default 'procedimentos',
  p_urgencia boolean default false,
  p_horario_especial boolean default false,
  p_acomodacao_individual boolean default false,
  p_anestesia boolean default false,
  p_quantidade_auxiliares integer default 0,
  p_sequencia integer default 1,
  p_via_acesso text default null,
  p_mesma_via boolean default false,
  p_origem_tipo text default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_root public.credenciamento_contratos%rowtype;
  v_contexto record;
  v_data date := coalesce(p_data, current_date);
  v_codigo text := nullif(trim(p_codigo), '');
  v_categoria text := lower(coalesce(nullif(trim(p_categoria), ''), 'procedimentos'));
  v_simulacao jsonb;
  v_cenarios jsonb := '[]'::jsonb;
  v_bloqueios integer;
  v_avisos integer;
  v_sobreposicoes integer;
  v_total integer := 0;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  if p_contrato_id is null or v_codigo is null then
    raise exception 'CONTRATO_E_CODIGO_OBRIGATORIOS';
  end if;

  select c.*
    into v_root
    from public.credenciamento_contratos c
   where c.id = p_contrato_id;

  if not found then
    raise exception 'CONTRATO_NAO_ENCONTRADO';
  end if;

  if not public.comercial_pode_visualizar(v_root.empresa_id, v_root.unidade_id) then
    raise exception 'SEM_PERMISSAO_COMERCIAL' using errcode = '42501';
  end if;

  for v_contexto in
    select
      c.id,
      c.empresa_id,
      c.convenio_id,
      c.plano_id,
      c.unidade_id,
      c.numero_contrato,
      c.data_inicio,
      c.data_fim,
      p.nome as plano_nome,
      u.nome as unidade_nome,
      ((case when c.plano_id is not null then 1 else 0 end)
        + (case when c.unidade_id is not null then 1 else 0 end)) as especificidade
    from public.credenciamento_contratos c
    left join public.convenio_planos p on p.id = c.plano_id
    left join public.unidades u on u.id = c.unidade_id
    where c.empresa_id = v_root.empresa_id
      and c.convenio_id = v_root.convenio_id
      and c.status = 'ativo'
      and (c.data_inicio is null or c.data_inicio <= v_data)
      and (c.data_fim is null or c.data_fim >= v_data)
      and public.comercial_pode_visualizar(c.empresa_id, c.unidade_id)
    order by
      ((case when c.plano_id is not null then 1 else 0 end)
        + (case when c.unidade_id is not null then 1 else 0 end)) desc,
      p.nome nulls first,
      u.nome nulls first,
      c.numero_contrato nulls first,
      c.id
  loop
    select count(*)::integer
      into v_sobreposicoes
      from public.credenciamento_contratos c2
     where c2.empresa_id = v_contexto.empresa_id
       and c2.convenio_id = v_contexto.convenio_id
       and c2.status = 'ativo'
       and c2.plano_id is not distinct from v_contexto.plano_id
       and c2.unidade_id is not distinct from v_contexto.unidade_id
       and (c2.data_inicio is null or c2.data_inicio <= v_data)
       and (c2.data_fim is null or c2.data_fim >= v_data);

    select
      count(*) filter (where d.severidade = 'bloqueio')::integer,
      count(*) filter (where d.severidade = 'aviso')::integer
      into v_bloqueios, v_avisos
      from public.comercial_prontidao_contrato(v_contexto.id, v_data) d;

    v_simulacao := public.comercial_simular_precificacao(
      v_contexto.id,
      v_codigo,
      v_data,
      v_categoria,
      coalesce(p_urgencia, false),
      coalesce(p_horario_especial, false),
      coalesce(p_acomodacao_individual, false),
      coalesce(p_anestesia, false),
      coalesce(p_quantidade_auxiliares, 0),
      coalesce(p_sequencia, 1),
      p_via_acesso,
      coalesce(p_mesma_via, false),
      p_origem_tipo
    );

    v_cenarios := v_cenarios || jsonb_build_array(jsonb_build_object(
      'contrato_id', v_contexto.id,
      'selecionado', v_contexto.id = v_root.id,
      'numero_contrato', v_contexto.numero_contrato,
      'plano_id', v_contexto.plano_id,
      'plano_nome', coalesce(v_contexto.plano_nome, 'Todos os planos'),
      'unidade_id', v_contexto.unidade_id,
      'unidade_nome', coalesce(v_contexto.unidade_nome, 'Todas as unidades'),
      'data_inicio', v_contexto.data_inicio,
      'data_fim', v_contexto.data_fim,
      'especificidade', v_contexto.especificidade,
      'sobreposicoes_contexto', v_sobreposicoes,
      'prontidao_bloqueios', coalesce(v_bloqueios, 0),
      'prontidao_avisos', coalesce(v_avisos, 0),
      'simulacao', v_simulacao
    ));
    v_total := v_total + 1;
  end loop;

  return jsonb_build_object(
    'status', case when v_total = 0 then 'sem_contextos_ativos' else 'ok' end,
    'contrato_raiz_id', v_root.id,
    'convenio_id', v_root.convenio_id,
    'data_referencia', v_data,
    'codigo', v_codigo,
    'categoria', v_categoria,
    'total_cenarios', v_total,
    'cenarios', v_cenarios
  );
end
$function$;

revoke all on function public.comercial_simular_matriz_cenarios(uuid,text,date,text,boolean,boolean,boolean,boolean,integer,integer,text,boolean,text) from public, anon;
grant execute on function public.comercial_simular_matriz_cenarios(uuid,text,date,text,boolean,boolean,boolean,boolean,integer,integer,text,boolean,text) to authenticated;
