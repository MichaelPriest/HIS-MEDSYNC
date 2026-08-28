create or replace function public.comercial_clonar_edicao(
  p_edicao_id uuid,p_nome_edicao text,p_vigencia_inicio date,p_observacoes text default null
) returns uuid
language plpgsql security definer set search_path=public,pg_catalog,extensions
as $$
declare v_e public.tabelas_comerciais_edicoes%rowtype; v_empresa uuid; v_nova uuid;
begin
  if auth.uid() is null then raise exception 'COMERCIAL_AUTENTICACAO_OBRIGATORIA' using errcode='42501'; end if;
  select * into v_e from public.tabelas_comerciais_edicoes where id=p_edicao_id for update;
  if not found then raise exception 'COMERCIAL_EDICAO_NAO_LOCALIZADA'; end if;
  select empresa_id into v_empresa from public.tabelas_comerciais_fontes where id=v_e.fonte_id;
  if not public.tabelas_comerciais_pode_editar(v_empresa,null) then raise exception 'COMERCIAL_SEM_PERMISSAO_TABELA' using errcode='42501'; end if;
  if coalesce(btrim(p_nome_edicao),'')='' or p_vigencia_inicio is null then raise exception 'COMERCIAL_NOVA_EDICAO_DADOS_OBRIGATORIOS'; end if;
  insert into public.tabelas_comerciais_edicoes(fonte_id,convenio_id,nome_edicao,referencia,vigencia_inicio,status,metodo_calculo,valor_uco,moeda,observacoes,created_by)
  values(v_e.fonte_id,v_e.convenio_id,btrim(p_nome_edicao),v_e.referencia,p_vigencia_inicio,'rascunho',v_e.metodo_calculo,v_e.valor_uco,v_e.moeda,coalesce(nullif(btrim(p_observacoes),''),'Nova versão criada a partir de '||v_e.nome_edicao),auth.uid())
  returning id into v_nova;
  insert into public.tabelas_comerciais_itens(
    edicao_id,codigo,codigo_fabricante,codigo_anvisa,codigo_tuss,descricao,fabricante,apresentacao,unidade,
    valor_fabrica,valor_referencia,valor_maximo,percentual_acrescimo,regra_preco,exige_autorizacao,
    pontos_ch,pontos_hm,pontos_sadt,quantidade_auxiliares,porte,ch_anestesista,quantidade_filme,
    quantidade_uco,porte_anestesico,codigo_auxiliar,ativo,metadata,item_assistencial_id,categoria_item,
    tabela_tiss_codigo,familia_tuss,codigo_brasindice,codigo_simpro,ean,ggrem,valor_pmc,icms_percentual,
    tipo_lista_cmed,codigo_tabela_propria
  )
  select v_nova,codigo,codigo_fabricante,codigo_anvisa,codigo_tuss,descricao,fabricante,apresentacao,unidade,
    valor_fabrica,valor_referencia,valor_maximo,percentual_acrescimo,regra_preco,exige_autorizacao,
    pontos_ch,pontos_hm,pontos_sadt,quantidade_auxiliares,porte,ch_anestesista,quantidade_filme,
    quantidade_uco,porte_anestesico,codigo_auxiliar,ativo,metadata,item_assistencial_id,categoria_item,
    tabela_tiss_codigo,familia_tuss,codigo_brasindice,codigo_simpro,ean,ggrem,valor_pmc,icms_percentual,
    tipo_lista_cmed,codigo_tabela_propria
  from public.tabelas_comerciais_itens where edicao_id=p_edicao_id;
  return v_nova;
end;
$$;

create or replace function public.comercial_salvar_item_edicao(p_edicao_id uuid,p_item_id uuid,p_payload jsonb)
returns uuid language plpgsql security definer set search_path=public,pg_catalog,extensions
as $$
declare v_e public.tabelas_comerciais_edicoes%rowtype; v_empresa uuid; v_id uuid; v_old jsonb; v_new jsonb; v_codigo text; v_descricao text;
begin
  if auth.uid() is null then raise exception 'COMERCIAL_AUTENTICACAO_OBRIGATORIA' using errcode='42501'; end if;
  select * into v_e from public.tabelas_comerciais_edicoes where id=p_edicao_id for update;
  if not found then raise exception 'COMERCIAL_EDICAO_NAO_LOCALIZADA'; end if;
  select empresa_id into v_empresa from public.tabelas_comerciais_fontes where id=v_e.fonte_id;
  if not public.tabelas_comerciais_pode_editar(v_empresa,null) then raise exception 'COMERCIAL_SEM_PERMISSAO_TABELA' using errcode='42501'; end if;
  if v_e.status<>'rascunho' then raise exception 'COMERCIAL_EDICAO_PUBLICADA_CRIAR_NOVA_VERSAO'; end if;
  v_codigo=nullif(btrim(p_payload->>'codigo'),''); v_descricao=nullif(btrim(p_payload->>'descricao'),'');
  if p_item_id is null then
    if v_codigo is null or v_descricao is null then raise exception 'COMERCIAL_ITEM_CODIGO_DESCRICAO_OBRIGATORIOS'; end if;
    insert into public.tabelas_comerciais_itens(
      edicao_id,codigo,descricao,valor_referencia,codigo_tuss,porte,porte_anestesico,pontos_ch,pontos_hm,pontos_sadt,
      quantidade_auxiliares,ch_anestesista,quantidade_filme,quantidade_uco,exige_autorizacao,ativo,categoria_item,
      tabela_tiss_codigo,codigo_tabela_propria,metadata
    ) values (
      p_edicao_id,v_codigo,v_descricao,coalesce((p_payload->>'valor_referencia')::numeric,0),nullif(btrim(p_payload->>'codigo_tuss'),''),
      nullif(btrim(p_payload->>'porte'),''),nullif(btrim(p_payload->>'porte_anestesico'),''),
      nullif(p_payload->>'pontos_ch','')::numeric,nullif(p_payload->>'pontos_hm','')::numeric,nullif(p_payload->>'pontos_sadt','')::numeric,
      nullif(p_payload->>'quantidade_auxiliares','')::numeric,nullif(p_payload->>'ch_anestesista','')::numeric,
      nullif(p_payload->>'quantidade_filme','')::numeric,nullif(p_payload->>'quantidade_uco','')::numeric,
      coalesce((p_payload->>'exige_autorizacao')::boolean,false),coalesce((p_payload->>'ativo')::boolean,true),
      coalesce(nullif(p_payload->>'categoria_item',''),'outro'),nullif(p_payload->>'tabela_tiss_codigo',''),
      nullif(p_payload->>'codigo_tabela_propria',''),'{}'::jsonb
    ) returning id into v_id;
  else
    select to_jsonb(i) into v_old from public.tabelas_comerciais_itens i where i.id=p_item_id and i.edicao_id=p_edicao_id for update;
    if v_old is null then raise exception 'COMERCIAL_ITEM_NAO_LOCALIZADO'; end if;
    update public.tabelas_comerciais_itens i set
      codigo=coalesce(v_codigo,i.codigo),descricao=coalesce(v_descricao,i.descricao),
      valor_referencia=case when p_payload?'valor_referencia' then coalesce(nullif(p_payload->>'valor_referencia','')::numeric,0) else i.valor_referencia end,
      codigo_tuss=case when p_payload?'codigo_tuss' then nullif(btrim(p_payload->>'codigo_tuss'),'') else i.codigo_tuss end,
      porte=case when p_payload?'porte' then nullif(btrim(p_payload->>'porte'),'') else i.porte end,
      porte_anestesico=case when p_payload?'porte_anestesico' then nullif(btrim(p_payload->>'porte_anestesico'),'') else i.porte_anestesico end,
      pontos_ch=case when p_payload?'pontos_ch' then nullif(p_payload->>'pontos_ch','')::numeric else i.pontos_ch end,
      pontos_hm=case when p_payload?'pontos_hm' then nullif(p_payload->>'pontos_hm','')::numeric else i.pontos_hm end,
      pontos_sadt=case when p_payload?'pontos_sadt' then nullif(p_payload->>'pontos_sadt','')::numeric else i.pontos_sadt end,
      quantidade_auxiliares=case when p_payload?'quantidade_auxiliares' then nullif(p_payload->>'quantidade_auxiliares','')::numeric else i.quantidade_auxiliares end,
      ch_anestesista=case when p_payload?'ch_anestesista' then nullif(p_payload->>'ch_anestesista','')::numeric else i.ch_anestesista end,
      quantidade_filme=case when p_payload?'quantidade_filme' then nullif(p_payload->>'quantidade_filme','')::numeric else i.quantidade_filme end,
      quantidade_uco=case when p_payload?'quantidade_uco' then nullif(p_payload->>'quantidade_uco','')::numeric else i.quantidade_uco end,
      exige_autorizacao=case when p_payload?'exige_autorizacao' then coalesce((p_payload->>'exige_autorizacao')::boolean,false) else i.exige_autorizacao end,
      ativo=case when p_payload?'ativo' then coalesce((p_payload->>'ativo')::boolean,true) else i.ativo end,
      categoria_item=case when p_payload?'categoria_item' then coalesce(nullif(p_payload->>'categoria_item',''),'outro') else i.categoria_item end,
      tabela_tiss_codigo=case when p_payload?'tabela_tiss_codigo' then nullif(p_payload->>'tabela_tiss_codigo','') else i.tabela_tiss_codigo end,
      codigo_tabela_propria=case when p_payload?'codigo_tabela_propria' then nullif(p_payload->>'codigo_tabela_propria','') else i.codigo_tabela_propria end
    where i.id=p_item_id returning id into v_id;
  end if;
  select to_jsonb(i) into v_new from public.tabelas_comerciais_itens i where i.id=v_id;
  insert into public.comercial_eventos(empresa_id,entidade_tipo,entidade_id,acao,antes,depois,usuario_id)
  values(v_empresa,'tabelas_comerciais_itens',v_id,case when p_item_id is null then 'insert' else 'update' end,v_old,v_new,auth.uid());
  return v_id;
end;
$$;

revoke all on function public.comercial_clonar_edicao(uuid,text,date,text) from public,anon;
revoke all on function public.comercial_salvar_item_edicao(uuid,uuid,jsonb) from public,anon;
grant execute on function public.comercial_clonar_edicao(uuid,text,date,text) to authenticated;
grant execute on function public.comercial_salvar_item_edicao(uuid,uuid,jsonb) to authenticated;
