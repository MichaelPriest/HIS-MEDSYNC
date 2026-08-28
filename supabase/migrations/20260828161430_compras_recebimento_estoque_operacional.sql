-- Recebimento transacional de compras com rastreabilidade pedido -> recebimento -> lote -> movimento -> financeiro.

alter table public.compras_pedidos
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists updated_by uuid null references auth.users(id);

alter table public.compras_pedido_itens
  drop constraint if exists compras_pedido_itens_quantidade_recebida_check;
alter table public.compras_pedido_itens
  add constraint compras_pedido_itens_quantidade_recebida_check
  check (quantidade_recebida >= 0 and quantidade_recebida <= quantidade);

alter table public.compras_recebimento_itens
  add column if not exists pedido_item_id uuid null references public.compras_pedido_itens(id) on delete restrict,
  add column if not exists estoque_lote_id uuid null references public.estoque_lotes(id) on delete restrict,
  add column if not exists divergencia_tipo text null,
  add column if not exists divergencia_observacao text null;

create index if not exists idx_compras_recebimento_itens_pedido_item on public.compras_recebimento_itens(pedido_item_id) where pedido_item_id is not null;
create index if not exists idx_compras_recebimento_itens_lote on public.compras_recebimento_itens(estoque_lote_id) where estoque_lote_id is not null;

alter table public.estoque_movimentos
  add column if not exists compra_recebimento_id uuid null references public.compras_recebimentos(id) on delete restrict,
  add column if not exists compra_recebimento_item_id uuid null references public.compras_recebimento_itens(id) on delete restrict,
  add column if not exists compra_pedido_item_id uuid null references public.compras_pedido_itens(id) on delete restrict;

create index if not exists idx_estoque_movimentos_compra_recebimento on public.estoque_movimentos(compra_recebimento_id) where compra_recebimento_id is not null;
create index if not exists idx_estoque_movimentos_compra_recebimento_item on public.estoque_movimentos(compra_recebimento_item_id) where compra_recebimento_item_id is not null;
create index if not exists idx_estoque_movimentos_compra_pedido_item on public.estoque_movimentos(compra_pedido_item_id) where compra_pedido_item_id is not null;

alter table public.estoque_lotes drop constraint if exists estoque_lotes_quantidade_nao_negativa_check;
alter table public.estoque_lotes add constraint estoque_lotes_quantidade_nao_negativa_check check (quantidade >= 0);
alter table public.estoque_lotes drop constraint if exists estoque_lotes_custo_nao_negativo_check;
alter table public.estoque_lotes add constraint estoque_lotes_custo_nao_negativo_check check (custo_unitario >= 0);

create unique index if not exists ux_estoque_produto_item_assistencial_ativo
  on public.estoque_produtos(empresa_id,item_assistencial_id)
  where item_assistencial_id is not null and ativo=true;
create unique index if not exists ux_estoque_lote_identidade_operacional
  on public.estoque_lotes(empresa_id,unidade_id,local_id,produto_id,coalesce(numero_lote,''),coalesce(validade,'infinity'::date));
create unique index if not exists ux_compras_recebimento_documento_pedido
  on public.compras_recebimentos(pedido_id,numero_documento,coalesce(serie_documento,''))
  where numero_documento is not null and status <> 'cancelado';
create unique index if not exists ux_financeiro_conta_pagar_recebimento
  on public.financeiro_contas_pagar(compra_recebimento_id)
  where compra_recebimento_id is not null;

alter table public.compras_pedidos enable row level security;
alter table public.compras_pedidos force row level security;
drop policy if exists compras_pedidos_all on public.compras_pedidos;
drop policy if exists compras_pedidos_select on public.compras_pedidos;
drop policy if exists compras_pedidos_mutate on public.compras_pedidos;
create policy compras_pedidos_select on public.compras_pedidos for select to authenticated using (
  public.tem_unidade(empresa_id,unidade_id) and (
    public.tem_permissao(empresa_id,unidade_id,'compras.visualizar') or public.tem_permissao(empresa_id,unidade_id,'compras.solicitar') or
    public.tem_permissao(empresa_id,unidade_id,'compras.cotar') or public.tem_permissao(empresa_id,unidade_id,'compras.aprovar') or
    public.tem_permissao(empresa_id,unidade_id,'compras.receber') or public.tem_permissao(empresa_id,unidade_id,'compras.gerenciar')
  )
);
create policy compras_pedidos_mutate on public.compras_pedidos for all to authenticated using (
  public.tem_unidade(empresa_id,unidade_id) and (public.tem_permissao(empresa_id,unidade_id,'compras.aprovar') or public.tem_permissao(empresa_id,unidade_id,'compras.gerenciar'))
) with check (
  public.tem_unidade(empresa_id,unidade_id) and (public.tem_permissao(empresa_id,unidade_id,'compras.aprovar') or public.tem_permissao(empresa_id,unidade_id,'compras.gerenciar'))
);
grant select,insert,update on public.compras_pedidos to authenticated;
revoke delete on public.compras_pedidos from anon,authenticated;

alter table public.compras_pedido_itens enable row level security;
alter table public.compras_pedido_itens force row level security;
drop policy if exists compras_pedido_itens_all on public.compras_pedido_itens;
drop policy if exists compras_pedido_itens_select on public.compras_pedido_itens;
drop policy if exists compras_pedido_itens_mutate on public.compras_pedido_itens;
create policy compras_pedido_itens_select on public.compras_pedido_itens for select to authenticated using (
  exists (select 1 from public.compras_pedidos p where p.id=compras_pedido_itens.pedido_id and public.tem_unidade(p.empresa_id,p.unidade_id) and (
    public.tem_permissao(p.empresa_id,p.unidade_id,'compras.visualizar') or public.tem_permissao(p.empresa_id,p.unidade_id,'compras.solicitar') or
    public.tem_permissao(p.empresa_id,p.unidade_id,'compras.cotar') or public.tem_permissao(p.empresa_id,p.unidade_id,'compras.aprovar') or
    public.tem_permissao(p.empresa_id,p.unidade_id,'compras.receber') or public.tem_permissao(p.empresa_id,p.unidade_id,'compras.gerenciar')
  ))
);
create policy compras_pedido_itens_mutate on public.compras_pedido_itens for all to authenticated using (
  exists (select 1 from public.compras_pedidos p where p.id=compras_pedido_itens.pedido_id and public.tem_unidade(p.empresa_id,p.unidade_id) and (public.tem_permissao(p.empresa_id,p.unidade_id,'compras.aprovar') or public.tem_permissao(p.empresa_id,p.unidade_id,'compras.gerenciar')))
) with check (
  exists (select 1 from public.compras_pedidos p where p.id=compras_pedido_itens.pedido_id and public.tem_unidade(p.empresa_id,p.unidade_id) and (public.tem_permissao(p.empresa_id,p.unidade_id,'compras.aprovar') or public.tem_permissao(p.empresa_id,p.unidade_id,'compras.gerenciar')))
);
grant select,insert,update on public.compras_pedido_itens to authenticated;
revoke delete on public.compras_pedido_itens from anon,authenticated;

alter table public.compras_recebimentos enable row level security;
alter table public.compras_recebimentos force row level security;
drop policy if exists compras_recebimentos_all on public.compras_recebimentos;
drop policy if exists compras_recebimentos_select on public.compras_recebimentos;
create policy compras_recebimentos_select on public.compras_recebimentos for select to authenticated using (
  public.tem_unidade(empresa_id,unidade_id) and (
    public.tem_permissao(empresa_id,unidade_id,'compras.visualizar') or public.tem_permissao(empresa_id,unidade_id,'compras.solicitar') or
    public.tem_permissao(empresa_id,unidade_id,'compras.cotar') or public.tem_permissao(empresa_id,unidade_id,'compras.aprovar') or
    public.tem_permissao(empresa_id,unidade_id,'compras.receber') or public.tem_permissao(empresa_id,unidade_id,'compras.gerenciar')
  )
);
grant select on public.compras_recebimentos to authenticated;
revoke insert,update,delete on public.compras_recebimentos from anon,authenticated;

alter table public.compras_recebimento_itens enable row level security;
alter table public.compras_recebimento_itens force row level security;
drop policy if exists compras_recebimento_itens_all on public.compras_recebimento_itens;
drop policy if exists compras_recebimento_itens_select on public.compras_recebimento_itens;
create policy compras_recebimento_itens_select on public.compras_recebimento_itens for select to authenticated using (
  exists (select 1 from public.compras_recebimentos r where r.id=compras_recebimento_itens.recebimento_id and public.tem_unidade(r.empresa_id,r.unidade_id) and (
    public.tem_permissao(r.empresa_id,r.unidade_id,'compras.visualizar') or public.tem_permissao(r.empresa_id,r.unidade_id,'compras.solicitar') or
    public.tem_permissao(r.empresa_id,r.unidade_id,'compras.cotar') or public.tem_permissao(r.empresa_id,r.unidade_id,'compras.aprovar') or
    public.tem_permissao(r.empresa_id,r.unidade_id,'compras.receber') or public.tem_permissao(r.empresa_id,r.unidade_id,'compras.gerenciar')
  ))
);
grant select on public.compras_recebimento_itens to authenticated;
revoke insert,update,delete on public.compras_recebimento_itens from anon,authenticated;

alter table public.estoque_lotes enable row level security;
alter table public.estoque_lotes force row level security;
drop policy if exists estoque_lotes_all on public.estoque_lotes;
drop policy if exists estoque_lotes_select on public.estoque_lotes;
drop policy if exists estoque_lotes_mutate on public.estoque_lotes;
create policy estoque_lotes_select on public.estoque_lotes for select to authenticated using (public.tem_unidade(empresa_id,unidade_id));
create policy estoque_lotes_mutate on public.estoque_lotes for all to authenticated using (
  public.tem_unidade(empresa_id,unidade_id) and (
    public.tem_permissao(empresa_id,unidade_id,'estoque.gerenciar') or public.tem_permissao(empresa_id,unidade_id,'estoque.movimentar') or
    public.tem_permissao(empresa_id,unidade_id,'estoque.inventariar') or public.tem_permissao(empresa_id,unidade_id,'almoxarifado.atender') or
    public.tem_permissao(empresa_id,unidade_id,'farmacia.dispensar') or public.tem_permissao(empresa_id,unidade_id,'farmacia.devolver') or
    public.tem_permissao(empresa_id,unidade_id,'farmacia.gerenciar') or public.tem_permissao(empresa_id,unidade_id,'compras.receber') or public.tem_permissao(empresa_id,unidade_id,'compras.gerenciar')
  )
) with check (
  public.tem_unidade(empresa_id,unidade_id) and (
    public.tem_permissao(empresa_id,unidade_id,'estoque.gerenciar') or public.tem_permissao(empresa_id,unidade_id,'estoque.movimentar') or
    public.tem_permissao(empresa_id,unidade_id,'estoque.inventariar') or public.tem_permissao(empresa_id,unidade_id,'almoxarifado.atender') or
    public.tem_permissao(empresa_id,unidade_id,'farmacia.dispensar') or public.tem_permissao(empresa_id,unidade_id,'farmacia.devolver') or
    public.tem_permissao(empresa_id,unidade_id,'farmacia.gerenciar') or public.tem_permissao(empresa_id,unidade_id,'compras.receber') or public.tem_permissao(empresa_id,unidade_id,'compras.gerenciar')
  )
);

alter table public.estoque_movimentos enable row level security;
alter table public.estoque_movimentos force row level security;
drop policy if exists estoque_movimentos_all on public.estoque_movimentos;
drop policy if exists estoque_movimentos_select on public.estoque_movimentos;
drop policy if exists estoque_movimentos_mutate on public.estoque_movimentos;
create policy estoque_movimentos_select on public.estoque_movimentos for select to authenticated using (public.tem_unidade(empresa_id,unidade_id));
create policy estoque_movimentos_mutate on public.estoque_movimentos for all to authenticated using (
  public.tem_unidade(empresa_id,unidade_id) and (
    public.tem_permissao(empresa_id,unidade_id,'estoque.gerenciar') or public.tem_permissao(empresa_id,unidade_id,'estoque.movimentar') or
    public.tem_permissao(empresa_id,unidade_id,'estoque.inventariar') or public.tem_permissao(empresa_id,unidade_id,'almoxarifado.atender') or
    public.tem_permissao(empresa_id,unidade_id,'farmacia.dispensar') or public.tem_permissao(empresa_id,unidade_id,'farmacia.devolver') or
    public.tem_permissao(empresa_id,unidade_id,'farmacia.gerenciar') or public.tem_permissao(empresa_id,unidade_id,'compras.receber') or public.tem_permissao(empresa_id,unidade_id,'compras.gerenciar')
  )
) with check (
  public.tem_unidade(empresa_id,unidade_id) and (
    public.tem_permissao(empresa_id,unidade_id,'estoque.gerenciar') or public.tem_permissao(empresa_id,unidade_id,'estoque.movimentar') or
    public.tem_permissao(empresa_id,unidade_id,'estoque.inventariar') or public.tem_permissao(empresa_id,unidade_id,'almoxarifado.atender') or
    public.tem_permissao(empresa_id,unidade_id,'farmacia.dispensar') or public.tem_permissao(empresa_id,unidade_id,'farmacia.devolver') or
    public.tem_permissao(empresa_id,unidade_id,'farmacia.gerenciar') or public.tem_permissao(empresa_id,unidade_id,'compras.receber') or public.tem_permissao(empresa_id,unidade_id,'compras.gerenciar')
  )
);

create or replace function public.receber_pedido_compra_operacional(
  p_pedido_id uuid,
  p_itens jsonb,
  p_numero_documento text default null,
  p_serie_documento text default null,
  p_data_emissao date default null,
  p_vencimento date default null,
  p_valor_documento numeric default null,
  p_observacoes text default null
)
returns uuid language plpgsql security definer set search_path to 'public','pg_catalog'
as $function$
declare
  v_pedido public.compras_pedidos%rowtype;
  v_pedido_item public.compras_pedido_itens%rowtype;
  v_item jsonb;
  v_item_assistencial record;
  v_local public.estoque_locais%rowtype;
  v_produto_id uuid;
  v_lote_id uuid;
  v_recebimento_id uuid;
  v_recebimento_item_id uuid;
  v_quantidade numeric;
  v_restante numeric;
  v_valor_unitario numeric;
  v_valor_itens numeric := 0;
  v_valor_documento numeric;
  v_numero_lote text;
  v_validade date;
  v_divergencia_observacao text;
  v_divergencia_tipo text;
  v_tem_divergencia boolean := false;
  v_itens_recebidos integer := 0;
  v_itens_pendentes integer := 0;
begin
  if auth.uid() is null then raise exception 'COMPRAS_AUTENTICACAO_OBRIGATORIA' using errcode='42501'; end if;
  if p_pedido_id is null then raise exception 'COMPRAS_PEDIDO_OBRIGATORIO'; end if;
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens)=0 then raise exception 'COMPRAS_RECEBIMENTO_SEM_ITENS'; end if;

  select * into v_pedido from public.compras_pedidos where id=p_pedido_id for update;
  if v_pedido.id is null then raise exception 'COMPRAS_PEDIDO_NAO_ENCONTRADO'; end if;
  if not public.tem_unidade(v_pedido.empresa_id,v_pedido.unidade_id) then raise exception 'COMPRAS_UNIDADE_FORA_ESCOPO' using errcode='42501'; end if;
  if not (public.tem_permissao(v_pedido.empresa_id,v_pedido.unidade_id,'compras.receber') or public.tem_permissao(v_pedido.empresa_id,v_pedido.unidade_id,'compras.gerenciar')) then raise exception 'COMPRAS_SEM_PERMISSAO_RECEBER' using errcode='42501'; end if;
  if v_pedido.status in ('cancelado','recebido') then raise exception 'COMPRAS_PEDIDO_NAO_RECEBIVEL'; end if;

  insert into public.compras_recebimentos(empresa_id,unidade_id,pedido_id,fornecedor_id,numero_documento,serie_documento,data_emissao,valor_documento,vencimento,status,recebimento_parcial,quantidade_itens_recebidos,quantidade_itens_pendentes,observacoes,created_by)
  values(v_pedido.empresa_id,v_pedido.unidade_id,v_pedido.id,v_pedido.fornecedor_id,nullif(trim(coalesce(p_numero_documento,'')),''),nullif(trim(coalesce(p_serie_documento,'')),''),p_data_emissao,0,p_vencimento,'recebido',false,0,0,nullif(trim(coalesce(p_observacoes,'')),''),auth.uid())
  returning id into v_recebimento_id;

  for v_item in select value from jsonb_array_elements(p_itens) loop
    if nullif(v_item->>'pedido_item_id','') is null then raise exception 'COMPRAS_PEDIDO_ITEM_OBRIGATORIO'; end if;
    v_quantidade := coalesce(nullif(v_item->>'quantidade','')::numeric,0);
    if v_quantidade <= 0 then raise exception 'COMPRAS_QUANTIDADE_RECEBIDA_INVALIDA'; end if;

    select * into v_pedido_item from public.compras_pedido_itens where id=(v_item->>'pedido_item_id')::uuid and pedido_id=v_pedido.id for update;
    if v_pedido_item.id is null then raise exception 'COMPRAS_PEDIDO_ITEM_NAO_ENCONTRADO'; end if;
    v_restante := greatest(v_pedido_item.quantidade-coalesce(v_pedido_item.quantidade_recebida,0),0);
    if v_restante <= 0 then raise exception 'COMPRAS_PEDIDO_ITEM_JA_RECEBIDO'; end if;
    if v_quantidade > v_restante then raise exception 'COMPRAS_QUANTIDADE_SUPERA_SALDO_PEDIDO'; end if;

    if nullif(v_item->>'local_estoque_id','') is null then raise exception 'COMPRAS_LOCAL_ESTOQUE_OBRIGATORIO'; end if;
    select * into v_local from public.estoque_locais where id=(v_item->>'local_estoque_id')::uuid and empresa_id=v_pedido.empresa_id and unidade_id=v_pedido.unidade_id and ativo=true;
    if v_local.id is null then raise exception 'COMPRAS_LOCAL_ESTOQUE_INVALIDO'; end if;

    v_produto_id := v_pedido_item.produto_id;
    if v_produto_id is null and v_pedido_item.item_assistencial_id is not null then
      select id into v_produto_id from public.estoque_produtos where empresa_id=v_pedido.empresa_id and item_assistencial_id=v_pedido_item.item_assistencial_id and ativo=true order by created_at asc limit 1;
      if v_produto_id is null then
        select ia.id,ia.codigo_tuss,ia.codigo_brasindice,ia.codigo_simpro,ia.codigo_anvisa,ia.categoria into v_item_assistencial
        from public.itens_assistenciais ia where ia.id=v_pedido_item.item_assistencial_id and ia.empresa_id=v_pedido.empresa_id;
        if v_item_assistencial.id is null then raise exception 'COMPRAS_ITEM_ASSISTENCIAL_INVALIDO'; end if;
        insert into public.estoque_produtos(empresa_id,codigo,descricao,tipo,unidade_medida,codigo_tuss,codigo_brasindice,codigo_simpro,codigo_anvisa,item_assistencial_id,ativo,created_by,updated_by)
        values(v_pedido.empresa_id,'IA-'||replace(v_pedido_item.item_assistencial_id::text,'-',''),v_pedido_item.descricao,case when v_item_assistencial.categoria in ('medicamento','material','opme','gas_medicinal','dietas','higiene','expediente','outro') then v_item_assistencial.categoria else 'outro' end,coalesce(nullif(v_pedido_item.unidade_medida,''),'UN'),v_item_assistencial.codigo_tuss,v_item_assistencial.codigo_brasindice,v_item_assistencial.codigo_simpro,v_item_assistencial.codigo_anvisa,v_pedido_item.item_assistencial_id,true,auth.uid(),auth.uid()) returning id into v_produto_id;
      end if;
      update public.compras_pedido_itens set produto_id=v_produto_id where id=v_pedido_item.id;
      update public.compras_solicitacao_itens si set produto_id=coalesce(si.produto_id,v_produto_id)
      where si.id=(select ci.solicitacao_item_id from public.compras_cotacao_itens ci where ci.id=v_pedido_item.cotacao_item_id) and si.produto_id is null;
    end if;
    if v_produto_id is null then raise exception 'COMPRAS_PRODUTO_ESTOQUE_NAO_RESOLVIDO'; end if;
    if not exists(select 1 from public.estoque_produtos ep where ep.id=v_produto_id and ep.empresa_id=v_pedido.empresa_id and ep.ativo=true) then raise exception 'COMPRAS_PRODUTO_ESTOQUE_INVALIDO'; end if;

    v_valor_unitario := coalesce(nullif(v_item->>'valor_unitario','')::numeric,v_pedido_item.valor_unitario,0);
    if v_valor_unitario < 0 then raise exception 'COMPRAS_VALOR_UNITARIO_INVALIDO'; end if;
    v_numero_lote := nullif(trim(coalesce(v_item->>'numero_lote','')),'');
    v_validade := nullif(v_item->>'validade','')::date;
    v_divergencia_observacao := nullif(trim(coalesce(v_item->>'divergencia_observacao','')),'');
    v_divergencia_tipo := null;
    if abs(v_valor_unitario-coalesce(v_pedido_item.valor_unitario,0)) > 0.0001 then v_divergencia_tipo := 'preco'; v_tem_divergencia := true; end if;
    if v_divergencia_observacao is not null then v_divergencia_tipo := case when v_divergencia_tipo is null then 'informada' else 'preco_e_informada' end; v_tem_divergencia := true; end if;

    select id into v_lote_id from public.estoque_lotes where empresa_id=v_pedido.empresa_id and unidade_id=v_pedido.unidade_id and local_id=v_local.id and produto_id=v_produto_id and coalesce(numero_lote,'')=coalesce(v_numero_lote,'') and validade is not distinct from v_validade limit 1 for update;
    if v_lote_id is null then
      insert into public.estoque_lotes(empresa_id,unidade_id,local_id,produto_id,fornecedor_id,numero_lote,validade,quantidade,custo_unitario,status,created_at,updated_at)
      values(v_pedido.empresa_id,v_pedido.unidade_id,v_local.id,v_produto_id,v_pedido.fornecedor_id,v_numero_lote,v_validade,v_quantidade,v_valor_unitario,'disponivel',now(),now()) returning id into v_lote_id;
    else
      update public.estoque_lotes set quantidade=quantidade+v_quantidade,custo_unitario=case when quantidade+v_quantidade>0 then ((quantidade*coalesce(custo_unitario,0))+(v_quantidade*v_valor_unitario))/(quantidade+v_quantidade) else v_valor_unitario end,fornecedor_id=coalesce(fornecedor_id,v_pedido.fornecedor_id),updated_at=now() where id=v_lote_id;
    end if;

    insert into public.compras_recebimento_itens(recebimento_id,pedido_item_id,produto_id,quantidade,valor_unitario,lote,validade,local_estoque_id,farmacia,estoque_lote_id,divergencia_tipo,divergencia_observacao)
    values(v_recebimento_id,v_pedido_item.id,v_produto_id,v_quantidade,v_valor_unitario,v_numero_lote,v_validade,v_local.id,coalesce(v_local.eh_farmacia,false),v_lote_id,v_divergencia_tipo,v_divergencia_observacao) returning id into v_recebimento_item_id;

    insert into public.estoque_movimentos(empresa_id,unidade_id,produto_id,lote_id,local_destino_id,tipo,quantidade,custo_unitario,motivo,compra_recebimento_id,compra_recebimento_item_id,compra_pedido_item_id,created_at,created_by)
    values(v_pedido.empresa_id,v_pedido.unidade_id,v_produto_id,v_lote_id,v_local.id,'entrada',v_quantidade,v_valor_unitario,'Recebimento de compra '||v_pedido.numero||coalesce(' / documento '||nullif(trim(coalesce(p_numero_documento,'')),''),''),v_recebimento_id,v_recebimento_item_id,v_pedido_item.id,now(),auth.uid());

    update public.compras_pedido_itens set quantidade_recebida=quantidade_recebida+v_quantidade where id=v_pedido_item.id;
    v_valor_itens := v_valor_itens + (v_quantidade*v_valor_unitario);
    v_itens_recebidos := v_itens_recebidos + 1;
  end loop;

  select count(*)::int into v_itens_pendentes from public.compras_pedido_itens where pedido_id=v_pedido.id and quantidade_recebida < quantidade;
  v_valor_documento := coalesce(p_valor_documento,v_valor_itens);
  if v_valor_documento < 0 then raise exception 'COMPRAS_VALOR_DOCUMENTO_INVALIDO'; end if;
  if abs(v_valor_documento-v_valor_itens)>0.01 then v_tem_divergencia := true; end if;

  update public.compras_recebimentos set valor_documento=v_valor_documento,status=case when v_tem_divergencia then 'divergente' else 'conferido' end,recebimento_parcial=(v_itens_pendentes>0),quantidade_itens_recebidos=v_itens_recebidos,quantidade_itens_pendentes=v_itens_pendentes where id=v_recebimento_id;
  update public.compras_pedidos set status=case when v_itens_pendentes=0 then 'recebido' else 'parcial' end,updated_at=now(),updated_by=auth.uid() where id=v_pedido.id;

  if v_valor_documento>0 then
    insert into public.financeiro_contas_pagar(empresa_id,unidade_id,fornecedor_id,compra_recebimento_id,documento,competencia,vencimento,valor_bruto,status,observacoes,created_by)
    values(v_pedido.empresa_id,v_pedido.unidade_id,v_pedido.fornecedor_id,v_recebimento_id,nullif(trim(coalesce(p_numero_documento,'')),''),to_char(coalesce(p_data_emissao,current_date),'YYYY-MM'),p_vencimento,v_valor_documento,'aberto',case when v_tem_divergencia then 'Recebimento de compra com divergência registrada' else 'Gerado pelo recebimento transacional de compra' end,auth.uid());
  end if;
  return v_recebimento_id;
end;
$function$;

revoke all on function public.receber_pedido_compra_operacional(uuid,jsonb,text,text,date,date,numeric,text) from public,anon;
grant execute on function public.receber_pedido_compra_operacional(uuid,jsonb,text,text,date,date,numeric,text) to authenticated;
