create or replace function public.comercial_prontidao_contrato(
  p_contrato_id uuid,
  p_data date default current_date
)
returns table(
  severidade text,
  codigo text,
  categoria text,
  mensagem text,
  contexto jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_data date := coalesce(p_data, current_date);
  v_contrato public.credenciamento_contratos%rowtype;
  v_vinculo public.contrato_tabelas_comerciais%rowtype;
  v_fonte public.tabelas_comerciais_fontes%rowtype;
  v_edicao public.tabelas_comerciais_edicoes%rowtype;
  v_itens integer := 0;
  v_qtd integer := 0;
  v_issues integer := 0;
  v_filme_configurado boolean := false;
  v_base_coluna text;
begin
  select c.* into v_contrato
    from public.credenciamento_contratos c
   where c.id = p_contrato_id;

  if not found then
    raise exception 'Contrato comercial não encontrado.';
  end if;

  if not public.comercial_pode_visualizar(v_contrato.empresa_id, v_contrato.unidade_id) then
    raise exception 'Usuário sem permissão para visualizar este contrato.';
  end if;

  if v_contrato.status <> 'ativo' then
    severidade := 'bloqueio'; codigo := 'CONTRATO_INATIVO'; categoria := 'contrato';
    mensagem := 'O contrato não está com status ativo na data de referência.';
    contexto := jsonb_build_object('status', v_contrato.status, 'data_referencia', v_data);
    v_issues := v_issues + 1; return next;
  end if;

  if (v_contrato.data_inicio is not null and v_contrato.data_inicio > v_data)
     or (v_contrato.data_fim is not null and v_contrato.data_fim < v_data) then
    severidade := 'bloqueio'; codigo := 'CONTRATO_FORA_VIGENCIA'; categoria := 'contrato';
    mensagem := 'O contrato não está vigente na data usada para a simulação de cobrança.';
    contexto := jsonb_build_object('data_referencia', v_data, 'inicio', v_contrato.data_inicio, 'fim', v_contrato.data_fim);
    v_issues := v_issues + 1; return next;
  end if;

  if v_contrato.prazo_pagamento_dias is null then
    severidade := 'aviso'; codigo := 'PRAZO_PAGAMENTO_AUSENTE'; categoria := 'contrato';
    mensagem := 'O prazo de pagamento não está configurado no contrato.';
    contexto := jsonb_build_object('data_referencia', v_data);
    v_issues := v_issues + 1; return next;
  end if;

  select count(*) into v_qtd
    from public.contrato_tabelas_comerciais t
   where t.contrato_id = p_contrato_id and t.ativo;
  if v_qtd = 0 then
    severidade := 'bloqueio'; codigo := 'SEM_TABELA_VINCULADA'; categoria := 'tabelas';
    mensagem := 'Nenhuma tabela comercial ativa está vinculada ao contrato.';
    contexto := jsonb_build_object('data_referencia', v_data);
    v_issues := v_issues + 1; return next;
  end if;

  for v_vinculo in
    select t.*
      from public.contrato_tabelas_comerciais t
     where t.contrato_id = p_contrato_id and t.ativo
     order by t.categoria, t.prioridade, t.id
  loop
    select f.* into v_fonte
      from public.tabelas_comerciais_fontes f
     where f.id = v_vinculo.fonte_id
       and f.empresa_id = v_contrato.empresa_id
       and f.ativo;

    if not found then
      severidade := 'bloqueio'; codigo := 'FONTE_INATIVA_OU_INVALIDA'; categoria := v_vinculo.categoria;
      mensagem := 'O vínculo aponta para uma fonte comercial inativa ou fora da empresa do contrato.';
      contexto := jsonb_build_object('vinculo_id', v_vinculo.id, 'fonte_id', v_vinculo.fonte_id);
      v_issues := v_issues + 1; return next;
      continue;
    end if;

    v_edicao := null;
    if v_vinculo.modo_edicao = 'edicao_fixa' then
      select e.* into v_edicao
        from public.tabelas_comerciais_edicoes e
       where e.id = v_vinculo.edicao_fixa_id
         and e.fonte_id = v_fonte.id
         and e.status <> 'cancelada'
         and (e.convenio_id is null or e.convenio_id = v_contrato.convenio_id)
       limit 1;
    else
      select e.* into v_edicao
        from public.tabelas_comerciais_edicoes e
       where e.fonte_id = v_fonte.id
         and e.status = 'vigente'
         and e.vigencia_inicio <= v_data
         and (e.vigencia_fim is null or e.vigencia_fim >= v_data)
         and (e.convenio_id is null or e.convenio_id = v_contrato.convenio_id)
       order by case when e.convenio_id = v_contrato.convenio_id then 0 else 1 end,
                e.vigencia_inicio desc,
                e.id
       limit 1;
    end if;

    if v_edicao.id is null then
      severidade := 'bloqueio'; codigo := 'EDICAO_NAO_RESOLVIDA'; categoria := v_vinculo.categoria;
      mensagem := 'Não existe edição comercial válida para este vínculo na data de referência.';
      contexto := jsonb_build_object(
        'vinculo_id', v_vinculo.id, 'fonte_id', v_fonte.id, 'fonte', v_fonte.nome,
        'modo_edicao', v_vinculo.modo_edicao, 'edicao_fixa_id', v_vinculo.edicao_fixa_id,
        'data_referencia', v_data
      );
      v_issues := v_issues + 1; return next;
      continue;
    end if;

    select count(*) into v_itens
      from public.tabelas_comerciais_itens i
     where i.edicao_id = v_edicao.id and i.ativo;
    if v_itens = 0 then
      severidade := 'bloqueio'; codigo := 'EDICAO_SEM_ITENS'; categoria := v_vinculo.categoria;
      mensagem := 'A edição resolvida não possui itens ativos para cobrança.';
      contexto := jsonb_build_object('vinculo_id', v_vinculo.id, 'fonte', v_fonte.nome, 'edicao_id', v_edicao.id, 'edicao', v_edicao.nome_edicao);
      v_issues := v_issues + 1; return next;
      continue;
    end if;

    if v_fonte.tipo in ('brasindice','cmed','simpro') and v_vinculo.base_preco is null then
      severidade := 'bloqueio'; codigo := 'BASE_PRECO_NAO_DEFINIDA'; categoria := v_vinculo.categoria;
      mensagem := 'A fonte exige base de preço explícita no contrato; o motor não escolhe PF, PMC ou referência automaticamente.';
      contexto := jsonb_build_object('vinculo_id', v_vinculo.id, 'fonte', v_fonte.nome, 'tipo', v_fonte.tipo, 'edicao_id', v_edicao.id);
      v_issues := v_issues + 1; return next;
    end if;

    if v_vinculo.base_preco in ('valor_fabrica','valor_pmc','valor_maximo') then
      v_base_coluna := v_vinculo.base_preco;
      execute format(
        'select count(*) from public.tabelas_comerciais_itens i where i.edicao_id = $1 and i.ativo and i.%I is null',
        v_base_coluna
      ) into v_qtd using v_edicao.id;
      if v_qtd > 0 then
        severidade := 'bloqueio'; codigo := 'ITENS_SEM_BASE_PRECO'; categoria := v_vinculo.categoria;
        mensagem := 'Existem itens ativos sem valor na base de preço escolhida para este vínculo.';
        contexto := jsonb_build_object('vinculo_id', v_vinculo.id, 'fonte', v_fonte.nome, 'edicao_id', v_edicao.id, 'base_preco', v_base_coluna, 'itens_afetados', v_qtd);
        v_issues := v_issues + 1; return next;
      end if;
    end if;

    if v_fonte.tipo in ('amb90','amb92','amb96','amb99') then
      select count(*) into v_qtd
        from public.tabelas_comerciais_itens i
       where i.edicao_id = v_edicao.id and i.ativo and coalesce(i.pontos_ch, 0) <> 0;
      if v_qtd > 0 and v_vinculo.valor_sadt is null then
        severidade := 'bloqueio'; codigo := 'AMB_SADT_AUSENTE'; categoria := v_vinculo.categoria;
        mensagem := 'A edição AMB possui itens com CH, mas o valor SADT usado pelo motor AMB não está configurado no vínculo.';
        contexto := jsonb_build_object('vinculo_id', v_vinculo.id, 'fonte', v_fonte.nome, 'edicao_id', v_edicao.id, 'itens_afetados', v_qtd);
        v_issues := v_issues + 1; return next;
      end if;

      select count(*) into v_qtd
        from public.tabelas_comerciais_itens i
       where i.edicao_id = v_edicao.id and i.ativo and coalesce(i.quantidade_filme, 0) <> 0;
      v_filme_configurado := v_vinculo.valor_filme_m2 is not null
        or coalesce(v_vinculo.regras_adicionais->>'valor_filme_m2','') ~ '^[0-9]+([\\.,][0-9]+)?$';
      if v_qtd > 0 and not v_filme_configurado then
        severidade := 'bloqueio'; codigo := 'AMB_FILME_AUSENTE'; categoria := v_vinculo.categoria;
        mensagem := 'A edição AMB possui quantidade de filme, mas o valor de filme/m² não está configurado no contrato.';
        contexto := jsonb_build_object('vinculo_id', v_vinculo.id, 'fonte', v_fonte.nome, 'edicao_id', v_edicao.id, 'itens_afetados', v_qtd);
        v_issues := v_issues + 1; return next;
      end if;
    elsif v_edicao.metodo_calculo = 'ch_hm_sadt' then
      select count(*) into v_qtd from public.tabelas_comerciais_itens i where i.edicao_id=v_edicao.id and i.ativo and coalesce(i.pontos_ch,0)<>0;
      if v_qtd > 0 and v_vinculo.valor_ch is null then
        severidade := 'bloqueio'; codigo := 'CH_CONTRATUAL_AUSENTE'; categoria := v_vinculo.categoria;
        mensagem := 'Há itens com CH, mas o valor contratual de CH está ausente.';
        contexto := jsonb_build_object('vinculo_id',v_vinculo.id,'fonte',v_fonte.nome,'edicao_id',v_edicao.id,'itens_afetados',v_qtd);
        v_issues := v_issues + 1; return next;
      end if;
      select count(*) into v_qtd from public.tabelas_comerciais_itens i where i.edicao_id=v_edicao.id and i.ativo and coalesce(i.pontos_hm,0)<>0;
      if v_qtd > 0 and v_vinculo.valor_hm is null then
        severidade := 'bloqueio'; codigo := 'HM_CONTRATUAL_AUSENTE'; categoria := v_vinculo.categoria;
        mensagem := 'Há itens com HM, mas o valor contratual de HM está ausente.';
        contexto := jsonb_build_object('vinculo_id',v_vinculo.id,'fonte',v_fonte.nome,'edicao_id',v_edicao.id,'itens_afetados',v_qtd);
        v_issues := v_issues + 1; return next;
      end if;
      select count(*) into v_qtd from public.tabelas_comerciais_itens i where i.edicao_id=v_edicao.id and i.ativo and coalesce(i.pontos_sadt,0)<>0;
      if v_qtd > 0 and v_vinculo.valor_sadt is null then
        severidade := 'bloqueio'; codigo := 'SADT_CONTRATUAL_AUSENTE'; categoria := v_vinculo.categoria;
        mensagem := 'Há itens com SADT, mas o valor contratual de SADT está ausente.';
        contexto := jsonb_build_object('vinculo_id',v_vinculo.id,'fonte',v_fonte.nome,'edicao_id',v_edicao.id,'itens_afetados',v_qtd);
        v_issues := v_issues + 1; return next;
      end if;
    end if;

    if v_fonte.tipo = 'cbhpm' and v_edicao.metodo_calculo = 'cbhpm' and v_vinculo.base_preco is null then
      select count(*) into v_qtd
        from public.tabelas_comerciais_itens i
       where i.edicao_id = v_edicao.id and i.ativo and coalesce(i.quantidade_uco,0) <> 0;
      if v_qtd > 0 and v_vinculo.valor_uco_contratual is null then
        severidade := 'bloqueio'; codigo := 'CBHPM_UCO_AUSENTE'; categoria := v_vinculo.categoria;
        mensagem := 'A edição CBHPM possui itens com UCO, mas o valor da UCO contratual não está configurado.';
        contexto := jsonb_build_object('vinculo_id',v_vinculo.id,'fonte',v_fonte.nome,'edicao_id',v_edicao.id,'itens_afetados',v_qtd);
        v_issues := v_issues + 1; return next;
      end if;

      select count(*) into v_qtd
        from public.tabelas_comerciais_itens i
       where i.edicao_id = v_edicao.id
         and i.ativo
         and nullif(btrim(i.porte),'') is not null
         and not exists (
           select 1 from public.contrato_cbhpm_portes p
            where p.vinculo_id = v_vinculo.id and p.tipo='procedimento' and p.porte=i.porte and p.ativo
              and (p.vigencia_inicio is null or p.vigencia_inicio <= v_data)
              and (p.vigencia_fim is null or p.vigencia_fim >= v_data)
         )
         and coalesce(v_vinculo.regras_adicionais->'valores_porte'->>i.porte,'') !~ '^-?[0-9]+([\\.,][0-9]+)?$';
      if v_qtd > 0 then
        severidade := 'bloqueio'; codigo := 'CBHPM_PORTES_PROCEDIMENTO_AUSENTES'; categoria := v_vinculo.categoria;
        mensagem := 'Existem portes de procedimento da edição sem valor monetário válido para a vigência.';
        contexto := jsonb_build_object('vinculo_id',v_vinculo.id,'fonte',v_fonte.nome,'edicao_id',v_edicao.id,'itens_afetados',v_qtd);
        v_issues := v_issues + 1; return next;
      end if;

      select count(*) into v_qtd
        from public.tabelas_comerciais_itens i
       where i.edicao_id = v_edicao.id
         and i.ativo
         and nullif(btrim(i.porte_anestesico),'') is not null
         and not exists (
           select 1 from public.contrato_cbhpm_portes p
            where p.vinculo_id = v_vinculo.id and p.tipo='anestesia' and p.porte=i.porte_anestesico and p.ativo
              and (p.vigencia_inicio is null or p.vigencia_inicio <= v_data)
              and (p.vigencia_fim is null or p.vigencia_fim >= v_data)
         )
         and coalesce(v_vinculo.regras_adicionais->'valores_porte_anestesico'->>i.porte_anestesico,'') !~ '^-?[0-9]+([\\.,][0-9]+)?$';
      if v_qtd > 0 then
        severidade := 'aviso'; codigo := 'CBHPM_PORTES_ANESTESIA_AUSENTES'; categoria := v_vinculo.categoria;
        mensagem := 'Existem portes anestésicos sem valor monetário válido; isso bloqueará itens de anestesia que dependam deles.';
        contexto := jsonb_build_object('vinculo_id',v_vinculo.id,'fonte',v_fonte.nome,'edicao_id',v_edicao.id,'itens_afetados',v_qtd);
        v_issues := v_issues + 1; return next;
      end if;
    end if;

    select count(*) into v_qtd
      from public.tabelas_comerciais_itens i
     where i.edicao_id = v_edicao.id
       and i.ativo
       and nullif(btrim(i.codigo_tuss),'') is null
       and coalesce(i.tabela_tiss_codigo,'') <> '00'
       and not exists (
         select 1 from public.contrato_depara_tuss d
          where d.contrato_id = p_contrato_id
            and d.fonte_id = v_fonte.id
            and d.codigo_origem = i.codigo
            and d.ativo
            and d.vigencia_inicio <= v_data
            and (d.vigencia_fim is null or d.vigencia_fim >= v_data)
       )
       and not exists (
         select 1 from public.referencia_equivalencias r
          where r.status='ativa'
            and r.codigo_origem=i.codigo
            and upper(r.sistema_destino)='TUSS'
            and (
              upper(r.sistema_origem) in (upper(v_fonte.codigo),upper(v_fonte.tipo))
              or (v_fonte.tipo like 'amb%' and upper(r.sistema_origem)='AMB')
            )
       );
    if v_qtd > 0 then
      severidade := 'aviso'; codigo := 'TUSS_NAO_MAPEADO'; categoria := v_vinculo.categoria;
      mensagem := 'Há itens sem TUSS direto e sem DePara explícito vigente. Confirme se usam tabela própria (00) ou cadastre a equivalência antes do TISS.';
      contexto := jsonb_build_object('vinculo_id',v_vinculo.id,'fonte',v_fonte.nome,'edicao_id',v_edicao.id,'itens_afetados',v_qtd);
      v_issues := v_issues + 1; return next;
    end if;
  end loop;

  select count(*) into v_qtd
    from (
      select t.categoria, t.prioridade
        from public.contrato_tabelas_comerciais t
       where t.contrato_id=p_contrato_id and t.ativo
       group by t.categoria,t.prioridade
      having count(*) > 1
    ) d;
  if v_qtd > 0 then
    severidade := 'aviso'; codigo := 'PRIORIDADE_TABELA_EMPATE'; categoria := 'tabelas';
    mensagem := 'Existem vínculos ativos com a mesma categoria e prioridade. O desempate por ID é determinístico, mas a prioridade comercial deve ser explicitada.';
    contexto := jsonb_build_object('grupos_empatados', v_qtd);
    v_issues := v_issues + 1; return next;
  end if;

  if v_issues = 0 then
    severidade := 'ok'; codigo := 'CONTRATO_PRONTO'; categoria := 'geral';
    mensagem := 'Nenhum bloqueio ou aviso comercial foi encontrado para a data de referência.';
    contexto := jsonb_build_object('data_referencia', v_data, 'contrato_id', p_contrato_id);
    return next;
  end if;
end;
$$;

revoke all on function public.comercial_prontidao_contrato(uuid,date) from public, anon;
grant execute on function public.comercial_prontidao_contrato(uuid,date) to authenticated, postgres;

comment on function public.comercial_prontidao_contrato(uuid,date) is
'Diagnóstico somente leitura da prontidão comercial do contrato para uma data; não cria preço, edição, porte ou DePara automaticamente.';
