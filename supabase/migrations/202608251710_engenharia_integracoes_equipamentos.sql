alter table public.laboratorio_equipamentos add column if not exists engenharia_equipamento_id uuid null references public.engenharia_equipamentos(id) on delete set null;
alter table public.imagem_execucoes add column if not exists engenharia_equipamento_id uuid null references public.engenharia_equipamentos(id) on delete set null;

create table if not exists public.engenharia_integracoes_equipamentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  unidade_id uuid not null,
  equipamento_id uuid not null references public.engenharia_equipamentos(id) on delete cascade,
  sistema_origem text not null,
  tipo_integracao text not null,
  protocolo text null,
  host text null,
  porta integer null,
  ae_title text null,
  modalidade_dicom text null,
  endpoint text null,
  identificador_externo text null,
  ativo boolean not null default true,
  status text not null default 'nao_testado',
  ultimo_contato_em timestamptz null,
  ultima_falha_em timestamptz null,
  ultima_mensagem text null,
  configuracao jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid null,
  updated_at timestamptz not null default now(),
  updated_by uuid null,
  unique (empresa_id, unidade_id, equipamento_id, sistema_origem, tipo_integracao)
);

create table if not exists public.engenharia_integracao_eventos (
  id uuid primary key default gen_random_uuid(),
  integracao_id uuid not null references public.engenharia_integracoes_equipamentos(id) on delete cascade,
  direcao text not null default 'interno',
  tipo text not null,
  status text not null default 'ok',
  correlation_id text null,
  mensagem text null,
  payload jsonb null,
  ocorrido_em timestamptz not null default now(),
  created_by uuid null
);

create table if not exists public.engenharia_sala_equipamentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  unidade_id uuid not null,
  sala_cirurgica_id uuid not null references public.salas_cirurgicas(id) on delete cascade,
  equipamento_id uuid not null references public.engenharia_equipamentos(id) on delete cascade,
  obrigatorio boolean not null default false,
  principal boolean not null default false,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid null,
  unique (sala_cirurgica_id, equipamento_id)
);

create index if not exists idx_eng_integracoes_equipamento on public.engenharia_integracoes_equipamentos(equipamento_id);
create index if not exists idx_eng_integracoes_status on public.engenharia_integracoes_equipamentos(empresa_id, unidade_id, status);
create index if not exists idx_eng_integracao_eventos_integracao on public.engenharia_integracao_eventos(integracao_id, ocorrido_em desc);
create index if not exists idx_lab_equip_eng on public.laboratorio_equipamentos(engenharia_equipamento_id);
create index if not exists idx_img_exec_eng on public.imagem_execucoes(engenharia_equipamento_id);

alter table public.engenharia_integracoes_equipamentos enable row level security;
alter table public.engenharia_integracao_eventos enable row level security;
alter table public.engenharia_sala_equipamentos enable row level security;

drop policy if exists eng_integracoes_select on public.engenharia_integracoes_equipamentos;
create policy eng_integracoes_select on public.engenharia_integracoes_equipamentos for select using (public.tem_permissao(empresa_id,unidade_id,'engenharia_clinica.visualizar') or public.tem_permissao(empresa_id,unidade_id,'engenharia_clinica.gerenciar'));
drop policy if exists eng_integracoes_write on public.engenharia_integracoes_equipamentos;
create policy eng_integracoes_write on public.engenharia_integracoes_equipamentos for all using (public.tem_permissao(empresa_id,unidade_id,'engenharia_clinica.gerenciar')) with check (public.tem_permissao(empresa_id,unidade_id,'engenharia_clinica.gerenciar'));
drop policy if exists eng_integracao_eventos_select on public.engenharia_integracao_eventos;
create policy eng_integracao_eventos_select on public.engenharia_integracao_eventos for select using (exists(select 1 from public.engenharia_integracoes_equipamentos i where i.id=integracao_id and (public.tem_permissao(i.empresa_id,i.unidade_id,'engenharia_clinica.visualizar') or public.tem_permissao(i.empresa_id,i.unidade_id,'engenharia_clinica.gerenciar'))));
drop policy if exists eng_integracao_eventos_write on public.engenharia_integracao_eventos;
create policy eng_integracao_eventos_write on public.engenharia_integracao_eventos for insert with check (exists(select 1 from public.engenharia_integracoes_equipamentos i where i.id=integracao_id and public.tem_permissao(i.empresa_id,i.unidade_id,'engenharia_clinica.gerenciar')));
drop policy if exists eng_sala_equip_select on public.engenharia_sala_equipamentos;
create policy eng_sala_equip_select on public.engenharia_sala_equipamentos for select using (public.tem_permissao(empresa_id,unidade_id,'engenharia_clinica.visualizar') or public.tem_permissao(empresa_id,unidade_id,'centro_cirurgico.visualizar'));
drop policy if exists eng_sala_equip_write on public.engenharia_sala_equipamentos;
create policy eng_sala_equip_write on public.engenharia_sala_equipamentos for all using (public.tem_permissao(empresa_id,unidade_id,'engenharia_clinica.gerenciar')) with check (public.tem_permissao(empresa_id,unidade_id,'engenharia_clinica.gerenciar'));
