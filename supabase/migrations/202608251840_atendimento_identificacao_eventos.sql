create table if not exists public.atendimento_identificacao_eventos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  unidade_id uuid not null,
  atendimento_id uuid not null references public.atendimentos(id) on delete cascade,
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  convenio_id uuid not null references public.convenios(id) on delete cascade,
  metodo text not null check (metodo in ('biometria_digital','token')),
  referencia_hash text,
  provedor text,
  dispositivo text,
  validado boolean not null default false,
  validado_em timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid
);
create index if not exists idx_atendimento_identificacao_lookup on public.atendimento_identificacao_eventos(empresa_id,unidade_id,atendimento_id,created_at desc);
alter table public.atendimento_identificacao_eventos enable row level security;
drop policy if exists atendimento_identificacao_select on public.atendimento_identificacao_eventos;
create policy atendimento_identificacao_select on public.atendimento_identificacao_eventos for select to authenticated using (public.tem_empresa(empresa_id) and public.tem_unidade(empresa_id,unidade_id));
drop policy if exists atendimento_identificacao_insert on public.atendimento_identificacao_eventos;
create policy atendimento_identificacao_insert on public.atendimento_identificacao_eventos for insert to authenticated with check (public.tem_empresa(empresa_id) and public.tem_unidade(empresa_id,unidade_id));
comment on column public.atendimento_identificacao_eventos.referencia_hash is 'Hash de token ou referência do SDK biométrico. Não armazenar segredo nem imagem bruta.';
