create or replace function public.salvar_item_conta_faturamento(
  p_conta_id uuid,
  p_item_id uuid,
  p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path to 'public','pg_catalog'
as $function$
declare
  v_user uuid := auth.uid();
  v_conta public.contas_faturamento%rowtype;
  v_item_id uuid;
  v_qtd numeric;
  v_unit numeric;
  v_pct numeric;
  v_total numeric;
  v_bruto numeric;
begin
  if v_user is null then raise exception 'FAT_ITEM_NAO_AUTENTICADO' using errcode='42501'; end if;
  select * into v_conta from public.contas_faturamento where id=p_conta_id for update;
  if not found then raise exception 'FAT_CONTA_NAO_LOCALIZADA' using errcode='P0002'; end if;
  if not public.tem_unidade(v_conta.empresa_id,v_conta.unidade_id)
     or not public.tem_permissao(v_conta.empresa_id,v_conta.unidade_id,'faturamento.criar') then
    raise exception 'FAT_ITEM_SEM_PERMISSAO' using errcode='42501';
  end if;
  if v_conta.status in ('faturada','cancelada') then raise exception 'FAT_CONTA_NAO_EDITAVEL'; end if;
  if exists(select 1 from public.tiss_guias g where g.conta_id=p_conta_id and g.status <> 'cancelada') then
    raise exception 'FAT_CONTA_COM_GUIA_TISS_ATIVA';
  end if;

  v_qtd := nullif(p_payload->>'quantidade','')::numeric;
  v_unit := nullif(p_payload->>'valor_unitario','')::numeric;
  v_pct := coalesce(nullif(p_payload->>'percentual_reducao_acrescimo','')::numeric,0);
  if coalesce(v_qtd,0) <= 0 then raise exception 'FAT_ITEM_QUANTIDADE_INVALIDA'; end if;
  if v_unit is null or v_unit < 0 then raise exception 'FAT_ITEM_VALOR_INVALIDO'; end if;
  if v_pct < -100 or v_pct > 1000 then raise exception 'FAT_ITEM_PERCENTUAL_INVALIDO'; end if;
  if nullif(btrim(coalesce(p_payload->>'descricao','')),'') is null then raise exception 'FAT_ITEM_DESCRICAO_OBRIGATORIA'; end if;
  v_total := round(v_qtd * v_unit * (1 + (v_pct / 100)),2);

  if p_item_id is null then
    insert into public.conta_faturamento_itens(
      conta_id,origem_tipo,data_execucao,tabela,codigo,descricao,quantidade,valor_unitario,
      percentual_reducao_acrescimo,valor_total,setor,cobravel,observacao,grupo_ato_id,
      sequencia_ato,via_acesso,urgencia,horario_especial,acomodacao_individual,anestesia,
      numero_auxiliares,filme_m2,origem_valor
    ) values (
      p_conta_id,coalesce(nullif(p_payload->>'origem_tipo',''),'procedimento'),
      coalesce(nullif(p_payload->>'data_execucao','')::timestamptz,now()),
      nullif(btrim(coalesce(p_payload->>'tabela','')),''),nullif(btrim(coalesce(p_payload->>'codigo','')),''),
      btrim(p_payload->>'descricao'),v_qtd,v_unit,v_pct,v_total,
      nullif(btrim(coalesce(p_payload->>'setor','')),''),coalesce(nullif(p_payload->>'cobravel','')::boolean,true),
      nullif(btrim(coalesce(p_payload->>'observacao','')),''),nullif(p_payload->>'grupo_ato_id','')::uuid,
      nullif(p_payload->>'sequencia_ato','')::integer,nullif(btrim(coalesce(p_payload->>'via_acesso','')),''),
      coalesce(nullif(p_payload->>'urgencia','')::boolean,false),coalesce(nullif(p_payload->>'horario_especial','')::boolean,false),
      coalesce(nullif(p_payload->>'acomodacao_individual','')::boolean,false),coalesce(nullif(p_payload->>'anestesia','')::boolean,false),
      coalesce(nullif(p_payload->>'numero_auxiliares','')::integer,0),coalesce(nullif(p_payload->>'filme_m2','')::numeric,0),'lancamento_manual'
    ) returning id into v_item_id;
  else
    update public.conta_faturamento_itens set
      origem_tipo=coalesce(nullif(p_payload->>'origem_tipo',''),origem_tipo),
      data_execucao=coalesce(nullif(p_payload->>'data_execucao','')::timestamptz,data_execucao),
      tabela=nullif(btrim(coalesce(p_payload->>'tabela','')),''),codigo=nullif(btrim(coalesce(p_payload->>'codigo','')),''),
      descricao=btrim(p_payload->>'descricao'),quantidade=v_qtd,valor_unitario=v_unit,
      percentual_reducao_acrescimo=v_pct,valor_total=v_total,setor=nullif(btrim(coalesce(p_payload->>'setor','')),''),
      cobravel=coalesce(nullif(p_payload->>'cobravel','')::boolean,true),observacao=nullif(btrim(coalesce(p_payload->>'observacao','')),''),
      grupo_ato_id=nullif(p_payload->>'grupo_ato_id','')::uuid,sequencia_ato=nullif(p_payload->>'sequencia_ato','')::integer,
      via_acesso=nullif(btrim(coalesce(p_payload->>'via_acesso','')),''),urgencia=coalesce(nullif(p_payload->>'urgencia','')::boolean,false),
      horario_especial=coalesce(nullif(p_payload->>'horario_especial','')::boolean,false),
      acomodacao_individual=coalesce(nullif(p_payload->>'acomodacao_individual','')::boolean,false),
      anestesia=coalesce(nullif(p_payload->>'anestesia','')::boolean,false),numero_auxiliares=coalesce(nullif(p_payload->>'numero_auxiliares','')::integer,0),
      filme_m2=coalesce(nullif(p_payload->>'filme_m2','')::numeric,0),valor_contratual_calculado=null,
      percentual_aplicado=null,divergencia_valor_contratual=null
    where id=p_item_id and conta_id=p_conta_id returning id into v_item_id;
    if v_item_id is null then raise exception 'FAT_ITEM_NAO_LOCALIZADO' using errcode='P0002'; end if;
  end if;

  update public.conta_faturamento_criticas set resolvida=true,resolvida_em=now(),resolvida_por=v_user where conta_id=p_conta_id and not resolvida;
  select coalesce(sum(valor_total) filter (where cobravel),0) into v_bruto from public.conta_faturamento_itens where conta_id=p_conta_id;
  update public.contas_faturamento set valor_bruto=v_bruto,valor_liquido=greatest(v_bruto-coalesce(valor_desconto,0),0),status='pre_faturamento',updated_at=now(),updated_by=v_user where id=p_conta_id;
  return v_item_id;
end
$function$;

create or replace function public.excluir_item_conta_faturamento(p_conta_id uuid,p_item_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public','pg_catalog'
as $function$
declare
  v_user uuid := auth.uid();
  v_conta public.contas_faturamento%rowtype;
  v_bruto numeric;
begin
  if v_user is null then raise exception 'FAT_ITEM_NAO_AUTENTICADO' using errcode='42501'; end if;
  select * into v_conta from public.contas_faturamento where id=p_conta_id for update;
  if not found then raise exception 'FAT_CONTA_NAO_LOCALIZADA' using errcode='P0002'; end if;
  if not public.tem_unidade(v_conta.empresa_id,v_conta.unidade_id)
     or not public.tem_permissao(v_conta.empresa_id,v_conta.unidade_id,'faturamento.criar') then raise exception 'FAT_ITEM_SEM_PERMISSAO' using errcode='42501'; end if;
  if v_conta.status in ('faturada','cancelada') then raise exception 'FAT_CONTA_NAO_EDITAVEL'; end if;
  if exists(select 1 from public.tiss_guias g where g.conta_id=p_conta_id and g.status <> 'cancelada') then raise exception 'FAT_CONTA_COM_GUIA_TISS_ATIVA'; end if;
  delete from public.conta_faturamento_itens where id=p_item_id and conta_id=p_conta_id;
  if not found then raise exception 'FAT_ITEM_NAO_LOCALIZADO' using errcode='P0002'; end if;
  update public.conta_faturamento_criticas set resolvida=true,resolvida_em=now(),resolvida_por=v_user where conta_id=p_conta_id and not resolvida;
  select coalesce(sum(valor_total) filter (where cobravel),0) into v_bruto from public.conta_faturamento_itens where conta_id=p_conta_id;
  update public.contas_faturamento set valor_bruto=v_bruto,valor_liquido=greatest(v_bruto-coalesce(valor_desconto,0),0),status='pre_faturamento',updated_at=now(),updated_by=v_user where id=p_conta_id;
end
$function$;

create or replace function public.atualizar_resumo_conta_faturamento(p_conta_id uuid,p_competencia text,p_valor_desconto numeric)
returns void
language plpgsql
security definer
set search_path to 'public','pg_catalog'
as $function$
declare
  v_user uuid := auth.uid();
  v_conta public.contas_faturamento%rowtype;
  v_desconto numeric := greatest(coalesce(p_valor_desconto,0),0);
begin
  if v_user is null then raise exception 'FAT_CONTA_NAO_AUTENTICADA' using errcode='42501'; end if;
  select * into v_conta from public.contas_faturamento where id=p_conta_id for update;
  if not found then raise exception 'FAT_CONTA_NAO_LOCALIZADA' using errcode='P0002'; end if;
  if not public.tem_unidade(v_conta.empresa_id,v_conta.unidade_id)
     or not public.tem_permissao(v_conta.empresa_id,v_conta.unidade_id,'faturamento.criar') then raise exception 'FAT_CONTA_SEM_PERMISSAO' using errcode='42501'; end if;
  if v_conta.status in ('faturada','cancelada') then raise exception 'FAT_CONTA_NAO_EDITAVEL'; end if;
  if p_competencia is null or p_competencia !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then raise exception 'FAT_COMPETENCIA_INVALIDA'; end if;
  if v_desconto > coalesce(v_conta.valor_bruto,0) then raise exception 'FAT_DESCONTO_MAIOR_QUE_BRUTO'; end if;
  update public.contas_faturamento set competencia=p_competencia,valor_desconto=v_desconto,valor_liquido=greatest(coalesce(valor_bruto,0)-v_desconto,0),status=case when status='pronta' then 'pre_faturamento' else status end,updated_at=now(),updated_by=v_user where id=p_conta_id;
end
$function$;

revoke all on function public.salvar_item_conta_faturamento(uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.excluir_item_conta_faturamento(uuid,uuid) from public,anon,authenticated;
revoke all on function public.atualizar_resumo_conta_faturamento(uuid,text,numeric) from public,anon,authenticated;
grant execute on function public.salvar_item_conta_faturamento(uuid,uuid,jsonb) to authenticated;
grant execute on function public.excluir_item_conta_faturamento(uuid,uuid) to authenticated;
grant execute on function public.atualizar_resumo_conta_faturamento(uuid,text,numeric) to authenticated;
