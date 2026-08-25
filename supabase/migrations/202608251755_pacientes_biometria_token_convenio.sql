create table if not exists public.paciente_biometrias (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  tipo text not null check (tipo in ('digital','facial')),
  dedo text,
  provedor text,
  dispositivo text,
  identificador_externo text,
  template_hash text,
  token_ref text,
  qualidade numeric,
  consentimento_registrado boolean not null default false,
  base_legal text,
  capturado_em timestamptz not null default now(),
  capturado_por uuid,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
create index if not exists idx_paciente_biometrias_paciente on public.paciente_biometrias(empresa_id,paciente_id) where ativo;

create table if not exists public.convenio_identificacao_config (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  convenio_id uuid not null references public.convenios(id) on delete cascade,
  metodo text not null check (metodo in ('nenhum','biometria_digital','token','biometria_ou_token')) default 'nenhum',
  provedor text,
  endpoint text,
  credencial_ref text,
  exige_no_atendimento boolean not null default false,
  exige_na_autorizacao boolean not null default false,
  faixa_etaria_min integer,
  faixa_etaria_max integer,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique(empresa_id,convenio_id)
);

create table if not exists public.paciente_convenio_tokens (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  convenio_id uuid not null references public.convenios(id) on delete cascade,
  atendimento_id uuid,
  tipo text not null default 'token_atendimento',
  token_hash text,
  token_ref text,
  validado boolean not null default false,
  validado_em timestamptz,
  expira_em timestamptz,
  origem text,
  created_at timestamptz not null default now(),
  created_by uuid
);
create index if not exists idx_paciente_convenio_tokens_lookup on public.paciente_convenio_tokens(empresa_id,paciente_id,convenio_id,created_at desc);

alter table public.paciente_biometrias enable row level security;
alter table public.convenio_identificacao_config enable row level security;
alter table public.paciente_convenio_tokens enable row level security;

create policy paciente_biometrias_empresa on public.paciente_biometrias for select to authenticated using (public.tem_empresa(empresa_id));
create policy paciente_biometrias_write on public.paciente_biometrias for all to authenticated using (public.tem_empresa(empresa_id)) with check (public.tem_empresa(empresa_id));
create policy convenio_identificacao_empresa on public.convenio_identificacao_config for select to authenticated using (public.tem_empresa(empresa_id));
create policy convenio_identificacao_write on public.convenio_identificacao_config for all to authenticated using (public.tem_empresa(empresa_id)) with check (public.tem_empresa(empresa_id));
create policy paciente_convenio_tokens_empresa on public.paciente_convenio_tokens for select to authenticated using (public.tem_empresa(empresa_id));
create policy paciente_convenio_tokens_write on public.paciente_convenio_tokens for all to authenticated using (public.tem_empresa(empresa_id)) with check (public.tem_empresa(empresa_id));

comment on column public.paciente_biometrias.template_hash is 'Hash/identificador não reversível. Não armazenar imagem bruta da impressão digital.';
comment on column public.paciente_biometrias.token_ref is 'Referência segura para template/token mantido pelo SDK, dispositivo ou cofre de segredos.';
comment on column public.paciente_convenio_tokens.token_hash is 'Hash do token para auditoria; não persistir token em texto puro.';