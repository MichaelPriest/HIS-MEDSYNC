create table if not exists public.filas_setoriais (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  unidade_id uuid not null references public.unidades(id),
  atendimento_id uuid not null references public.atendimentos(id),
  paciente_id uuid not null references public.pacientes(id),
  setor_codigo text not null,
  origem text not null default 'medico',
  motivo text,
  prioridade text not null default 'normal' check (prioridade in ('normal','preferencial','emergencia')),
  status text not null default 'aguardando' check (status in ('aguardando','chamado','em_atendimento','concluido','cancelado')),
  profissional_origem_id uuid references public.profissionais(id),
  profissional_destino_id uuid references public.profissionais(id),
  ponto_atendimento text,
  created_at timestamptz not null default now(),
  chamado_em timestamptz,
  iniciado_em timestamptz,
  concluido_em timestamptz,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
create index if not exists filas_setoriais_unidade_setor_status_idx on public.filas_setoriais(unidade_id,setor_codigo,status,prioridade,created_at);
create index if not exists filas_setoriais_atendimento_idx on public.filas_setoriais(atendimento_id,created_at desc);
alter table public.filas_setoriais enable row level security;
alter table public.filas_setoriais force row level security;
create policy filas_setoriais_select on public.filas_setoriais for select using (public.tem_unidade(empresa_id,unidade_id));
create policy filas_setoriais_insert on public.filas_setoriais for insert with check (public.tem_unidade(empresa_id,unidade_id) and created_by=auth.uid());
create policy filas_setoriais_update on public.filas_setoriais for update using (public.tem_unidade(empresa_id,unidade_id)) with check (public.tem_unidade(empresa_id,unidade_id) and updated_by=auth.uid());
revoke delete,truncate on public.filas_setoriais from anon,authenticated;

alter table public.atendimentos add column if not exists setor_atual text;
alter table public.atendimentos add column if not exists ultima_movimentacao_em timestamptz;
