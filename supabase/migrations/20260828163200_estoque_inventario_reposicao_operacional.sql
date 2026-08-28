-- Inventário físico, parâmetros de reposição por local e movimentação manual transacional.

create table if not exists public.estoque_parametros_local (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  unidade_id uuid not null references public.unidades(id),
  local_id uuid not null references public.estoque_locais(id) on delete cascade,
  produto_id uuid not null references public.estoque_produtos(id) on delete cascade,
  estoque_minimo numeric not null default 0 check (estoque_minimo >= 0),
  ponto_reposicao numeric not null default 0 check (ponto_reposicao >= 0),
  estoque_maximo numeric not null default 0 check (estoque_maximo >= 0),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id),
  constraint estoque_parametros_local_faixa_check check (estoque_minimo <= ponto_reposicao and ponto_reposicao <= estoque_maximo),
  constraint estoque_parametros_local_unique unique (empresa_id,unidade_id,local_id,produto_id)
);

create index if not exists idx_estoque_parametros_local_reposicao
  on public.estoque_parametros_local(empresa_id,unidade_id,local_id,ativo,ponto_reposicao);

create table if not exists public.estoque_inventarios (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  unidade_id uuid not null references public.unidades(id),
  local_id uuid not null references public.estoque_locais(id) on delete restrict,
  numero text not null,
  status text not null default 'aberto' check (status in ('aberto','em_contagem','conciliado','cancelado')),
  motivo text null,
  observacoes text null,
  iniciado_em timestamptz not null default now(),
  finalizado_em timestamptz null,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id),
  constraint estoque_inventarios_numero_unique unique (empresa_id,numero)
);

create unique index if not exists ux_estoque_inventario_aberto_local
  on public.estoque_inventarios(empresa_id,unidade_id,local_id)
  where status in ('aberto','em_contagem');

create table if not exists public.estoque_inventario_itens (
  id uuid primary key default gen_random_uuid(),
  inventario_id uuid not null references public.estoque_inventarios(id) on delete cascade,
  lote_id uuid not null references public.estoque_lotes(id) on delete restrict,
  produto_id uuid not null references public.estoque_produtos(id) on delete restrict,
  saldo_sistema_inicial numeric not null default 0,
  saldo_sistema_final numeric null,
  quantidade_contada numeric null check (quantidade_contada is null or quantidade_contada >= 0),
  divergencia numeric null,
  observacoes text null,
  contado_em timestamptz null,
  contado_por uuid null references auth.users(id),
  ajuste_movimento_id uuid null references public.estoque_movimentos(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint estoque_inventario_itens_unique unique (inventario_id,lote_id)
);

create index if not exists idx_estoque_inventario_itens_produto on public.estoque_inventario_itens(inventario_id,produto_id);

alter table public.estoque_movimentos
  add column if not exists inventario_id uuid null references public.estoque_inventarios(id) on delete restrict,
  add column if not exists inventario_item_id uuid null references public.estoque_inventario_itens(id) on delete restrict;
create index if not exists idx_estoque_movimentos_inventario on public.estoque_movimentos(inventario_id) where inventario_id is not null;

alter table public.estoque_parametros_local enable row level security;
alter table public.estoque_parametros_local force row level security;
drop policy if exists estoque_parametros_local_select on public.estoque_parametros_local;
drop policy if exists estoque_parametros_local_mutate on public.estoque_parametros_local;
create policy estoque_parametros_local_select on public.estoque_parametros_local
for select to authenticated using (
  public.tem_unidade(empresa_id,unidade_id) and (
    public.tem_permissao(empresa_id,unidade_id,'estoque.visualizar') or
    public.tem_permissao(empresa_id,unidade_id,'estoque.movimentar') or
    public.tem_permissao(empresa_id,unidade_id,'estoque.inventariar') or
    public.tem_permissao(empresa_id,unidade_id,'estoque.gerenciar') or
    public.tem_permissao(empresa_id,unidade_id,'almoxarifado.atender') or
    public.tem_permissao(empresa_id,unidade_id,'almoxarifado.requisitar')
  )
);
create policy estoque_parametros_local_mutate on public.estoque_parametros_local
for all to authenticated using (
  public.tem_unidade(empresa_id,unidade_id) and public.tem_permissao(empresa_id,unidade_id,'estoque.gerenciar')
) with check (
  public.tem_unidade(empresa_id,unidade_id) and public.tem_permissao(empresa_id,unidade_id,'estoque.gerenciar')
);
grant select,insert,update on public.estoque_parametros_local to authenticated;
revoke delete on public.estoque_parametros_local from anon,authenticated;

alter table public.estoque_inventarios enable row level security;
alter table public.estoque_inventarios force row level security;
drop policy if exists estoque_inventarios_select on public.estoque_inventarios;
create policy estoque_inventarios_select on public.estoque_inventarios
for select to authenticated using (
  public.tem_unidade(empresa_id,unidade_id) and (
    public.tem_permissao(empresa_id,unidade_id,'estoque.visualizar') or
    public.tem_permissao(empresa_id,unidade_id,'estoque.inventariar') or
    public.tem_permissao(empresa_id,unidade_id,'estoque.gerenciar')
  )
);
grant select on public.estoque_inventarios to authenticated;
revoke insert,update,delete on public.estoque_inventarios from anon,authenticated;

alter table public.estoque_inventario_itens enable row level security;
alter table public.estoque_inventario_itens force row level security;
drop policy if exists estoque_inventario_itens_select on public.estoque_inventario_itens;
create policy estoque_inventario_itens_select on public.estoque_inventario_itens
for select to authenticated using (
  exists (
    select 1 from public.estoque_inventarios i
    where i.id=estoque_inventario_itens.inventario_id
      and public.tem_unidade(i.empresa_id,i.unidade_id)
      and (
        public.tem_permissao(i.empresa_id,i.unidade_id,'estoque.visualizar') or
        public.tem_permissao(i.empresa_id,i.unidade_id,'estoque.inventariar') or
        public.tem_permissao(i.empresa_id,i.unidade_id,'estoque.gerenciar')
      )
  )
);
grant select on public.estoque_inventario_itens to authenticated;
revoke insert,update,delete on public.estoque_inventario_itens from anon,authenticated;

create or replace function public.configurar_parametro_reposicao_estoque(
  p_local_id uuid,
  p_produto_id uuid,
  p_estoque_minimo numeric,
  p_ponto_reposicao numeric,
  p_estoque_maximo numeric
)
returns uuid
language plpgsql
security definer
set search_path to 'public','pg_catalog'
as $function$
declare
  v_local public.estoque_locais%rowtype;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'USUARIO_NAO_AUTENTICADO' using errcode='42501'; end if;
  select * into v_local from public.estoque_locais where id=p_local_id and ativo=true;
  if v_local.id is null then raise exception 'LOCAL_ESTOQUE_INVALIDO'; end if;
  if not public.tem_unidade(v_local.empresa_id,v_local.unidade_id) then raise exception 'LOCAL_FORA_ESCOPO' using errcode='42501'; end if;
  if not public.tem_permissao(v_local.empresa_id,v_local.unidade_id,'estoque.gerenciar') then raise exception 'SEM_PERMISSAO_GERENCIAR_ESTOQUE' using errcode='42501'; end if;
  if not exists(select 1 from public.estoque_produtos p where p.id=p_produto_id and p.empresa_id=v_local.empresa_id and p.ativo=true) then raise exception 'PRODUTO_ESTOQUE_INVALIDO'; end if;
  if coalesce(p_estoque_minimo,-1)<0 or coalesce(p_ponto_reposicao,-1)<0 or coalesce(p_estoque_maximo,-1)<0 then raise exception 'PARAMETRO_REPOSICAO_INVALIDO'; end if;
  if p_estoque_minimo>p_ponto_reposicao or p_ponto_reposicao>p_estoque_maximo then raise exception 'FAIXA_REPOSICAO_INVALIDA'; end if;

  insert into public.estoque_parametros_local(empresa_id,unidade_id,local_id,produto_id,estoque_minimo,ponto_reposicao,estoque_maximo,ativo,created_by,updated_by)
  values(v_local.empresa_id,v_local.unidade_id,v_local.id,p_produto_id,p_estoque_minimo,p_ponto_reposicao,p_estoque_maximo,true,auth.uid(),auth.uid())
  on conflict (empresa_id,unidade_id,local_id,produto_id) do update
    set estoque_minimo=excluded.estoque_minimo,ponto_reposicao=excluded.ponto_reposicao,estoque_maximo=excluded.estoque_maximo,ativo=true,updated_at=now(),updated_by=auth.uid()
  returning id into v_id;
  return v_id;
end;
$function$;

create or replace function public.movimentar_estoque_operacional(
  p_lote_id uuid,
  p_tipo text,
  p_quantidade numeric,
  p_local_destino_id uuid default null,
  p_atendimento_id uuid default null,
  p_motivo text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public','pg_catalog'
as $function$
declare
  v_lote public.estoque_lotes%rowtype;
  v_dest public.estoque_lotes%rowtype;
  v_dest_id uuid;
  v_mov uuid;
  v_tipo text:=lower(trim(coalesce(p_tipo,'')));
begin
  if auth.uid() is null then raise exception 'USUARIO_NAO_AUTENTICADO' using errcode='42501'; end if;
  if coalesce(p_quantidade,0)<=0 then raise exception 'QUANTIDADE_INVALIDA'; end if;
  if v_tipo not in ('entrada','saida','transferencia','consumo_paciente','devolucao') then raise exception 'TIPO_MOVIMENTO_INVALIDO'; end if;

  select * into v_lote from public.estoque_lotes where id=p_lote_id for update;
  if v_lote.id is null then raise exception 'LOTE_NAO_LOCALIZADO'; end if;
  if not public.tem_unidade(v_lote.empresa_id,v_lote.unidade_id) then raise exception 'LOTE_FORA_ESCOPO' using errcode='42501'; end if;
  if not (public.tem_permissao(v_lote.empresa_id,v_lote.unidade_id,'estoque.movimentar') or public.tem_permissao(v_lote.empresa_id,v_lote.unidade_id,'estoque.gerenciar')) then raise exception 'SEM_PERMISSAO_MOVIMENTAR_ESTOQUE' using errcode='42501'; end if;
  if v_lote.validade is not null and v_lote.validade<current_date and v_tipo in ('saida','transferencia','consumo_paciente') then raise exception 'LOTE_VENCIDO_NAO_MOVIMENTAVEL'; end if;
  if v_lote.status<>'disponivel' and v_tipo in ('saida','transferencia','consumo_paciente') then raise exception 'LOTE_NAO_DISPONIVEL'; end if;
  if p_atendimento_id is not null and not exists(select 1 from public.atendimentos a where a.id=p_atendimento_id and a.empresa_id=v_lote.empresa_id and a.unidade_id=v_lote.unidade_id) then raise exception 'ATENDIMENTO_FORA_ESCOPO'; end if;
  if v_tipo='consumo_paciente' and p_atendimento_id is null then raise exception 'ATENDIMENTO_OBRIGATORIO_PARA_CONSUMO'; end if;

  if v_tipo in ('saida','transferencia','consumo_paciente') then
    if v_lote.quantidade<p_quantidade then raise exception 'ESTOQUE_INSUFICIENTE'; end if;
    update public.estoque_lotes set quantidade=quantidade-p_quantidade,updated_at=now() where id=v_lote.id;
  elsif v_tipo in ('entrada','devolucao') then
    update public.estoque_lotes set quantidade=quantidade+p_quantidade,updated_at=now() where id=v_lote.id;
  end if;

  if v_tipo='transferencia' then
    if p_local_destino_id is null or p_local_destino_id=v_lote.local_id then raise exception 'LOCAL_DESTINO_INVALIDO'; end if;
    if not exists(select 1 from public.estoque_locais l where l.id=p_local_destino_id and l.empresa_id=v_lote.empresa_id and l.unidade_id=v_lote.unidade_id and l.ativo=true) then raise exception 'LOCAL_DESTINO_FORA_ESCOPO'; end if;
    select * into v_dest from public.estoque_lotes
      where empresa_id=v_lote.empresa_id and unidade_id=v_lote.unidade_id and local_id=p_local_destino_id and produto_id=v_lote.produto_id
        and coalesce(numero_lote,'')=coalesce(v_lote.numero_lote,'') and validade is not distinct from v_lote.validade
      limit 1 for update;
    if v_dest.id is null then
      insert into public.estoque_lotes(empresa_id,unidade_id,local_id,produto_id,fornecedor_id,numero_lote,validade,quantidade,custo_unitario,status,created_at,updated_at)
      values(v_lote.empresa_id,v_lote.unidade_id,p_local_destino_id,v_lote.produto_id,v_lote.fornecedor_id,v_lote.numero_lote,v_lote.validade,p_quantidade,v_lote.custo_unitario,'disponivel',now(),now())
      returning id into v_dest_id;
    else
      v_dest_id:=v_dest.id;
      update public.estoque_lotes
        set quantidade=quantidade+p_quantidade,
            custo_unitario=case when quantidade+p_quantidade>0 then ((quantidade*coalesce(custo_unitario,0))+(p_quantidade*coalesce(v_lote.custo_unitario,0)))/(quantidade+p_quantidade) else coalesce(v_lote.custo_unitario,0) end,
            updated_at=now()
      where id=v_dest.id;
    end if;
  end if;

  insert into public.estoque_movimentos(empresa_id,unidade_id,produto_id,lote_id,local_origem_id,local_destino_id,atendimento_id,tipo,quantidade,custo_unitario,motivo,created_at,created_by)
  values(
    v_lote.empresa_id,v_lote.unidade_id,v_lote.produto_id,v_lote.id,
    case when v_tipo in ('saida','transferencia','consumo_paciente') then v_lote.local_id else null end,
    case when v_tipo='transferencia' then p_local_destino_id when v_tipo in ('entrada','devolucao') then v_lote.local_id else null end,
    p_atendimento_id,v_tipo,p_quantidade,v_lote.custo_unitario,nullif(trim(coalesce(p_motivo,'')),''),now(),auth.uid()
  ) returning id into v_mov;
  return v_mov;
end;
$function$;

create or replace function public.abrir_inventario_estoque(p_local_id uuid,p_motivo text default null)
returns uuid
language plpgsql
security definer
set search_path to 'public','pg_catalog'
as $function$
declare
  v_local public.estoque_locais%rowtype;
  v_id uuid;
  v_numero text;
  v_qtd integer;
begin
  if auth.uid() is null then raise exception 'USUARIO_NAO_AUTENTICADO' using errcode='42501'; end if;
  select * into v_local from public.estoque_locais where id=p_local_id and ativo=true;
  if v_local.id is null then raise exception 'LOCAL_ESTOQUE_INVALIDO'; end if;
  if not public.tem_unidade(v_local.empresa_id,v_local.unidade_id) then raise exception 'LOCAL_FORA_ESCOPO' using errcode='42501'; end if;
  if not (public.tem_permissao(v_local.empresa_id,v_local.unidade_id,'estoque.inventariar') or public.tem_permissao(v_local.empresa_id,v_local.unidade_id,'estoque.gerenciar')) then raise exception 'SEM_PERMISSAO_INVENTARIAR' using errcode='42501'; end if;
  if exists(select 1 from public.estoque_inventarios i where i.empresa_id=v_local.empresa_id and i.unidade_id=v_local.unidade_id and i.local_id=v_local.id and i.status in ('aberto','em_contagem')) then raise exception 'INVENTARIO_JA_ABERTO_NO_LOCAL'; end if;

  v_numero:='INV-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISS')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,4));
  insert into public.estoque_inventarios(empresa_id,unidade_id,local_id,numero,status,motivo,created_by,updated_by)
  values(v_local.empresa_id,v_local.unidade_id,v_local.id,v_numero,'aberto',nullif(trim(coalesce(p_motivo,'')),''),auth.uid(),auth.uid()) returning id into v_id;

  insert into public.estoque_inventario_itens(inventario_id,lote_id,produto_id,saldo_sistema_inicial)
  select v_id,l.id,l.produto_id,l.quantidade from public.estoque_lotes l where l.empresa_id=v_local.empresa_id and l.unidade_id=v_local.unidade_id and l.local_id=v_local.id order by l.produto_id,l.validade,l.numero_lote;
  get diagnostics v_qtd=row_count;
  if v_qtd=0 then
    delete from public.estoque_inventarios where id=v_id;
    raise exception 'INVENTARIO_SEM_LOTES';
  end if;
  return v_id;
end;
$function$;

create or replace function public.registrar_contagem_inventario_estoque(p_inventario_id uuid,p_itens jsonb)
returns integer
language plpgsql
security definer
set search_path to 'public','pg_catalog'
as $function$
declare
  v_inv public.estoque_inventarios%rowtype;
  v_item jsonb;
  v_qtd numeric;
  v_total integer:=0;
begin
  if auth.uid() is null then raise exception 'USUARIO_NAO_AUTENTICADO' using errcode='42501'; end if;
  if p_itens is null or jsonb_typeof(p_itens)<>'array' then raise exception 'CONTAGEM_INVALIDA'; end if;
  select * into v_inv from public.estoque_inventarios where id=p_inventario_id for update;
  if v_inv.id is null then raise exception 'INVENTARIO_NAO_ENCONTRADO'; end if;
  if not public.tem_unidade(v_inv.empresa_id,v_inv.unidade_id) then raise exception 'INVENTARIO_FORA_ESCOPO' using errcode='42501'; end if;
  if not (public.tem_permissao(v_inv.empresa_id,v_inv.unidade_id,'estoque.inventariar') or public.tem_permissao(v_inv.empresa_id,v_inv.unidade_id,'estoque.gerenciar')) then raise exception 'SEM_PERMISSAO_INVENTARIAR' using errcode='42501'; end if;
  if v_inv.status not in ('aberto','em_contagem') then raise exception 'INVENTARIO_NAO_EDITAVEL'; end if;

  for v_item in select value from jsonb_array_elements(p_itens) loop
    if nullif(v_item->>'item_id','') is null or nullif(v_item->>'quantidade_contada','') is null then continue; end if;
    v_qtd:=(v_item->>'quantidade_contada')::numeric;
    if v_qtd<0 then raise exception 'CONTAGEM_NEGATIVA_INVALIDA'; end if;
    update public.estoque_inventario_itens
      set quantidade_contada=v_qtd,observacoes=nullif(trim(coalesce(v_item->>'observacoes','')),''),contado_em=now(),contado_por=auth.uid(),updated_at=now()
      where id=(v_item->>'item_id')::uuid and inventario_id=v_inv.id;
    if found then v_total:=v_total+1; end if;
  end loop;
  if v_total=0 then raise exception 'CONTAGEM_SEM_ITENS_VALIDOS'; end if;
  update public.estoque_inventarios set status='em_contagem',updated_at=now(),updated_by=auth.uid() where id=v_inv.id;
  return v_total;
end;
$function$;

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
      set saldo_sistema_final=v_lote.quantidade,divergencia=v_delta,ajuste_movimento_id=v_mov,updated_at=now()
      where id=v_item.id;
  end loop;

  update public.estoque_inventarios set status='conciliado',observacoes=nullif(trim(coalesce(p_observacoes,'')),''),finalizado_em=now(),updated_at=now(),updated_by=auth.uid() where id=v_inv.id;
  return v_ajustes;
end;
$function$;

revoke all on function public.configurar_parametro_reposicao_estoque(uuid,uuid,numeric,numeric,numeric) from public,anon;
grant execute on function public.configurar_parametro_reposicao_estoque(uuid,uuid,numeric,numeric,numeric) to authenticated;
revoke all on function public.movimentar_estoque_operacional(uuid,text,numeric,uuid,uuid,text) from public,anon;
grant execute on function public.movimentar_estoque_operacional(uuid,text,numeric,uuid,uuid,text) to authenticated;
revoke all on function public.abrir_inventario_estoque(uuid,text) from public,anon;
grant execute on function public.abrir_inventario_estoque(uuid,text) to authenticated;
revoke all on function public.registrar_contagem_inventario_estoque(uuid,jsonb) from public,anon;
grant execute on function public.registrar_contagem_inventario_estoque(uuid,jsonb) to authenticated;
revoke all on function public.concluir_inventario_estoque(uuid,text) from public,anon;
grant execute on function public.concluir_inventario_estoque(uuid,text) to authenticated;
