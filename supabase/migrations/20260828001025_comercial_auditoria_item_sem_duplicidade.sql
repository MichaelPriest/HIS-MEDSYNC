create or replace function public.comercial_salvar_item_edicao(p_edicao_id uuid, p_item_id uuid, p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path=public,pg_catalog,extensions
as $$
declare
  v_e public.tabelas_comerciais_edicoes%rowtype;
  v_empresa uuid;
  v_id uuid;
  v_codigo text;
  v_descricao text;
begin
  if auth.uid() is null then raise exception 'COMERCIAL_AUTENTICACAO_OBRIGATORIA' using errcode='42501'; end if;
  select e.* into v_e from public.tabelas_comerciais_edicoes e where e.id=p_edicao_id for update;
  if not found then raise exception 'COMERCIAL_EDICAO_NAO_LOCALIZADA'; end if;
  select f.empresa_id into v_empresa from public.tabelas_comerciais_fontes f where f.id=v_e.fonte_id;
  if not public.tabelas_comerciais_pode_editar(v_empresa,null) then raise exception 'COMERCIAL_SEM_PERMISSAO_TABELA' using errcode='42501'; end if;
  if v_e.status<>'rascunho' then raise exception 'COMERCIAL_EDICAO_PUBLICADA_CRIAR_NOVA_VERSAO'; end if;

  v_codigo=nullif(btrim(p_payload->>'codigo'),'');
  v_descricao=nullif(btrim(p_payload->>'descricao'),'');

  if p_item_id is null then
    if v_codigo is null or v_descricao is null then raise exception 'COMERCIAL_ITEM_CODIGO_DESCRICAO_OBRIGATORIOS'; end if;
    insert into public.tabelas_comerciais_itens(
      edicao_id,codigo,descricao,valor_referencia,codigo_tuss,porte,porte_anestesico,pontos_ch,pontos_hm,pontos_sadt,
      quantidade_uco,exige_autorizacao,ativo,categoria_item,tabela_tiss_codigo,codigo_tabela_propria,metadata
    ) values(
      p_edicao_id,v_codigo,v_descricao,coalesce((p_payload->>'valor_referencia')::numeric,0),
      nullif(btrim(p_payload->>'codigo_tuss'),''),nullif(btrim(p_payload->>'porte'),''),nullif(btrim(p_payload->>'porte_anestesico'),''),
      nullif(p_payload->>'pontos_ch','')::numeric,nullif(p_payload->>'pontos_hm','')::numeric,nullif(p_payload->>'pontos_sadt','')::numeric,
      nullif(p_payload->>'quantidade_uco','')::numeric,coalesce((p_payload->>'exige_autorizacao')::boolean,false),
      coalesce((p_payload->>'ativo')::boolean,true),coalesce(nullif(p_payload->>'categoria_item',''),'outro'),
      nullif(p_payload->>'tabela_tiss_codigo',''),nullif(p_payload->>'codigo_tabela_propria',''),'{}'::jsonb
    ) returning id into v_id;
  else
    perform 1 from public.tabelas_comerciais_itens i where i.id=p_item_id and i.edicao_id=p_edicao_id for update;
    if not found then raise exception 'COMERCIAL_ITEM_NAO_LOCALIZADO'; end if;

    update public.tabelas_comerciais_itens i set
      codigo=coalesce(v_codigo,i.codigo),
      descricao=coalesce(v_descricao,i.descricao),
      valor_referencia=case when p_payload ? 'valor_referencia' then coalesce(nullif(p_payload->>'valor_referencia','')::numeric,0) else i.valor_referencia end,
      codigo_tuss=case when p_payload ? 'codigo_tuss' then nullif(btrim(p_payload->>'codigo_tuss'),'') else i.codigo_tuss end,
      porte=case when p_payload ? 'porte' then nullif(btrim(p_payload->>'porte'),'') else i.porte end,
      porte_anestesico=case when p_payload ? 'porte_anestesico' then nullif(btrim(p_payload->>'porte_anestesico'),'') else i.porte_anestesico end,
      pontos_ch=case when p_payload ? 'pontos_ch' then nullif(p_payload->>'pontos_ch','')::numeric else i.pontos_ch end,
      pontos_hm=case when p_payload ? 'pontos_hm' then nullif(p_payload->>'pontos_hm','')::numeric else i.pontos_hm end,
      pontos_sadt=case when p_payload ? 'pontos_sadt' then nullif(p_payload->>'pontos_sadt','')::numeric else i.pontos_sadt end,
      quantidade_uco=case when p_payload ? 'quantidade_uco' then nullif(p_payload->>'quantidade_uco','')::numeric else i.quantidade_uco end,
      exige_autorizacao=case when p_payload ? 'exige_autorizacao' then coalesce((p_payload->>'exige_autorizacao')::boolean,false) else i.exige_autorizacao end,
      ativo=case when p_payload ? 'ativo' then coalesce((p_payload->>'ativo')::boolean,true) else i.ativo end,
      categoria_item=case when p_payload ? 'categoria_item' then coalesce(nullif(p_payload->>'categoria_item',''),'outro') else i.categoria_item end,
      tabela_tiss_codigo=case when p_payload ? 'tabela_tiss_codigo' then nullif(p_payload->>'tabela_tiss_codigo','') else i.tabela_tiss_codigo end,
      codigo_tabela_propria=case when p_payload ? 'codigo_tabela_propria' then nullif(p_payload->>'codigo_tabela_propria','') else i.codigo_tabela_propria end
    where i.id=p_item_id
    returning i.id into v_id;
  end if;

  return v_id;
end
$$;

revoke all on function public.comercial_salvar_item_edicao(uuid,uuid,jsonb) from public,anon;
grant execute on function public.comercial_salvar_item_edicao(uuid,uuid,jsonb) to authenticated;