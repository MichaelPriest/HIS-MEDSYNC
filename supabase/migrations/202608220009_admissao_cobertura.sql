begin;

create type public.tipo_cobertura_atendimento as enum ('particular','convenio');

create table public.convenio_planos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas,
  convenio_id uuid not null references public.convenios on delete restrict,
  codigo text,
  nome text not null,
  acomodacao text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users,
  unique(convenio_id,nome)
);
create index convenio_planos_empresa_convenio_idx on public.convenio_planos(empresa_id,convenio_id,ativo);
alter table public.convenio_planos enable row level security;
alter table public.convenio_planos force row level security;
create policy convenio_planos_select on public.convenio_planos for select using (public.tem_empresa(empresa_id) and public.tem_permissao(empresa_id,null,'convenios.visualizar'));
create policy convenio_planos_insert on public.convenio_planos for insert with check (public.tem_empresa(empresa_id) and public.tem_permissao(empresa_id,null,'convenios.criar') and created_by=auth.uid());
create policy convenio_planos_update on public.convenio_planos for update using (public.tem_empresa(empresa_id) and public.tem_permissao(empresa_id,null,'convenios.editar')) with check (public.tem_empresa(empresa_id) and public.tem_permissao(empresa_id,null,'convenios.editar') and updated_by=auth.uid());
revoke delete,truncate on public.convenio_planos from anon,authenticated;

alter table public.atendimentos
  add column if not exists cobertura public.tipo_cobertura_atendimento not null default 'particular',
  add column if not exists convenio_id uuid references public.convenios,
  add column if not exists plano_id uuid references public.convenio_planos,
  add column if not exists numero_carteirinha text,
  add column if not exists validade_carteirinha date,
  add column if not exists numero_autorizacao text,
  add column if not exists senha_autorizacao text,
  add column if not exists paciente_nome text,
  add column if not exists paciente_cpf text,
  add column if not exists paciente_rg text,
  add column if not exists paciente_cns text,
  add column if not exists paciente_data_nascimento date,
  add column if not exists paciente_nacionalidade text,
  add column if not exists paciente_estado_civil text,
  add column if not exists paciente_sexo text,
  add column if not exists paciente_telefone text,
  add column if not exists paciente_email text,
  add column if not exists paciente_cep text,
  add column if not exists paciente_endereco text,
  add column if not exists paciente_numero text,
  add column if not exists paciente_complemento text,
  add column if not exists paciente_bairro text,
  add column if not exists paciente_cidade text,
  add column if not exists paciente_estado text,
  add constraint atendimentos_cobertura_check check (
    (cobertura='particular' and convenio_id is null and plano_id is null)
    or
    (cobertura='convenio' and convenio_id is not null and plano_id is not null and numero_carteirinha is not null)
  );

create index if not exists atendimentos_convenio_idx on public.atendimentos(empresa_id,convenio_id,plano_id) where convenio_id is not null;

commit;
