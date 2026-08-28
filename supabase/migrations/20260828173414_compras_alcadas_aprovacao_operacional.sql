create table public.compras_alcadas_aprovacao (
  id uuid primary key default extensions.gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  unidade_id uuid not null references public.unidades(id),
  nome text not null,
  valor_min numeric(14,2) not null default 0 check (valor_min >= 0),
  valor_max numeric(14,2),
  aprovacoes_necessarias smallint not null default 1 check (aprovacoes_necessarias between 1 and 10),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references public.usuarios(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.usuarios(id),
  constraint compras_alcadas_aprovacao_faixa_check check (valor_max is null or valor_max >= valor_min),
  constraint compras_alcadas_aprovacao_nome_key unique (empresa_id, unidade_id, nome)
);

create table public.compras_alcada_perfis (
  alcada_id uuid not null references public.compras_alcadas_aprovacao(id) on delete cascade,
  perfil_id uuid not null references public.perfis(id),
  created_at timestamptz not null default now(),
  created_by uuid references public.usuarios(id),
  primary key (alcada_id, perfil_id)
);

create table public.compras_cotacao_aprovacao_fluxos (
  id uuid primary key default extensions.gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  unidade_id uuid not null references public.unidades(id),
  cotacao_id uuid not null references public.compras_cotacoes(id),
  alcada_id uuid not null references public.compras_alcadas_aprovacao(id),
  fornecedor_id uuid not null references public.fornecedores(id),
  versao integer not null check (versao > 0),
  valor_total numeric(14,2) not null check (valor_total >= 0),
  aprovacoes_necessarias smallint not null check (aprovacoes_necessarias between 1 and 10),
  status text not null default 'pendente' check (status in ('pendente','aprovada','rejeitada','cancelada')),
  iniciado_por uuid not null references public.usuarios(id),
  iniciado_em timestamptz not null default now(),
  concluido_em timestamptz,
  cancelado_motivo text,
  unique (cotacao_id, versao)
);

create unique index compras_cotacao_aprovacao_fluxos_ativo_idx
  on public.compras_cotacao_aprovacao_fluxos(cotacao_id)
  where status in ('pendente','aprovada');

create table public.compras_cotacao_aprovacao_fluxo_perfis (
  fluxo_id uuid not null references public.compras_cotacao_aprovacao_fluxos(id) on delete cascade,
  perfil_id uuid not null references public.perfis(id),
  primary key (fluxo_id, perfil_id)
);

create table public.compras_cotacao_aprovacoes (
  id uuid primary key default extensions.gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  unidade_id uuid not null references public.unidades(id),
  fluxo_id uuid not null references public.compras_cotacao_aprovacao_fluxos(id),
  aprovador_id uuid not null references public.usuarios(id),
  perfil_id uuid not null references public.perfis(id),
  decisao text not null check (decisao in ('aprovada','rejeitada')),
  observacoes text,
  created_at timestamptz not null default now(),
  unique (fluxo_id, aprovador_id)
);

create index compras_alcadas_aprovacao_unidade_idx on public.compras_alcadas_aprovacao(empresa_id, unidade_id, ativo, valor_min, valor_max);
create index compras_cotacao_aprovacao_fluxos_cotacao_idx on public.compras_cotacao_aprovacao_fluxos(cotacao_id, versao desc);
create index compras_cotacao_aprovacoes_fluxo_idx on public.compras_cotacao_aprovacoes(fluxo_id, decisao, created_at);

alter table public.compras_alcadas_aprovacao enable row level security;
alter table public.compras_alcadas_aprovacao force row level security;
alter table public.compras_alcada_perfis enable row level security;
alter table public.compras_alcada_perfis force row level security;
alter table public.compras_cotacao_aprovacao_fluxos enable row level security;
alter table public.compras_cotacao_aprovacao_fluxos force row level security;
alter table public.compras_cotacao_aprovacao_fluxo_perfis enable row level security;
alter table public.compras_cotacao_aprovacao_fluxo_perfis force row level security;
alter table public.compras_cotacao_aprovacoes enable row level security;
alter table public.compras_cotacao_aprovacoes force row level security;

create policy compras_alcadas_aprovacao_select on public.compras_alcadas_aprovacao for select to authenticated
using (public.tem_unidade(empresa_id, unidade_id) and (
  public.tem_permissao(empresa_id, unidade_id, 'compras.visualizar') or
  public.tem_permissao(empresa_id, unidade_id, 'compras.aprovar') or
  public.tem_permissao(empresa_id, unidade_id, 'compras.gerenciar')
));

create policy compras_alcada_perfis_select on public.compras_alcada_perfis for select to authenticated
using (exists (
  select 1 from public.compras_alcadas_aprovacao a
  where a.id=alcada_id and public.tem_unidade(a.empresa_id,a.unidade_id)
    and (public.tem_permissao(a.empresa_id,a.unidade_id,'compras.visualizar') or public.tem_permissao(a.empresa_id,a.unidade_id,'compras.aprovar') or public.tem_permissao(a.empresa_id,a.unidade_id,'compras.gerenciar'))
));

create policy compras_cotacao_aprovacao_fluxos_select on public.compras_cotacao_aprovacao_fluxos for select to authenticated
using (public.tem_unidade(empresa_id, unidade_id) and (
  public.tem_permissao(empresa_id, unidade_id, 'compras.visualizar') or
  public.tem_permissao(empresa_id, unidade_id, 'compras.aprovar') or
  public.tem_permissao(empresa_id, unidade_id, 'compras.gerenciar')
));

create policy compras_cotacao_aprovacao_fluxo_perfis_select on public.compras_cotacao_aprovacao_fluxo_perfis for select to authenticated
using (exists (
  select 1 from public.compras_cotacao_aprovacao_fluxos f
  where f.id=fluxo_id and public.tem_unidade(f.empresa_id,f.unidade_id)
    and (public.tem_permissao(f.empresa_id,f.unidade_id,'compras.visualizar') or public.tem_permissao(f.empresa_id,f.unidade_id,'compras.aprovar') or public.tem_permissao(f.empresa_id,f.unidade_id,'compras.gerenciar'))
));

create policy compras_cotacao_aprovacoes_select on public.compras_cotacao_aprovacoes for select to authenticated
using (public.tem_unidade(empresa_id, unidade_id) and (
  public.tem_permissao(empresa_id, unidade_id, 'compras.visualizar') or
  public.tem_permissao(empresa_id, unidade_id, 'compras.aprovar') or
  public.tem_permissao(empresa_id, unidade_id, 'compras.gerenciar')
));

grant select on public.compras_alcadas_aprovacao, public.compras_alcada_perfis, public.compras_cotacao_aprovacao_fluxos, public.compras_cotacao_aprovacao_fluxo_perfis, public.compras_cotacao_aprovacoes to authenticated;
revoke insert, update, delete on public.compras_alcadas_aprovacao, public.compras_alcada_perfis, public.compras_cotacao_aprovacao_fluxos, public.compras_cotacao_aprovacao_fluxo_perfis, public.compras_cotacao_aprovacoes from authenticated, anon;

create or replace function public.salvar_alcada_compra_operacional(
  p_id uuid,
  p_empresa uuid,
  p_unidade uuid,
  p_nome text,
  p_valor_min numeric,
  p_valor_max numeric,
  p_aprovacoes_necessarias integer,
  p_perfis uuid[],
  p_ativa boolean
) returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_id uuid;
  v_total_perfis integer;
  v_validos integer;
begin
  if auth.uid() is null then raise exception 'COMPRAS_AUTENTICACAO_OBRIGATORIA' using errcode='42501'; end if;
  if not public.tem_unidade(p_empresa,p_unidade) then raise exception 'COMPRAS_UNIDADE_FORA_ESCOPO' using errcode='42501'; end if;
  if not public.tem_permissao(p_empresa,p_unidade,'compras.gerenciar') then raise exception 'COMPRAS_SEM_PERMISSAO_GERENCIAR' using errcode='42501'; end if;
  if nullif(trim(p_nome),'') is null then raise exception 'COMPRAS_ALCADA_NOME_OBRIGATORIO'; end if;
  if coalesce(p_valor_min,-1) < 0 or (p_valor_max is not null and p_valor_max < p_valor_min) then raise exception 'COMPRAS_ALCADA_FAIXA_INVALIDA'; end if;
  if p_aprovacoes_necessarias is null or p_aprovacoes_necessarias not between 1 and 10 then raise exception 'COMPRAS_ALCADA_APROVACOES_INVALIDAS'; end if;

  perform 1 from public.unidades where id=p_unidade and empresa_id=p_empresa for update;
  if not found then raise exception 'COMPRAS_UNIDADE_INVALIDA'; end if;

  select count(distinct x.perfil_id) into v_total_perfis from unnest(coalesce(p_perfis,array[]::uuid[])) x(perfil_id) where x.perfil_id is not null;
  if v_total_perfis=0 then raise exception 'COMPRAS_ALCADA_SEM_PERFIS'; end if;

  select count(distinct pf.id) into v_validos
  from unnest(coalesce(p_perfis,array[]::uuid[])) x(perfil_id)
  join public.perfis pf on pf.id=x.perfil_id and pf.empresa_id=p_empresa and pf.ativo
  where exists (
    select 1 from public.perfil_permissoes pp join public.permissoes pe on pe.id=pp.permissao_id and pe.ativo
    where pp.perfil_id=pf.id and pe.codigo='compras.aprovar'
  );
  if v_validos<>v_total_perfis then raise exception 'COMPRAS_ALCADA_PERFIL_SEM_PERMISSAO_APROVAR'; end if;

  if coalesce(p_ativa,true) and exists (
    select 1 from public.compras_alcadas_aprovacao a
    where a.empresa_id=p_empresa and a.unidade_id=p_unidade and a.ativo
      and (p_id is null or a.id<>p_id)
      and numrange(a.valor_min,a.valor_max,'[]') && numrange(p_valor_min,p_valor_max,'[]')
  ) then raise exception 'COMPRAS_ALCADA_FAIXA_SOBREPOSTA'; end if;

  if p_id is null then
    insert into public.compras_alcadas_aprovacao(empresa_id,unidade_id,nome,valor_min,valor_max,aprovacoes_necessarias,ativo,created_by,updated_by)
    values(p_empresa,p_unidade,trim(p_nome),p_valor_min,p_valor_max,p_aprovacoes_necessarias,coalesce(p_ativa,true),auth.uid(),auth.uid())
    returning id into v_id;
  else
    select id into v_id from public.compras_alcadas_aprovacao where id=p_id and empresa_id=p_empresa and unidade_id=p_unidade for update;
    if v_id is null then raise exception 'COMPRAS_ALCADA_NAO_ENCONTRADA'; end if;
    update public.compras_alcadas_aprovacao
       set nome=trim(p_nome),valor_min=p_valor_min,valor_max=p_valor_max,aprovacoes_necessarias=p_aprovacoes_necessarias,ativo=coalesce(p_ativa,true),updated_at=now(),updated_by=auth.uid()
     where id=v_id;
  end if;

  delete from public.compras_alcada_perfis where alcada_id=v_id;
  insert into public.compras_alcada_perfis(alcada_id,perfil_id,created_by)
  select v_id,x.perfil_id,auth.uid() from (select distinct unnest(p_perfis) as perfil_id) x where x.perfil_id is not null;
  return v_id;
end;$function$;

create or replace function public.gerar_cotacao_compra_catalogo(p_solicitacao_id uuid, p_validade date default null, p_observacoes text default null)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare v_s public.compras_solicitacoes%rowtype; v_id uuid; v_numero text; v_itens integer;
begin
  if auth.uid() is null then raise exception 'COMPRAS_AUTENTICACAO_OBRIGATORIA' using errcode='42501'; end if;
  select * into v_s from public.compras_solicitacoes where id=p_solicitacao_id for update;
  if v_s.id is null then raise exception 'COMPRAS_SOLICITACAO_NAO_ENCONTRADA'; end if;
  if not public.tem_unidade(v_s.empresa_id,v_s.unidade_id) then raise exception 'COMPRAS_UNIDADE_FORA_ESCOPO' using errcode='42501'; end if;
  if not (public.tem_permissao(v_s.empresa_id,v_s.unidade_id,'compras.cotar') or public.tem_permissao(v_s.empresa_id,v_s.unidade_id,'compras.gerenciar')) then raise exception 'COMPRAS_SEM_PERMISSAO_COTAR' using errcode='42501'; end if;
  if v_s.status not in ('solicitada','aprovada','em_cotacao','cotacao') then raise exception 'COMPRAS_STATUS_SOLICITACAO_INVALIDO'; end if;
  select id into v_id from public.compras_cotacoes where solicitacao_id=p_solicitacao_id and status in ('aberta','em_analise','em_aprovacao','aprovada') order by created_at desc limit 1;
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

create or replace function public.adicionar_fornecedor_cotacao_operacional(p_cotacao_id uuid, p_fornecedor_id uuid, p_frete numeric default 0, p_prazo_entrega_dias integer default null, p_condicao_pagamento text default null, p_observacoes text default null)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
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

create or replace function public.salvar_proposta_item_cotacao(p_cotacao_item_id uuid, p_fornecedor_id uuid, p_valor_unitario numeric, p_quantidade_ofertada numeric default null, p_marca text default null, p_fabricante text default null, p_codigo_anvisa text default null, p_prazo_entrega_dias integer default null, p_disponibilidade text default 'pronta_entrega', p_observacoes text default null)
returns numeric
language plpgsql
security definer
set search_path to ''
as $function$
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

create or replace function public.aprovar_fornecedor_cotacao_operacional(p_cotacao_id uuid, p_fornecedor_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_c public.compras_cotacoes%rowtype;
  v_cf public.compras_cotacao_fornecedores%rowtype;
  v_fluxo public.compras_cotacao_aprovacao_fluxos%rowtype;
  v_alcada public.compras_alcadas_aprovacao%rowtype;
  v_solicitante uuid;
  v_total numeric(14,2);
  v_perfil uuid;
  v_versao integer;
  v_aprovadas integer;
begin
  if auth.uid() is null then raise exception 'COMPRAS_AUTENTICACAO_OBRIGATORIA' using errcode='42501'; end if;
  select * into v_c from public.compras_cotacoes where id=p_cotacao_id for update;
  if v_c.id is null or not public.tem_unidade(v_c.empresa_id,v_c.unidade_id) then raise exception 'COMPRAS_COTACAO_FORA_ESCOPO' using errcode='42501'; end if;
  if not public.tem_permissao(v_c.empresa_id,v_c.unidade_id,'compras.aprovar') then raise exception 'COMPRAS_SEM_PERMISSAO_APROVAR' using errcode='42501'; end if;
  if v_c.status not in ('aberta','em_analise','em_aprovacao') then raise exception 'COMPRAS_COTACAO_NAO_APROVAVEL'; end if;

  select solicitante_id into v_solicitante from public.compras_solicitacoes where id=v_c.solicitacao_id;
  if v_solicitante=auth.uid() then raise exception 'COMPRAS_SEGREGACAO_SOLICITANTE_APROVADOR' using errcode='42501'; end if;

  select * into v_cf from public.compras_cotacao_fornecedores where cotacao_id=p_cotacao_id and fornecedor_id=p_fornecedor_id for update;
  if v_cf.id is null or v_cf.itens_total=0 or v_cf.itens_cotados<v_cf.itens_total then raise exception 'COMPRAS_PROPOSTA_INCOMPLETA'; end if;
  v_total:=round(coalesce(v_cf.valor_total,0)+coalesce(v_cf.frete,0),2);

  select * into v_fluxo from public.compras_cotacao_aprovacao_fluxos where cotacao_id=p_cotacao_id and status='pendente' for update;
  if v_fluxo.id is null then
    select * into v_alcada from public.compras_alcadas_aprovacao
      where empresa_id=v_c.empresa_id and unidade_id=v_c.unidade_id and ativo
        and v_total>=valor_min and (valor_max is null or v_total<=valor_max)
      order by valor_min desc limit 1;
    if v_alcada.id is null then raise exception 'COMPRAS_ALCADA_NAO_CONFIGURADA'; end if;

    select up.perfil_id into v_perfil
    from public.usuario_perfis up
    join public.compras_alcada_perfis ap on ap.perfil_id=up.perfil_id and ap.alcada_id=v_alcada.id
    where up.usuario_id=auth.uid() and up.empresa_id=v_c.empresa_id and up.ativo and (up.unidade_id is null or up.unidade_id=v_c.unidade_id)
    order by case when up.unidade_id=v_c.unidade_id then 0 else 1 end limit 1;
    if v_perfil is null then raise exception 'COMPRAS_APROVADOR_FORA_DA_ALCADA' using errcode='42501'; end if;

    select coalesce(max(versao),0)+1 into v_versao from public.compras_cotacao_aprovacao_fluxos where cotacao_id=p_cotacao_id;
    insert into public.compras_cotacao_aprovacao_fluxos(empresa_id,unidade_id,cotacao_id,alcada_id,fornecedor_id,versao,valor_total,aprovacoes_necessarias,status,iniciado_por)
    values(v_c.empresa_id,v_c.unidade_id,p_cotacao_id,v_alcada.id,p_fornecedor_id,v_versao,v_total,v_alcada.aprovacoes_necessarias,'pendente',auth.uid())
    returning * into v_fluxo;
    insert into public.compras_cotacao_aprovacao_fluxo_perfis(fluxo_id,perfil_id)
    select v_fluxo.id,perfil_id from public.compras_alcada_perfis where alcada_id=v_alcada.id;
    update public.compras_cotacao_fornecedores set selecionado=false where cotacao_id=p_cotacao_id;
    update public.compras_cotacao_fornecedores set selecionado=true,atualizado_em=now() where cotacao_id=p_cotacao_id and fornecedor_id=p_fornecedor_id;
    update public.compras_cotacoes set status='em_aprovacao' where id=p_cotacao_id;
  else
    if v_fluxo.fornecedor_id<>p_fornecedor_id then raise exception 'COMPRAS_FORNECEDOR_DIVERGENTE_APROVACAO'; end if;
    select up.perfil_id into v_perfil
    from public.usuario_perfis up
    join public.compras_cotacao_aprovacao_fluxo_perfis fp on fp.perfil_id=up.perfil_id and fp.fluxo_id=v_fluxo.id
    where up.usuario_id=auth.uid() and up.empresa_id=v_c.empresa_id and up.ativo and (up.unidade_id is null or up.unidade_id=v_c.unidade_id)
    order by case when up.unidade_id=v_c.unidade_id then 0 else 1 end limit 1;
    if v_perfil is null then raise exception 'COMPRAS_APROVADOR_FORA_DA_ALCADA' using errcode='42501'; end if;
  end if;

  if exists(select 1 from public.compras_cotacao_aprovacoes where fluxo_id=v_fluxo.id and aprovador_id=auth.uid()) then raise exception 'COMPRAS_APROVADOR_JA_DECIDIU'; end if;
  insert into public.compras_cotacao_aprovacoes(empresa_id,unidade_id,fluxo_id,aprovador_id,perfil_id,decisao)
  values(v_c.empresa_id,v_c.unidade_id,v_fluxo.id,auth.uid(),v_perfil,'aprovada');

  select count(*)::int into v_aprovadas from public.compras_cotacao_aprovacoes where fluxo_id=v_fluxo.id and decisao='aprovada';
  if v_aprovadas>=v_fluxo.aprovacoes_necessarias then
    update public.compras_cotacao_aprovacao_fluxos set status='aprovada',concluido_em=now() where id=v_fluxo.id;
    update public.compras_cotacoes set status='aprovada' where id=p_cotacao_id;
  else
    update public.compras_cotacoes set status='em_aprovacao' where id=p_cotacao_id;
  end if;
end;$function$;

create or replace function public.rejeitar_cotacao_compra_operacional(p_cotacao_id uuid, p_observacoes text)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_c public.compras_cotacoes%rowtype;
  v_fluxo public.compras_cotacao_aprovacao_fluxos%rowtype;
  v_solicitante uuid;
  v_perfil uuid;
begin
  if auth.uid() is null then raise exception 'COMPRAS_AUTENTICACAO_OBRIGATORIA' using errcode='42501'; end if;
  if length(trim(coalesce(p_observacoes,'')))<5 then raise exception 'COMPRAS_REJEICAO_MOTIVO_OBRIGATORIO'; end if;
  select * into v_c from public.compras_cotacoes where id=p_cotacao_id for update;
  if v_c.id is null or not public.tem_unidade(v_c.empresa_id,v_c.unidade_id) then raise exception 'COMPRAS_COTACAO_FORA_ESCOPO' using errcode='42501'; end if;
  if not public.tem_permissao(v_c.empresa_id,v_c.unidade_id,'compras.aprovar') then raise exception 'COMPRAS_SEM_PERMISSAO_APROVAR' using errcode='42501'; end if;
  if v_c.status<>'em_aprovacao' then raise exception 'COMPRAS_COTACAO_SEM_APROVACAO_PENDENTE'; end if;
  select solicitante_id into v_solicitante from public.compras_solicitacoes where id=v_c.solicitacao_id;
  if v_solicitante=auth.uid() then raise exception 'COMPRAS_SEGREGACAO_SOLICITANTE_APROVADOR' using errcode='42501'; end if;
  select * into v_fluxo from public.compras_cotacao_aprovacao_fluxos where cotacao_id=p_cotacao_id and status='pendente' for update;
  if v_fluxo.id is null then raise exception 'COMPRAS_FLUXO_APROVACAO_NAO_ENCONTRADO'; end if;
  select up.perfil_id into v_perfil from public.usuario_perfis up join public.compras_cotacao_aprovacao_fluxo_perfis fp on fp.perfil_id=up.perfil_id and fp.fluxo_id=v_fluxo.id
   where up.usuario_id=auth.uid() and up.empresa_id=v_c.empresa_id and up.ativo and (up.unidade_id is null or up.unidade_id=v_c.unidade_id)
   order by case when up.unidade_id=v_c.unidade_id then 0 else 1 end limit 1;
  if v_perfil is null then raise exception 'COMPRAS_APROVADOR_FORA_DA_ALCADA' using errcode='42501'; end if;
  if exists(select 1 from public.compras_cotacao_aprovacoes where fluxo_id=v_fluxo.id and aprovador_id=auth.uid()) then raise exception 'COMPRAS_APROVADOR_JA_DECIDIU'; end if;
  insert into public.compras_cotacao_aprovacoes(empresa_id,unidade_id,fluxo_id,aprovador_id,perfil_id,decisao,observacoes)
  values(v_c.empresa_id,v_c.unidade_id,v_fluxo.id,auth.uid(),v_perfil,'rejeitada',trim(p_observacoes));
  update public.compras_cotacao_aprovacao_fluxos set status='rejeitada',concluido_em=now() where id=v_fluxo.id;
  update public.compras_cotacoes set status='rejeitada' where id=p_cotacao_id;
end;$function$;

create or replace function public.reiniciar_aprovacao_cotacao_operacional(p_cotacao_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare v_c public.compras_cotacoes%rowtype; v_fluxo_id uuid;
begin
  if auth.uid() is null then raise exception 'COMPRAS_AUTENTICACAO_OBRIGATORIA' using errcode='42501'; end if;
  if length(trim(coalesce(p_motivo,'')))<5 then raise exception 'COMPRAS_REINICIO_MOTIVO_OBRIGATORIO'; end if;
  select * into v_c from public.compras_cotacoes where id=p_cotacao_id for update;
  if v_c.id is null or not public.tem_unidade(v_c.empresa_id,v_c.unidade_id) then raise exception 'COMPRAS_COTACAO_FORA_ESCOPO' using errcode='42501'; end if;
  if not public.tem_permissao(v_c.empresa_id,v_c.unidade_id,'compras.gerenciar') then raise exception 'COMPRAS_SEM_PERMISSAO_GERENCIAR' using errcode='42501'; end if;
  if exists(select 1 from public.compras_pedidos where cotacao_id=p_cotacao_id) then raise exception 'COMPRAS_COTACAO_JA_CONVERTIDA_PEDIDO'; end if;
  select id into v_fluxo_id from public.compras_cotacao_aprovacao_fluxos where cotacao_id=p_cotacao_id order by versao desc limit 1 for update;
  if v_fluxo_id is not null then update public.compras_cotacao_aprovacao_fluxos set status='cancelada',concluido_em=coalesce(concluido_em,now()),cancelado_motivo=trim(p_motivo) where id=v_fluxo_id; end if;
  update public.compras_cotacao_fornecedores set selecionado=false where cotacao_id=p_cotacao_id;
  update public.compras_cotacoes set status='em_analise' where id=p_cotacao_id;
end;$function$;

create or replace function public.gerar_pedido_cotacao_aprovada(p_cotacao_id uuid)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare v_c public.compras_cotacoes%rowtype;v_cf public.compras_cotacao_fornecedores%rowtype;v_fluxo public.compras_cotacao_aprovacao_fluxos%rowtype;v_pedido uuid;v_numero text;v_solicitante uuid;v_aprovadas integer;
begin
  if auth.uid() is null then raise exception 'COMPRAS_AUTENTICACAO_OBRIGATORIA' using errcode='42501'; end if;
  select * into v_c from public.compras_cotacoes where id=p_cotacao_id for update;
  if v_c.id is null or not public.tem_unidade(v_c.empresa_id,v_c.unidade_id) then raise exception 'COMPRAS_COTACAO_FORA_ESCOPO' using errcode='42501'; end if;
  if not public.tem_permissao(v_c.empresa_id,v_c.unidade_id,'compras.aprovar') then raise exception 'COMPRAS_SEM_PERMISSAO_APROVAR' using errcode='42501'; end if;
  select solicitante_id into v_solicitante from public.compras_solicitacoes where id=v_c.solicitacao_id;
  if v_solicitante=auth.uid() then raise exception 'COMPRAS_SEGREGACAO_SOLICITANTE_APROVADOR' using errcode='42501'; end if;
  select id into v_pedido from public.compras_pedidos where cotacao_id=p_cotacao_id limit 1;
  if v_pedido is not null then return v_pedido; end if;
  if v_c.status<>'aprovada' then raise exception 'COMPRAS_COTACAO_NAO_APROVADA'; end if;
  select * into v_fluxo from public.compras_cotacao_aprovacao_fluxos where cotacao_id=p_cotacao_id and status='aprovada' order by versao desc limit 1;
  if v_fluxo.id is null then raise exception 'COMPRAS_APROVACAO_FORMAL_AUSENTE'; end if;
  select count(*)::int into v_aprovadas from public.compras_cotacao_aprovacoes where fluxo_id=v_fluxo.id and decisao='aprovada';
  if v_aprovadas<v_fluxo.aprovacoes_necessarias then raise exception 'COMPRAS_APROVACAO_INSUFICIENTE'; end if;
  select * into v_cf from public.compras_cotacao_fornecedores where cotacao_id=p_cotacao_id and fornecedor_id=v_fluxo.fornecedor_id and selecionado limit 1;
  if v_cf.id is null or v_cf.itens_total=0 or v_cf.itens_cotados<v_cf.itens_total then raise exception 'COMPRAS_COTACAO_INCOMPLETA'; end if;
  if round(coalesce(v_cf.valor_total,0)+coalesce(v_cf.frete,0),2)<>v_fluxo.valor_total then raise exception 'COMPRAS_VALOR_ALTERADO_APOS_APROVACAO'; end if;
  v_numero:='PC'||to_char(clock_timestamp(),'YYMMDDHH24MISSMS');
  insert into public.compras_pedidos(empresa_id,unidade_id,solicitacao_id,cotacao_id,fornecedor_id,numero,data_pedido,previsao_entrega,valor_total,status,created_by)
  values(v_c.empresa_id,v_c.unidade_id,v_c.solicitacao_id,p_cotacao_id,v_cf.fornecedor_id,v_numero,current_date,case when v_cf.prazo_entrega_dias is null then null else current_date+v_cf.prazo_entrega_dias end,v_fluxo.valor_total,'aberto',auth.uid()) returning id into v_pedido;
  insert into public.compras_pedido_itens(pedido_id,produto_id,item_assistencial_id,cotacao_item_id,descricao,quantidade,unidade_medida,valor_unitario,valor_total)
  select v_pedido,ep.id,ci.item_assistencial_id,ci.id,ci.descricao,ci.quantidade,ci.unidade_medida,p.valor_unitario,round(ci.quantidade*p.valor_unitario,2)
  from public.compras_cotacao_itens ci join public.compras_cotacao_item_propostas p on p.cotacao_item_id=ci.id and p.fornecedor_id=v_cf.fornecedor_id and p.disponibilidade<>'indisponivel' and coalesce(p.quantidade_ofertada,0)>=ci.quantidade
  left join lateral(select e.id from public.estoque_produtos e where e.item_assistencial_id=ci.item_assistencial_id and e.empresa_id=v_c.empresa_id and e.ativo order by e.created_at limit 1) ep on true
  where ci.cotacao_id=p_cotacao_id;
  update public.compras_cotacoes set status='convertida_pedido' where id=p_cotacao_id;
  if v_c.solicitacao_id is not null then update public.compras_solicitacoes set status='pedido_emitido',updated_at=now() where id=v_c.solicitacao_id; end if;
  return v_pedido;
end;$function$;

revoke insert, update, delete on public.compras_cotacoes, public.compras_cotacao_itens, public.compras_cotacao_fornecedores, public.compras_cotacao_item_propostas, public.compras_pedidos, public.compras_pedido_itens from authenticated, anon;

revoke all on function public.salvar_alcada_compra_operacional(uuid,uuid,uuid,text,numeric,numeric,integer,uuid[],boolean) from public, anon, authenticated;
revoke all on function public.rejeitar_cotacao_compra_operacional(uuid,text) from public, anon, authenticated;
revoke all on function public.reiniciar_aprovacao_cotacao_operacional(uuid,text) from public, anon, authenticated;
revoke all on function public.gerar_cotacao_compra_catalogo(uuid,date,text) from public, anon, authenticated;
revoke all on function public.adicionar_fornecedor_cotacao_operacional(uuid,uuid,numeric,integer,text,text) from public, anon, authenticated;
revoke all on function public.salvar_proposta_item_cotacao(uuid,uuid,numeric,numeric,text,text,text,integer,text,text) from public, anon, authenticated;
revoke all on function public.aprovar_fornecedor_cotacao_operacional(uuid,uuid) from public, anon, authenticated;
revoke all on function public.gerar_pedido_cotacao_aprovada(uuid) from public, anon, authenticated;

grant execute on function public.salvar_alcada_compra_operacional(uuid,uuid,uuid,text,numeric,numeric,integer,uuid[],boolean) to authenticated;
grant execute on function public.rejeitar_cotacao_compra_operacional(uuid,text) to authenticated;
grant execute on function public.reiniciar_aprovacao_cotacao_operacional(uuid,text) to authenticated;
grant execute on function public.gerar_cotacao_compra_catalogo(uuid,date,text) to authenticated;
grant execute on function public.adicionar_fornecedor_cotacao_operacional(uuid,uuid,numeric,integer,text,text) to authenticated;
grant execute on function public.salvar_proposta_item_cotacao(uuid,uuid,numeric,numeric,text,text,text,integer,text,text) to authenticated;
grant execute on function public.aprovar_fornecedor_cotacao_operacional(uuid,uuid) to authenticated;
grant execute on function public.gerar_pedido_cotacao_aprovada(uuid) to authenticated;