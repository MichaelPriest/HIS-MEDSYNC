create or replace function public.centro_cirurgico_consumir_suprimento_operacional(
  p_cirurgia_id uuid,
  p_estoque_lote_id uuid,
  p_quantidade numeric,
  p_opme_id uuid default null,
  p_requisicao_item_id uuid default null,
  p_serie text default null,
  p_observacoes text default null
) returns jsonb
language plpgsql security definer
set search_path='public','pg_catalog','extensions'
as $$
declare
  v_c public.cirurgias%rowtype;
  v_lote public.estoque_lotes%rowtype;
  v_prod public.estoque_produtos%rowtype;
  v_item public.itens_assistenciais%rowtype;
  v_opme public.cirurgia_opme%rowtype;
  v_req_item record;
  v_mov uuid;
  v_opme_id uuid;
  v_prof uuid;
  v_codigo text;
  v_nome text;
  v_serie text:=nullif(btrim(p_serie),'');
  v_req_disponivel numeric;
  v_req_consumido numeric;
begin
  if auth.uid() is null then raise exception 'CC_AUTENTICACAO_OBRIGATORIA' using errcode='42501'; end if;
  if coalesce(p_quantidade,0)<=0 then raise exception 'CC_SUPRIMENTO_QUANTIDADE_INVALIDA'; end if;
  select * into v_c from public.cirurgias where id=p_cirurgia_id for update;
  if not found then raise exception 'CC_CIRURGIA_NAO_LOCALIZADA'; end if;
  if not public.tem_unidade(v_c.empresa_id,v_c.unidade_id) then raise exception 'CC_UNIDADE_FORA_ESCOPO' using errcode='42501'; end if;
  if not (public.tem_permissao(v_c.empresa_id,v_c.unidade_id,'centro_cirurgico.operar') or public.tem_permissao(v_c.empresa_id,v_c.unidade_id,'centro_cirurgico.gerenciar')) then raise exception 'CC_SEM_PERMISSAO_OPERAR' using errcode='42501'; end if;
  if v_c.status<>'em_andamento' then raise exception 'CC_CONSUMO_EXIGE_CIRURGIA_EM_ANDAMENTO'; end if;

  select * into v_lote from public.estoque_lotes where id=p_estoque_lote_id for update;
  if not found then raise exception 'CC_SUPRIMENTO_LOTE_NAO_LOCALIZADO'; end if;
  if v_lote.empresa_id<>v_c.empresa_id or v_lote.unidade_id<>v_c.unidade_id then raise exception 'CC_SUPRIMENTO_LOTE_FORA_ESCOPO'; end if;
  if v_lote.status<>'disponivel' then raise exception 'CC_SUPRIMENTO_LOTE_NAO_DISPONIVEL'; end if;
  if v_lote.validade is not null and v_lote.validade<current_date then raise exception 'CC_SUPRIMENTO_LOTE_VENCIDO'; end if;
  if v_lote.quantidade<p_quantidade then raise exception 'CC_SUPRIMENTO_ESTOQUE_INSUFICIENTE'; end if;
  if not exists(select 1 from public.estoque_locais l where l.id=v_lote.local_id and l.empresa_id=v_c.empresa_id and l.unidade_id=v_c.unidade_id and l.ativo=true) then raise exception 'CC_SUPRIMENTO_LOCAL_INATIVO'; end if;

  select * into v_prod from public.estoque_produtos where id=v_lote.produto_id and empresa_id=v_c.empresa_id and ativo=true;
  if not found then raise exception 'CC_SUPRIMENTO_PRODUTO_INVALIDO'; end if;
  if v_prod.tipo='medicamento' then raise exception 'CC_MEDICAMENTO_EXIGE_FLUXO_FARMACIA_PRESCRICAO'; end if;
  if v_prod.tipo not in ('material','opme','gas_medicinal') then raise exception 'CC_SUPRIMENTO_TIPO_NAO_CONSUMIVEL'; end if;

  if v_prod.item_assistencial_id is not null then
    select * into v_item from public.itens_assistenciais where id=v_prod.item_assistencial_id and empresa_id=v_c.empresa_id and ativo=true;
    if not found and v_prod.tipo='opme' then raise exception 'CC_OPME_ITEM_ASSISTENCIAL_ATIVO_OBRIGATORIO'; end if;
    if found and v_prod.tipo='opme' and v_item.categoria<>'opme' then raise exception 'CC_OPME_CATALOGO_INCONSISTENTE'; end if;
  elsif v_prod.tipo='opme' then
    raise exception 'CC_OPME_ITEM_ASSISTENCIAL_ATIVO_OBRIGATORIO';
  end if;

  if p_opme_id is not null and v_prod.tipo<>'opme' then raise exception 'CC_OPME_VINCULO_EM_PRODUTO_NAO_OPME'; end if;
  if p_requisicao_item_id is not null then
    select i.*,r.id as req_id,r.cirurgia_id as req_cirurgia_id,r.local_destino_id as req_local_destino_id,r.status as req_status
    into v_req_item
    from public.estoque_requisicao_setorial_itens i
    join public.estoque_requisicoes_setoriais r on r.id=i.requisicao_id
    where i.id=p_requisicao_item_id for update of i;
    if not found or v_req_item.req_cirurgia_id is distinct from v_c.id then raise exception 'CC_REQUISICAO_ITEM_FORA_CIRURGIA'; end if;
    if v_req_item.produto_id<>v_prod.id then raise exception 'CC_REQUISICAO_ITEM_PRODUTO_DIVERGENTE'; end if;
    if v_req_item.req_local_destino_id<>v_lote.local_id then raise exception 'CC_REQUISICAO_ITEM_LOCAL_DIVERGENTE'; end if;
    if v_req_item.req_status not in ('atendida','recebida') then raise exception 'CC_REQUISICAO_ITEM_NAO_DISPONIVEL'; end if;
    select coalesce(sum(greatest(m.quantidade-coalesce((select sum(d.quantidade) from public.estoque_movimentos d where d.movimento_origem_id=m.id and d.tipo='devolucao'),0),0)),0)
      into v_req_consumido
    from public.estoque_movimentos m
    where m.requisicao_setorial_item_id=p_requisicao_item_id and m.tipo='consumo_paciente';
    v_req_disponivel:=greatest(coalesce(v_req_item.quantidade_atendida,0)-coalesce(v_req_consumido,0),0);
    if p_quantidade>v_req_disponivel then raise exception 'CC_CONSUMO_SUPERA_REQUISICAO_ATENDIDA'; end if;
  end if;

  v_codigo:=coalesce(nullif(btrim(v_item.codigo_tuss),''),nullif(btrim(v_item.codigo_tabela_propria),''),nullif(btrim(v_prod.codigo_tuss),''),nullif(btrim(v_prod.codigo),''));
  v_nome:=coalesce(nullif(btrim(v_item.descricao),''),v_prod.descricao);
  v_prof:=public.profissional_logado(v_c.empresa_id);

  if v_prod.tipo='opme' then
    if v_serie is not null and exists(select 1 from public.cirurgia_opme o where o.empresa_id=v_c.empresa_id and o.produto_id=v_prod.id and o.serie=v_serie and o.status='utilizado' and (p_opme_id is null or o.id<>p_opme_id)) then raise exception 'CC_OPME_SERIE_JA_UTILIZADA'; end if;
    if p_opme_id is not null then
      select * into v_opme from public.cirurgia_opme where id=p_opme_id and cirurgia_id=v_c.id for update;
      if not found then raise exception 'CC_OPME_PLANEJADA_NAO_LOCALIZADA'; end if;
      if v_opme.status<>'previsto' then raise exception 'CC_OPME_PLANEJADA_JA_PROCESSADA'; end if;
      v_opme_id:=v_opme.id;
      update public.cirurgia_opme set
        item_assistencial_id=v_prod.item_assistencial_id,
        produto_id=v_prod.id,
        estoque_lote_id=v_lote.id,
        item=v_nome,
        codigo=v_codigo,
        fabricante=coalesce(nullif(btrim(v_item.fabricante),''),fabricante),
        lote=v_lote.numero_lote,
        serie=coalesce(v_serie,serie),
        registro_anvisa=coalesce(nullif(btrim(v_item.codigo_anvisa),''),nullif(btrim(v_prod.codigo_anvisa),''),registro_anvisa),
        quantidade=p_quantidade,
        observacoes=coalesce(nullif(btrim(p_observacoes),''),observacoes),
        updated_at=now(),updated_by=auth.uid()
      where id=v_opme_id;
    else
      insert into public.cirurgia_opme(
        empresa_id,unidade_id,cirurgia_id,atendimento_id,item,codigo,fabricante,lote,serie,registro_anvisa,quantidade,status,observacoes,
        item_assistencial_id,produto_id,estoque_lote_id,created_by,updated_by
      ) values(
        v_c.empresa_id,v_c.unidade_id,v_c.id,v_c.atendimento_id,v_nome,v_codigo,nullif(btrim(v_item.fabricante),''),v_lote.numero_lote,v_serie,
        coalesce(nullif(btrim(v_item.codigo_anvisa),''),nullif(btrim(v_prod.codigo_anvisa),'')),p_quantidade,'previsto',nullif(btrim(p_observacoes),''),
        v_prod.item_assistencial_id,v_prod.id,v_lote.id,auth.uid(),auth.uid()
      ) returning id into v_opme_id;
    end if;
  end if;

  update public.estoque_lotes set quantidade=quantidade-p_quantidade,updated_at=now() where id=v_lote.id;
  insert into public.estoque_movimentos(
    empresa_id,unidade_id,produto_id,lote_id,local_origem_id,atendimento_id,tipo,quantidade,custo_unitario,motivo,created_at,created_by,
    cirurgia_id,cirurgia_opme_id,requisicao_setorial_id,requisicao_setorial_item_id
  ) values(
    v_c.empresa_id,v_c.unidade_id,v_prod.id,v_lote.id,v_lote.local_id,v_c.atendimento_id,'consumo_paciente',p_quantidade,v_lote.custo_unitario,
    concat('Consumo cirúrgico ',coalesce(v_c.cirurgia,v_c.procedimento),case when nullif(btrim(p_observacoes),'') is not null then ': '||btrim(p_observacoes) else '' end),
    now(),auth.uid(),v_c.id,v_opme_id,case when p_requisicao_item_id is not null then v_req_item.req_id else null end,p_requisicao_item_id
  ) returning id into v_mov;

  if v_opme_id is not null then
    update public.cirurgia_opme set status='utilizado',utilizado_em=now(),estoque_movimento_id=v_mov,updated_at=now(),updated_by=auth.uid() where id=v_opme_id;
  end if;

  insert into public.cirurgia_eventos(empresa_id,unidade_id,cirurgia_id,atendimento_id,tipo_evento,detalhes,profissional_id,created_by)
  values(
    v_c.empresa_id,v_c.unidade_id,v_c.id,v_c.atendimento_id,
    case when v_prod.tipo='opme' then 'opme_utilizada_estoque' else 'suprimento_consumido' end,
    jsonb_build_object('produto_id',v_prod.id,'item_assistencial_id',v_prod.item_assistencial_id,'tipo',v_prod.tipo,'lote_id',v_lote.id,'lote',v_lote.numero_lote,
      'quantidade',p_quantidade,'movimento_id',v_mov,'opme_id',v_opme_id,'requisicao_item_id',p_requisicao_item_id),
    v_prof,auth.uid()
  );

  return jsonb_build_object('movimento_id',v_mov,'opme_id',v_opme_id,'produto_id',v_prod.id,'lote_id',v_lote.id,'quantidade',p_quantidade,
    'saldo_lote',v_lote.quantidade-p_quantidade,'tipo',v_prod.tipo);
end $$;
