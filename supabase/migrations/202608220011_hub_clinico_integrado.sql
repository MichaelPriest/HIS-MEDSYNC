insert into public.permissoes(codigo,descricao) values
('prescricao.visualizar','Visualizar prescrições do atendimento'),
('prescricao.criar','Criar prescrições'),
('internacao.visualizar','Visualizar internações'),
('internacao.gerenciar','Gerenciar internações'),
('exames.visualizar','Visualizar solicitações e resultados de exames')
on conflict (codigo) do nothing;

create table if not exists public.prescricoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas,
  unidade_id uuid not null references public.unidades,
  atendimento_id uuid not null references public.atendimentos on delete restrict,
  profissional_id uuid not null references public.profissionais on delete restrict,
  tipo text not null default 'medicamento',
  item text not null,
  dose text,
  via text,
  frequencia text,
  duracao text,
  orientacoes text,
  status text not null default 'ativa' check (status in ('ativa','suspensa','concluida','cancelada')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users
);
create index if not exists prescricoes_atendimento_idx on public.prescricoes(atendimento_id,created_at desc);
alter table public.prescricoes enable row level security;
alter table public.prescricoes force row level security;
create policy prescricoes_select on public.prescricoes for select using (public.tem_unidade(empresa_id,unidade_id) and (public.tem_permissao(empresa_id,unidade_id,'prescricao.visualizar') or public.tem_permissao(empresa_id,unidade_id,'prontuario.visualizar')));
create policy prescricoes_insert on public.prescricoes for insert with check (public.tem_unidade(empresa_id,unidade_id) and public.tem_permissao(empresa_id,unidade_id,'prescricao.criar') and created_by=auth.uid());
create policy prescricoes_update on public.prescricoes for update using (public.tem_unidade(empresa_id,unidade_id) and public.tem_permissao(empresa_id,unidade_id,'prescricao.criar')) with check (updated_by=auth.uid());
revoke delete,truncate on public.prescricoes from anon,authenticated;

create table if not exists public.internacoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas,
  unidade_id uuid not null references public.unidades,
  atendimento_id uuid not null unique references public.atendimentos on delete restrict,
  setor text,
  quarto text,
  leito text,
  tipo_internacao text,
  data_internacao timestamptz not null default now(),
  previsao_alta date,
  data_alta timestamptz,
  status text not null default 'internado' check (status in ('internado','alta','transferido','cancelado')),
  observacoes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users
);
create index if not exists internacoes_unidade_status_idx on public.internacoes(empresa_id,unidade_id,status,data_internacao desc);
alter table public.internacoes enable row level security;
alter table public.internacoes force row level security;
create policy internacoes_select on public.internacoes for select using (public.tem_unidade(empresa_id,unidade_id) and (public.tem_permissao(empresa_id,unidade_id,'internacao.visualizar') or public.tem_permissao(empresa_id,unidade_id,'prontuario.visualizar')));
create policy internacoes_insert on public.internacoes for insert with check (public.tem_unidade(empresa_id,unidade_id) and public.tem_permissao(empresa_id,unidade_id,'internacao.gerenciar') and created_by=auth.uid());
create policy internacoes_update on public.internacoes for update using (public.tem_unidade(empresa_id,unidade_id) and public.tem_permissao(empresa_id,unidade_id,'internacao.gerenciar')) with check (updated_by=auth.uid());
revoke delete,truncate on public.internacoes from anon,authenticated;

create table if not exists public.solicitacoes_exames (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas,
  unidade_id uuid not null references public.unidades,
  atendimento_id uuid not null references public.atendimentos on delete restrict,
  profissional_id uuid references public.profissionais on delete restrict,
  modalidade text not null check (modalidade in ('laboratorio','imagem','outro')),
  exame text not null,
  codigo_tuss text,
  indicacao_clinica text,
  status text not null default 'solicitado' check (status in ('solicitado','agendado','coletado','em_execucao','liberado','cancelado')),
  resultado_resumo text,
  resultado_em timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users
);
create index if not exists solicitacoes_exames_atendimento_idx on public.solicitacoes_exames(atendimento_id,created_at desc);
alter table public.solicitacoes_exames enable row level security;
alter table public.solicitacoes_exames force row level security;
create policy solicitacoes_exames_select on public.solicitacoes_exames for select using (public.tem_unidade(empresa_id,unidade_id) and (public.tem_permissao(empresa_id,unidade_id,'exames.visualizar') or public.tem_permissao(empresa_id,unidade_id,'prontuario.visualizar')));
revoke delete,truncate on public.solicitacoes_exames from anon,authenticated;
