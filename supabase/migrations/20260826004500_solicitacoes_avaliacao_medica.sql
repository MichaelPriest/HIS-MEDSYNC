create table if not exists public.solicitacoes_avaliacao_medica (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  unidade_id uuid not null,
  atendimento_id uuid not null references public.atendimentos(id) on delete cascade,
  paciente_id uuid not null references public.pacientes(id),
  solicitante_profissional_id uuid not null references public.profissionais(id),
  especialidade text not null,
  prioridade text not null default 'rotina' check (prioridade in ('rotina','urgente','emergencia')),
  motivo text not null,
  observacoes text,
  status text not null default 'solicitada' check (status in ('solicitada','aceita','em_avaliacao','concluida','cancelada')),
  profissional_responsavel_id uuid references public.profissionais(id),
  solicitada_em timestamptz not null default now(),
  aceita_em timestamptz,
  iniciada_em timestamptz,
  concluida_em timestamptz,
  parecer text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_solicitacoes_avaliacao_atendimento on public.solicitacoes_avaliacao_medica(empresa_id,unidade_id,atendimento_id,solicitada_em desc);
create index if not exists idx_solicitacoes_avaliacao_fila on public.solicitacoes_avaliacao_medica(empresa_id,unidade_id,especialidade,status,prioridade,solicitada_em);

alter table public.solicitacoes_avaliacao_medica enable row level security;
alter table public.solicitacoes_avaliacao_medica force row level security;

create policy solicitacoes_avaliacao_select on public.solicitacoes_avaliacao_medica
for select to authenticated using (public.tem_empresa(empresa_id) and public.tem_unidade(empresa_id,unidade_id));
create policy solicitacoes_avaliacao_insert on public.solicitacoes_avaliacao_medica
for insert to authenticated with check (public.tem_empresa(empresa_id) and public.tem_unidade(empresa_id,unidade_id));
create policy solicitacoes_avaliacao_update on public.solicitacoes_avaliacao_medica
for update to authenticated using (public.tem_empresa(empresa_id) and public.tem_unidade(empresa_id,unidade_id))
with check (public.tem_empresa(empresa_id) and public.tem_unidade(empresa_id,unidade_id));
revoke delete,truncate on public.solicitacoes_avaliacao_medica from anon,authenticated;

comment on table public.solicitacoes_avaliacao_medica is 'Solicitações de avaliação, parecer ou interconsulta médica vinculadas ao mesmo episódio assistencial.';
notify pgrst, 'reload schema';
