alter type public.tipo_catalogo add value if not exists 'tipo_profissional';

alter table public.convenios add column if not exists logo_path text;
alter table public.usuarios add column if not exists foto_path text;
alter table public.usuarios add column if not exists telefone text;
alter table public.usuarios add column if not exists cargo text;

create table if not exists public.profissional_contratos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas,
  profissional_id uuid not null references public.profissionais on delete restrict,
  tipo_contrato text not null check (tipo_contrato in ('clt','pj','cooperado','autonomo','estatutario','credenciado','prestador','outro')),
  matricula text,
  data_inicio date not null,
  data_fim date,
  carga_horaria_semanal numeric(6,2),
  tipo_remuneracao text check (tipo_remuneracao is null or tipo_remuneracao in ('mensal','hora','plantao','procedimento','producao','outro')),
  valor_remuneracao numeric(14,2),
  observacoes text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users,
  check (data_fim is null or data_fim >= data_inicio),
  check (carga_horaria_semanal is null or carga_horaria_semanal >= 0),
  check (valor_remuneracao is null or valor_remuneracao >= 0)
);
create index if not exists profissional_contratos_empresa_profissional_idx on public.profissional_contratos(empresa_id, profissional_id, ativo);
alter table public.profissional_contratos enable row level security;
alter table public.profissional_contratos force row level security;
create policy profissional_contratos_select on public.profissional_contratos for select using (public.tem_empresa(empresa_id) and public.tem_permissao(empresa_id,null,'profissionais.visualizar'));
create policy profissional_contratos_insert on public.profissional_contratos for insert with check (public.tem_empresa(empresa_id) and public.tem_permissao(empresa_id,null,'profissionais.criar') and created_by=auth.uid());
create policy profissional_contratos_update on public.profissional_contratos for update using (public.tem_empresa(empresa_id) and public.tem_permissao(empresa_id,null,'profissionais.editar')) with check (public.tem_empresa(empresa_id) and public.tem_permissao(empresa_id,null,'profissionais.editar') and updated_by=auth.uid());
revoke delete,truncate on public.profissional_contratos from anon,authenticated;

create policy usuarios_self_update on public.usuarios for update using (id=auth.uid() and ativo and not bloqueado) with check (id=auth.uid() and ativo and not bloqueado);

insert into public.permissoes(codigo,descricao) values
('agenda.visualizar','Visualizar agenda'),
('agenda.criar','Criar agendamentos'),
('agenda.editar','Editar agendamentos'),
('recepcao.visualizar','Visualizar recepção')
on conflict (codigo) do nothing;

create type public.status_atendimento as enum ('aberto','em_espera','em_atendimento','alta','cancelado');
create type public.status_agendamento as enum ('agendado','confirmado','checkin','atendido','faltou','cancelado');

create table public.atendimentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas,
  unidade_id uuid not null references public.unidades,
  paciente_id uuid not null references public.pacientes,
  profissional_id uuid references public.profissionais,
  tipo_atendimento text not null,
  origem text,
  status public.status_atendimento not null default 'aberto',
  data_abertura timestamptz not null default now(),
  data_fechamento timestamptz,
  observacoes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users
);
create index atendimentos_empresa_unidade_status_idx on public.atendimentos(empresa_id,unidade_id,status,data_abertura desc);
alter table public.atendimentos enable row level security;
alter table public.atendimentos force row level security;
create policy atendimentos_select on public.atendimentos for select using (public.tem_unidade(empresa_id,unidade_id) and public.tem_permissao(empresa_id,unidade_id,'atendimentos.visualizar'));
create policy atendimentos_insert on public.atendimentos for insert with check (public.tem_unidade(empresa_id,unidade_id) and public.tem_permissao(empresa_id,unidade_id,'atendimentos.abrir') and created_by=auth.uid());
create policy atendimentos_update on public.atendimentos for update using (public.tem_unidade(empresa_id,unidade_id) and public.tem_permissao(empresa_id,unidade_id,'atendimentos.transferir')) with check (public.tem_unidade(empresa_id,unidade_id) and updated_by=auth.uid());
revoke delete,truncate on public.atendimentos from anon,authenticated;

create table public.agendamentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas,
  unidade_id uuid not null references public.unidades,
  paciente_id uuid not null references public.pacientes,
  profissional_id uuid references public.profissionais,
  convenio_id uuid references public.convenios,
  inicio timestamptz not null,
  fim timestamptz not null,
  status public.status_agendamento not null default 'agendado',
  tipo_atendimento text,
  observacoes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users,
  check (fim > inicio)
);
create index agendamentos_empresa_unidade_inicio_idx on public.agendamentos(empresa_id,unidade_id,inicio);
alter table public.agendamentos enable row level security;
alter table public.agendamentos force row level security;
create policy agendamentos_select on public.agendamentos for select using (public.tem_unidade(empresa_id,unidade_id) and public.tem_permissao(empresa_id,unidade_id,'agenda.visualizar'));
create policy agendamentos_insert on public.agendamentos for insert with check (public.tem_unidade(empresa_id,unidade_id) and public.tem_permissao(empresa_id,unidade_id,'agenda.criar') and created_by=auth.uid());
create policy agendamentos_update on public.agendamentos for update using (public.tem_unidade(empresa_id,unidade_id) and public.tem_permissao(empresa_id,unidade_id,'agenda.editar')) with check (public.tem_unidade(empresa_id,unidade_id) and updated_by=auth.uid());
revoke delete,truncate on public.agendamentos from anon,authenticated;
