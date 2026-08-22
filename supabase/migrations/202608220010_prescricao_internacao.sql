insert into public.permissoes(codigo,descricao) values
('prescricao.visualizar','Visualizar prescrições'),
('prescricao.criar','Criar prescrições'),
('internacao.visualizar','Visualizar internações'),
('internacao.criar','Criar internações'),
('internacao.editar','Movimentar e atualizar internações')
on conflict (codigo) do nothing;

create table public.prescricoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas,
  unidade_id uuid not null references public.unidades,
  atendimento_id uuid not null references public.atendimentos on delete restrict,
  profissional_id uuid not null references public.profissionais on delete restrict,
  tipo text not null default 'medicamento' check (tipo in ('medicamento','dieta','cuidado','procedimento','outro')),
  item text not null,
  dose text,
  via text,
  frequencia text,
  duracao text,
  instrucoes text,
  status text not null default 'ativa' check (status in ('ativa','suspensa','concluida','cancelada')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users
);
create index prescricoes_atendimento_idx on public.prescricoes(atendimento_id,created_at desc);
alter table public.prescricoes enable row level security;
alter table public.prescricoes force row level security;
create policy prescricoes_select on public.prescricoes for select using (public.tem_unidade(empresa_id,unidade_id) and public.tem_permissao(empresa_id,unidade_id,'prescricao.visualizar'));
create policy prescricoes_insert on public.prescricoes for insert with check (public.tem_unidade(empresa_id,unidade_id) and public.tem_permissao(empresa_id,unidade_id,'prescricao.criar') and created_by=auth.uid());
create policy prescricoes_update on public.prescricoes for update using (public.tem_unidade(empresa_id,unidade_id) and public.tem_permissao(empresa_id,unidade_id,'prescricao.criar') and created_by=auth.uid()) with check (updated_by=auth.uid());
revoke delete,truncate on public.prescricoes from anon,authenticated;

create table public.internacoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas,
  unidade_id uuid not null references public.unidades,
  atendimento_id uuid not null references public.atendimentos on delete restrict,
  profissional_responsavel_id uuid references public.profissionais on delete restrict,
  setor text not null,
  leito text,
  acomodacao text,
  motivo text,
  data_internacao timestamptz not null default now(),
  previsao_alta date,
  data_alta timestamptz,
  status text not null default 'internado' check (status in ('aguardando_leito','internado','transferido','alta','cancelado')),
  observacoes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users
);
create unique index internacoes_atendimento_ativa_idx on public.internacoes(atendimento_id) where status in ('aguardando_leito','internado','transferido');
create index internacoes_unidade_status_idx on public.internacoes(empresa_id,unidade_id,status,data_internacao desc);
alter table public.internacoes enable row level security;
alter table public.internacoes force row level security;
create policy internacoes_select on public.internacoes for select using (public.tem_unidade(empresa_id,unidade_id) and public.tem_permissao(empresa_id,unidade_id,'internacao.visualizar'));
create policy internacoes_insert on public.internacoes for insert with check (public.tem_unidade(empresa_id,unidade_id) and public.tem_permissao(empresa_id,unidade_id,'internacao.criar') and created_by=auth.uid());
create policy internacoes_update on public.internacoes for update using (public.tem_unidade(empresa_id,unidade_id) and public.tem_permissao(empresa_id,unidade_id,'internacao.editar')) with check (public.tem_unidade(empresa_id,unidade_id) and updated_by=auth.uid());
revoke delete,truncate on public.internacoes from anon,authenticated;
