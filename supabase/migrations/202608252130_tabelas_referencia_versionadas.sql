create table if not exists public.referencia_tabelas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nome text not null,
  tipo text not null check (tipo in ('AMB','CBHPM','TUSS','OPERADORA','OUTRA')),
  versao text,
  fonte text,
  vigencia_inicio date,
  vigencia_fim date,
  status text not null default 'ativa' check (status in ('ativa','historica','rascunho','inativa')),
  metadados jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.referencia_itens (
  id uuid primary key default gen_random_uuid(),
  tabela_id uuid not null references public.referencia_tabelas(id) on delete cascade,
  codigo text not null,
  descricao text not null,
  quantidade_ch numeric,
  quantidade_aux numeric,
  porte text,
  fracao_porte numeric,
  valor_porte numeric,
  custo_operacional numeric,
  porte_cirurgico text,
  ch_anestesista numeric,
  porte_anestesista text,
  valor_porte_anestesista numeric,
  quantidade_filme numeric,
  atributos jsonb not null default '{}'::jsonb,
  origem_linha integer,
  origem_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tabela_id,codigo)
);
create index if not exists idx_referencia_itens_codigo on public.referencia_itens(codigo);
create index if not exists idx_referencia_itens_descricao on public.referencia_itens using gin(to_tsvector('portuguese',coalesce(descricao,'')));

create table if not exists public.referencia_equivalencias (
  id uuid primary key default gen_random_uuid(),
  sistema_origem text not null,
  codigo_origem text not null,
  descricao_origem text,
  sistema_destino text not null,
  codigo_destino text not null,
  descricao_destino text,
  fonte text,
  status text not null default 'ativa' check (status in ('ativa','revisar','inativa')),
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(sistema_origem,codigo_origem,sistema_destino,codigo_destino,fonte)
);
create index if not exists idx_ref_equiv_origem on public.referencia_equivalencias(sistema_origem,codigo_origem);
create index if not exists idx_ref_equiv_destino on public.referencia_equivalencias(sistema_destino,codigo_destino);

create table if not exists public.referencia_glosas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  motivo text not null,
  fonte text not null default 'XML legado',
  ativo boolean not null default true,
  metadados jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.convenio_tabelas_referencia (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  unidade_id uuid,
  convenio_id uuid not null references public.convenios(id) on delete cascade,
  tabela_id uuid not null references public.referencia_tabelas(id),
  vigencia_inicio date not null,
  vigencia_fim date,
  prioridade integer not null default 1,
  valor_ch numeric,
  fator_multiplicador numeric not null default 1,
  regras jsonb not null default '{}'::jsonb,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_convenio_tabelas_vigencia on public.convenio_tabelas_referencia(empresa_id,convenio_id,ativo,vigencia_inicio desc);

alter table public.referencia_tabelas enable row level security;
alter table public.referencia_itens enable row level security;
alter table public.referencia_equivalencias enable row level security;
alter table public.referencia_glosas enable row level security;
alter table public.convenio_tabelas_referencia enable row level security;

create policy referencia_tabelas_read on public.referencia_tabelas for select to authenticated using (true);
create policy referencia_itens_read on public.referencia_itens for select to authenticated using (true);
create policy referencia_equivalencias_read on public.referencia_equivalencias for select to authenticated using (true);
create policy referencia_glosas_read on public.referencia_glosas for select to authenticated using (true);
create policy convenio_tabelas_read on public.convenio_tabelas_referencia for select to authenticated using (public.tem_empresa(empresa_id) and (unidade_id is null or public.tem_unidade(empresa_id,unidade_id)));

revoke insert,update,delete,truncate on public.referencia_tabelas,public.referencia_itens,public.referencia_equivalencias,public.referencia_glosas from anon,authenticated;
revoke insert,update,delete,truncate on public.convenio_tabelas_referencia from anon,authenticated;

comment on table public.referencia_tabelas is 'Versoes historicas e comerciais de tabelas de procedimentos como AMB, CBHPM e tabelas de operadoras.';
comment on table public.referencia_itens is 'Itens versionados. O mesmo codigo pode ter valores e atributos diferentes entre tabelas/versoes.';
comment on table public.referencia_equivalencias is 'Mapeamentos entre sistemas de codificacao, preservando origem e destino sem sobrescrever historico.';
comment on table public.referencia_glosas is 'Catalogo de codigos/motivos de glosa importados de fontes versionadas.';
