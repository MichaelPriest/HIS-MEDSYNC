-- Cotação MATMED item a item, com snapshots do catálogo, RBAC e geração idempotente de pedido.

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
set categoria_item = coalesce(si.categoria_item, case when ia.categoria in ('material','medicamento','opme','gas_medicinal') then ia.categoria else 'outro' end),
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
drop policy if exists compras_cotacao_itens_select on public.compras_cotacao_itens;
drop policy if exists compras_cotacao_itens_mutate on public.compras_cotacao_itens;
create policy compras_cotacao_itens_select on public.compras_cotacao_itens for select to authenticated using (
  exists (select 1 from public.compras_cotacoes c where c.id=compras_cotacao_itens.cotacao_id and public.tem_unidade(c.empresa_id,c.unidade_id)
    and (public.tem_permissao(c.empresa_id,c.unidade_id,'compras.visualizar') or public.tem_permissao(c.empresa_id,c.unidade_id,'compras.solicitar') or public.tem_permissao(c.empresa_id,c.unidade_id,'compras.cotar') or public.tem_permissao(c.empresa_id,c.unidade_id,'compras.aprovar') or public.tem_permissao(c.empresa_id,c.unidade_id,'compras.gerenciar') or public.tem_permissao(c.empresa_id,c.unidade_id,'compras.receber')))
);
create policy compras_cotacao_itens_mutate on public.compras_cotacao_itens for all to authenticated using (
  exists (select 1 from public.compras_cotacoes c where c.id=compras_cotacao_itens.cotacao_id and public.tem_unidade(c.empresa_id,c.unidade_id)
    and (public.tem_permissao(c.empresa_id,c.unidade_id,'compras.cotar') or public.tem_permissao(c.empresa_id,c.unidade_id,'compras.gerenciar')))
) with check (
  exists (select 1 from public.compras_cotacoes c where c.id=compras_cotacao_itens.cotacao_id and public.tem_unidade(c.empresa_id,c.unidade_id)
    and (public.tem_permissao(c.empresa_id,c.unidade_id,'compras.cotar') or public.tem_permissao(c.empresa_id,c.unidade_id,'compras.gerenciar')))
);
grant select,insert,update on public.compras_cotacao_itens to authenticated;
revoke delete on public.compras_cotacao_itens from anon,authenticated;

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
  constraint compras_cotacao_item_propostas_disponibilidade_check check (disponibilidade = any (array['pronta_entrega','parcial','sob_encomenda','indisponivel']))
);
create index if not exists idx_compras_cotacao_item_propostas_fornecedor on public.compras_cotacao_item_propostas(fornecedor_id,cotacao_item_id);
alter table public.compras_cotacao_item_propostas enable row level security;
alter table public.compras_cotacao_item_propostas force row level security;
drop policy if exists compras_cotacao_item_propostas_select on public.compras_cotacao_item_propostas;
drop policy if exists compras_cotacao_item_propostas_mutate on public.compras_cotacao_item_propostas;
create policy compras_cotacao_item_propostas_select on public.compras_cotacao_item_propostas for select to authenticated using (
  exists (select 1 from public.compras_cotacao_itens ci join public.compras_cotacoes c on c.id=ci.cotacao_id where ci.id=compras_cotacao_item_propostas.cotacao_item_id and public.tem_unidade(c.empresa_id,c.unidade_id)
    and (public.tem_permissao(c.empresa_id,c.unidade_id,'compras.visualizar') or public.tem_permissao(c.empresa_id,c.unidade_id,'compras.solicitar') or public.tem_permissao(c.empresa_id,c.unidade_id,'compras.cotar') or public.tem_permissao(c.empresa_id,c.unidade_id,'compras.aprovar') or public.tem_permissao(c.empresa_id,c.unidade_id,'compras.gerenciar') or public.tem_permissao(c.empresa_id,c.unidade_id,'compras.receber')))
);
create policy compras_cotacao_item_propostas_mutate on public.compras_cotacao_item_propostas for all to authenticated using (
  exists (select 1 from public.compras_cotacao_itens ci join public.compras_cotacoes c on c.id=ci.cotacao_id where ci.id=compras_cotacao_item_propostas.cotacao_item_id and public.tem_unidade(c.empresa_id,c.unidade_id)
    and (public.tem_permissao(c.empresa_id,c.unidade_id,'compras.cotar') or public.tem_permissao(c.empresa_id,c.unidade_id,'compras.gerenciar')))
) with check (
  exists (select 1 from public.compras_cotacao_itens ci join public.compras_cotacoes c on c.id=ci.cotacao_id where ci.id=compras_cotacao_item_propostas.cotacao_item_id and public.tem_unidade(c.empresa_id,c.unidade_id)
    and (public.tem_permissao(c.empresa_id,c.unidade_id,'compras.cotar') or public.tem_permissao(c.empresa_id,c.unidade_id,'compras.gerenciar')))
);
grant select,insert,update,delete on public.compras_cotacao_item_propostas to authenticated;

alter table public.compras_cotacao_fornecedores
  add column if not exists itens_cotados integer not null default 0,
  add column if not exists itens_total integer not null default 0,
  add column if not exists atualizado_em timestamptz null;

alter table public.compras_pedidos add column if not exists cotacao_id uuid null references public.compras_cotacoes(id) on delete set null;
create unique index if not exists ux_compras_pedido_cotacao on public.compras_pedidos(cotacao_id) where cotacao_id is not null;

alter table public.compras_pedido_itens
  add column if not exists item_assistencial_id uuid null references public.itens_assistenciais(id) on delete set null,
  add column if not exists cotacao_item_id uuid null references public.compras_cotacao_itens(id) on delete set null,
  add column if not exists unidade_medida text not null default 'UN';
create index if not exists idx_compras_pedido_itens_catalogo on public.compras_pedido_itens(item_assistencial_id) where item_assistencial_id is not null;

-- Backfill de snapshots das cotações existentes; não altera preço/proposta.
insert into public.compras_cotacao_itens(cotacao_id,solicitacao_item_id,item_assistencial_id,categoria_item,codigo_interno,descricao,quantidade,unidade_medida,tabela_tiss_codigo,codigo_tuss,codigo_tabela_propria,codigo_brasindice,codigo_simpro,codigo_anvisa,fabricante,apresentacao,observacoes)
select c.id,si.id,si.item_assistencial_id,coalesce(si.categoria_item,'outro'),si.codigo_interno,si.descricao,si.quantidade,si.unidade_medida,si.tabela_tiss_codigo,si.codigo_tuss,si.codigo_tabela_propria,si.codigo_brasindice,si.codigo_simpro,si.codigo_anvisa,si.fabricante,si.apresentacao,si.observacoes
from public.compras_cotacoes c join public.compras_solicitacao_itens si on si.solicitacao_id=c.solicitacao_id
on conflict do nothing;

update public.compras_cotacao_fornecedores cf set itens_total=(select count(*) from public.compras_cotacao_itens ci where ci.cotacao_id=cf.cotacao_id), atualizado_em=coalesce(cf.atualizado_em,now());

create or replace function public.gerar_cotacao_compra_catalogo(p_solicitacao_id uuid,p_validade date default null,p_observacoes text default null)
returns uuid language plpgsql security invoker set search_path='' as $function$
declare v_s public.compras_solicitacoes%rowtype; v_id uuid; v_numero text; v_itens integer;
begin
  if auth.uid() is null then raise exception 'COMPRAS_AUTENTICACAO_OBRIGATORIA' using errcode='42501'; end if;
  select * into v_s from public.compras_solicitacoes where id=p_solicitacao_id for update;
  if v_s.id is null then raise exception 'COMPRAS_SOLICITACAO_NAO_ENCONTRADA'; end if;
  if not public.tem_unidade(v_s.empresa_id,v_s.unidade_id) then raise exception 'COMPRAS_UNIDADE_FORA_ESCOPO' using errcode='42501'; end if;
  if not (public.tem_permissao(v_s.empresa_id,v_s.unidade_id,'compras.cotar') or public.tem_permissao(v_s.empresa_id,v_s.unidade_id,'compras.gerenciar')) then raise exception 'COMPRAS_SEM_PERMISSAO_COTAR' using errcode='42501'; end if;
  if v_s.status not in ('solicitada','aprovada','em_cotacao','cotacao') then raise exception 'COMPRAS_STATUS_SOLICITACAO_INVALIDO'; end if;
  select id into v_id from public.compras_cotacoes where solicitacao_id=p_solicitacao_id and status in ('aberta','em_analise') order by created_at desc limit 1;
  if v_id is not null then return v_id; end if;
  select count(*)::int into v_itens from public.compras_solicitacao_itens where solicitacao_id=p_solicitacao_id;
  if v_itens=0 then raise exception 'COMPRAS_SOLICITACAO_SEM_ITENS'; end if;
  v_numero:='CT'||to_char(clock_timestamp(),'YYMMDDHH24MISSMS');
  insert into public.compras_cotacoes(empresa_id,unidade_id,solicitacao_id,numero,status,validade,observacoes,created_by)
  values(v_s.empresa_id,v_s.unidade_id,p_solicitacao_id,v_numero,'aberta',p_validade,nullif(trim(p_observacoes),''),auth.uid()) returning id into v_id;
  insert into public.compras_cotacao_itens(cotacao_id,solicitacao_item_id,item_assistencial_id,categoria_item,codigo_interno,descricao,quantidade,unidade_medida,tabela_tiss_codigo,codigo_tuss,codigo_tabela_propria,codigo_brasindice,codigo_simpro,codigo_anvisa,fabricante,apresentacao,observacoes)
  select v_id,si.id,si.item_assistencial_id,coalesce(si.categoria_item,'outro'),si.codigo_interno,si.descricao,si.quantidade,si.unidade_medida,si.tabela_tiss_codigo,si.codigo_tuss,si.codigo_tabela_propria,si.codigo_brasindice,si.codigo_simpro,si.codigo_anvisa,si.fabricante,si.apresentacao,si.observacoes from public.compras_solicitacao_itens si where si.solicitacao_id=p_solicitacao_id;
  update public.compras_solicitacoes set status='em_cotacao',updated_at=now() where id=p_solicitacao_id;
  return v_id;
end;$function$;
revoke all on function public.gerar_cotacao_compra_catalogo(uuid,date,text) from public,anon;
grant execute on function public.gerar_cotacao_compra_catalogo(uuid,date,text) to authenticated;

create or replace function public.adicionar_fornecedor_cotacao_operacional(p_cotacao_id uuid,p_fornecedor_id uuid,p_frete numeric default 0,p_prazo_entrega_dias integer default null,p_condicao_pagamento text default null,p_observacoes text default null)
returns uuid language plpgsql security invoker set search_path='' as $function$
declare v_c public.compras_cotacoes%rowtype; v_id uuid; v_total integer;
begin
  if auth.uid() is null then raise exception 'COMPRAS_AUTENTICACAO_OBRIGATORIA' using errcode='42501'; end if;
  select * into v_c from public.compras_cotacoes where id=p_cotacao_id for update;
  if v_c.id is null or not public.tem_unidade(v_c.empresa_id,v_c.unidade_id) then raise exception 'COMPRAS_COTACAO_FORA_ESCOPO' using errcode='42501'; end if;
  if not (public.tem_permissao(v_c.empresa_id,v_c.unidade_id,'compras.cotar') or public.tem_permissao(v_c.empresa_id,v_c.unidade_id,'compras.gerenciar')) then raise exception 'COMPRAS_SEM_PERMISSAO_COTAR' using errcode='42501'; end if;
  if v_c.status not in ('aberta','em_analise') then raise exception 'COMPRAS_COTACAO_FECHADA'; end if;
  if not exists(select 1 from public.fornecedores f where f.id=p_fornecedor_id and f.empresa_id=v_c.empresa_id and f.ativo) then raise exception 'COMPRAS_FORNECEDOR_INVALIDO'; end if;
  select count(*)::int into v_total from public.compras_cotacao_itens where cotacao_id=p_cotacao_id;
  insert into public.compras_cotacao_fornecedores(cotacao_id,fornecedor_id,valor_total,prazo_entrega_dias,condicao_pagamento,frete,observacoes,itens_total,atualizado_em)
  values(p_cotacao_id,p_fornecedor_id,0,p_prazo_entrega_dias,nullif(trim(p_condicao_pagamento),''),greatest(coalesce(p_frete,0),0),nullif(trim(p_observacoes),''),v_total,now())
  on conflict(cotacao_id,fornecedor_id) do update set prazo_entrega_dias=excluded.prazo_entrega_dias,condicao_pagamento=excluded.condicao_pagamento,frete=excluded.frete,observacoes=excluded.observacoes,itens_total=excluded.itens_total,atualizado_em=now()
  returning id into v_id;
  return v_id;
end;$function$;
revoke all on function public.adicionar_fornecedor_cotacao_operacional(uuid,uuid,numeric,integer,text,text) from public,anon;
grant execute on function public.adicionar_fornecedor_cotacao_operacional(uuid,uuid,numeric,integer,text,text) to authenticated;

create or replace function public.salvar_proposta_item_cotacao(p_cotacao_item_id uuid,p_fornecedor_id uuid,p_valor_unitario numeric,p_quantidade_ofertada numeric default null,p_marca text default null,p_fabricante text default null,p_codigo_anvisa text default null,p_prazo_entrega_dias integer default null,p_disponibilidade text default 'pronta_entrega',p_observacoes text default null)
returns numeric language plpgsql security invoker set search_path='' as $function$
declare v_cotacao_id uuid;v_empresa uuid;v_unidade uuid;v_quantidade numeric;v_total numeric:=0;v_itens_total integer:=0;v_itens_cotados integer:=0;
begin
  if auth.uid() is null then raise exception 'COMPRAS_AUTENTICACAO_OBRIGATORIA' using errcode='42501'; end if;
  if p_valor_unitario<0 then raise exception 'COMPRAS_VALOR_INVALIDO'; end if;
  if p_disponibilidade not in ('pronta_entrega','parcial','sob_encomenda','indisponivel') then raise exception 'COMPRAS_DISPONIBILIDADE_INVALIDA'; end if;
  select ci.cotacao_id,c.empresa_id,c.unidade_id,ci.quantidade into v_cotacao_id,v_empresa,v_unidade,v_quantidade from public.compras_cotacao_itens ci join public.compras_cotacoes c on c.id=ci.cotacao_id where ci.id=p_cotacao_item_id;
  if v_cotacao_id is null or not public.tem_unidade(v_empresa,v_unidade) then raise exception 'COMPRAS_COTACAO_ITEM_FORA_ESCOPO' using errcode='42501'; end if;
  if not (public.tem_permissao(v_empresa,v_unidade,'compras.cotar') or public.tem_permissao(v_empresa,v_unidade,'compras.gerenciar')) then raise exception 'COMPRAS_SEM_PERMISSAO_COTAR' using errcode='42501'; end if;
  if not exists(select 1 from public.compras_cotacoes where id=v_cotacao_id and status in ('aberta','em_analise')) then raise exception 'COMPRAS_COTACAO_FECHADA'; end if;
  if not exists(select 1 from public.compras_cotacao_fornecedores cf join public.fornecedores f on f.id=cf.fornecedor_id where cf.cotacao_id=v_cotacao_id and cf.fornecedor_id=p_fornecedor_id and f.empresa_id=v_empresa and f.ativo) then raise exception 'COMPRAS_FORNECEDOR_NAO_VINCULADO'; end if;
  insert into public.compras_cotacao_item_propostas(cotacao_item_id,fornecedor_id,quantidade_ofertada,valor_unitario,marca_ofertada,fabricante_ofertado,codigo_anvisa_ofertado,prazo_entrega_dias,disponibilidade,observacoes,updated_at)
  values(p_cotacao_item_id,p_fornecedor_id,coalesce(p_quantidade_ofertada,v_quantidade),p_valor_unitario,nullif(trim(p_marca),''),nullif(trim(p_fabricante),''),nullif(trim(p_codigo_anvisa),''),p_prazo_entrega_dias,p_disponibilidade,nullif(trim(p_observacoes),''),now())
  on conflict(cotacao_item_id,fornecedor_id) do update set quantidade_ofertada=excluded.quantidade_ofertada,valor_unitario=excluded.valor_unitario,marca_ofertada=excluded.marca_ofertada,fabricante_ofertado=excluded.fabricante_ofertado,codigo_anvisa_ofertado=excluded.codigo_anvisa_ofertado,prazo_entrega_dias=excluded.prazo_entrega_dias,disponibilidade=excluded.disponibilidade,observacoes=excluded.observacoes,updated_at=now();
  select count(*)::int into v_itens_total from public.compras_cotacao_itens where cotacao_id=v_cotacao_id;
  select count(*) filter(where p.disponibilidade<>'indisponivel' and coalesce(p.quantidade_ofertada,0)>=ci.quantidade)::int,
         coalesce(sum(ci.quantidade*p.valor_unitario) filter(where p.disponibilidade<>'indisponivel' and coalesce(p.quantidade_ofertada,0)>=ci.quantidade),0)
    into v_itens_cotados,v_total
  from public.compras_cotacao_itens ci left join public.compras_cotacao_item_propostas p on p.cotacao_item_id=ci.id and p.fornecedor_id=p_fornecedor_id where ci.cotacao_id=v_cotacao_id;
  update public.compras_cotacao_fornecedores set valor_total=v_total,itens_cotados=v_itens_cotados,itens_total=v_itens_total,atualizado_em=now() where cotacao_id=v_cotacao_id and fornecedor_id=p_fornecedor_id;
  return v_total;
end;$function$;
revoke all on function public.salvar_proposta_item_cotacao(uuid,uuid,numeric,numeric,text,text,text,integer,text,text) from public,anon;
grant execute on function public.salvar_proposta_item_cotacao(uuid,uuid,numeric,numeric,text,text,text,integer,text,text) to authenticated;

create or replace function public.aprovar_fornecedor_cotacao_operacional(p_cotacao_id uuid,p_fornecedor_id uuid)
returns void language plpgsql security invoker set search_path='' as $function$
declare v_c public.compras_cotacoes%rowtype;v_cf public.compras_cotacao_fornecedores%rowtype;
begin
  if auth.uid() is null then raise exception 'COMPRAS_AUTENTICACAO_OBRIGATORIA' using errcode='42501'; end if;
  select * into v_c from public.compras_cotacoes where id=p_cotacao_id for update;
  if v_c.id is null or not public.tem_unidade(v_c.empresa_id,v_c.unidade_id) then raise exception 'COMPRAS_COTACAO_FORA_ESCOPO' using errcode='42501'; end if;
  if not (public.tem_permissao(v_c.empresa_id,v_c.unidade_id,'compras.aprovar') or public.tem_permissao(v_c.empresa_id,v_c.unidade_id,'compras.gerenciar')) then raise exception 'COMPRAS_SEM_PERMISSAO_APROVAR' using errcode='42501'; end if;
  if v_c.status not in ('aberta','em_analise') then raise exception 'COMPRAS_COTACAO_NAO_APROVAVEL'; end if;
  select * into v_cf from public.compras_cotacao_fornecedores where cotacao_id=p_cotacao_id and fornecedor_id=p_fornecedor_id for update;
  if v_cf.id is null or v_cf.itens_total=0 or v_cf.itens_cotados<v_cf.itens_total then raise exception 'COMPRAS_PROPOSTA_INCOMPLETA'; end if;
  update public.compras_cotacao_fornecedores set selecionado=false where cotacao_id=p_cotacao_id;
  update public.compras_cotacao_fornecedores set selecionado=true,atualizado_em=now() where cotacao_id=p_cotacao_id and fornecedor_id=p_fornecedor_id;
  update public.compras_cotacoes set status='aprovada' where id=p_cotacao_id;
end;$function$;
revoke all on function public.aprovar_fornecedor_cotacao_operacional(uuid,uuid) from public,anon;
grant execute on function public.aprovar_fornecedor_cotacao_operacional(uuid,uuid) to authenticated;

create or replace function public.gerar_pedido_cotacao_aprovada(p_cotacao_id uuid)
returns uuid language plpgsql security invoker set search_path='' as $function$
declare v_c public.compras_cotacoes%rowtype;v_cf public.compras_cotacao_fornecedores%rowtype;v_pedido uuid;v_numero text;
begin
  if auth.uid() is null then raise exception 'COMPRAS_AUTENTICACAO_OBRIGATORIA' using errcode='42501'; end if;
  select * into v_c from public.compras_cotacoes where id=p_cotacao_id for update;
  if v_c.id is null or not public.tem_unidade(v_c.empresa_id,v_c.unidade_id) then raise exception 'COMPRAS_COTACAO_FORA_ESCOPO' using errcode='42501'; end if;
  if not (public.tem_permissao(v_c.empresa_id,v_c.unidade_id,'compras.aprovar') or public.tem_permissao(v_c.empresa_id,v_c.unidade_id,'compras.gerenciar')) then raise exception 'COMPRAS_SEM_PERMISSAO_APROVAR' using errcode='42501'; end if;
  select id into v_pedido from public.compras_pedidos where cotacao_id=p_cotacao_id limit 1;
  if v_pedido is not null then return v_pedido; end if;
  if v_c.status<>'aprovada' then raise exception 'COMPRAS_COTACAO_NAO_APROVADA'; end if;
  select * into v_cf from public.compras_cotacao_fornecedores where cotacao_id=p_cotacao_id and selecionado limit 1;
  if v_cf.id is null or v_cf.itens_total=0 or v_cf.itens_cotados<v_cf.itens_total then raise exception 'COMPRAS_COTACAO_INCOMPLETA'; end if;
  v_numero:='PC'||to_char(clock_timestamp(),'YYMMDDHH24MISSMS');
  insert into public.compras_pedidos(empresa_id,unidade_id,solicitacao_id,cotacao_id,fornecedor_id,numero,data_pedido,previsao_entrega,valor_total,status,created_by)
  values(v_c.empresa_id,v_c.unidade_id,v_c.solicitacao_id,p_cotacao_id,v_cf.fornecedor_id,v_numero,current_date,case when v_cf.prazo_entrega_dias is null then null else current_date+v_cf.prazo_entrega_dias end,v_cf.valor_total+v_cf.frete,'aberto',auth.uid()) returning id into v_pedido;
  insert into public.compras_pedido_itens(pedido_id,produto_id,item_assistencial_id,cotacao_item_id,descricao,quantidade,unidade_medida,valor_unitario,valor_total)
  select v_pedido,ep.id,ci.item_assistencial_id,ci.id,ci.descricao,ci.quantidade,ci.unidade_medida,p.valor_unitario,round(ci.quantidade*p.valor_unitario,2)
  from public.compras_cotacao_itens ci join public.compras_cotacao_item_propostas p on p.cotacao_item_id=ci.id and p.fornecedor_id=v_cf.fornecedor_id and p.disponibilidade<>'indisponivel' and coalesce(p.quantidade_ofertada,0)>=ci.quantidade
  left join lateral(select e.id from public.estoque_produtos e where e.item_assistencial_id=ci.item_assistencial_id and e.empresa_id=v_c.empresa_id and e.ativo order by e.created_at limit 1) ep on true
  where ci.cotacao_id=p_cotacao_id;
  update public.compras_cotacoes set status='convertida_pedido' where id=p_cotacao_id;
  if v_c.solicitacao_id is not null then update public.compras_solicitacoes set status='pedido_emitido',updated_at=now() where id=v_c.solicitacao_id; end if;
  return v_pedido;
end;$function$;
revoke all on function public.gerar_pedido_cotacao_aprovada(uuid) from public,anon;
grant execute on function public.gerar_pedido_cotacao_aprovada(uuid) to authenticated;
