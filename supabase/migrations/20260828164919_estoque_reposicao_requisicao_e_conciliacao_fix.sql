-- Corrige saldo final de inventário e fecha o ciclo de reposição por local.

create or replace function public.concluir_inventario_estoque(p_inventario_id uuid,p_observacoes text default null)
returns integer
language plpgsql
security definer
set search_path to 'public','pg_catalog'
as $function$
declare
  v_inv public.estoque_inventarios%rowtype;
  v_item record;
  v_lote public.estoque_lotes%rowtype;
  v_delta numeric;
  v_mov uuid;
  v_ajustes integer:=0;
begin
  if auth.uid() is null then raise exception 'USUARIO_NAO_AUTENTICADO' using errcode='42501'; end if;
  select * into v_inv from public.estoque_inventarios where id=p_inventario_id for update;
  if v_inv.id is null then raise exception 'INVENTARIO_NAO_ENCONTRADO'; end if;
  if not public.tem_unidade(v_inv.empresa_id,v_inv.unidade_id) then raise exception 'INVENTARIO_FORA_ESCOPO' using errcode='42501'; end if;
  if not (public.tem_permissao(v_inv.empresa_id,v_inv.unidade_id,'estoque.inventariar') or public.tem_permissao(v_inv.empresa_id,v_inv.unidade_id,'estoque.gerenciar')) then raise exception 'SEM_PERMISSAO_INVENTARIAR' using errcode='42501'; end if;
  if v_inv.status not in ('aberto','em_contagem') then raise exception 'INVENTARIO_NAO_CONCILIAVEL'; end if;
  if exists(select 1 from public.estoque_inventario_itens x where x.inventario_id=v_inv.id and x.quantidade_contada is null) then raise exception 'INVENTARIO_COM_ITENS_NAO_CONTADOS'; end if;

  for v_item in select * from public.estoque_inventario_itens x where x.inventario_id=v_inv.id order by x.id loop
    select * into v_lote from public.estoque_lotes l where l.id=v_item.lote_id for update;
    if v_lote.id is null or v_lote.empresa_id<>v_inv.empresa_id or v_lote.unidade_id<>v_inv.unidade_id or v_lote.local_id<>v_inv.local_id then raise exception 'LOTE_INVENTARIO_INVALIDO'; end if;
    v_delta:=v_item.quantidade_contada-v_lote.quantidade;
    v_mov:=null;
    if v_delta<>0 then
      update public.estoque_lotes set quantidade=v_item.quantidade_contada,updated_at=now() where id=v_lote.id;
      insert into public.estoque_movimentos(empresa_id,unidade_id,produto_id,lote_id,local_origem_id,local_destino_id,tipo,quantidade,custo_unitario,motivo,inventario_id,inventario_item_id,created_at,created_by)
      values(v_inv.empresa_id,v_inv.unidade_id,v_lote.produto_id,v_lote.id,case when v_delta<0 then v_inv.local_id else null end,case when v_delta>0 then v_inv.local_id else null end,'ajuste_inventario',abs(v_delta),v_lote.custo_unitario,'Conciliação do inventário '||v_inv.numero,v_inv.id,v_item.id,now(),auth.uid()) returning id into v_mov;
      v_ajustes:=v_ajustes+1;
    end if;
    update public.estoque_inventario_itens
      set saldo_sistema_final=v_item.quantidade_contada,divergencia=v_delta,ajuste_movimento_id=v_mov,updated_at=now()
      where id=v_item.id;
  end loop;

  update public.estoque_inventarios set status='conciliado',observacoes=nullif(trim(coalesce(p_observacoes,'')),''),finalizado_em=now(),updated_at=now(),updated_by=auth.uid() where id=v_inv.id;
  return v_ajustes;
end;
$function$;

create or replace function public.cancelar_inventario_estoque(p_inventario_id uuid,p_motivo text)
returns void
language plpgsql
security definer
set search_path to 'public','pg_catalog'
as $function$
declare
  v_inv public.estoque_inventarios%rowtype;
begin
  if auth.uid() is null then raise exception 'USUARIO_NAO_AUTENTICADO' using errcode='42501'; end if;
  select * into v_inv from public.estoque_inventarios where id=p_inventario_id for update;
  if v_inv.id is null then raise exception 'INVENTARIO_NAO_ENCONTRADO'; end if;
  if not public.tem_unidade(v_inv.empresa_id,v_inv.unidade_id) then raise exception 'INVENTARIO_FORA_ESCOPO' using errcode='42501'; end if;
  if not (public.tem_permissao(v_inv.empresa_id,v_inv.unidade_id,'estoque.inventariar') or public.tem_permissao(v_inv.empresa_id,v_inv.unidade_id,'estoque.gerenciar')) then raise exception 'SEM_PERMISSAO_INVENTARIAR' using errcode='42501'; end if;
  if v_inv.status not in ('aberto','em_contagem') then raise exception 'INVENTARIO_NAO_CANCELAVEL'; end if;
  if nullif(trim(coalesce(p_motivo,'')),'') is null then raise exception 'MOTIVO_CANCELAMENTO_OBRIGATORIO'; end if;
  update public.estoque_inventarios
     set status='cancelado',observacoes=trim(p_motivo),finalizado_em=now(),updated_at=now(),updated_by=auth.uid()
   where id=v_inv.id;
end;
$function$;

create or replace function public.listar_necessidades_reposicao_estoque(p_local_id uuid default null)
returns table(
  empresa_id uuid,
  unidade_id uuid,
  local_id uuid,
  local_nome text,
  produto_id uuid,
  produto_codigo text,
  produto_descricao text,
  unidade_medida text,
  saldo_fisico numeric,
  saldo_disponivel numeric,
  quantidade_em_requisicoes numeric,
  saldo_projetado numeric,
  estoque_minimo numeric,
  ponto_reposicao numeric,
  estoque_maximo numeric,
  quantidade_sugerida numeric
)
language plpgsql
security definer
set search_path to 'public','pg_catalog'
as $function$
begin
  if auth.uid() is null then raise exception 'USUARIO_NAO_AUTENTICADO' using errcode='42501'; end if;

  return query
  with saldos as (
    select
      prm.empresa_id,
      prm.unidade_id,
      prm.local_id,
      loc.nome as local_nome,
      prm.produto_id,
      prod.codigo as produto_codigo,
      prod.descricao as produto_descricao,
      prod.unidade_medida,
      prm.estoque_minimo,
      prm.ponto_reposicao,
      prm.estoque_maximo,
      coalesce(sum(l.quantidade),0)::numeric as saldo_fisico,
      coalesce(sum(case when l.status='disponivel' and (l.validade is null or l.validade>=current_date) then l.quantidade else 0 end),0)::numeric as saldo_disponivel
    from public.estoque_parametros_local prm
    join public.estoque_locais loc on loc.id=prm.local_id and loc.ativo=true
    join public.estoque_produtos prod on prod.id=prm.produto_id and prod.ativo=true
    left join public.estoque_lotes l on l.empresa_id=prm.empresa_id and l.unidade_id=prm.unidade_id and l.local_id=prm.local_id and l.produto_id=prm.produto_id
    where prm.ativo=true
      and (p_local_id is null or prm.local_id=p_local_id)
      and public.tem_unidade(prm.empresa_id,prm.unidade_id)
      and (
        public.tem_permissao(prm.empresa_id,prm.unidade_id,'estoque.visualizar') or
        public.tem_permissao(prm.empresa_id,prm.unidade_id,'estoque.movimentar') or
        public.tem_permissao(prm.empresa_id,prm.unidade_id,'estoque.gerenciar') or
        public.tem_permissao(prm.empresa_id,prm.unidade_id,'almoxarifado.atender') or
        public.tem_permissao(prm.empresa_id,prm.unidade_id,'almoxarifado.requisitar')
      )
    group by prm.empresa_id,prm.unidade_id,prm.local_id,loc.nome,prm.produto_id,prod.codigo,prod.descricao,prod.unidade_medida,prm.estoque_minimo,prm.ponto_reposicao,prm.estoque_maximo
  ), abertos as (
    select r.empresa_id,r.unidade_id,r.local_destino_id as local_id,i.produto_id,
           coalesce(sum(greatest(coalesce(i.quantidade_aprovada,i.quantidade_solicitada)-coalesce(i.quantidade_atendida,0),0)),0)::numeric as quantidade_em_requisicoes
    from public.estoque_requisicoes_setoriais r
    join public.estoque_requisicao_setorial_itens i on i.requisicao_id=r.id
    where r.status not in ('recebida','cancelada')
      and i.status not in ('atendido','cancelado')
    group by r.empresa_id,r.unidade_id,r.local_destino_id,i.produto_id
  )
  select
    s.empresa_id,s.unidade_id,s.local_id,s.local_nome,s.produto_id,s.produto_codigo,s.produto_descricao,s.unidade_medida,
    s.saldo_fisico,s.saldo_disponivel,coalesce(a.quantidade_em_requisicoes,0)::numeric,
    (s.saldo_disponivel+coalesce(a.quantidade_em_requisicoes,0))::numeric as saldo_projetado,
    s.estoque_minimo,s.ponto_reposicao,s.estoque_maximo,
    greatest(s.estoque_maximo-(s.saldo_disponivel+coalesce(a.quantidade_em_requisicoes,0)),0)::numeric as quantidade_sugerida
  from saldos s
  left join abertos a on a.empresa_id=s.empresa_id and a.unidade_id=s.unidade_id and a.local_id=s.local_id and a.produto_id=s.produto_id
  where s.estoque_maximo>0
    and (s.saldo_disponivel+coalesce(a.quantidade_em_requisicoes,0))<=s.ponto_reposicao
    and greatest(s.estoque_maximo-(s.saldo_disponivel+coalesce(a.quantidade_em_requisicoes,0)),0)>0
  order by s.local_nome,s.produto_descricao;
end;
$function$;

create or replace function public.gerar_requisicao_reposicao_estoque(
  p_local_destino_id uuid,
  p_itens jsonb,
  p_justificativa text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public','pg_catalog'
as $function$
declare
  v_local public.estoque_locais%rowtype;
  v_id uuid;
  v_numero text;
  v_prof uuid;
  v_item jsonb;
  v_produto_id uuid;
  v_qtd numeric;
  v_unidade text;
  v_sugerida numeric;
  v_itens integer:=0;
begin
  if auth.uid() is null then raise exception 'USUARIO_NAO_AUTENTICADO' using errcode='42501'; end if;
  if p_itens is null or jsonb_typeof(p_itens)<>'array' or jsonb_array_length(p_itens)=0 then raise exception 'REPOSICAO_SEM_ITENS'; end if;

  select * into v_local from public.estoque_locais where id=p_local_destino_id and ativo=true;
  if v_local.id is null then raise exception 'LOCAL_DESTINO_INVALIDO'; end if;
  if not public.tem_unidade(v_local.empresa_id,v_local.unidade_id) then raise exception 'LOCAL_DESTINO_FORA_ESCOPO' using errcode='42501'; end if;
  if not (public.tem_permissao(v_local.empresa_id,v_local.unidade_id,'estoque.gerenciar') or public.tem_permissao(v_local.empresa_id,v_local.unidade_id,'almoxarifado.requisitar')) then raise exception 'SEM_PERMISSAO_GERAR_REPOSICAO' using errcode='42501'; end if;

  v_prof:=public.profissional_logado(v_local.empresa_id);
  v_numero:='REP-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISS')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,4));
  insert into public.estoque_requisicoes_setoriais(empresa_id,unidade_id,numero,setor_id,local_destino_id,solicitante_id,prioridade,justificativa,status,created_by,updated_by)
  values(v_local.empresa_id,v_local.unidade_id,v_numero,v_local.setor_id,v_local.id,v_prof,'normal',coalesce(nullif(trim(coalesce(p_justificativa,'')),''),'Reposição por estoque mínimo/máximo'),'solicitada',auth.uid(),auth.uid())
  returning id into v_id;

  for v_item in select value from jsonb_array_elements(p_itens) loop
    if nullif(v_item->>'produto_id','') is null or nullif(v_item->>'quantidade','') is null then continue; end if;
    v_produto_id:=(v_item->>'produto_id')::uuid;
    v_qtd:=(v_item->>'quantidade')::numeric;
    if v_qtd<=0 then continue; end if;

    select n.quantidade_sugerida,n.unidade_medida into v_sugerida,v_unidade
      from public.listar_necessidades_reposicao_estoque(v_local.id) n
     where n.produto_id=v_produto_id;
    if not found then raise exception 'ITEM_SEM_NECESSIDADE_REPOSICAO'; end if;
    if v_qtd>v_sugerida then raise exception 'QUANTIDADE_REPOSICAO_ACIMA_NECESSIDADE'; end if;

    insert into public.estoque_requisicao_setorial_itens(requisicao_id,produto_id,quantidade_solicitada,unidade_medida,observacoes,status,created_by,updated_by)
    values(v_id,v_produto_id,v_qtd,v_unidade,'Gerada pela reposição mínimo/máximo','pendente',auth.uid(),auth.uid());
    v_itens:=v_itens+1;
  end loop;

  if v_itens=0 then
    delete from public.estoque_requisicoes_setoriais where id=v_id;
    raise exception 'REPOSICAO_SEM_ITENS_VALIDOS';
  end if;

  insert into public.estoque_requisicao_setorial_eventos(requisicao_id,evento,detalhe,profissional_id,usuario_id)
  values(v_id,'solicitada',jsonb_build_object('origem','reposicao_estoque','local_destino_id',v_local.id,'itens',v_itens),v_prof,auth.uid());
  return v_id;
end;
$function$;

revoke all on function public.cancelar_inventario_estoque(uuid,text) from public,anon;
grant execute on function public.cancelar_inventario_estoque(uuid,text) to authenticated;
revoke all on function public.listar_necessidades_reposicao_estoque(uuid) from public,anon;
grant execute on function public.listar_necessidades_reposicao_estoque(uuid) to authenticated;
revoke all on function public.gerar_requisicao_reposicao_estoque(uuid,jsonb,text) from public,anon;
grant execute on function public.gerar_requisicao_reposicao_estoque(uuid,jsonb,text) to authenticated;
