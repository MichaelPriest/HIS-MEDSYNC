-- Integra Compras ao catálogo mestre de itens assistenciais.
-- Solicitação -> cotação item a item -> fornecedor -> pedido mantém snapshots regulatórios/comerciais.

alter table public.compras_solicitacao_itens
  add column if not exists item_assistencial_id uuid null references public.itens_assistenciais(id) on delete set null,
  add column if not exists categoria_item text null,
  add column if not exists codigo_interno text null,
  add column if not exists tabela_tiss_codigo text null,
  add column if not exists codigo_tuss text null,
  add column if not exists codigo_tabela_propria text null,
  add column if not exists codigo_brasindice text null,
  add column if not exists codigo_simpro text null,
  add column if not exists codigo_anvisa text null,
  add column if not exists fabricante text null,
  add column if not exists apresentacao text null;

alter table public.compras_solicitacao_itens drop constraint if exists compras_solicitacao_itens_categoria_item_check;
alter table public.compras_solicitacao_itens add constraint compras_solicitacao_itens_categoria_item_check check (
  categoria_item is null or categoria_item = any (array['material','medicamento','opme','gas_medicinal','outro'])
);

create unique index if not exists ux_compras_solicitacao_item_catalogo
  on public.compras_solicitacao_itens (solicitacao_id, item_assistencial_id)
  where item_assistencial_id is not null;
create index if not exists idx_compras_solicitacao_item_catalogo
  on public.compras_solicitacao_itens (item_assistencial_id)
  where item_assistencial_id is not null;

update public.compras_solicitacao_itens si
set item_assistencial_id = ep.item_assistencial_id
from public.estoque_produtos ep
where si.produto_id = ep.id
  and si.item_assistencial_id is null
  and ep.item_assistencial_id is not null;

update public.compras_solicitacao_itens si
set categoria_item = coalesce(si.categoria_item, ia.categoria),
    codigo_interno = coalesce(si.codigo_interno, ia.codigo_interno),
    tabela_tiss_codigo = coalesce(si.tabela_tiss_codigo, ia.tabela_tiss_codigo),
    codigo_tuss = coalesce(si.codigo_tuss, ia.codigo_tuss),
    codigo_tabela_propria = coalesce(si.codigo_tabela_propria, ia.codigo_tabela_propria),
    codigo_brasindice = coalesce(si.codigo_brasindice, ia.codigo_brasindice),
    codigo_simpro = coalesce(si.codigo_simpro, ia.codigo_simpro),
    codigo_anvisa = coalesce(si.codigo_anvisa, ia.codigo_anvisa),
    fabricante = coalesce(si.fabricante, ia.fabricante),
    apresentacao = coalesce(si.apresentacao, ia.apresentacao),
    descricao = coalesce(nullif(si.descricao, ''), ia.descricao),
    unidade_medida = coalesce(nullif(si.unidade_medida, ''), ia.unidade_medida, 'UN')
from public.itens_assistenciais ia
where si.item_assistencial_id = ia.id;

create table if not exists public.compras_cotacao_itens (
  id uuid primary key default extensions.gen_random_uuid(),
  cotacao_id uuid not null references public.compras_cotacoes(id) on delete cascade,
  solicitacao_item_id uuid null references public.compras_solicitacao_itens(id) on delete set null,
  item_assistencial_id uuid null references public.itens_assistenciais(id) on delete set null,
  categoria_item text not null default 'outro',
  codigo_interno text null,
  descricao text not null,
  quantidade numeric(14,4) not null,
  unidade_medida text not null default 'UN',
  tabela_tiss_codigo text null,
  codigo_tuss text null,
  codigo_tabela_propria text null,
  codigo_brasindice text null,
  codigo_simpro text null,
  codigo_anvisa text null,
  fabricante text null,
  apresentacao text null,
  observacoes text null,
  created_at timestamptz not null default now(),
  constraint compras_cotacao_itens_quantidade_check check (quantidade > 0),
  constraint compras_cotacao_itens_categoria_check check (categoria_item = any (array['material','medicamento','opme','gas_medicinal','outro']))
);

create unique index if not exists ux_compras_cotacao_solicitacao_item
  on public.compras_cotacao_itens (cotacao_id, solicitacao_item_id)
  where solicitacao_item_id is not null;
create index if not exists idx_compras_cotacao_itens_catalogo
  on public.compras_cotacao_itens (item_assistencial_id)
  where item_assistencial_id is not null;

alter table public.compras_cotacao_itens enable row level security;
alter table public.compras_cotacao_itens force row level security;
drop policy if exists compras_cotacao_itens_all on public.compras_cotacao_itens;
create policy compras_cotacao_itens_all on public.compras_cotacao_itens
for all to authenticated
using (exists (
  select 1 from public.compras_cotacoes c
  where c.id = compras_cotacao_itens.cotacao_id
    and public.tem_unidade(c.empresa_id, c.unidade_id)
))
with check (exists (
  select 1 from public.compras_cotacoes c
  where c.id = compras_cotacao_itens.cotacao_id
    and public.tem_unidade(c.empresa_id, c.unidade_id)
));
grant select, insert, update on public.compras_cotacao_itens to authenticated;
revoke delete on public.compras_cotacao_itens from anon, authenticated;

create table if not exists public.compras_cotacao_item_propostas (
  id uuid primary key default extensions.gen_random_uuid(),
  cotacao_item_id uuid not null references public.compras_cotacao_itens(id) on delete cascade,
  fornecedor_id uuid not null references public.fornecedores(id) on delete restrict,
  quantidade_ofertada numeric(14,4) null,
  valor_unitario numeric(16,4) not null default 0,
  marca_ofertada text null,
  fabricante_ofertado text null,
  codigo_anvisa_ofertado text null,
  prazo_entrega_dias integer null,
  disponibilidade text not null default 'pronta_entrega',
  observacoes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint compras_cotacao_item_propostas_unique unique (cotacao_item_id, fornecedor_id),
  constraint compras_cotacao_item_propostas_valor_check check (valor_unitario >= 0),
  constraint compras_cotacao_item_propostas_quantidade_check check (quantidade_ofertada is null or quantidade_ofertada >= 0),
  constraint compras_cotacao_item_propostas_prazo_check check (prazo_entrega_dias is null or prazo_entrega_dias >= 0),
  constraint compras_cotacao_item_propostas_disponibilidade_check check (
    disponibilidade = any (array['pronta_entrega','parcial','sob_encomenda','indisponivel'])
  )
);

create index if not exists idx_compras_cotacao_item_propostas_fornecedor
  on public.compras_cotacao_item_propostas (fornecedor_id, cotacao_item_id);

alter table public.compras_cotacao_item_propostas enable row level security;
alter table public.compras_cotacao_item_propostas force row level security;
drop policy if exists compras_cotacao_item_propostas_all on public.compras_cotacao_item_propostas;
create policy compras_cotacao_item_propostas_all on public.compras_cotacao_item_propostas
for all to authenticated
using (exists (
  select 1
  from public.compras_cotacao_itens ci
  join public.compras_cotacoes c on c.id = ci.cotacao_id
  where ci.id = compras_cotacao_item_propostas.cotacao_item_id
    and public.tem_unidade(c.empresa_id, c.unidade_id)
))
with check (exists (
  select 1
  from public.compras_cotacao_itens ci
  join public.compras_cotacoes c on c.id = ci.cotacao_id
  where ci.id = compras_cotacao_item_propostas.cotacao_item_id
    and public.tem_unidade(c.empresa_id, c.unidade_id)
));
grant select, insert, update, delete on public.compras_cotacao_item_propostas to authenticated;

alter table public.compras_cotacao_fornecedores
  add column if not exists itens_cotados integer not null default 0,
  add column if not exists itens_total integer not null default 0,
  add column if not exists atualizado_em timestamptz null;

alter table public.compras_pedido_itens
  add column if not exists item_assistencial_id uuid null references public.itens_assistenciais(id) on delete set null,
  add column if not exists cotacao_item_id uuid null references public.compras_cotacao_itens(id) on delete set null,
  add column if not exists unidade_medida text not null default 'UN';
create index if not exists idx_compras_pedido_itens_catalogo
  on public.compras_pedido_itens (item_assistencial_id)
  where item_assistencial_id is not null;

create or replace function public.gerar_cotacao_compra_catalogo(
  p_solicitacao_id uuid,
  p_validade date default null,
  p_observacoes text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_solicitacao public.compras_solicitacoes%rowtype;
  v_cotacao_id uuid;
  v_numero text;
  v_itens integer;
begin
  select * into v_solicitacao
  from public.compras_solicitacoes
  where id = p_solicitacao_id
  for update;

  if v_solicitacao.id is null then
    raise exception 'solicitacao_nao_encontrada';
  end if;
  if not public.tem_unidade(v_solicitacao.empresa_id, v_solicitacao.unidade_id) then
    raise exception 'sem_acesso_unidade';
  end if;
  if v_solicitacao.status not in ('solicitada','aprovada','em_cotacao','cotacao') then
    raise exception 'status_solicitacao_invalido';
  end if;

  select count(*)::int into v_itens
  from public.compras_solicitacao_itens
  where solicitacao_id = p_solicitacao_id;
  if v_itens = 0 then
    raise exception 'solicitacao_sem_itens';
  end if;

  v_numero := 'CT' || to_char(clock_timestamp(), 'YYMMDDHH24MISSMS');
  insert into public.compras_cotacoes (
    empresa_id, unidade_id, solicitacao_id, numero, status, validade, observacoes, created_by
  ) values (
    v_solicitacao.empresa_id, v_solicitacao.unidade_id, p_solicitacao_id, v_numero,
    'aberta', p_validade, nullif(trim(p_observacoes), ''), auth.uid()
  ) returning id into v_cotacao_id;

  insert into public.compras_cotacao_itens (
    cotacao_id, solicitacao_item_id, item_assistencial_id, categoria_item, codigo_interno,
    descricao, quantidade, unidade_medida, tabela_tiss_codigo, codigo_tuss,
    codigo_tabela_propria, codigo_brasindice, codigo_simpro, codigo_anvisa,
    fabricante, apresentacao, observacoes
  )
  select
    v_cotacao_id, si.id, si.item_assistencial_id, coalesce(si.categoria_item, 'outro'), si.codigo_interno,
    si.descricao, si.quantidade, si.unidade_medida, si.tabela_tiss_codigo, si.codigo_tuss,
    si.codigo_tabela_propria, si.codigo_brasindice, si.codigo_simpro, si.codigo_anvisa,
    si.fabricante, si.apresentacao, si.observacoes
  from public.compras_solicitacao_itens si
  where si.solicitacao_id = p_solicitacao_id;

  update public.compras_solicitacoes
  set status = 'em_cotacao', updated_at = now()
  where id = p_solicitacao_id;

  return v_cotacao_id;
end;
$$;
revoke all on function public.gerar_cotacao_compra_catalogo(uuid,date,text) from public, anon;
grant execute on function public.gerar_cotacao_compra_catalogo(uuid,date,text) to authenticated;

create or replace function public.salvar_proposta_item_cotacao(
  p_cotacao_item_id uuid,
  p_fornecedor_id uuid,
  p_valor_unitario numeric,
  p_quantidade_ofertada numeric default null,
  p_marca text default null,
  p_fabricante text default null,
  p_codigo_anvisa text default null,
  p_prazo_entrega_dias integer default null,
  p_disponibilidade text default 'pronta_entrega',
  p_observacoes text default null
)
returns numeric
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_cotacao_id uuid;
  v_empresa_id uuid;
  v_unidade_id uuid;
  v_quantidade numeric;
  v_total numeric := 0;
  v_itens_total integer := 0;
  v_itens_cotados integer := 0;
begin
  if p_valor_unitario < 0 then raise exception 'valor_invalido'; end if;
  if p_disponibilidade not in ('pronta_entrega','parcial','sob_encomenda','indisponivel') then
    raise exception 'disponibilidade_invalida';
  end if;

  select ci.cotacao_id, c.empresa_id, c.unidade_id, ci.quantidade
    into v_cotacao_id, v_empresa_id, v_unidade_id, v_quantidade
  from public.compras_cotacao_itens ci
  join public.compras_cotacoes c on c.id = ci.cotacao_id
  where ci.id = p_cotacao_item_id;

  if v_cotacao_id is null or not public.tem_unidade(v_empresa_id, v_unidade_id) then
    raise exception 'cotacao_item_invalido';
  end if;
  if not exists (
    select 1 from public.fornecedores f
    where f.id = p_fornecedor_id and f.empresa_id = v_empresa_id and f.ativo
  ) then
    raise exception 'fornecedor_invalido';
  end if;

  insert into public.compras_cotacao_fornecedores (cotacao_id, fornecedor_id, valor_total, frete)
  values (v_cotacao_id, p_fornecedor_id, 0, 0)
  on conflict (cotacao_id, fornecedor_id) do nothing;

  insert into public.compras_cotacao_item_propostas (
    cotacao_item_id, fornecedor_id, quantidade_ofertada, valor_unitario,
    marca_ofertada, fabricante_ofertado, codigo_anvisa_ofertado,
    prazo_entrega_dias, disponibilidade, observacoes, updated_at
  ) values (
    p_cotacao_item_id, p_fornecedor_id, coalesce(p_quantidade_ofertada, v_quantidade), p_valor_unitario,
    nullif(trim(p_marca), ''), nullif(trim(p_fabricante), ''), nullif(trim(p_codigo_anvisa), ''),
    p_prazo_entrega_dias, p_disponibilidade, nullif(trim(p_observacoes), ''), now()
  )
  on conflict (cotacao_item_id, fornecedor_id) do update set
    quantidade_ofertada = excluded.quantidade_ofertada,
    valor_unitario = excluded.valor_unitario,
    marca_ofertada = excluded.marca_ofertada,
    fabricante_ofertado = excluded.fabricante_ofertado,
    codigo_anvisa_ofertado = excluded.codigo_anvisa_ofertado,
    prazo_entrega_dias = excluded.prazo_entrega_dias,
    disponibilidade = excluded.disponibilidade,
    observacoes = excluded.observacoes,
    updated_at = now();

  select count(*)::int into v_itens_total
  from public.compras_cotacao_itens where cotacao_id = v_cotacao_id;

  select count(*)::int,
         coalesce(sum(ci.quantidade * p.valor_unitario) filter (where p.disponibilidade <> 'indisponivel'), 0)
    into v_itens_cotados, v_total
  from public.compras_cotacao_itens ci
  join public.compras_cotacao_item_propostas p
    on p.cotacao_item_id = ci.id and p.fornecedor_id = p_fornecedor_id
  where ci.cotacao_id = v_cotacao_id
    and p.disponibilidade <> 'indisponivel';

  update public.compras_cotacao_fornecedores
  set valor_total = v_total,
      itens_cotados = v_itens_cotados,
      itens_total = v_itens_total,
      atualizado_em = now()
  where cotacao_id = v_cotacao_id and fornecedor_id = p_fornecedor_id;

  return v_total;
end;
$$;
revoke all on function public.salvar_proposta_item_cotacao(uuid,uuid,numeric,numeric,text,text,text,integer,text,text) from public, anon;
grant execute on function public.salvar_proposta_item_cotacao(uuid,uuid,numeric,numeric,text,text,text,integer,text,text) to authenticated;

create or replace function public.gerar_pedido_cotacao_aprovada(p_cotacao_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_cotacao public.compras_cotacoes%rowtype;
  v_fornecedor public.compras_cotacao_fornecedores%rowtype;
  v_pedido_id uuid;
  v_numero text;
begin
  select * into v_cotacao from public.compras_cotacoes where id = p_cotacao_id for update;
  if v_cotacao.id is null or not public.tem_unidade(v_cotacao.empresa_id, v_cotacao.unidade_id) then
    raise exception 'cotacao_invalida';
  end if;
  if v_cotacao.status <> 'aprovada' then raise exception 'cotacao_nao_aprovada'; end if;

  select * into v_fornecedor
  from public.compras_cotacao_fornecedores
  where cotacao_id = p_cotacao_id and selecionado
  limit 1;
  if v_fornecedor.id is null then raise exception 'fornecedor_nao_selecionado'; end if;
  if v_fornecedor.itens_total = 0 or v_fornecedor.itens_cotados < v_fornecedor.itens_total then
    raise exception 'cotacao_incompleta';
  end if;

  select id into v_pedido_id
  from public.compras_pedidos
  where solicitacao_id = v_cotacao.solicitacao_id and fornecedor_id = v_fornecedor.fornecedor_id
  order by created_at desc limit 1;
  if v_pedido_id is not null then return v_pedido_id; end if;

  v_numero := 'PC' || to_char(clock_timestamp(), 'YYMMDDHH24MISSMS');
  insert into public.compras_pedidos (
    empresa_id, unidade_id, solicitacao_id, fornecedor_id, numero, data_pedido,
    previsao_entrega, valor_total, status, created_by
  ) values (
    v_cotacao.empresa_id, v_cotacao.unidade_id, v_cotacao.solicitacao_id,
    v_fornecedor.fornecedor_id, v_numero, current_date,
    case when v_fornecedor.prazo_entrega_dias is null then null else current_date + v_fornecedor.prazo_entrega_dias end,
    v_fornecedor.valor_total + v_fornecedor.frete, 'aberto', auth.uid()
  ) returning id into v_pedido_id;

  insert into public.compras_pedido_itens (
    pedido_id, produto_id, item_assistencial_id, cotacao_item_id, descricao,
    quantidade, unidade_medida, valor_unitario, valor_total
  )
  select
    v_pedido_id,
    ep.id,
    ci.item_assistencial_id,
    ci.id,
    ci.descricao,
    ci.quantidade,
    ci.unidade_medida,
    prop.valor_unitario,
    round(ci.quantidade * prop.valor_unitario, 2)
  from public.compras_cotacao_itens ci
  join public.compras_cotacao_item_propostas prop
    on prop.cotacao_item_id = ci.id
   and prop.fornecedor_id = v_fornecedor.fornecedor_id
   and prop.disponibilidade <> 'indisponivel'
  left join lateral (
    select p.id from public.estoque_produtos p
    where p.item_assistencial_id = ci.item_assistencial_id
      and p.empresa_id = v_cotacao.empresa_id
      and p.ativo
    order by p.created_at
    limit 1
  ) ep on true
  where ci.cotacao_id = p_cotacao_id;

  update public.compras_cotacoes set status = 'convertida_pedido' where id = p_cotacao_id;
  update public.compras_solicitacoes set status = 'pedido_emitido', updated_at = now()
  where id = v_cotacao.solicitacao_id;

  return v_pedido_id;
end;
$$;
revoke all on function public.gerar_pedido_cotacao_aprovada(uuid) from public, anon;
grant execute on function public.gerar_pedido_cotacao_aprovada(uuid) to authenticated;
