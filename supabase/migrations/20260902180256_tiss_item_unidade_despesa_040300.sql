alter table public.tiss_guia_itens add column if not exists unidade_medida_tiss text;
alter table public.tiss_guia_itens drop constraint if exists tiss_guia_itens_unidade_medida_040300_check;
alter table public.tiss_guia_itens add constraint tiss_guia_itens_unidade_medida_040300_check check (unidade_medida_tiss is null or unidade_medida_tiss ~ '^[0-9]{3}$');

create or replace function public.validar_guia_tiss_040300_completa(p_guia_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_base jsonb;
  v_com jsonb;
  v_guia public.tiss_guias%rowtype;
  v_user uuid := auth.uid();
  v_erros integer := 0;
  v_alertas integer := 0;
  v_status text;
begin
  v_base := public.validar_guia_tiss_internal(p_guia_id);
  select * into v_guia from public.tiss_guias where id=p_guia_id;
  if not found then raise exception 'TISS_GUIA_NAO_LOCALIZADA' using errcode='P0002'; end if;
  if v_guia.status not in ('rascunho','pronta') then return v_base; end if;

  v_com := public.validar_guia_tiss_comunicacao_040300_internal(p_guia_id);
  select * into v_guia from public.tiss_guias where id=p_guia_id;
  delete from public.tiss_guia_criticas where guia_id=p_guia_id and not resolvida and (codigo like 'XSD040300-SADT-SOL-%' or codigo='XSD040300-ITEM-UNIDADE');

  if v_guia.tipo_guia='sp_sadt' then
    if nullif(btrim(coalesce(v_guia.solicitante_codigo_prestador_snapshot,'')),'') is null and length(regexp_replace(coalesce(v_guia.solicitante_cnpj_snapshot,''),'\D','','g'))<>14 then
      insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by) values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'XSD040300-SADT-SOL-PREST','erro','solicitante_codigo_prestador_snapshot','Informe o código do prestador solicitante na operadora ou o CNPJ do contratado solicitante.',v_user);
    end if;
    if nullif(btrim(coalesce(v_guia.solicitante_nome_contratado_snapshot,'')),'') is null then
      insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by) values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'XSD040300-SADT-SOL-NOME','erro','solicitante_nome_contratado_snapshot','Informe o nome do contratado solicitante da guia SP/SADT.',v_user);
    end if;
    if nullif(btrim(coalesce(v_guia.solicitante_codigo_conselho_ans_snapshot,'')),'') is null or nullif(btrim(coalesce(v_guia.solicitante_numero_conselho_snapshot,'')),'') is null or nullif(btrim(coalesce(v_guia.solicitante_uf_conselho_snapshot,'')),'') is null or nullif(btrim(coalesce(v_guia.solicitante_cbo_snapshot,'')),'') is null or v_guia.solicitante_cbo_snapshot !~ '^[0-9]{6}$' then
      insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by) values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'XSD040300-SADT-SOL-PROF','erro','solicitante_profissional','Conselho ANS, número, UF e CBO do profissional solicitante devem estar completos.',v_user);
    end if;
  end if;

  insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,item_id,codigo,severidade,campo,mensagem,created_by)
  select v_guia.empresa_id,v_guia.unidade_id,v_guia.id,gi.id,'XSD040300-ITEM-UNIDADE','erro','unidade_medida_tiss','Informe a unidade de medida TISS de 3 dígitos para esta despesa.',v_user
    from public.tiss_guia_itens gi
   where gi.guia_id=v_guia.id
     and gi.origem_tipo in ('medicamento','material','opme','taxa','diaria','gas_medicinal')
     and nullif(btrim(coalesce(gi.unidade_medida_tiss,'')),'') is null;

  select count(*) filter (where severidade='erro')::integer,count(*) filter (where severidade='alerta')::integer
    into v_erros,v_alertas from public.tiss_guia_criticas where guia_id=p_guia_id and not resolvida;
  v_status := case when coalesce(v_erros,0)=0 then 'pronta' else 'rascunho' end;
  update public.tiss_guias set status=v_status,validado_em=now(),validado_por=v_user,updated_at=now(),updated_by=v_user where id=p_guia_id and status in ('rascunho','pronta');
  return jsonb_build_object('guia_id',p_guia_id,'status',v_status,'preservada',false,'erros',coalesce(v_erros,0),'alertas',coalesce(v_alertas,0),'comunicacao',v_com);
end
$function$;

create or replace function public.salvar_item_complemento_tiss_040300_operacional(p_guia_id uuid,p_item_id uuid,p_unidade_medida text default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user uuid:=auth.uid();
  v_guia public.tiss_guias%rowtype;
  v_item public.tiss_guia_itens%rowtype;
  v_unidade text:=nullif(btrim(coalesce(p_unidade_medida,'')),'');
begin
  if v_user is null then raise exception 'TISS_GUIA_NAO_AUTENTICADO' using errcode='42501'; end if;
  select * into v_guia from public.tiss_guias where id=p_guia_id for update;
  if not found then raise exception 'TISS_GUIA_NAO_LOCALIZADA' using errcode='P0002'; end if;
  if not public.tem_unidade(v_guia.empresa_id,v_guia.unidade_id) or not public.tem_permissao(v_guia.empresa_id,v_guia.unidade_id,'tiss.gerar') then raise exception 'TISS_GUIA_SEM_PERMISSAO' using errcode='42501'; end if;
  if v_guia.status not in ('rascunho','pronta') then raise exception 'TISS_GUIA_NAO_EDITAVEL'; end if;
  if v_unidade is not null and v_unidade !~ '^[0-9]{3}$' then raise exception 'TISS_UNIDADE_MEDIDA_INVALIDA'; end if;
  select * into v_item from public.tiss_guia_itens where id=p_item_id and guia_id=p_guia_id;
  if not found then raise exception 'TISS_ITEM_NAO_LOCALIZADO' using errcode='P0002'; end if;
  update public.tiss_guia_itens set unidade_medida_tiss=v_unidade where id=v_item.id;
  return public.validar_guia_tiss_040300_completa(p_guia_id);
end
$function$;
revoke all on function public.salvar_item_complemento_tiss_040300_operacional(uuid,uuid,text) from public,anon;
grant execute on function public.salvar_item_complemento_tiss_040300_operacional(uuid,uuid,text) to authenticated;
