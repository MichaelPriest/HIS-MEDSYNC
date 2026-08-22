begin;

create type public.sexo_paciente as enum ('feminino','masculino','intersexo','nao_informado');

create table public.pacientes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas,
  nome_completo text not null check (char_length(trim(nome_completo)) >= 2),
  nome_social text,
  cpf text check (cpf is null or cpf ~ '^[0-9]{11}$'),
  cns text check (cns is null or cns ~ '^[0-9]{15}$'),
  data_nascimento date not null,
  sexo public.sexo_paciente not null default 'nao_informado',
  telefone text,
  email text,
  cep text check (cep is null or cep ~ '^[0-9]{8}$'),
  logradouro text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  uf text check (uf is null or uf ~ '^[A-Z]{2}$'),
  contato_emergencia_nome text,
  contato_emergencia_telefone text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users
);

create unique index pacientes_empresa_cpf_unique on public.pacientes(empresa_id,cpf) where cpf is not null and ativo;
create unique index pacientes_empresa_cns_unique on public.pacientes(empresa_id,cns) where cns is not null and ativo;
create index pacientes_empresa_nome_idx on public.pacientes(empresa_id,nome_completo) where ativo;

alter table public.pacientes enable row level security;
alter table public.pacientes force row level security;

create policy pacientes_select on public.pacientes for select
using (public.tem_empresa(empresa_id) and public.tem_permissao(empresa_id,null,'pacientes.visualizar'));

create policy pacientes_insert on public.pacientes for insert
with check (public.tem_empresa(empresa_id) and public.tem_permissao(empresa_id,null,'pacientes.criar') and created_by=auth.uid());

create policy pacientes_update on public.pacientes for update
using (public.tem_empresa(empresa_id) and public.tem_permissao(empresa_id,null,'pacientes.editar'))
with check (public.tem_empresa(empresa_id) and public.tem_permissao(empresa_id,null,'pacientes.editar') and updated_by=auth.uid());

revoke delete,truncate on public.pacientes from anon,authenticated;

commit;
