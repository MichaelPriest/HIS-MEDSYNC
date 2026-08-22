begin;

insert into public.permissoes(codigo,descricao) values
('profissionais.visualizar','Visualizar profissionais'),
('profissionais.criar','Criar profissionais'),
('profissionais.editar','Editar profissionais'),
('convenios.visualizar','Visualizar convênios'),
('convenios.criar','Criar convênios'),
('convenios.editar','Editar convênios'),
('catalogos.visualizar','Visualizar catálogos'),
('catalogos.criar','Criar catálogos'),
('catalogos.editar','Editar catálogos')
on conflict (codigo) do nothing;

create table public.profissionais (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas,
  nome_completo text not null check (char_length(trim(nome_completo)) >= 2),
  cpf text check (cpf is null or cpf ~ '^[0-9]{11}$'),
  conselho text,
  numero_conselho text,
  uf_conselho text check (uf_conselho is null or uf_conselho ~ '^[A-Z]{2}$'),
  especialidade text,
  cbo text,
  telefone text,
  email text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users
);
create unique index profissionais_empresa_cpf_unique on public.profissionais(empresa_id,cpf) where cpf is not null and ativo;
create index profissionais_empresa_nome_idx on public.profissionais(empresa_id,nome_completo) where ativo;

create table public.convenios (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas,
  registro_ans text check (registro_ans is null or registro_ans ~ '^[0-9]{6}$'),
  razao_social text not null,
  nome_fantasia text not null,
  cnpj text check (cnpj is null or cnpj ~ '^[0-9]{14}$'),
  telefone text,
  email text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users
);
create unique index convenios_empresa_ans_unique on public.convenios(empresa_id,registro_ans) where registro_ans is not null and ativo;
create index convenios_empresa_nome_idx on public.convenios(empresa_id,nome_fantasia) where ativo;

create type public.tipo_catalogo as enum ('especialidade','cbo','cid10','tuss','tipo_atendimento','motivo_classificacao');
create table public.catalogos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas,
  tipo public.tipo_catalogo not null,
  codigo text not null,
  descricao text not null,
  vigencia_inicio date,
  vigencia_fim date,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users,
  check (vigencia_fim is null or vigencia_inicio is null or vigencia_fim >= vigencia_inicio)
);
create unique index catalogos_empresa_tipo_codigo_unique on public.catalogos(empresa_id,tipo,codigo) where ativo;
create index catalogos_empresa_tipo_descricao_idx on public.catalogos(empresa_id,tipo,descricao) where ativo;

alter table public.profissionais enable row level security;
alter table public.profissionais force row level security;
alter table public.convenios enable row level security;
alter table public.convenios force row level security;
alter table public.catalogos enable row level security;
alter table public.catalogos force row level security;

create policy profissionais_select on public.profissionais for select using (public.tem_empresa(empresa_id) and public.tem_permissao(empresa_id,null,'profissionais.visualizar'));
create policy profissionais_insert on public.profissionais for insert with check (public.tem_empresa(empresa_id) and public.tem_permissao(empresa_id,null,'profissionais.criar') and created_by=auth.uid());
create policy profissionais_update on public.profissionais for update using (public.tem_empresa(empresa_id) and public.tem_permissao(empresa_id,null,'profissionais.editar')) with check (public.tem_empresa(empresa_id) and public.tem_permissao(empresa_id,null,'profissionais.editar') and updated_by=auth.uid());

create policy convenios_select on public.convenios for select using (public.tem_empresa(empresa_id) and public.tem_permissao(empresa_id,null,'convenios.visualizar'));
create policy convenios_insert on public.convenios for insert with check (public.tem_empresa(empresa_id) and public.tem_permissao(empresa_id,null,'convenios.criar') and created_by=auth.uid());
create policy convenios_update on public.convenios for update using (public.tem_empresa(empresa_id) and public.tem_permissao(empresa_id,null,'convenios.editar')) with check (public.tem_empresa(empresa_id) and public.tem_permissao(empresa_id,null,'convenios.editar') and updated_by=auth.uid());

create policy catalogos_select on public.catalogos for select using (public.tem_empresa(empresa_id) and public.tem_permissao(empresa_id,null,'catalogos.visualizar'));
create policy catalogos_insert on public.catalogos for insert with check (public.tem_empresa(empresa_id) and public.tem_permissao(empresa_id,null,'catalogos.criar') and created_by=auth.uid());
create policy catalogos_update on public.catalogos for update using (public.tem_empresa(empresa_id) and public.tem_permissao(empresa_id,null,'catalogos.editar')) with check (public.tem_empresa(empresa_id) and public.tem_permissao(empresa_id,null,'catalogos.editar') and updated_by=auth.uid());

revoke delete,truncate on public.profissionais, public.convenios, public.catalogos from anon,authenticated;

commit;
