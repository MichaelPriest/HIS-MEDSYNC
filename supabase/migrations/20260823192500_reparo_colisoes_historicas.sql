begin;

-- ============================================================================
-- REPARO DE COLISOES HISTORICAS DE MIGRATIONS
--
-- Versoes que existiram com mais de um arquivo no repositorio:
--   202608220011  -> hub clinico / contexto clinico
--   20260823008000 -> metodologias procedimentos / precificacao comercial
--   20260823008100 -> auditoria de precos / integracao conta-guias
--
-- O Supabase registra a VERSAO, nao qual dos arquivos homonimos foi executado.
-- Esta migration restaura, de forma idempotente, os objetos que podem ter sido
-- pulados em um banco remoto que recebeu apenas um dos arquivos de cada versao.
-- Nao apaga dados nem altera PKs existentes.
-- ============================================================================

create extension if not exists pgcrypto;

-- --------------------------------------------------------------------------
-- 1) HUB CLINICO: garante solicitacoes de exames (objeto exclusivo do antigo
--    202608220011_hub_clinico_integrado.sql).
-- --------------------------------------------------------------------------
insert into public.permissoes(codigo,descricao) values
('exames.visualizar','Visualizar solicitações e resultados de exames')
on conflict (codigo) do update set descricao=excluded.descricao;

create table if not exists public.solicitacoes_exames (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  unidade_id uuid not null references public.unidades(id),
  atendimento_id uuid not null references public.atendimentos(id) on delete restrict,
  profissional_id uuid references public.profissionais(id) on delete restrict,
  modalidade text not null check (modalidade in ('laboratorio','imagem','outro')),
  exame text not null,
  codigo_tuss text,
  indicacao_clinica text,
  status text not null default 'solicitado' check (status in ('solicitado','agendado','coletado','em_execucao','liberado','cancelado')),
  resultado_resumo text,
  resultado_em timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
create index if not exists solicitacoes_exames_atendimento_idx on public.solicitacoes_exames(atendimento_id,created_at desc);
alter table public.solicitacoes_exames enable row level security;
alter table public.solicitacoes_exames force row level security;
drop policy if exists solicitacoes_exames_select on public.solicitacoes_exames;
create policy solicitacoes_exames_select on public.solicitacoes_exames for select using (
  public.tem_unidade(empresa_id,unidade_id)
  and (
    public.tem_permissao(empresa_id,unidade_id,'exames.visualizar')
    or public.tem_permissao(empresa_id,unidade_id,'prontuario.visualizar')
  )
);
revoke delete,truncate on public.solicitacoes_exames from anon,authenticated;

-- --------------------------------------------------------------------------
-- 2) METODOLOGIAS DE PROCEDIMENTOS: garante o dominio tabelas_procedimentos_*
--    caso o remoto tenha marcado 08000 ao executar somente a outra migration.
-- --------------------------------------------------------------------------
insert into public.permissoes(codigo,descricao) values
('tabelas_procedimentos.visualizar','Visualizar tabelas de procedimentos e regras contratuais'),
('tabelas_procedimentos.gerenciar','Gerenciar tabelas de procedimentos e regras contratuais')
on conflict (codigo) do update set descricao=excluded.descricao;

create table if not exists public.tabelas_procedimentos_fontes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  codigo text not null,
  nome text not null,
  metodologia text not null check (metodologia in ('tabela_propria','amb90','amb92','amb96','amb99','cbhpm','outra')),
  descricao text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(empresa_id,codigo)
);

create table if not exists public.tabelas_procedimentos_edicoes (
  id uuid primary key default gen_random_uuid(),
  fonte_id uuid not null references public.tabelas_procedimentos_fontes(id) on delete cascade,
  nome_edicao text not null,
  referencia text,
  vigencia_inicio date not null,
  vigencia_fim date,
  status text not null default 'ativa' check (status in ('rascunho','ativa','encerrada','cancelada')),
  observacoes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(fonte_id,nome_edicao)
);
create index if not exists tab_proc_edicoes_vigencia_idx on public.tabelas_procedimentos_edicoes(fonte_id,vigencia_inicio,vigencia_fim);

create table if not exists public.tabelas_procedimentos_itens (
  id uuid primary key default gen_random_uuid(),
  edicao_id uuid not null references public.tabelas_procedimentos_edicoes(id) on delete cascade,
  codigo text not null,
  codigo_tuss text,
  descricao text not null,
  grupo text,
  subgrupo text,
  tipo_item text not null default 'procedimento' check (tipo_item in ('consulta','procedimento','exame','sadt','honorario','taxa','diaria','outro')),
  valor_fixo numeric(14,4),
  ch_hm numeric(14,4),
  ch_sadt numeric(14,4),
  porte text,
  porte_anestesico text,
  uco numeric(14,4),
  numero_auxiliares integer,
  filme_m2 numeric(14,4),
  observacoes text,
  ativo boolean not null default true,
  unique(edicao_id,codigo)
);
create index if not exists tab_proc_itens_codigo_idx on public.tabelas_procedimentos_itens(edicao_id,codigo);
create index if not exists tab_proc_itens_tuss_idx on public.tabelas_procedimentos_itens(edicao_id,codigo_tuss);

create table if not exists public.contrato_regras_procedimentos (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.credenciamento_contratos(id) on delete cascade,
  categoria text not null default 'procedimentos' check (categoria in ('procedimentos','consultas','sadt','exames','honorarios','diarias','taxas','outro')),
  fonte_id uuid not null references public.tabelas_procedimentos_fontes(id),
  modo_edicao text not null default 'vigente_data' check (modo_edicao in ('vigente_data','edicao_fixa')),
  edicao_fixa_id uuid references public.tabelas_procedimentos_edicoes(id),
  valor_ch_hm numeric(14,6),
  valor_ch_sadt numeric(14,6),
  valor_uco numeric(14,6),
  percentual_ajuste numeric(8,4) not null default 0,
  adicional_urgencia_percentual numeric(8,4),
  adicional_apartamento_percentual numeric(8,4),
  aplicar_urgencia boolean not null default false,
  aplicar_acomodacao boolean not null default false,
  regras_json jsonb not null default '{}'::jsonb,
  vigencia_inicio date,
  vigencia_fim date,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index if not exists contrato_regras_proc_idx on public.contrato_regras_procedimentos(contrato_id,categoria,ativo,vigencia_inicio,vigencia_fim);

alter table public.tabelas_procedimentos_fontes enable row level security;
alter table public.tabelas_procedimentos_edicoes enable row level security;
alter table public.tabelas_procedimentos_itens enable row level security;
alter table public.contrato_regras_procedimentos enable row level security;

drop policy if exists tab_proc_fontes_select on public.tabelas_procedimentos_fontes;
create policy tab_proc_fontes_select on public.tabelas_procedimentos_fontes for select using (public.tem_empresa(empresa_id));
drop policy if exists tab_proc_fontes_write on public.tabelas_procedimentos_fontes;
create policy tab_proc_fontes_write on public.tabelas_procedimentos_fontes for all
using (public.tem_empresa(empresa_id) and public.tem_permissao(empresa_id,null,'tabelas_procedimentos.gerenciar'))
with check (public.tem_empresa(empresa_id) and public.tem_permissao(empresa_id,null,'tabelas_procedimentos.gerenciar'));
drop policy if exists tab_proc_edicoes_select on public.tabelas_procedimentos_edicoes;
create policy tab_proc_edicoes_select on public.tabelas_procedimentos_edicoes for select using (
  exists(select 1 from public.tabelas_procedimentos_fontes f where f.id=fonte_id and public.tem_empresa(f.empresa_id))
);
drop policy if exists tab_proc_itens_select on public.tabelas_procedimentos_itens;
create policy tab_proc_itens_select on public.tabelas_procedimentos_itens for select using (
  exists(select 1 from public.tabelas_procedimentos_edicoes e join public.tabelas_procedimentos_fontes f on f.id=e.fonte_id where e.id=edicao_id and public.tem_empresa(f.empresa_id))
);
drop policy if exists regras_proc_select on public.contrato_regras_procedimentos;
create policy regras_proc_select on public.contrato_regras_procedimentos for select using (
  exists(select 1 from public.credenciamento_contratos c where c.id=contrato_id and public.tem_empresa(c.empresa_id))
);

create or replace function public.obter_valor_procedimento_contratual(
  p_convenio_id uuid,
  p_codigo text,
  p_data date,
  p_categoria text default 'procedimentos',
  p_urgencia boolean default false,
  p_acomodacao_individual boolean default false
) returns table(
  valor numeric,
  metodologia text,
  fonte_id uuid,
  edicao_id uuid,
  item_id uuid,
  memoria jsonb
)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_contrato public.credenciamento_contratos%rowtype;
  v_regra public.contrato_regras_procedimentos%rowtype;
  v_fonte public.tabelas_procedimentos_fontes%rowtype;
  v_edicao public.tabelas_procedimentos_edicoes%rowtype;
  v_item public.tabelas_procedimentos_itens%rowtype;
  v_base numeric:=0;
  v_final numeric:=0;
  v_adicional numeric:=0;
begin
  select * into v_contrato from public.credenciamento_contratos c
  where c.convenio_id=p_convenio_id and c.status='ativo'
    and (c.data_inicio is null or c.data_inicio<=p_data)
    and (c.data_fim is null or c.data_fim>=p_data)
  order by c.data_inicio desc nulls last,c.created_at desc limit 1;
  if v_contrato.id is null then return; end if;

  select * into v_regra from public.contrato_regras_procedimentos r
  where r.contrato_id=v_contrato.id and r.ativo=true and r.categoria=p_categoria
    and (r.vigencia_inicio is null or r.vigencia_inicio<=p_data)
    and (r.vigencia_fim is null or r.vigencia_fim>=p_data)
  order by r.vigencia_inicio desc nulls last,r.created_at desc limit 1;
  if v_regra.id is null then
    select * into v_regra from public.contrato_regras_procedimentos r
    where r.contrato_id=v_contrato.id and r.ativo=true and r.categoria='procedimentos'
      and (r.vigencia_inicio is null or r.vigencia_inicio<=p_data)
      and (r.vigencia_fim is null or r.vigencia_fim>=p_data)
    order by r.vigencia_inicio desc nulls last,r.created_at desc limit 1;
  end if;
  if v_regra.id is null then return; end if;

  select * into v_fonte from public.tabelas_procedimentos_fontes where id=v_regra.fonte_id;
  if v_regra.modo_edicao='edicao_fixa' then
    select * into v_edicao from public.tabelas_procedimentos_edicoes where id=v_regra.edicao_fixa_id;
  else
    select * into v_edicao from public.tabelas_procedimentos_edicoes e
    where e.fonte_id=v_regra.fonte_id and e.status='ativa'
      and e.vigencia_inicio<=p_data and (e.vigencia_fim is null or e.vigencia_fim>=p_data)
    order by e.vigencia_inicio desc limit 1;
  end if;
  if v_edicao.id is null then return; end if;

  select * into v_item from public.tabelas_procedimentos_itens i
  where i.edicao_id=v_edicao.id and i.ativo=true and (i.codigo=p_codigo or i.codigo_tuss=p_codigo)
  order by case when i.codigo=p_codigo then 0 else 1 end limit 1;
  if v_item.id is null then return; end if;

  case v_fonte.metodologia
    when 'amb90' then v_base:=coalesce(v_item.ch_hm,0)*coalesce(v_regra.valor_ch_hm,0)+coalesce(v_item.ch_sadt,0)*coalesce(v_regra.valor_ch_sadt,0);
    when 'amb92' then v_base:=coalesce(v_item.ch_hm,0)*coalesce(v_regra.valor_ch_hm,0)+coalesce(v_item.ch_sadt,0)*coalesce(v_regra.valor_ch_sadt,0);
    when 'amb96' then v_base:=coalesce(v_item.valor_fixo,0);
    when 'amb99' then v_base:=coalesce(v_item.valor_fixo,0);
    when 'cbhpm' then v_base:=coalesce(v_item.valor_fixo,0)+coalesce(v_item.uco,0)*coalesce(v_regra.valor_uco,0);
    else v_base:=coalesce(v_item.valor_fixo,0);
  end case;

  v_final:=v_base*(1+coalesce(v_regra.percentual_ajuste,0)/100.0);
  if p_urgencia and v_regra.aplicar_urgencia then v_adicional:=v_adicional+coalesce(v_regra.adicional_urgencia_percentual,0); end if;
  if p_acomodacao_individual and v_regra.aplicar_acomodacao then v_adicional:=v_adicional+coalesce(v_regra.adicional_apartamento_percentual,0); end if;
  v_final:=v_final*(1+v_adicional/100.0);

  return query select round(v_final,2),v_fonte.metodologia,v_fonte.id,v_edicao.id,v_item.id,
    jsonb_build_object('base',round(v_base,4),'percentual_ajuste',v_regra.percentual_ajuste,'adicional_percentual',v_adicional,'valor_ch_hm',v_regra.valor_ch_hm,'valor_ch_sadt',v_regra.valor_ch_sadt,'valor_uco',v_regra.valor_uco,'ch_hm',v_item.ch_hm,'ch_sadt',v_item.ch_sadt,'porte',v_item.porte,'uco',v_item.uco,'edicao',v_edicao.nome_edicao,'fonte',v_fonte.nome);
end;$$;
grant execute on function public.obter_valor_procedimento_contratual(uuid,text,date,text,boolean,boolean) to authenticated;

-- --------------------------------------------------------------------------
-- 3) AUDITORIA/CENTRAL GUIAS: garante os efeitos exclusivos do antigo 08100.
-- --------------------------------------------------------------------------
alter table if exists public.central_guias add column if not exists codigo_procedimento text;
alter table if exists public.central_guias add column if not exists descricao_procedimento text;
alter table if exists public.central_guias add column if not exists categoria_preco text default 'procedimentos';
alter table if exists public.central_guias add column if not exists valor_contratual numeric(14,2);
alter table if exists public.central_guias add column if not exists valor_solicitado numeric(14,2);
alter table if exists public.central_guias add column if not exists valor_autorizado numeric(14,2);
alter table if exists public.central_guias add column if not exists metodologia_preco text;
alter table if exists public.central_guias add column if not exists memoria_calculo_preco jsonb not null default '{}'::jsonb;
alter table if exists public.central_guias add column if not exists edicao_preco_id uuid references public.tabelas_procedimentos_edicoes(id);

alter table if exists public.conta_faturamento_itens add column if not exists metodologia_preco text;
alter table if exists public.conta_faturamento_itens add column if not exists tabela_procedimento_edicao_id uuid references public.tabelas_procedimentos_edicoes(id);
alter table if exists public.conta_faturamento_itens add column if not exists tabela_procedimento_item_id uuid references public.tabelas_procedimentos_itens(id);
alter table if exists public.conta_faturamento_itens add column if not exists valor_referencia numeric(14,4);
alter table if exists public.conta_faturamento_itens add column if not exists memoria_calculo jsonb not null default '{}'::jsonb;

create or replace function public.calcular_preco_central_guia(p_guia_id uuid)
returns numeric
language plpgsql
security definer
set search_path=public
as $$
declare
  v_guia public.central_guias%rowtype;
  v_preco record;
  v_valor numeric;
begin
  select * into v_guia from public.central_guias where id=p_guia_id;
  if v_guia.id is null or v_guia.convenio_id is null or v_guia.codigo_procedimento is null then return null; end if;
  if not public.tem_unidade(v_guia.empresa_id,v_guia.unidade_id) then raise exception 'Sem acesso'; end if;
  select * into v_preco from public.obter_valor_procedimento_contratual(v_guia.convenio_id,v_guia.codigo_procedimento,coalesce(v_guia.data_solicitacao::date,current_date),coalesce(v_guia.categoria_preco,'procedimentos'),false,false) limit 1;
  v_valor:=v_preco.valor;
  if v_valor is not null then
    update public.central_guias set valor_contratual=v_valor,metodologia_preco=v_preco.metodologia,edicao_preco_id=v_preco.edicao_id,memoria_calculo_preco=v_preco.memoria where id=p_guia_id;
  end if;
  return v_valor;
end;$$;
grant execute on function public.calcular_preco_central_guia(uuid) to authenticated;

-- A funcao de auditoria final sera recriada por 09102/193000 com o motor avancado.

commit;
