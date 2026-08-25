create table if not exists public.monitorizacao_equipamento_dados (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  unidade_id uuid not null,
  atendimento_id uuid references public.atendimentos(id) on delete cascade,
  paciente_id uuid references public.pacientes(id) on delete cascade,
  equipamento_id uuid not null references public.engenharia_equipamentos(id),
  integracao_id uuid references public.engenharia_integracoes_equipamentos(id),
  origem text not null default 'equipamento',
  tipo text not null,
  observado_em timestamptz not null default now(),
  dados jsonb not null default '{}'::jsonb,
  referencia_externa text,
  qualidade text,
  status text not null default 'recebido',
  created_at timestamptz not null default now(),
  created_by uuid
);

create index if not exists idx_monitorizacao_equipamento_atendimento
  on public.monitorizacao_equipamento_dados(empresa_id,unidade_id,atendimento_id,observado_em desc);
create index if not exists idx_monitorizacao_equipamento_origem
  on public.monitorizacao_equipamento_dados(equipamento_id,observado_em desc);

alter table public.monitorizacao_equipamento_dados enable row level security;

drop policy if exists monitorizacao_equipamento_select on public.monitorizacao_equipamento_dados;
create policy monitorizacao_equipamento_select on public.monitorizacao_equipamento_dados
for select to authenticated using (
  public.tem_empresa(empresa_id) and public.tem_unidade(empresa_id,unidade_id)
);

drop policy if exists monitorizacao_equipamento_insert on public.monitorizacao_equipamento_dados;
create policy monitorizacao_equipamento_insert on public.monitorizacao_equipamento_dados
for insert to authenticated with check (
  public.tem_empresa(empresa_id) and public.tem_unidade(empresa_id,unidade_id)
);

comment on table public.monitorizacao_equipamento_dados is
'Leituras estruturadas recebidas de monitores, ventiladores e outros equipamentos assistenciais vinculados à Engenharia Clínica.';
