create or replace function public.comercial_simular_precificacao(
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
set search_path = ''
as $$
declare
  v_contrato public.credenciamento_contratos%rowtype;
  v_preco record;
  v_regra public.contrato_regras_faturamento%rowtype;
  v_data date := coalesce(p_data,current_date);
  v_categoria text := lower(coalesce(nullif(trim(p_categoria),''),'procedimentos'));
  v_categoria_singular text;
  v_codigo text := nullif(trim(p_codigo),'');
  v_base numeric;
  v_final numeric;
  v_alvo numeric;
  v_antes numeric;
  v_cond_ok boolean;
  v_regras_aplicadas jsonb := '[]'::jsonb;
  v_codigo_seq integer;
  v_memoria jsonb := '{}'::jsonb;
  v_contrato_resolvido uuid;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode='42501';
  end if;

  if p_contrato_id is null or v_codigo is null then
    raise exception 'CONTRATO_E_CODIGO_OBRIGATORIOS';
  end if;

  if v_categoria not in (
    'geral','procedimentos','cirurgias','sadt','honorarios','anestesia','auxiliares',
    'diarias','taxas','gases','materiais','medicamentos','opme','pacotes','outra'
  ) then
    raise exception 'CATEGORIA_COMERCIAL_INVALIDA';
  end if;

  if coalesce(p_quantidade_auxiliares,0) < 0 or coalesce(p_sequencia,1) < 1 then
    raise exception 'CONTEXTO_SIMULACAO_INVALIDO';
  end if;

  select c.* into v_contrato
    from public.credenciamento_contratos c
   where c.id=p_contrato_id;

  if not found then
    raise exception 'CONTRATO_NAO_ENCONTRADO';
  end if;

  if not public.comercial_pode_visualizar(v_contrato.empresa_id,v_contrato.unidade_id) then
    raise exception 'SEM_PERMISSAO_COMERCIAL' using errcode='42501';
  end if;

  if v_contrato.status <> 'ativo'
     or (v_contrato.data_inicio is not null and v_contrato.data_inicio>v_data)
     or (v_contrato.data_fim is not null and v_contrato.data_fim<v_data) then
    return jsonb_build_object(
      'status','contrato_fora_contexto',
      'data_referencia',v_data,
      'contrato_id',v_contrato.id,
      'contrato_status',v_contrato.status,
      'vigencia_inicio',v_contrato.data_inicio,
      'vigencia_fim',v_contrato.data_fim,
      'codigo',v_codigo,
      'categoria',v_categoria
    );
  end if;

  select * into v_preco
    from public.obter_valor_item_comercial_tuss_contextual_internal(
      v_contrato.convenio_id,
      v_contrato.plano_id,
      v_contrato.unidade_id,
      null,
      v_codigo,
      v_data,
      v_categoria
    )
   limit 1;

  if v_preco.valor is null then
    return jsonb_build_object(
      'status','sem_preco_contratual',
      'data_referencia',v_data,
      'contrato_id',v_contrato.id,
      'codigo',v_codigo,
      'categoria',v_categoria,
      'plano_id',v_contrato.plano_id,
      'unidade_id',v_contrato.unidade_id
    );
  end if;

  v_memoria:=coalesce(v_preco.memoria,'{}'::jsonb);
  if coalesce(v_memoria->>'contrato_id','') ~ '^[0-9a-fA-F-]{36}$' then
    v_contrato_resolvido:=(v_memoria->>'contrato_id')::uuid;
  end if;

  if v_contrato_resolvido is distinct from v_contrato.id then
    return jsonb_build_object(
      'status','contrato_contextual_diferente',
      'data_referencia',v_data,
      'contrato_selecionado_id',v_contrato.id,
      'contrato_resolvido_id',v_contrato_resolvido,
      'codigo',v_codigo,
      'categoria',v_categoria,
      'valor_resolvido',v_preco.valor,
      'memoria_base',v_memoria
    );
  end if;

  v_categoria_singular:=case v_categoria
    when 'medicamentos' then 'medicamento'
    when 'materiais' then 'material'
    when 'gases' then 'gas'
    when 'honorarios' then 'honorario'
    when 'auxiliares' then 'auxiliar'
    when 'diarias' then 'diaria'
    when 'taxas' then 'taxa'
    when 'cirurgias' then 'cirurgia'
    else v_categoria
  end;

  v_base:=v_preco.valor;
  v_final:=v_base;

  for v_regra in
    select r.*
      from public.contrato_regras_faturamento r
     where r.contrato_id=v_contrato.id
       and r.ativo
       and r.categoria in ('geral',v_categoria,v_categoria_singular)
       and (r.vigencia_inicio is null or r.vigencia_inicio<=v_data)
       and (r.vigencia_fim is null or r.vigencia_fim>=v_data)
     order by r.prioridade,r.id
  loop
    v_cond_ok:=true;

    if v_regra.codigo_regra='MULTIPLO_N' then
      v_cond_ok:=coalesce(p_sequencia,1)>1;
    elsif v_regra.codigo_regra ~ '^MULTIPLO_[0-9]+$' then
      v_codigo_seq:=substring(v_regra.codigo_regra from 'MULTIPLO_([0-9]+)')::integer;
      v_cond_ok:=coalesce(p_sequencia,1)=v_codigo_seq;
    elsif v_regra.codigo_regra='URGENCIA' and not (v_regra.condicoes ? 'urgencia') then
      v_cond_ok:=coalesce(p_urgencia,false);
    elsif v_regra.codigo_regra='HORARIO_ESPECIAL' and not (v_regra.condicoes ? 'horario_especial') then
      v_cond_ok:=coalesce(p_horario_especial,false);
    elsif v_regra.codigo_regra='ACOMODACAO_INDIVIDUAL' and not (v_regra.condicoes ? 'acomodacao_individual') then
      v_cond_ok:=coalesce(p_acomodacao_individual,false);
    elsif v_regra.codigo_regra='ANESTESIA' and not (v_regra.condicoes ? 'anestesia') then
      v_cond_ok:=coalesce(p_anestesia,false);
    elsif v_regra.codigo_regra='AUXILIARES' and not (v_regra.condicoes ? 'quantidade_auxiliares_min') then
      v_cond_ok:=coalesce(p_quantidade_auxiliares,0)>0;
    end if;

    if v_cond_ok and v_regra.condicoes ? 'sequencia' then
      v_cond_ok:=(v_regra.condicoes->>'sequencia')=coalesce(p_sequencia,1)::text;
    end if;
    if v_cond_ok and v_regra.condicoes ? 'sequencia_min'
       and coalesce(v_regra.condicoes->>'sequencia_min','') ~ '^[0-9]+$' then
      v_cond_ok:=coalesce(p_sequencia,1)>=(v_regra.condicoes->>'sequencia_min')::integer;
    end if;
    if v_cond_ok and v_regra.condicoes ? 'sequencia_max'
       and coalesce(v_regra.condicoes->>'sequencia_max','') ~ '^[0-9]+$' then
      v_cond_ok:=coalesce(p_sequencia,1)<=(v_regra.condicoes->>'sequencia_max')::integer;
    end if;
    if v_cond_ok and v_regra.condicoes ? 'urgencia' then
      v_cond_ok:=lower(v_regra.condicoes->>'urgencia')=case when coalesce(p_urgencia,false) then 'true' else 'false' end;
    end if;
    if v_cond_ok and v_regra.condicoes ? 'horario_especial' then
      v_cond_ok:=lower(v_regra.condicoes->>'horario_especial')=case when coalesce(p_horario_especial,false) then 'true' else 'false' end;
    end if;
    if v_cond_ok and v_regra.condicoes ? 'acomodacao_individual' then
      v_cond_ok:=lower(v_regra.condicoes->>'acomodacao_individual')=case when coalesce(p_acomodacao_individual,false) then 'true' else 'false' end;
    end if;
    if v_cond_ok and v_regra.condicoes ? 'anestesia' then
      v_cond_ok:=lower(v_regra.condicoes->>'anestesia')=case when coalesce(p_anestesia,false) then 'true' else 'false' end;
    end if;
    if v_cond_ok and v_regra.condicoes ? 'quantidade_auxiliares_min'
       and coalesce(v_regra.condicoes->>'quantidade_auxiliares_min','') ~ '^[0-9]+$' then
      v_cond_ok:=coalesce(p_quantidade_auxiliares,0)>=(v_regra.condicoes->>'quantidade_auxiliares_min')::integer;
    end if;
    if v_cond_ok and v_regra.condicoes ? 'via_acesso' then
      v_cond_ok:=lower(coalesce(p_via_acesso,''))=lower(v_regra.condicoes->>'via_acesso');
    end if;
    if v_cond_ok and v_regra.condicoes ? 'mesma_via' then
      v_cond_ok:=coalesce(p_mesma_via,false)=(lower(v_regra.condicoes->>'mesma_via')='true');
    end if;
    if v_cond_ok and v_regra.condicoes ? 'origem_tipo' then
      v_cond_ok:=lower(coalesce(p_origem_tipo,''))=lower(v_regra.condicoes->>'origem_tipo');
    end if;
    if v_cond_ok and v_regra.condicoes ? 'codigo' then
      v_cond_ok:=v_codigo=(v_regra.condicoes->>'codigo');
    end if;

    if not v_cond_ok then
      continue;
    end if;

    v_antes:=v_final;
    v_alvo:=case when v_regra.aplica_sobre='valor_base' then v_base else v_final end;

    case v_regra.operacao
      when 'multiplicar_percentual' then
        if v_regra.percentual is not null then
          v_final:=v_alvo*(v_regra.percentual/100.0);
        end if;
        if v_regra.valor_fixo is not null then
          v_final:=v_final+v_regra.valor_fixo;
        end if;
      when 'acrescentar_percentual' then
        if v_regra.percentual is not null then
          v_final:=v_final+(v_alvo*(v_regra.percentual/100.0));
        end if;
        if v_regra.valor_fixo is not null then
          v_final:=v_final+v_regra.valor_fixo;
        end if;
      when 'descontar_percentual' then
        if v_regra.percentual is not null then
          v_final:=v_final-(v_alvo*(v_regra.percentual/100.0));
        end if;
        if v_regra.valor_fixo is not null then
          v_final:=v_final-v_regra.valor_fixo;
        end if;
      when 'somar_valor_fixo' then
        if v_regra.valor_fixo is not null then
          v_final:=v_final+v_regra.valor_fixo;
        end if;
      when 'substituir_valor' then
        if v_regra.valor_fixo is not null then
          v_final:=v_regra.valor_fixo;
        end if;
    end case;

    v_final:=round(v_final,2);
    v_regras_aplicadas:=v_regras_aplicadas || jsonb_build_array(jsonb_build_object(
      'id',v_regra.id,
      'codigo',v_regra.codigo_regra,
      'descricao',v_regra.descricao,
      'categoria',v_regra.categoria,
      'prioridade',v_regra.prioridade,
      'operacao',v_regra.operacao,
      'aplica_sobre',v_regra.aplica_sobre,
      'percentual',v_regra.percentual,
      'valor_fixo',v_regra.valor_fixo,
      'valor_antes',v_antes,
      'valor_depois',v_final,
      'condicoes',v_regra.condicoes
    ));

    if v_regra.encerra_processamento then
      exit;
    end if;
  end loop;

  return jsonb_build_object(
    'status','precificado',
    'data_referencia',v_data,
    'contrato_id',v_contrato.id,
    'convenio_id',v_contrato.convenio_id,
    'plano_id',v_contrato.plano_id,
    'unidade_id',v_contrato.unidade_id,
    'codigo',v_codigo,
    'categoria',v_categoria,
    'metodologia',v_preco.metodologia,
    'fonte_id',v_preco.fonte_id,
    'edicao_id',v_preco.edicao_id,
    'item_id',v_preco.item_id,
    'valor_base',round(v_base,2),
    'valor_final',round(v_final,2),
    'regras_aplicadas',v_regras_aplicadas,
    'contexto',jsonb_build_object(
      'urgencia',coalesce(p_urgencia,false),
      'horario_especial',coalesce(p_horario_especial,false),
      'acomodacao_individual',coalesce(p_acomodacao_individual,false),
      'anestesia',coalesce(p_anestesia,false),
      'quantidade_auxiliares',coalesce(p_quantidade_auxiliares,0),
      'sequencia',coalesce(p_sequencia,1),
      'via_acesso',nullif(trim(p_via_acesso),''),
      'mesma_via',coalesce(p_mesma_via,false),
      'origem_tipo',nullif(trim(p_origem_tipo),'')
    ),
    'memoria_base',v_memoria
  );
end;
$$;

revoke all on function public.comercial_simular_precificacao(uuid,text,date,text,boolean,boolean,boolean,boolean,integer,integer,text,boolean,text) from public, anon;
grant execute on function public.comercial_simular_precificacao(uuid,text,date,text,boolean,boolean,boolean,boolean,integer,integer,text,boolean,text) to authenticated;

comment on function public.comercial_simular_precificacao(uuid,text,date,text,boolean,boolean,boolean,boolean,integer,integer,text,boolean,text) is
  'Simula a mesma cadeia comercial do faturamento sem persistir conta ou preco. Retorna memoria base e regras aplicadas para validacao/homologacao.';