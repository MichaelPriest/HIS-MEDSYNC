create or replace function public.comercial_atualizar_contrato_contextual(
  p_contrato_id uuid,
  p_plano_id uuid,
  p_numero_contrato text,
  p_status text,
  p_data_inicio date,
  p_data_fim date,
  p_prazo_pagamento_dias integer,
  p_reajuste_indice text,
  p_data_base_reajuste text,
  p_contato_comercial text,
  p_email_comercial text,
  p_observacoes text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.credenciamento_contratos%rowtype;
begin
  if auth.uid() is null then
    raise exception 'COMERCIAL_AUTENTICACAO_OBRIGATORIA' using errcode='42501';
  end if;
  select * into v_c from public.credenciamento_contratos where id=p_contrato_id for update;
  if not found then raise exception 'COMERCIAL_CONTRATO_NAO_LOCALIZADO'; end if;
  if not public.comercial_pode_editar(v_c.empresa_id,v_c.unidade_id) then
    raise exception 'COMERCIAL_SEM_PERMISSAO_EDITAR' using errcode='42501';
  end if;
  if p_data_inicio is not null and p_data_fim is not null and p_data_fim<p_data_inicio then
    raise exception 'COMERCIAL_VIGENCIA_INVALIDA';
  end if;
  if p_plano_id is not null and not exists(
    select 1 from public.convenio_planos p
     where p.id=p_plano_id
       and p.empresa_id=v_c.empresa_id
       and p.convenio_id=v_c.convenio_id
       and p.ativo
  ) then
    raise exception 'COMERCIAL_PLANO_INCOMPATIVEL';
  end if;

  update public.credenciamento_contratos set
    plano_id=p_plano_id,
    numero_contrato=nullif(btrim(p_numero_contrato),''),
    status=p_status,
    data_inicio=p_data_inicio,
    data_fim=p_data_fim,
    prazo_pagamento_dias=p_prazo_pagamento_dias,
    reajuste_indice=nullif(btrim(p_reajuste_indice),''),
    data_base_reajuste=nullif(btrim(p_data_base_reajuste),''),
    contato_comercial=nullif(btrim(p_contato_comercial),''),
    email_comercial=nullif(btrim(p_email_comercial),''),
    observacoes=nullif(btrim(p_observacoes),''),
    updated_at=now(),updated_by=auth.uid()
  where id=p_contrato_id;
  return p_contrato_id;
end;
$$;
revoke all on function public.comercial_atualizar_contrato_contextual(uuid,uuid,text,text,date,date,integer,text,text,text,text,text) from public, anon;
grant execute on function public.comercial_atualizar_contrato_contextual(uuid,uuid,text,text,date,date,integer,text,text,text,text,text) to authenticated;

create or replace function public.comercial_sincronizar_regra_vinculo_internal(
  p_vinculo_id uuid,
  p_codigo text,
  p_descricao text,
  p_percentual numeric,
  p_condicoes jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_v public.contrato_tabelas_comerciais%rowtype;
  v_regra_id uuid;
begin
  select * into v_v from public.contrato_tabelas_comerciais where id=p_vinculo_id;
  if not found then return; end if;

  select r.id into v_regra_id
    from public.contrato_regras_faturamento r
   where r.contrato_id=v_v.contrato_id
     and r.categoria=v_v.categoria
     and r.codigo_regra=p_codigo
     and r.condicoes->>'origem_vinculo_tabela_id'=p_vinculo_id::text
   order by r.created_at,r.id
   limit 1;

  if v_regra_id is null then
    if coalesce(p_percentual,0)=0 then return; end if;
    insert into public.contrato_regras_faturamento(
      contrato_id,categoria,codigo_regra,descricao,percentual,prioridade,condicoes,
      ativo,operacao,aplica_sobre,encerra_processamento
    ) values (
      v_v.contrato_id,v_v.categoria,p_codigo,p_descricao,p_percentual,v_v.prioridade,
      coalesce(p_condicoes,'{}'::jsonb)||jsonb_build_object('origem_vinculo_tabela_id',p_vinculo_id),
      true,'acrescentar_percentual','valor_atual',false
    );
  else
    update public.contrato_regras_faturamento
       set descricao=p_descricao,
           percentual=p_percentual,
           prioridade=v_v.prioridade,
           condicoes=coalesce(p_condicoes,'{}'::jsonb)||jsonb_build_object('origem_vinculo_tabela_id',p_vinculo_id),
           ativo=coalesce(p_percentual,0)<>0,
           operacao='acrescentar_percentual',
           aplica_sobre='valor_atual',
           encerra_processamento=false
     where id=v_regra_id;
  end if;
end;
$$;
revoke all on function public.comercial_sincronizar_regra_vinculo_internal(uuid,text,text,numeric,jsonb) from public, anon, authenticated;

create or replace function public.comercial_salvar_negociacao_tabela_v2(
  p_vinculo_id uuid,
  p_modo_edicao text,
  p_edicao_fixa_id uuid,
  p_percentual_ajuste numeric,
  p_valor_ch numeric,
  p_valor_hm numeric,
  p_valor_sadt numeric,
  p_valor_uco numeric,
  p_valor_filme_m2 numeric,
  p_base_preco text,
  p_prioridade integer,
  p_urgencia_percentual numeric,
  p_apartamento_percentual numeric,
  p_horario_especial_percentual numeric,
  p_arredondamento_casas integer,
  p_ativo boolean,
  p_observacoes text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_v public.contrato_tabelas_comerciais%rowtype;
  v_c public.credenciamento_contratos%rowtype;
  v_f public.tabelas_comerciais_fontes%rowtype;
  v_regras jsonb;
begin
  if auth.uid() is null then raise exception 'COMERCIAL_AUTENTICACAO_OBRIGATORIA' using errcode='42501'; end if;
  select * into v_v from public.contrato_tabelas_comerciais where id=p_vinculo_id for update;
  if not found then raise exception 'COMERCIAL_VINCULO_NAO_LOCALIZADO'; end if;
  select * into v_c from public.credenciamento_contratos where id=v_v.contrato_id;
  select * into v_f from public.tabelas_comerciais_fontes where id=v_v.fonte_id;
  if not (public.comercial_pode_editar(v_c.empresa_id,v_c.unidade_id) or public.tabelas_comerciais_pode_editar(v_c.empresa_id,v_c.unidade_id)) then
    raise exception 'COMERCIAL_SEM_PERMISSAO_EDITAR' using errcode='42501';
  end if;
  if p_modo_edicao not in ('edicao_fixa','vigente_na_data') then raise exception 'COMERCIAL_MODO_EDICAO_INVALIDO'; end if;
  if p_modo_edicao='edicao_fixa' and p_edicao_fixa_id is null then raise exception 'COMERCIAL_EDICAO_FIXA_OBRIGATORIA'; end if;
  if p_edicao_fixa_id is not null and not exists(
    select 1 from public.tabelas_comerciais_edicoes e where e.id=p_edicao_fixa_id and e.fonte_id=v_v.fonte_id
  ) then raise exception 'COMERCIAL_EDICAO_INCOMPATIVEL'; end if;
  if p_base_preco is not null and p_base_preco not in ('valor_referencia','valor_fabrica','valor_pmc','valor_maximo') then
    raise exception 'COMERCIAL_BASE_PRECO_INVALIDA';
  end if;
  if coalesce(p_ativo,true) and v_f.tipo in ('brasindice','cmed','simpro') and p_base_preco is null then
    raise exception 'COMERCIAL_BASE_PRECO_OBRIGATORIA';
  end if;
  if p_valor_filme_m2 is not null and p_valor_filme_m2<0 then raise exception 'COMERCIAL_VALOR_FILME_INVALIDO'; end if;
  if coalesce(p_prioridade,100)<0 then raise exception 'COMERCIAL_PRIORIDADE_INVALIDA'; end if;
  if coalesce(p_arredondamento_casas,2) not between 0 and 6 then raise exception 'COMERCIAL_ARREDONDAMENTO_INVALIDO'; end if;

  v_regras:=coalesce(v_v.regras_adicionais,'{}'::jsonb);
  v_regras:=jsonb_set(v_regras,'{urgencia_percentual}',to_jsonb(coalesce(p_urgencia_percentual,0)),true);
  v_regras:=jsonb_set(v_regras,'{apartamento_percentual}',to_jsonb(coalesce(p_apartamento_percentual,0)),true);
  if p_horario_especial_percentual is null then
    v_regras:=v_regras-'horario_especial_percentual'-'horario_especial_regra';
  else
    v_regras:=jsonb_set(v_regras,'{horario_especial_percentual}',to_jsonb(p_horario_especial_percentual),true);
    v_regras:=jsonb_set(v_regras,'{horario_especial_regra}',to_jsonb(p_horario_especial_percentual::text||'%'),true);
  end if;

  update public.contrato_tabelas_comerciais set
    modo_edicao=p_modo_edicao,
    edicao_fixa_id=case when p_modo_edicao='edicao_fixa' then p_edicao_fixa_id else null end,
    percentual_ajuste=coalesce(p_percentual_ajuste,0),
    valor_ch=p_valor_ch,
    valor_hm=p_valor_hm,
    valor_sadt=p_valor_sadt,
    valor_uco_contratual=p_valor_uco,
    valor_filme_m2=p_valor_filme_m2,
    base_preco=p_base_preco,
    prioridade=coalesce(p_prioridade,100),
    regras_adicionais=v_regras,
    arredondamento_casas=coalesce(p_arredondamento_casas,2),
    ativo=coalesce(p_ativo,true),
    observacoes=nullif(btrim(p_observacoes),'')
  where id=p_vinculo_id;

  perform public.comercial_sincronizar_regra_vinculo_internal(
    p_vinculo_id,'URGENCIA','Adicional de urgencia configurado na negociacao da tabela',
    coalesce(p_urgencia_percentual,0),jsonb_build_object('urgencia',true)
  );
  perform public.comercial_sincronizar_regra_vinculo_internal(
    p_vinculo_id,'ACOMODACAO_INDIVIDUAL','Adicional de acomodacao individual configurado na negociacao da tabela',
    coalesce(p_apartamento_percentual,0),jsonb_build_object('acomodacao_individual',true)
  );
  perform public.comercial_sincronizar_regra_vinculo_internal(
    p_vinculo_id,'HORARIO_ESPECIAL','Adicional de horario especial configurado na negociacao da tabela',
    coalesce(p_horario_especial_percentual,0),jsonb_build_object('horario_especial',true)
  );

  return p_vinculo_id;
end;
$$;
revoke all on function public.comercial_salvar_negociacao_tabela_v2(uuid,text,uuid,numeric,numeric,numeric,numeric,numeric,numeric,text,integer,numeric,numeric,numeric,integer,boolean,text) from public, anon;
grant execute on function public.comercial_salvar_negociacao_tabela_v2(uuid,text,uuid,numeric,numeric,numeric,numeric,numeric,numeric,text,integer,numeric,numeric,numeric,integer,boolean,text) to authenticated;

-- Mantem a RPC antiga funcional, mas sem apagar chaves extras como Doppler/filme.
create or replace function public.comercial_salvar_negociacao_tabela(
  p_vinculo_id uuid,
  p_modo_edicao text,
  p_edicao_fixa_id uuid,
  p_percentual_ajuste numeric,
  p_valor_ch numeric,
  p_valor_hm numeric,
  p_valor_sadt numeric,
  p_valor_uco numeric,
  p_prioridade integer,
  p_urgencia_percentual numeric,
  p_apartamento_percentual numeric,
  p_horario_especial_regra text,
  p_arredondamento_casas integer,
  p_ativo boolean,
  p_observacoes text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_horario numeric;
  v_v public.contrato_tabelas_comerciais%rowtype;
begin
  select * into v_v from public.contrato_tabelas_comerciais where id=p_vinculo_id;
  if coalesce(regexp_replace(coalesce(p_horario_especial_regra,''),'[^0-9,.-]','','g'),'') ~ '^-?[0-9]+([\.,][0-9]+)?$' then
    v_horario:=replace(regexp_replace(p_horario_especial_regra,'[^0-9,.-]','','g'),',','.')::numeric;
  end if;
  return public.comercial_salvar_negociacao_tabela_v2(
    p_vinculo_id,p_modo_edicao,p_edicao_fixa_id,p_percentual_ajuste,
    p_valor_ch,p_valor_hm,p_valor_sadt,p_valor_uco,v_v.valor_filme_m2,v_v.base_preco,
    p_prioridade,p_urgencia_percentual,p_apartamento_percentual,v_horario,
    p_arredondamento_casas,p_ativo,p_observacoes
  );
end;
$$;
revoke all on function public.comercial_salvar_negociacao_tabela(uuid,text,uuid,numeric,numeric,numeric,numeric,numeric,integer,numeric,numeric,text,integer,boolean,text) from public, anon;
grant execute on function public.comercial_salvar_negociacao_tabela(uuid,text,uuid,numeric,numeric,numeric,numeric,numeric,integer,numeric,numeric,text,integer,boolean,text) to authenticated;
