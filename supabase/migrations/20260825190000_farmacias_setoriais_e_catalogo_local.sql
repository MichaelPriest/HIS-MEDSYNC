alter table public.estoque_locais add column if not exists setor_id uuid null references public.setores(id) on delete set null;
alter table public.estoque_locais add column if not exists codigo text null;
alter table public.estoque_locais add column if not exists eh_farmacia boolean not null default false;
alter table public.estoque_locais add column if not exists farmacia_tipo text null;
alter table public.estoque_locais add column if not exists prioridade_atendimento integer not null default 100;

create unique index if not exists ux_estoque_locais_codigo_unidade on public.estoque_locais(unidade_id,codigo) where codigo is not null;
create index if not exists ix_estoque_locais_setor on public.estoque_locais(empresa_id,unidade_id,setor_id) where ativo=true;
create index if not exists ix_estoque_locais_farmacia on public.estoque_locais(empresa_id,unidade_id,eh_farmacia,farmacia_tipo) where ativo=true;

create table if not exists public.farmacia_catalogo_local (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  unidade_id uuid not null,
  local_id uuid not null references public.estoque_locais(id) on delete cascade,
  produto_id uuid not null references public.estoque_produtos(id) on delete cascade,
  padrao boolean not null default true,
  estoque_minimo numeric(14,4) null,
  estoque_maximo numeric(14,4) null,
  ponto_reposicao numeric(14,4) null,
  quantidade_reposicao numeric(14,4) null,
  permite_dispensacao boolean not null default true,
  observacoes text null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid null,
  updated_at timestamptz not null default now(),
  updated_by uuid null,
  unique(local_id,produto_id)
);
create index if not exists ix_farmacia_catalogo_local_local on public.farmacia_catalogo_local(empresa_id,unidade_id,local_id,ativo);
create index if not exists ix_farmacia_catalogo_local_produto on public.farmacia_catalogo_local(empresa_id,unidade_id,produto_id,ativo);

alter table public.dispensacoes_medicamentos add column if not exists farmacia_local_id uuid null references public.estoque_locais(id) on delete set null;
create index if not exists ix_dispensacoes_farmacia_local on public.dispensacoes_medicamentos(empresa_id,unidade_id,farmacia_local_id,dispensado_em desc);

create table if not exists public.farmacia_rotas_setoriais (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  unidade_id uuid not null,
  setor_id uuid null references public.setores(id) on delete cascade,
  tipo_atendimento text null,
  farmacia_local_id uuid not null references public.estoque_locais(id) on delete cascade,
  prioridade integer not null default 100,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid null,
  updated_at timestamptz not null default now(),
  updated_by uuid null
);
create index if not exists ix_farmacia_rotas_setoriais_busca on public.farmacia_rotas_setoriais(empresa_id,unidade_id,setor_id,tipo_atendimento,ativo,prioridade);
