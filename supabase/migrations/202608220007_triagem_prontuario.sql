create table public.triagens (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas,
  unidade_id uuid not null references public.unidades,
  atendimento_id uuid not null references public.atendimentos on delete restrict,
  peso_kg numeric(6,2),
  altura_cm numeric(6,2),
  pressao_arterial text,
  frequencia_cardiaca integer,
  frequencia_respiratoria integer,
  saturacao_o2 numeric(5,2),
  temperatura_c numeric(4,1),
  glicemia_mg_dl numeric(7,2),
  dor_escala integer check (dor_escala is null or dor_escala between 0 and 10),
  classificacao_risco text,
  queixa_principal text,
  observacoes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users
);
create unique index triagens_atendimento_unique on public.triagens(atendimento_id);
alter table public.triagens enable row level security;
alter table public.triagens force row level security;
create policy triagens_select on public.triagens for select using (public.tem_unidade(empresa_id,unidade_id) and (public.tem_permissao(empresa_id,unidade_id,'triagem.registrar') or public.tem_permissao(empresa_id,unidade_id,'prontuario.visualizar')));
create policy triagens_insert on public.triagens for insert with check (public.tem_unidade(empresa_id,unidade_id) and public.tem_permissao(empresa_id,unidade_id,'triagem.registrar') and created_by=auth.uid());
create policy triagens_update on public.triagens for update using (public.tem_unidade(empresa_id,unidade_id) and public.tem_permissao(empresa_id,unidade_id,'triagem.registrar')) with check (public.tem_unidade(empresa_id,unidade_id) and updated_by=auth.uid());
revoke delete,truncate on public.triagens from anon,authenticated;

create table public.prontuario_evolucoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas,
  unidade_id uuid not null references public.unidades,
  atendimento_id uuid not null references public.atendimentos on delete restrict,
  profissional_id uuid not null references public.profissionais on delete restrict,
  tipo_evolucao text not null default 'evolucao',
  subjetivo text,
  objetivo text,
  avaliacao text,
  plano text,
  texto_livre text,
  assinado_em timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users
);
create index prontuario_evolucoes_atendimento_idx on public.prontuario_evolucoes(atendimento_id,created_at desc);
alter table public.prontuario_evolucoes enable row level security;
alter table public.prontuario_evolucoes force row level security;
create policy prontuario_evolucoes_select on public.prontuario_evolucoes for select using (public.tem_unidade(empresa_id,unidade_id) and public.tem_permissao(empresa_id,unidade_id,'prontuario.visualizar'));
create policy prontuario_evolucoes_insert on public.prontuario_evolucoes for insert with check (public.tem_unidade(empresa_id,unidade_id) and public.tem_permissao(empresa_id,unidade_id,'prontuario.evoluir') and created_by=auth.uid());
create policy prontuario_evolucoes_update on public.prontuario_evolucoes for update using (public.tem_unidade(empresa_id,unidade_id) and public.tem_permissao(empresa_id,unidade_id,'prontuario.evoluir') and created_by=auth.uid()) with check (updated_by=auth.uid());
revoke delete,truncate on public.prontuario_evolucoes from anon,authenticated;
