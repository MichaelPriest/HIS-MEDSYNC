-- Segurança do ciclo da receita: somente guia regulatoriamente validada como pronta pode ser agrupada em lote.
create or replace function public.criar_lote_tiss_transacional(
  p_unidade_id uuid,
  p_convenio_id uuid,
  p_competencia text,
  p_previsao_pagamento date default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_catalog', 'extensions'
as $function$
declare
  v_user uuid := auth.uid();
  v_empresa_id uuid;
  v_versao_id uuid;
  v_lote_id uuid;
  v_numero_lote text;
  v_guia_ids uuid[];
  v_quantidade integer := 0;
  v_valor_total numeric := 0;
  v_seq bigint;
begin
  if v_user is null then
    raise exception 'TISS_NAO_AUTENTICADO' using errcode='42501';
  end if;
  if p_unidade_id is null or p_convenio_id is null then
    raise exception 'TISS_LOTE_ESCOPO_OBRIGATORIO' using errcode='22023';
  end if;
  if coalesce(p_competencia,'') !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then
    raise exception 'TISS_LOTE_COMPETENCIA_INVALIDA' using errcode='22023';
  end if;

  select u.empresa_id into v_empresa_id
    from public.unidades u
   where u.id=p_unidade_id and u.ativo;
  if v_empresa_id is null or not public.tem_unidade(v_empresa_id,p_unidade_id) then
    raise exception 'TISS_LOTE_SEM_ACESSO_UNIDADE' using errcode='42501';
  end if;
  if not public.tem_permissao(v_empresa_id,p_unidade_id,'tiss.gerar') then
    raise exception 'TISS_LOTE_SEM_PERMISSAO' using errcode='42501';
  end if;
  if not exists (
    select 1 from public.convenios c
     where c.id=p_convenio_id and c.empresa_id=v_empresa_id and c.ativo
  ) then
    raise exception 'TISS_LOTE_CONVENIO_INVALIDO' using errcode='22023';
  end if;

  select tv.id into v_versao_id
    from public.tiss_versoes tv
   where tv.ativo
   order by tv.vigente_desde desc nulls last,tv.created_at desc,tv.id
   limit 1;
  if v_versao_id is null then
    raise exception 'TISS_LOTE_VERSAO_INDISPONIVEL' using errcode='22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_unidade_id::text||'|'||p_convenio_id::text||'|'||p_competencia,0
  ));

  with elegiveis as (
    select g.id,g.valor_total
      from public.tiss_guias g
      join public.contas_faturamento cf on cf.id=g.conta_id
     where g.empresa_id=v_empresa_id
       and g.unidade_id=p_unidade_id
       and g.convenio_id=p_convenio_id
       and g.versao_id=v_versao_id
       and g.status='pronta'
       and cf.empresa_id=v_empresa_id
       and cf.unidade_id=p_unidade_id
       and cf.convenio_id=p_convenio_id
       and cf.competencia=p_competencia
       and cf.tipo_cobranca='convenio'
       and cf.status='pronta'
       and cf.auditoria_liberada
       and cf.contas_medicas_liberada
       and not exists (
         select 1
           from public.tiss_lote_guias lg
           join public.tiss_lotes l on l.id=lg.lote_id
          where lg.guia_id=g.id and l.status<>'rejeitado'
       )
     order by g.data_atendimento nulls last,g.created_at,g.id
     for update of g
     limit 500
  )
  select array_agg(id order by id),count(*)::int,coalesce(sum(valor_total),0)
    into v_guia_ids,v_quantidade,v_valor_total
    from elegiveis;

  if coalesce(v_quantidade,0)=0 then
    raise exception 'TISS_LOTE_SEM_GUIAS_ELEGIVEIS' using errcode='P0001';
  end if;

  v_seq := nextval('public.tiss_lote_numero_seq');
  v_numero_lote := 'L'||replace(p_competencia,'-','')||'-'||lpad(v_seq::text,8,'0');

  insert into public.tiss_lotes(
    empresa_id,unidade_id,convenio_id,versao_id,numero_lote,competencia,status,
    previsao_pagamento,quantidade_guias,valor_total,created_by
  ) values (
    v_empresa_id,p_unidade_id,p_convenio_id,v_versao_id,v_numero_lote,p_competencia,'rascunho',
    p_previsao_pagamento,v_quantidade,v_valor_total,v_user
  ) returning id into v_lote_id;

  insert into public.tiss_lote_guias(lote_id,guia_id)
  select v_lote_id,unnest(v_guia_ids);

  update public.tiss_guias
     set status='em_lote',updated_by=v_user,updated_at=now()
   where id=any(v_guia_ids);

  insert into public.financeiro_recebiveis(
    empresa_id,unidade_id,lote_id,convenio_id,competencia,previsao_pagamento,
    valor_bruto,valor_liquido_previsto,status,created_by,updated_by
  ) values (
    v_empresa_id,p_unidade_id,v_lote_id,p_convenio_id,p_competencia,p_previsao_pagamento,
    v_valor_total,v_valor_total,'previsto',v_user,v_user
  );

  return jsonb_build_object(
    'lote_id',v_lote_id,
    'numero_lote',v_numero_lote,
    'competencia',p_competencia,
    'quantidade_guias',v_quantidade,
    'valor_total',v_valor_total,
    'versao_id',v_versao_id
  );
end
$function$;

revoke all on function public.criar_lote_tiss_transacional(uuid,uuid,text,date) from public, anon, authenticated;
grant execute on function public.criar_lote_tiss_transacional(uuid,uuid,text,date) to authenticated;
