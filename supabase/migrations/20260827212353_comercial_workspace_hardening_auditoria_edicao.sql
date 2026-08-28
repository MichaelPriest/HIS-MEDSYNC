create table if not exists public.comercial_eventos (
  id uuid primary key default extensions.gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  unidade_id uuid null references public.unidades(id),
  entidade_tipo text not null,
  entidade_id uuid not null,
  acao text not null,
  antes jsonb null,
  depois jsonb null,
  usuario_id uuid null references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_comercial_eventos_empresa_created
  on public.comercial_eventos(empresa_id, created_at desc);
create index if not exists idx_comercial_eventos_entidade
  on public.comercial_eventos(entidade_tipo, entidade_id, created_at desc);

alter table public.comercial_eventos enable row level security;
alter table public.comercial_eventos force row level security;

create or replace function public.comercial_pode_visualizar(p_empresa uuid, p_unidade uuid default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.tem_empresa(p_empresa)
    and (
      public.tem_permissao(p_empresa,p_unidade,'comercial.visualizar')
      or public.tem_permissao(p_empresa,p_unidade,'comercial.editar')
      or public.tem_permissao(p_empresa,p_unidade,'credenciamento.visualizar')
      or public.tem_permissao(p_empresa,p_unidade,'credenciamento.gerenciar')
      or public.tem_permissao(p_empresa,p_unidade,'tabelas_comerciais.visualizar')
      or public.tem_permissao(p_empresa,p_unidade,'tabelas_comerciais.gerenciar')
    )
$$;

create or replace function public.comercial_pode_editar(p_empresa uuid, p_unidade uuid default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.tem_empresa(p_empresa)
    and (
      public.tem_permissao(p_empresa,p_unidade,'comercial.editar')
      or public.tem_permissao(p_empresa,p_unidade,'credenciamento.gerenciar')
    )
$$;

create or replace function public.tabelas_comerciais_pode_editar(p_empresa uuid, p_unidade uuid default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.tem_empresa(p_empresa)
    and public.tem_permissao(p_empresa,p_unidade,'tabelas_comerciais.gerenciar')
$$;

revoke all on function public.comercial_pode_visualizar(uuid,uuid) from public,anon;
revoke all on function public.comercial_pode_editar(uuid,uuid) from public,anon;
revoke all on function public.tabelas_comerciais_pode_editar(uuid,uuid) from public,anon;
grant execute on function public.comercial_pode_visualizar(uuid,uuid) to authenticated;
grant execute on function public.comercial_pode_editar(uuid,uuid) to authenticated;
grant execute on function public.tabelas_comerciais_pode_editar(uuid,uuid) to authenticated;

drop policy if exists comercial_eventos_select on public.comercial_eventos;
create policy comercial_eventos_select on public.comercial_eventos
for select to authenticated using (public.comercial_pode_visualizar(empresa_id,unidade_id));
revoke insert,update,delete on public.comercial_eventos from authenticated,anon;
grant select on public.comercial_eventos to authenticated;

drop policy if exists credenciamento_contratos_all on public.credenciamento_contratos;
drop policy if exists credenciamento_contratos_select_funcional on public.credenciamento_contratos;
drop policy if exists credenciamento_contratos_manage_funcional on public.credenciamento_contratos;
create policy credenciamento_contratos_select_funcional on public.credenciamento_contratos
for select to authenticated using (public.comercial_pode_visualizar(empresa_id,unidade_id));
create policy credenciamento_contratos_manage_funcional on public.credenciamento_contratos
for all to authenticated using (public.comercial_pode_editar(empresa_id,unidade_id))
with check (public.comercial_pode_editar(empresa_id,unidade_id));

do $do$
declare t text;
begin
  foreach t in array array['contrato_tabelas_comerciais','contrato_regras_procedimentos','contrato_regras_faturamento','contrato_pacotes'] loop
    execute format('drop policy if exists %I on public.%I',t||'_all',t);
    execute format('drop policy if exists %I on public.%I',t||'_select_funcional',t);
    execute format('drop policy if exists %I on public.%I',t||'_manage_funcional',t);
    execute format($p$
      create policy %I on public.%I for select to authenticated using (
        exists(select 1 from public.credenciamento_contratos c
          where c.id=%I.contrato_id
            and public.comercial_pode_visualizar(c.empresa_id,c.unidade_id))
      )
    $p$,t||'_select_funcional',t,t);
    execute format($p$
      create policy %I on public.%I for all to authenticated using (
        exists(select 1 from public.credenciamento_contratos c
          where c.id=%I.contrato_id
            and (public.comercial_pode_editar(c.empresa_id,c.unidade_id)
                 or (case when %L='contrato_tabelas_comerciais' then public.tabelas_comerciais_pode_editar(c.empresa_id,c.unidade_id) else false end)))
      ) with check (
        exists(select 1 from public.credenciamento_contratos c
          where c.id=%I.contrato_id
            and (public.comercial_pode_editar(c.empresa_id,c.unidade_id)
                 or (case when %L='contrato_tabelas_comerciais' then public.tabelas_comerciais_pode_editar(c.empresa_id,c.unidade_id) else false end)))
      )
    $p$,t||'_manage_funcional',t,t,t,t,t);
  end loop;
end $do$;

drop policy if exists contrato_pacote_itens_all on public.contrato_pacote_itens;
drop policy if exists contrato_pacote_itens_select_funcional on public.contrato_pacote_itens;
drop policy if exists contrato_pacote_itens_manage_funcional on public.contrato_pacote_itens;
create policy contrato_pacote_itens_select_funcional on public.contrato_pacote_itens
for select to authenticated using (
  exists(select 1 from public.contrato_pacotes p join public.credenciamento_contratos c on c.id=p.contrato_id
    where p.id=contrato_pacote_itens.pacote_id and public.comercial_pode_visualizar(c.empresa_id,c.unidade_id))
);
create policy contrato_pacote_itens_manage_funcional on public.contrato_pacote_itens
for all to authenticated using (
  exists(select 1 from public.contrato_pacotes p join public.credenciamento_contratos c on c.id=p.contrato_id
    where p.id=contrato_pacote_itens.pacote_id and public.comercial_pode_editar(c.empresa_id,c.unidade_id))
) with check (
  exists(select 1 from public.contrato_pacotes p join public.credenciamento_contratos c on c.id=p.contrato_id
    where p.id=contrato_pacote_itens.pacote_id and public.comercial_pode_editar(c.empresa_id,c.unidade_id))
);

drop policy if exists tabelas_comerciais_fontes_all on public.tabelas_comerciais_fontes;
drop policy if exists tabelas_comerciais_fontes_select_funcional on public.tabelas_comerciais_fontes;
drop policy if exists tabelas_comerciais_fontes_manage_funcional on public.tabelas_comerciais_fontes;
create policy tabelas_comerciais_fontes_select_funcional on public.tabelas_comerciais_fontes
for select to authenticated using (public.comercial_pode_visualizar(empresa_id,null));
create policy tabelas_comerciais_fontes_manage_funcional on public.tabelas_comerciais_fontes
for all to authenticated using (public.tabelas_comerciais_pode_editar(empresa_id,null))
with check (public.tabelas_comerciais_pode_editar(empresa_id,null));

drop policy if exists tabelas_comerciais_edicoes_all on public.tabelas_comerciais_edicoes;
drop policy if exists tabelas_comerciais_edicoes_select_funcional on public.tabelas_comerciais_edicoes;
drop policy if exists tabelas_comerciais_edicoes_manage_funcional on public.tabelas_comerciais_edicoes;
create policy tabelas_comerciais_edicoes_select_funcional on public.tabelas_comerciais_edicoes
for select to authenticated using (
  exists(select 1 from public.tabelas_comerciais_fontes f where f.id=tabelas_comerciais_edicoes.fonte_id and public.comercial_pode_visualizar(f.empresa_id,null))
);
create policy tabelas_comerciais_edicoes_manage_funcional on public.tabelas_comerciais_edicoes
for all to authenticated using (
  exists(select 1 from public.tabelas_comerciais_fontes f where f.id=tabelas_comerciais_edicoes.fonte_id and public.tabelas_comerciais_pode_editar(f.empresa_id,null))
) with check (
  exists(select 1 from public.tabelas_comerciais_fontes f where f.id=tabelas_comerciais_edicoes.fonte_id and public.tabelas_comerciais_pode_editar(f.empresa_id,null))
);

drop policy if exists tabelas_comerciais_itens_all on public.tabelas_comerciais_itens;
drop policy if exists tabelas_comerciais_itens_select_funcional on public.tabelas_comerciais_itens;
drop policy if exists tabelas_comerciais_itens_manage_funcional on public.tabelas_comerciais_itens;
create policy tabelas_comerciais_itens_select_funcional on public.tabelas_comerciais_itens
for select to authenticated using (
  exists(select 1 from public.tabelas_comerciais_edicoes e join public.tabelas_comerciais_fontes f on f.id=e.fonte_id
    where e.id=tabelas_comerciais_itens.edicao_id and public.comercial_pode_visualizar(f.empresa_id,null))
);
create policy tabelas_comerciais_itens_manage_funcional on public.tabelas_comerciais_itens
for all to authenticated using (
  exists(select 1 from public.tabelas_comerciais_edicoes e join public.tabelas_comerciais_fontes f on f.id=e.fonte_id
    where e.id=tabelas_comerciais_itens.edicao_id and public.tabelas_comerciais_pode_editar(f.empresa_id,null))
) with check (
  exists(select 1 from public.tabelas_comerciais_edicoes e join public.tabelas_comerciais_fontes f on f.id=e.fonte_id
    where e.id=tabelas_comerciais_itens.edicao_id and public.tabelas_comerciais_pode_editar(f.empresa_id,null))
);

insert into public.perfil_permissoes(perfil_id,permissao_id)
select pf.id,pe.id
from public.perfis pf
cross join public.permissoes pe
where pf.setor_chave='comercial' and pf.ativo
  and pe.ativo
  and pe.codigo in ('comercial.visualizar','comercial.editar','credenciamento.visualizar','credenciamento.gerenciar','tabelas_comerciais.visualizar','tabelas_comerciais.gerenciar')
on conflict do nothing;

create or replace function public.audit_comercial_mutacao()
returns trigger
language plpgsql
security definer
set search_path=public,pg_catalog,extensions
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_ref jsonb;
  v_empresa uuid;
  v_unidade uuid;
  v_entidade uuid;
begin
  v_old:=case when tg_op<>'INSERT' then to_jsonb(old) else null end;
  v_new:=case when tg_op<>'DELETE' then to_jsonb(new) else null end;
  v_ref:=coalesce(v_new,v_old);
  v_entidade:=(v_ref->>'id')::uuid;

  if tg_table_name='credenciamento_contratos' then
    v_empresa:=(v_ref->>'empresa_id')::uuid;
    v_unidade:=nullif(v_ref->>'unidade_id','')::uuid;
  elsif tg_table_name='tabelas_comerciais_fontes' then
    v_empresa:=(v_ref->>'empresa_id')::uuid;
  elsif tg_table_name='tabelas_comerciais_edicoes' then
    select f.empresa_id into v_empresa from public.tabelas_comerciais_fontes f where f.id=(v_ref->>'fonte_id')::uuid;
  elsif tg_table_name in ('contrato_tabelas_comerciais','contrato_regras_procedimentos','contrato_regras_faturamento','contrato_pacotes') then
    select c.empresa_id,c.unidade_id into v_empresa,v_unidade from public.credenciamento_contratos c where c.id=(v_ref->>'contrato_id')::uuid;
  elsif tg_table_name='contrato_pacote_itens' then
    select c.empresa_id,c.unidade_id into v_empresa,v_unidade
    from public.contrato_pacotes p join public.credenciamento_contratos c on c.id=p.contrato_id
    where p.id=(v_ref->>'pacote_id')::uuid;
  else
    return coalesce(new,old);
  end if;

  if v_empresa is not null then
    insert into public.comercial_eventos(empresa_id,unidade_id,entidade_tipo,entidade_id,acao,antes,depois,usuario_id)
    values(v_empresa,v_unidade,tg_table_name,v_entidade,lower(tg_op),v_old,v_new,auth.uid());
  end if;
  return coalesce(new,old);
end
$$;
revoke execute on function public.audit_comercial_mutacao() from public,anon,authenticated;

do $do$
declare t text;
begin
  foreach t in array array['credenciamento_contratos','contrato_tabelas_comerciais','contrato_regras_procedimentos','contrato_regras_faturamento','contrato_pacotes','contrato_pacote_itens','tabelas_comerciais_fontes','tabelas_comerciais_edicoes'] loop
    execute format('drop trigger if exists trg_audit_comercial on public.%I',t);
    execute format('create trigger trg_audit_comercial after insert or update or delete on public.%I for each row execute function public.audit_comercial_mutacao()',t);
  end loop;
end $do$;

create or replace function public.comercial_atualizar_contrato(
  p_contrato_id uuid,
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
) returns uuid
language plpgsql
security definer
set search_path=public,pg_catalog
as $$
declare v_c public.credenciamento_contratos%rowtype;
begin
  if auth.uid() is null then raise exception 'COMERCIAL_AUTENTICACAO_OBRIGATORIA' using errcode='42501'; end if;
  select * into v_c from public.credenciamento_contratos where id=p_contrato_id for update;
  if not found then raise exception 'COMERCIAL_CONTRATO_NAO_LOCALIZADO'; end if;
  if not public.comercial_pode_editar(v_c.empresa_id,v_c.unidade_id) then raise exception 'COMERCIAL_SEM_PERMISSAO_EDITAR' using errcode='42501'; end if;
  if p_data_inicio is not null and p_data_fim is not null and p_data_fim<p_data_inicio then raise exception 'COMERCIAL_VIGENCIA_INVALIDA'; end if;
  update public.credenciamento_contratos set
    numero_contrato=nullif(btrim(p_numero_contrato),''),status=p_status,
    data_inicio=p_data_inicio,data_fim=p_data_fim,prazo_pagamento_dias=p_prazo_pagamento_dias,
    reajuste_indice=nullif(btrim(p_reajuste_indice),''),data_base_reajuste=nullif(btrim(p_data_base_reajuste),''),
    contato_comercial=nullif(btrim(p_contato_comercial),''),email_comercial=nullif(btrim(p_email_comercial),''),
    observacoes=nullif(btrim(p_observacoes),''),updated_at=now(),updated_by=auth.uid()
  where id=p_contrato_id;
  return p_contrato_id;
end
$$;

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
) returns uuid
language plpgsql
security definer
set search_path=public,pg_catalog
as $$
declare v_v public.contrato_tabelas_comerciais%rowtype; v_c public.credenciamento_contratos%rowtype;
begin
  if auth.uid() is null then raise exception 'COMERCIAL_AUTENTICACAO_OBRIGATORIA' using errcode='42501'; end if;
  select * into v_v from public.contrato_tabelas_comerciais where id=p_vinculo_id for update;
  if not found then raise exception 'COMERCIAL_VINCULO_NAO_LOCALIZADO'; end if;
  select * into v_c from public.credenciamento_contratos where id=v_v.contrato_id;
  if not (public.comercial_pode_editar(v_c.empresa_id,v_c.unidade_id) or public.tabelas_comerciais_pode_editar(v_c.empresa_id,v_c.unidade_id)) then raise exception 'COMERCIAL_SEM_PERMISSAO_EDITAR' using errcode='42501'; end if;
  if p_modo_edicao='edicao_fixa' and p_edicao_fixa_id is null then raise exception 'COMERCIAL_EDICAO_FIXA_OBRIGATORIA'; end if;
  if p_edicao_fixa_id is not null and not exists(select 1 from public.tabelas_comerciais_edicoes e where e.id=p_edicao_fixa_id and e.fonte_id=v_v.fonte_id) then raise exception 'COMERCIAL_EDICAO_INCOMPATIVEL'; end if;
  update public.contrato_tabelas_comerciais set
    modo_edicao=p_modo_edicao,edicao_fixa_id=case when p_modo_edicao='edicao_fixa' then p_edicao_fixa_id else null end,
    percentual_ajuste=coalesce(p_percentual_ajuste,0),valor_ch=p_valor_ch,valor_hm=p_valor_hm,valor_sadt=p_valor_sadt,
    valor_uco_contratual=p_valor_uco,prioridade=coalesce(p_prioridade,100),
    regras_adicionais=jsonb_build_object('urgencia_percentual',coalesce(p_urgencia_percentual,0),'apartamento_percentual',coalesce(p_apartamento_percentual,0),'horario_especial_regra',nullif(btrim(p_horario_especial_regra),'')),
    arredondamento_casas=coalesce(p_arredondamento_casas,2),ativo=coalesce(p_ativo,true),observacoes=nullif(btrim(p_observacoes),'')
  where id=p_vinculo_id;
  return p_vinculo_id;
end
$$;

create or replace function public.comercial_clonar_edicao(
  p_edicao_id uuid,
  p_nome_edicao text,
  p_vigencia_inicio date,
  p_observacoes text default null
) returns uuid
language plpgsql
security definer
set search_path=public,pg_catalog,extensions
as $$
declare v_e public.tabelas_comerciais_edicoes%rowtype; v_empresa uuid; v_nova uuid;
begin
  if auth.uid() is null then raise exception 'COMERCIAL_AUTENTICACAO_OBRIGATORIA' using errcode='42501'; end if;
  select e.* into v_e from public.tabelas_comerciais_edicoes e where e.id=p_edicao_id for update;
  if not found then raise exception 'COMERCIAL_EDICAO_NAO_LOCALIZADA'; end if;
  select f.empresa_id into v_empresa from public.tabelas_comerciais_fontes f where f.id=v_e.fonte_id;
  if not public.tabelas_comerciais_pode_editar(v_empresa,null) then raise exception 'COMERCIAL_SEM_PERMISSAO_TABELA' using errcode='42501'; end if;
  if coalesce(btrim(p_nome_edicao),'')='' or p_vigencia_inicio is null then raise exception 'COMERCIAL_NOVA_EDICAO_DADOS_OBRIGATORIOS'; end if;

  insert into public.tabelas_comerciais_edicoes(fonte_id,convenio_id,nome_edicao,referencia,data_publicacao,vigencia_inicio,vigencia_fim,status,metodo_calculo,valor_uco,moeda,origem_arquivo,hash_arquivo,observacoes,created_by)
  values(v_e.fonte_id,v_e.convenio_id,btrim(p_nome_edicao),v_e.referencia,null,p_vigencia_inicio,null,'rascunho',v_e.metodo_calculo,v_e.valor_uco,v_e.moeda,null,null,coalesce(nullif(btrim(p_observacoes),''),'Nova versão criada a partir de '||v_e.nome_edicao),auth.uid())
  returning id into v_nova;

  insert into public.tabelas_comerciais_itens(edicao_id,codigo,codigo_fabricante,codigo_anvisa,codigo_tuss,descricao,fabricante,apresentacao,unidade,valor_fabrica,valor_referencia,valor_maximo,percentual_acrescimo,regra_preco,exige_autorizacao,pontos_ch,pontos_hm,pontos_sadt,porte,quantidade_uco,porte_anestesico,codigo_auxiliar,ativo,metadata,item_assistencial_id,categoria_item,tabela_tiss_codigo,familia_tuss,codigo_brasindice,codigo_simpro,ean,ggrem,valor_pmc,icms_percentual,tipo_lista_cmed,codigo_tabela_propria)
  select v_nova,codigo,codigo_fabricante,codigo_anvisa,codigo_tuss,descricao,fabricante,apresentacao,unidade,valor_fabrica,valor_referencia,valor_maximo,percentual_acrescimo,regra_preco,exige_autorizacao,pontos_ch,pontos_hm,pontos_sadt,porte,quantidade_uco,porte_anestesico,codigo_auxiliar,ativo,metadata,item_assistencial_id,categoria_item,tabela_tiss_codigo,familia_tuss,codigo_brasindice,codigo_simpro,ean,ggrem,valor_pmc,icms_percentual,tipo_lista_cmed,codigo_tabela_propria
  from public.tabelas_comerciais_itens where edicao_id=p_edicao_id;
  return v_nova;
end
$$;

create or replace function public.comercial_salvar_item_edicao(
  p_edicao_id uuid,
  p_item_id uuid,
  p_payload jsonb
) returns uuid
language plpgsql
security definer
set search_path=public,pg_catalog,extensions
as $$
declare
  v_e public.tabelas_comerciais_edicoes%rowtype;
  v_empresa uuid;
  v_id uuid;
  v_old jsonb;
  v_new jsonb;
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
    insert into public.tabelas_comerciais_itens(edicao_id,codigo,descricao,valor_referencia,codigo_tuss,porte,porte_anestesico,pontos_ch,pontos_hm,pontos_sadt,quantidade_uco,exige_autorizacao,ativo,categoria_item,tabela_tiss_codigo,codigo_tabela_propria,metadata)
    values(p_edicao_id,v_codigo,v_descricao,coalesce((p_payload->>'valor_referencia')::numeric,0),nullif(btrim(p_payload->>'codigo_tuss'),''),nullif(btrim(p_payload->>'porte'),''),nullif(btrim(p_payload->>'porte_anestesico'),''),nullif(p_payload->>'pontos_ch','')::numeric,nullif(p_payload->>'pontos_hm','')::numeric,nullif(p_payload->>'pontos_sadt','')::numeric,nullif(p_payload->>'quantidade_uco','')::numeric,coalesce((p_payload->>'exige_autorizacao')::boolean,false),coalesce((p_payload->>'ativo')::boolean,true),coalesce(nullif(p_payload->>'categoria_item',''),'outro'),nullif(p_payload->>'tabela_tiss_codigo',''),nullif(p_payload->>'codigo_tabela_propria',''),'{}'::jsonb)
    returning id into v_id;
    select to_jsonb(i) into v_new from public.tabelas_comerciais_itens i where i.id=v_id;
  else
    select to_jsonb(i) into v_old from public.tabelas_comerciais_itens i where i.id=p_item_id and i.edicao_id=p_edicao_id for update;
    if v_old is null then raise exception 'COMERCIAL_ITEM_NAO_LOCALIZADO'; end if;
    update public.tabelas_comerciais_itens i set
      codigo=coalesce(v_codigo,i.codigo),descricao=coalesce(v_descricao,i.descricao),
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
    where i.id=p_item_id returning i.id into v_id;
    select to_jsonb(i) into v_new from public.tabelas_comerciais_itens i where i.id=v_id;
  end if;

  insert into public.comercial_eventos(empresa_id,entidade_tipo,entidade_id,acao,antes,depois,usuario_id)
  values(v_empresa,'tabelas_comerciais_itens',v_id,case when p_item_id is null then 'insert' else 'update' end,v_old,v_new,auth.uid());
  return v_id;
end
$$;

create or replace function public.comercial_publicar_edicao(p_edicao_id uuid)
returns uuid
language plpgsql
security definer
set search_path=public,pg_catalog
as $$
declare v_e public.tabelas_comerciais_edicoes%rowtype; v_empresa uuid; v_qtd bigint;
begin
  if auth.uid() is null then raise exception 'COMERCIAL_AUTENTICACAO_OBRIGATORIA' using errcode='42501'; end if;
  select * into v_e from public.tabelas_comerciais_edicoes where id=p_edicao_id for update;
  if not found then raise exception 'COMERCIAL_EDICAO_NAO_LOCALIZADA'; end if;
  select f.empresa_id into v_empresa from public.tabelas_comerciais_fontes f where f.id=v_e.fonte_id;
  if not public.tabelas_comerciais_pode_editar(v_empresa,null) then raise exception 'COMERCIAL_SEM_PERMISSAO_TABELA' using errcode='42501'; end if;
  if v_e.status<>'rascunho' then raise exception 'COMERCIAL_EDICAO_NAO_E_RASCUNHO'; end if;
  select count(*) into v_qtd from public.tabelas_comerciais_itens where edicao_id=p_edicao_id and ativo;
  if v_qtd=0 then raise exception 'COMERCIAL_EDICAO_SEM_ITENS'; end if;

  update public.tabelas_comerciais_edicoes
  set status='encerrada',vigencia_fim=case when vigencia_inicio<v_e.vigencia_inicio then v_e.vigencia_inicio-1 else vigencia_fim end
  where fonte_id=v_e.fonte_id and id<>v_e.id and status='vigente'
    and convenio_id is not distinct from v_e.convenio_id and vigencia_inicio<=v_e.vigencia_inicio;
  update public.tabelas_comerciais_edicoes set status='vigente',data_publicacao=current_date where id=p_edicao_id;
  return p_edicao_id;
end
$$;

revoke all on function public.comercial_atualizar_contrato(uuid,text,text,date,date,integer,text,text,text,text,text) from public,anon;
revoke all on function public.comercial_salvar_negociacao_tabela(uuid,text,uuid,numeric,numeric,numeric,numeric,numeric,integer,numeric,numeric,text,integer,boolean,text) from public,anon;
revoke all on function public.comercial_clonar_edicao(uuid,text,date,text) from public,anon;
revoke all on function public.comercial_salvar_item_edicao(uuid,uuid,jsonb) from public,anon;
revoke all on function public.comercial_publicar_edicao(uuid) from public,anon;
grant execute on function public.comercial_atualizar_contrato(uuid,text,text,date,date,integer,text,text,text,text,text) to authenticated;
grant execute on function public.comercial_salvar_negociacao_tabela(uuid,text,uuid,numeric,numeric,numeric,numeric,numeric,integer,numeric,numeric,text,integer,boolean,text) to authenticated;
grant execute on function public.comercial_clonar_edicao(uuid,text,date,text) to authenticated;
grant execute on function public.comercial_salvar_item_edicao(uuid,uuid,jsonb) to authenticated;
grant execute on function public.comercial_publicar_edicao(uuid) to authenticated;
