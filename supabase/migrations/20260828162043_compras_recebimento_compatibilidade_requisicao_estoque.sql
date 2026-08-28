-- Mantém requisições setoriais compatíveis com a identidade única de lote.
-- Ao transferir o mesmo lote físico para um destino que já o possui, consolida saldo e custo médio.

create or replace function public.atender_requisicao_setorial_item(p_item_id uuid, p_estoque_lote_id uuid, p_quantidade numeric)
returns uuid
language plpgsql
security definer
set search_path to 'public','pg_catalog'
as $function$
declare
  v_item record;
  v_req record;
  v_lote record;
  v_dest_lote uuid;
  v_dest_quantidade numeric;
  v_dest_custo numeric;
  v_mov uuid;
  v_prof uuid;
  v_restante numeric;
begin
  if auth.uid() is null then raise exception 'USUARIO_NAO_AUTENTICADO' using errcode='42501'; end if;
  if p_quantidade is null or p_quantidade<=0 then raise exception 'QUANTIDADE_INVALIDA'; end if;

  select i.* into v_item from public.estoque_requisicao_setorial_itens i where i.id=p_item_id for update;
  if not found then raise exception 'ITEM_REQUISICAO_NAO_LOCALIZADO'; end if;
  select r.* into v_req from public.estoque_requisicoes_setoriais r where r.id=v_item.requisicao_id for update;
  if not public.tem_permissao(v_req.empresa_id,v_req.unidade_id,'almoxarifado.atender') then raise exception 'SEM_PERMISSAO_ATENDER_ALMOXARIFADO' using errcode='42501'; end if;
  if v_req.status in ('cancelada','atendida','recebida') then raise exception 'REQUISICAO_NAO_PODE_SER_ATENDIDA'; end if;

  select l.* into v_lote from public.estoque_lotes l where l.id=p_estoque_lote_id for update;
  if not found then raise exception 'LOTE_NAO_LOCALIZADO'; end if;
  if v_lote.empresa_id<>v_req.empresa_id or v_lote.unidade_id<>v_req.unidade_id then raise exception 'LOTE_FORA_ESCOPO'; end if;
  if v_lote.produto_id<>v_item.produto_id then raise exception 'PRODUTO_DIVERGENTE'; end if;
  if v_lote.local_id=v_req.local_destino_id then raise exception 'ORIGEM_IGUAL_DESTINO'; end if;

  v_restante:=greatest(coalesce(v_item.quantidade_aprovada,v_item.quantidade_solicitada)-coalesce(v_item.quantidade_atendida,0),0);
  if p_quantidade>v_restante then raise exception 'QUANTIDADE_SUPERA_PENDENCIA'; end if;
  if v_lote.quantidade<p_quantidade then raise exception 'ESTOQUE_INSUFICIENTE'; end if;

  update public.estoque_lotes set quantidade=quantidade-p_quantidade,updated_at=now() where id=v_lote.id;

  select id,quantidade,custo_unitario into v_dest_lote,v_dest_quantidade,v_dest_custo
  from public.estoque_lotes
  where empresa_id=v_req.empresa_id
    and unidade_id=v_req.unidade_id
    and local_id=v_req.local_destino_id
    and produto_id=v_lote.produto_id
    and coalesce(numero_lote,'')=coalesce(v_lote.numero_lote,'')
    and validade is not distinct from v_lote.validade
  limit 1 for update;

  if v_dest_lote is null then
    insert into public.estoque_lotes(empresa_id,unidade_id,local_id,produto_id,fornecedor_id,numero_lote,validade,quantidade,custo_unitario,created_at,updated_at)
    values(v_req.empresa_id,v_req.unidade_id,v_req.local_destino_id,v_lote.produto_id,v_lote.fornecedor_id,v_lote.numero_lote,v_lote.validade,p_quantidade,v_lote.custo_unitario,now(),now())
    returning id into v_dest_lote;
  else
    update public.estoque_lotes
    set quantidade=quantidade+p_quantidade,
        custo_unitario=case when quantidade+p_quantidade>0 then ((quantidade*coalesce(custo_unitario,0))+(p_quantidade*coalesce(v_lote.custo_unitario,0)))/(quantidade+p_quantidade) else coalesce(v_lote.custo_unitario,0) end,
        fornecedor_id=coalesce(fornecedor_id,v_lote.fornecedor_id),
        updated_at=now()
    where id=v_dest_lote;
  end if;

  insert into public.estoque_movimentos(empresa_id,unidade_id,produto_id,lote_id,local_origem_id,local_destino_id,tipo,quantidade,custo_unitario,motivo,created_at,created_by)
  values(v_req.empresa_id,v_req.unidade_id,v_lote.produto_id,v_lote.id,v_lote.local_id,v_req.local_destino_id,'transferencia',p_quantidade,v_lote.custo_unitario,'Atendimento da requisição '||v_req.numero,now(),auth.uid())
  returning id into v_mov;

  update public.estoque_requisicao_setorial_itens
  set quantidade_atendida=quantidade_atendida+p_quantidade,
      status=case when quantidade_atendida+p_quantidade>=coalesce(quantidade_aprovada,quantidade_solicitada) then 'atendido' else 'parcial' end,
      updated_at=now(),updated_by=auth.uid()
  where id=v_item.id;

  update public.estoque_requisicoes_setoriais r
  set local_origem_id=coalesce(r.local_origem_id,v_lote.local_id),
      iniciado_em=coalesce(r.iniciado_em,now()),
      status=case when not exists(select 1 from public.estoque_requisicao_setorial_itens x where x.requisicao_id=r.id and x.status not in ('atendido','cancelado')) then 'atendida' when exists(select 1 from public.estoque_requisicao_setorial_itens x where x.requisicao_id=r.id and x.quantidade_atendida>0) then 'parcial' else 'em_separacao' end,
      atendido_em=case when not exists(select 1 from public.estoque_requisicao_setorial_itens x where x.requisicao_id=r.id and x.status not in ('atendido','cancelado')) then now() else r.atendido_em end,
      updated_at=now(),updated_by=auth.uid()
  where r.id=v_req.id;

  v_prof:=public.profissional_logado(v_req.empresa_id);
  insert into public.estoque_requisicao_setorial_eventos(requisicao_id,evento,detalhe,profissional_id,usuario_id)
  values(v_req.id,'item_atendido',jsonb_build_object('item_id',v_item.id,'lote_origem_id',v_lote.id,'lote_destino_id',v_dest_lote,'quantidade',p_quantidade,'movimento_id',v_mov),v_prof,auth.uid());
  return v_mov;
end;
$function$;

revoke all on function public.atender_requisicao_setorial_item(uuid,uuid,numeric) from public,anon;
grant execute on function public.atender_requisicao_setorial_item(uuid,uuid,numeric) to authenticated;
