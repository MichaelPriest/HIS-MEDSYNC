begin;

-- ============================================================================
-- MEDSYNC HIS - BASELINE CONSOLIDADA / RESET TOTAL
-- Data: 2026-08-23
--
-- ATENCAO: ESTE ARQUIVO E DESTRUTIVO.
-- Ele preserva os registros de public.usuarios e NAO altera auth.users,
-- mas recria TODO o schema public e todos os dados operacionais/cadastrais.
--
-- Execute somente com backup/snapshot do projeto Supabase.
-- Por seguranca este arquivo fica em supabase/baseline, fora de migrations,
-- para nao ser reaplicado automaticamente por `supabase db push`.
-- ============================================================================

set local statement_timeout = '0';
set local lock_timeout = '15s';

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- --------------------------------------------------------------------------
-- 0. PRESERVA USUARIOS PUBLICOS EXISTENTES
-- --------------------------------------------------------------------------
create temporary table _medsync_usuarios_backup(payload jsonb) on commit drop;

do $$
begin
  if to_regclass('public.usuarios') is not null then
    execute 'insert into _medsync_usuarios_backup(payload) select to_jsonb(u) from public.usuarios u';
  end if;
end $$;

-- Policies de Storage que dependem de objetos do schema public podem impedir
-- referencias antigas. Removemos apenas policies conhecidas do MedSync.
drop policy if exists storage_clinico_select on storage.objects;
drop policy if exists storage_clinico_insert on storage.objects;
drop policy if exists cadastros_fotos_select on storage.objects;
drop policy if exists cadastros_fotos_insert on storage.objects;
drop policy if exists cadastros_fotos_update on storage.objects;

-- Reconstroi public do zero. auth, storage e supabase_migrations permanecem.
drop schema if exists public cascade;
create schema public;
grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on schema public to postgres, service_role;

set local search_path = public, extensions, pg_catalog;

-- --------------------------------------------------------------------------
-- 1. TIPOS
-- --------------------------------------------------------------------------
create type public.tipo_local as enum ('consultorio','sala','quarto','leito');
create type public.sexo_paciente as enum ('feminino','masculino','intersexo','nao_informado','outros');
create type public.nacionalidade_tipo as enum ('brasileiro','estrangeiro');
create type public.estado_civil_tipo as enum ('solteiro','casado','divorciado','viuvo');
create type public.tipo_telefone as enum ('celular','residencial','comercial');
create type public.tipo_endereco as enum ('residencial','comercial','outro');
create type public.tipo_catalogo as enum ('especialidade','cbo','cid10','tuss','tipo_atendimento','motivo_classificacao','tipo_profissional');
create type public.status_atendimento as enum ('aberto','em_espera','em_atendimento','alta','cancelado');
create type public.status_agendamento as enum ('agendado','confirmado','checkin','atendido','faltou','cancelado');
create type public.tipo_cobertura_atendimento as enum ('particular','convenio');
create type public.status_senha as enum ('aguardando','chamada','em_atendimento','finalizada','cancelada');
create type public.prioridade_senha as enum ('normal','preferencial','emergencia');

create sequence public.paciente_registro_seq start with 100000;
create sequence public.atendimento_numero_seq start with 1000000;

-- --------------------------------------------------------------------------
-- 2. CORE / IDENTIDADE / ACESSO
-- --------------------------------------------------------------------------
create table public.empresas (
  id uuid primary key default gen_random_uuid(),
  razao_social text not null,
  nome_fantasia text not null,
  cnpj text not null unique check (cnpj ~ '^[0-9]{14}$'),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create table public.unidades (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  nome text not null,
  cnes text check (cnes is null or cnes ~ '^[0-9]{7}$'),
  timezone text not null default 'America/Sao_Paulo',
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  unique(empresa_id,nome)
);

create table public.setores (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  unidade_id uuid not null references public.unidades(id),
  nome text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  unique(unidade_id,nome)
);

create table public.locais (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  unidade_id uuid not null references public.unidades(id),
  setor_id uuid not null references public.setores(id),
  local_pai_id uuid references public.locais(id),
  tipo public.tipo_local not null,
  nome text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  unique(setor_id,tipo,nome)
);

create table public.usuarios (
  id uuid primary key references auth.users(id) on delete restrict,
  nome text not null,
  bloqueado boolean not null default false,
  motivo_bloqueio text,
  ativo boolean not null default true,
  foto_path text,
  telefone text,
  cargo text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create table public.permissoes (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique check (codigo ~ '^[a-z]+[a-z0-9_.]+$'),
  descricao text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create table public.perfis (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  nome text not null,
  sistema boolean not null default false,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  unique(empresa_id,nome)
);

create table public.perfil_permissoes (
  perfil_id uuid not null references public.perfis(id) on delete cascade,
  permissao_id uuid not null references public.permissoes(id) on delete restrict,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  primary key(perfil_id,permissao_id)
);

create table public.usuario_empresas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios(id),
  empresa_id uuid not null references public.empresas(id),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  unique(usuario_id,empresa_id)
);

create table public.usuario_unidades (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios(id),
  empresa_id uuid not null references public.empresas(id),
  unidade_id uuid not null references public.unidades(id),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  unique(usuario_id,unidade_id)
);

create table public.usuario_perfis (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios(id),
  empresa_id uuid not null references public.empresas(id),
  unidade_id uuid references public.unidades(id),
  perfil_id uuid not null references public.perfis(id),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  unique nulls not distinct(usuario_id,perfil_id,unidade_id)
);

create table public.auditoria_eventos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  unidade_id uuid references public.unidades(id),
  usuario_id uuid not null references auth.users(id),
  operacao text not null,
  entidade text not null,
  registro_id uuid,
  origem text not null check (origem in ('web','api','job')),
  valores_anteriores jsonb,
  valores_novos jsonb,
  motivo text,
  correlation_id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create index unidades_empresa_idx on public.unidades(empresa_id);
create index setores_empresa_unidade_idx on public.setores(empresa_id,unidade_id);
create index locais_empresa_unidade_setor_idx on public.locais(empresa_id,unidade_id,setor_id);
create index usuario_empresas_ativo_idx on public.usuario_empresas(usuario_id,empresa_id) where ativo;
create index usuario_unidades_ativo_idx on public.usuario_unidades(usuario_id,unidade_id) where ativo;
create index usuario_perfis_ativo_idx on public.usuario_perfis(usuario_id,empresa_id,unidade_id) where ativo;
create index auditoria_eventos_empresa_data_idx on public.auditoria_eventos(empresa_id,created_at desc);

-- Restaura usuarios existentes que continuam presentes no Supabase Auth.
insert into public.usuarios(id,nome,bloqueado,motivo_bloqueio,ativo,foto_path,telefone,cargo)
select
  (b.payload->>'id')::uuid,
  coalesce(nullif(b.payload->>'nome',''),'Usuario'),
  coalesce((b.payload->>'bloqueado')::boolean,false),
  nullif(b.payload->>'motivo_bloqueio',''),
  coalesce((b.payload->>'ativo')::boolean,true),
  nullif(b.payload->>'foto_path',''),
  nullif(b.payload->>'telefone',''),
  nullif(b.payload->>'cargo','')
from _medsync_usuarios_backup b
where b.payload ? 'id'
  and exists(select 1 from auth.users au where au.id=(b.payload->>'id')::uuid)
on conflict(id) do update set
  nome=excluded.nome,
  bloqueado=excluded.bloqueado,
  motivo_bloqueio=excluded.motivo_bloqueio,
  ativo=excluded.ativo,
  foto_path=excluded.foto_path,
  telefone=excluded.telefone,
  cargo=excluded.cargo,
  updated_at=now();

-- Se public.usuarios estava vazio, recupera pelo menos o primeiro login do Auth.
insert into public.usuarios(id,nome)
select au.id,
       coalesce(nullif(au.raw_user_meta_data->>'name',''),nullif(au.raw_user_meta_data->>'full_name',''),nullif(split_part(coalesce(au.email,''),'@',1),''),'Administrador')
from auth.users au
where not exists(select 1 from public.usuarios)
order by au.created_at
limit 1
on conflict(id) do nothing;

create or replace function public.usuario_ativo()
returns boolean language sql stable security invoker set search_path=''
as $$
  select exists(select 1 from public.usuarios u where u.id=auth.uid() and u.ativo and not u.bloqueado)
$$;

create or replace function public.tem_empresa(p_empresa uuid)
returns boolean language sql stable security invoker set search_path=''
as $$
  select public.usuario_ativo()
     and exists(select 1 from public.usuario_empresas ue where ue.usuario_id=auth.uid() and ue.empresa_id=p_empresa and ue.ativo)
$$;

create or replace function public.tem_unidade(p_empresa uuid,p_unidade uuid)
returns boolean language sql stable security invoker set search_path=''
as $$
  select public.tem_empresa(p_empresa)
     and exists(select 1 from public.usuario_unidades uu where uu.usuario_id=auth.uid() and uu.empresa_id=p_empresa and uu.unidade_id=p_unidade and uu.ativo)
$$;

create or replace function public.tem_permissao(p_empresa uuid,p_unidade uuid,p_codigo text)
returns boolean language sql stable security invoker set search_path=''
as $$
  select public.usuario_ativo()
    and exists(
      select 1
      from public.usuario_perfis up
      join public.perfis pf on pf.id=up.perfil_id and pf.ativo
      join public.perfil_permissoes pp on pp.perfil_id=pf.id
      join public.permissoes pe on pe.id=pp.permissao_id and pe.ativo
      where up.usuario_id=auth.uid()
        and up.empresa_id=p_empresa
        and up.ativo
        and pe.codigo=p_codigo
        and (p_unidade is null or up.unidade_id is null or up.unidade_id=p_unidade)
    )
$$;

-- --------------------------------------------------------------------------
-- 3. CADASTROS MESTRES
-- --------------------------------------------------------------------------
create table public.catalogos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  tipo public.tipo_catalogo not null,
  codigo text not null,
  descricao text not null,
  vigencia_inicio date,
  vigencia_fim date,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  check (vigencia_fim is null or vigencia_inicio is null or vigencia_fim>=vigencia_inicio)
);
create unique index catalogos_empresa_tipo_codigo_unique on public.catalogos(empresa_id,tipo,codigo) where ativo;
create index catalogos_empresa_tipo_descricao_idx on public.catalogos(empresa_id,tipo,descricao) where ativo;

create table public.tipos_profissional (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nome text not null,
  ativo boolean not null default true,
  ordem integer not null default 100
);

create table public.pacientes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  numero_registro bigint not null default nextval('public.paciente_registro_seq'),
  ra text not null,
  nome_completo text not null check (char_length(trim(nome_completo))>=2),
  nome_social text,
  cpf text check (cpf is null or cpf ~ '^[0-9]{11}$'),
  cns text check (cns is null or cns ~ '^[0-9]{15}$'),
  rg text,
  data_nascimento date not null,
  sexo public.sexo_paciente not null default 'nao_informado',
  nacionalidade public.nacionalidade_tipo,
  estado_civil public.estado_civil_tipo,
  telefone text,
  email text,
  cep text check (cep is null or cep ~ '^[0-9]{8}$'),
  logradouro text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  uf text check (uf is null or uf ~ '^[A-Z]{2}$'),
  contato_emergencia_nome text,
  contato_emergencia_telefone text,
  foto_path text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
create unique index pacientes_empresa_cpf_unique on public.pacientes(empresa_id,cpf) where cpf is not null and ativo;
create unique index pacientes_empresa_cns_unique on public.pacientes(empresa_id,cns) where cns is not null and ativo;
create unique index pacientes_numero_registro_unique on public.pacientes(numero_registro);
create unique index pacientes_ra_unique on public.pacientes(ra);
create index pacientes_empresa_nome_idx on public.pacientes(empresa_id,nome_completo) where ativo;

create or replace function public.preencher_ra_paciente()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.numero_registro is null then new.numero_registro:=nextval('public.paciente_registro_seq'); end if;
  new.ra:='RA'||lpad(new.numero_registro::text,8,'0');
  return new;
end $$;
create trigger trg_pacientes_ra before insert or update of numero_registro on public.pacientes
for each row execute function public.preencher_ra_paciente();

create table public.paciente_emails (
  id uuid primary key default gen_random_uuid(), paciente_id uuid not null references public.pacientes(id) on delete cascade,
  email text not null, principal boolean not null default false, created_at timestamptz not null default now()
);
create table public.paciente_telefones (
  id uuid primary key default gen_random_uuid(), paciente_id uuid not null references public.pacientes(id) on delete cascade,
  telefone text not null, tipo public.tipo_telefone not null default 'celular', whatsapp boolean not null default false,
  principal boolean not null default false, created_at timestamptz not null default now()
);
create table public.paciente_enderecos (
  id uuid primary key default gen_random_uuid(), paciente_id uuid not null references public.pacientes(id) on delete cascade,
  cep text, endereco text not null, numero text not null, complemento text, bairro text not null, cidade text not null,
  estado text not null check (estado ~ '^[A-Z]{2}$'), tipo public.tipo_endereco not null default 'residencial',
  principal boolean not null default false, created_at timestamptz not null default now()
);

create table public.convenios (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  registro_ans text check (registro_ans is null or registro_ans ~ '^[0-9]{6}$'),
  razao_social text not null,
  nome_fantasia text not null,
  cnpj text check (cnpj is null or cnpj ~ '^[0-9]{14}$'),
  telefone text,
  email text,
  logo_path text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
create unique index convenios_empresa_ans_unique on public.convenios(empresa_id,registro_ans) where registro_ans is not null and ativo;
create index convenios_empresa_nome_idx on public.convenios(empresa_id,nome_fantasia) where ativo;

create table public.convenio_emails (
  id uuid primary key default gen_random_uuid(), convenio_id uuid not null references public.convenios(id) on delete cascade,
  email text not null, principal boolean not null default false, created_at timestamptz not null default now()
);
create table public.convenio_telefones (
  id uuid primary key default gen_random_uuid(), convenio_id uuid not null references public.convenios(id) on delete cascade,
  telefone text not null, tipo public.tipo_telefone not null default 'comercial', whatsapp boolean not null default false,
  principal boolean not null default false, created_at timestamptz not null default now()
);
create table public.convenio_enderecos (
  id uuid primary key default gen_random_uuid(), convenio_id uuid not null references public.convenios(id) on delete cascade,
  cep text, endereco text not null, numero text not null, complemento text, bairro text not null, cidade text not null,
  estado text not null check (estado ~ '^[A-Z]{2}$'), tipo public.tipo_endereco not null default 'comercial',
  principal boolean not null default false, created_at timestamptz not null default now()
);

create table public.convenio_planos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  convenio_id uuid not null references public.convenios(id) on delete restrict,
  codigo text,
  nome text not null,
  acomodacao text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  unique(convenio_id,nome)
);

create table public.profissionais (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  usuario_id uuid references auth.users(id),
  nome_completo text not null check (char_length(trim(nome_completo))>=2),
  cpf text check (cpf is null or cpf ~ '^[0-9]{11}$'),
  rg text,
  data_nascimento date,
  nacionalidade public.nacionalidade_tipo,
  estado_civil public.estado_civil_tipo,
  sexo public.sexo_paciente,
  tipo_profissional_id uuid references public.tipos_profissional(id),
  tipo_profissional_catalogo_id uuid references public.catalogos(id) on delete restrict,
  conselho text,
  numero_conselho text,
  uf_conselho text check (uf_conselho is null or uf_conselho ~ '^[A-Z]{2}$'),
  especialidade text,
  cbo text,
  telefone text,
  email text,
  foto_path text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
create unique index profissionais_usuario_unique on public.profissionais(usuario_id) where usuario_id is not null;
create unique index profissionais_empresa_cpf_unique on public.profissionais(empresa_id,cpf) where cpf is not null and ativo;
create index profissionais_empresa_nome_idx on public.profissionais(empresa_id,nome_completo) where ativo;
create index profissionais_tipo_profissional_catalogo_idx on public.profissionais(empresa_id,tipo_profissional_catalogo_id) where tipo_profissional_catalogo_id is not null and ativo;

create table public.profissional_emails (
  id uuid primary key default gen_random_uuid(), profissional_id uuid not null references public.profissionais(id) on delete cascade,
  email text not null, principal boolean not null default false, created_at timestamptz not null default now()
);
create table public.profissional_telefones (
  id uuid primary key default gen_random_uuid(), profissional_id uuid not null references public.profissionais(id) on delete cascade,
  telefone text not null, tipo public.tipo_telefone not null default 'celular', whatsapp boolean not null default false,
  principal boolean not null default false, created_at timestamptz not null default now()
);
create table public.profissional_enderecos (
  id uuid primary key default gen_random_uuid(), profissional_id uuid not null references public.profissionais(id) on delete cascade,
  cep text, endereco text not null, numero text not null, complemento text, bairro text not null, cidade text not null,
  estado text not null check (estado ~ '^[A-Z]{2}$'), tipo public.tipo_endereco not null default 'comercial',
  principal boolean not null default false, created_at timestamptz not null default now()
);

create table public.profissional_contratos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  profissional_id uuid not null references public.profissionais(id) on delete restrict,
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
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  check (data_fim is null or data_fim>=data_inicio),
  check (carga_horaria_semanal is null or carga_horaria_semanal>=0),
  check (valor_remuneracao is null or valor_remuneracao>=0)
);
create index profissional_contratos_empresa_profissional_idx on public.profissional_contratos(empresa_id,profissional_id,ativo);

-- --------------------------------------------------------------------------
-- 4. ASSISTENCIAL / RECEPCAO / FILAS
-- --------------------------------------------------------------------------
create table public.atendimentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  unidade_id uuid not null references public.unidades(id),
  numero_atendimento bigint not null default nextval('public.atendimento_numero_seq'),
  paciente_id uuid not null references public.pacientes(id),
  profissional_id uuid references public.profissionais(id),
  tipo_atendimento text not null,
  origem text,
  status public.status_atendimento not null default 'aberto',
  cobertura public.tipo_cobertura_atendimento not null default 'particular',
  convenio_id uuid references public.convenios(id),
  plano_id uuid references public.convenio_planos(id),
  numero_carteirinha text,
  validade_carteirinha date,
  numero_autorizacao text,
  senha_autorizacao text,
  paciente_nome text,
  paciente_cpf text,
  paciente_rg text,
  paciente_cns text,
  paciente_data_nascimento date,
  paciente_nacionalidade text,
  paciente_estado_civil text,
  paciente_sexo text,
  paciente_telefone text,
  paciente_email text,
  paciente_cep text,
  paciente_endereco text,
  paciente_numero text,
  paciente_complemento text,
  paciente_bairro text,
  paciente_cidade text,
  paciente_estado text,
  especialidade_destino text,
  triagem_concluida_em timestamptz,
  setor_atual text,
  ultima_movimentacao_em timestamptz,
  data_abertura timestamptz not null default now(),
  data_fechamento timestamptz,
  observacoes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  constraint atendimentos_cobertura_check check (
    (cobertura='particular' and convenio_id is null and plano_id is null)
    or (cobertura='convenio' and convenio_id is not null and plano_id is not null and numero_carteirinha is not null)
  )
);
create unique index atendimentos_numero_atendimento_unique on public.atendimentos(numero_atendimento);
create index atendimentos_empresa_unidade_status_idx on public.atendimentos(empresa_id,unidade_id,status,data_abertura desc);
create index atendimentos_convenio_idx on public.atendimentos(empresa_id,convenio_id,plano_id) where convenio_id is not null;

create table public.agendamentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  unidade_id uuid not null references public.unidades(id),
  paciente_id uuid not null references public.pacientes(id),
  profissional_id uuid references public.profissionais(id),
  convenio_id uuid references public.convenios(id),
  inicio timestamptz not null,
  fim timestamptz not null,
  status public.status_agendamento not null default 'agendado',
  tipo_atendimento text,
  observacoes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  check (fim>inicio)
);
create index agendamentos_empresa_unidade_inicio_idx on public.agendamentos(empresa_id,unidade_id,inicio);

create table public.triagens (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  unidade_id uuid not null references public.unidades(id),
  atendimento_id uuid not null references public.atendimentos(id) on delete restrict,
  peso_kg numeric(6,2), altura_cm numeric(6,2), pressao_arterial text,
  frequencia_cardiaca integer, frequencia_respiratoria integer,
  saturacao_o2 numeric(5,2), temperatura_c numeric(4,1), glicemia_mg_dl numeric(7,2),
  dor_escala integer check (dor_escala is null or dor_escala between 0 and 10),
  classificacao_risco text, queixa_principal text, observacoes text,
  created_at timestamptz not null default now(), created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(), updated_by uuid references auth.users(id)
);
create unique index triagens_atendimento_unique on public.triagens(atendimento_id);

create table public.prontuario_evolucoes (
  id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas(id),
  unidade_id uuid not null references public.unidades(id), atendimento_id uuid not null references public.atendimentos(id) on delete restrict,
  profissional_id uuid not null references public.profissionais(id) on delete restrict,
  tipo_evolucao text not null default 'evolucao', subjetivo text, objetivo text, avaliacao text, plano text, texto_livre text,
  assinado_em timestamptz, created_at timestamptz not null default now(), created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(), updated_by uuid references auth.users(id)
);
create index prontuario_evolucoes_atendimento_idx on public.prontuario_evolucoes(atendimento_id,created_at desc);

create table public.prescricoes (
  id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas(id),
  unidade_id uuid not null references public.unidades(id), atendimento_id uuid not null references public.atendimentos(id) on delete restrict,
  profissional_id uuid not null references public.profissionais(id) on delete restrict,
  tipo text not null default 'medicamento' check (tipo in ('medicamento','dieta','cuidado','procedimento','outro')),
  item text not null, dose text, via text, frequencia text, duracao text, instrucoes text, orientacoes text,
  status text not null default 'ativa' check (status in ('ativa','suspensa','concluida','cancelada')),
  created_at timestamptz not null default now(), created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(), updated_by uuid references auth.users(id)
);
create index prescricoes_atendimento_idx on public.prescricoes(atendimento_id,created_at desc);

create table public.internacoes (
  id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas(id),
  unidade_id uuid not null references public.unidades(id), atendimento_id uuid not null references public.atendimentos(id) on delete restrict,
  profissional_responsavel_id uuid references public.profissionais(id) on delete restrict,
  setor text not null, quarto text, leito text, acomodacao text, tipo_internacao text, motivo text,
  data_internacao timestamptz not null default now(), previsao_alta date, data_alta timestamptz,
  status text not null default 'internado' check (status in ('aguardando_leito','internado','transferido','alta','cancelado')),
  observacoes text, created_at timestamptz not null default now(), created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(), updated_by uuid references auth.users(id)
);
create unique index internacoes_atendimento_ativa_idx on public.internacoes(atendimento_id) where status in ('aguardando_leito','internado','transferido');
create index internacoes_unidade_status_idx on public.internacoes(empresa_id,unidade_id,status,data_internacao desc);

create table public.solicitacoes_exames (
  id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas(id),
  unidade_id uuid not null references public.unidades(id), atendimento_id uuid not null references public.atendimentos(id) on delete restrict,
  profissional_id uuid references public.profissionais(id) on delete restrict,
  modalidade text not null check (modalidade in ('laboratorio','imagem','outro')), exame text not null, codigo_tuss text,
  indicacao_clinica text, status text not null default 'solicitado' check (status in ('solicitado','agendado','coletado','em_execucao','liberado','cancelado')),
  resultado_resumo text, resultado_em timestamptz, created_at timestamptz not null default now(),
  created_by uuid references auth.users(id), updated_at timestamptz not null default now(), updated_by uuid references auth.users(id)
);
create index solicitacoes_exames_atendimento_idx on public.solicitacoes_exames(atendimento_id,created_at desc);

create table public.setores_chamada (
  id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas(id),
  unidade_id uuid not null references public.unidades(id), codigo text not null, nome text not null,
  prefixo text not null check (char_length(prefixo) between 1 and 3), permite_totem boolean not null default false,
  ativo boolean not null default true, ordem integer not null default 0, created_at timestamptz not null default now(),
  unique(unidade_id,codigo), unique(unidade_id,prefixo)
);

create table public.senhas_atendimento (
  id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas(id),
  unidade_id uuid not null references public.unidades(id), setor_id uuid not null references public.setores_chamada(id),
  data_referencia date not null default (now() at time zone 'America/Sao_Paulo')::date,
  sequencial integer not null, senha text not null, prioridade public.prioridade_senha not null default 'normal',
  status public.status_senha not null default 'aguardando', paciente_id uuid references public.pacientes(id),
  atendimento_id uuid references public.atendimentos(id), setor_destino_id uuid references public.setores_chamada(id),
  emitida_em timestamptz not null default now(), primeira_chamada_em timestamptz, ultima_chamada_em timestamptz,
  iniciado_em timestamptz, finalizado_em timestamptz, chamado_por uuid references auth.users(id),
  ponto_atendimento text, observacoes text, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), updated_by uuid references auth.users(id),
  unique(unidade_id,data_referencia,senha), unique(atendimento_id)
);
create index senhas_fila_idx on public.senhas_atendimento(unidade_id,setor_id,data_referencia,status,prioridade,sequencial);
create index senhas_chamadas_idx on public.senhas_atendimento(unidade_id,ultima_chamada_em desc) where ultima_chamada_em is not null;

alter table public.atendimentos add column senha_id uuid references public.senhas_atendimento(id);
create unique index atendimentos_senha_unique on public.atendimentos(senha_id) where senha_id is not null;

create table public.configuracoes_painel_chamadas (
  id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas(id),
  unidade_id uuid not null references public.unidades(id), modo text not null default 'integrado' check (modo in ('integrado','setorial')),
  recepcao_chama_todos boolean not null default true, chamar_por_nome_apos_identificacao boolean not null default true,
  exibir_senha_apoio boolean not null default true, tocar_audio boolean not null default true,
  updated_at timestamptz not null default now(), updated_by uuid references auth.users(id), unique(unidade_id)
);

create table public.autorizacoes_atendimento (
  id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas(id),
  unidade_id uuid not null references public.unidades(id), atendimento_id uuid not null references public.atendimentos(id) on delete restrict,
  paciente_id uuid not null references public.pacientes(id) on delete restrict, convenio_id uuid references public.convenios(id) on delete restrict,
  plano_id uuid references public.convenio_planos(id) on delete restrict, numero_guia_prestador text, numero_guia_operadora text,
  senha_autorizacao text, validade date, status text not null default 'pendente' check (status in ('pendente','solicitada','autorizada','negada','dispensada')),
  observacao text, created_at timestamptz not null default now(), created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(), updated_by uuid references auth.users(id), unique(atendimento_id)
);
create index autorizacoes_atendimento_idx on public.autorizacoes_atendimento(unidade_id,atendimento_id,status);

create table public.encaminhamentos_assistenciais (
  id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas(id),
  unidade_id uuid not null references public.unidades(id), atendimento_id uuid not null references public.atendimentos(id) on delete restrict,
  paciente_id uuid not null references public.pacientes(id) on delete restrict, origem text not null default 'triagem',
  especialidade text not null, profissional_id uuid references public.profissionais(id) on delete restrict,
  status text not null default 'aguardando_profissional' check (status in ('aguardando_profissional','chamado','em_atendimento','concluido','cancelado')),
  prioridade text, created_at timestamptz not null default now(), created_by uuid references auth.users(id),
  chamado_em timestamptz, iniciado_em timestamptz, concluido_em timestamptz,
  updated_at timestamptz not null default now(), updated_by uuid references auth.users(id), unique(atendimento_id)
);
create index encaminhamentos_especialidade_status_idx on public.encaminhamentos_assistenciais(unidade_id,especialidade,status,created_at);

create table public.filas_setoriais (
  id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas(id),
  unidade_id uuid not null references public.unidades(id), atendimento_id uuid not null references public.atendimentos(id),
  paciente_id uuid not null references public.pacientes(id), setor_codigo text not null, origem text not null default 'medico',
  motivo text, prioridade text not null default 'normal' check (prioridade in ('normal','preferencial','emergencia')),
  status text not null default 'aguardando' check (status in ('aguardando','chamado','em_atendimento','concluido','cancelado')),
  profissional_origem_id uuid references public.profissionais(id), profissional_destino_id uuid references public.profissionais(id),
  ponto_atendimento text, created_at timestamptz not null default now(), chamado_em timestamptz, iniciado_em timestamptz,
  concluido_em timestamptz, created_by uuid references auth.users(id), updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
create index filas_setoriais_unidade_setor_status_idx on public.filas_setoriais(unidade_id,setor_codigo,status,prioridade,created_at);
create index filas_setoriais_atendimento_idx on public.filas_setoriais(atendimento_id,created_at desc);

-- --------------------------------------------------------------------------
-- 5. FATURAMENTO BASE
-- --------------------------------------------------------------------------
create table public.contas_faturamento (
  id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas(id),
  unidade_id uuid not null references public.unidades(id), atendimento_id uuid not null references public.atendimentos(id),
  paciente_id uuid not null references public.pacientes(id), convenio_id uuid references public.convenios(id),
  plano_id uuid references public.convenio_planos(id), competencia text not null,
  tipo_cobranca text not null check (tipo_cobranca in ('particular','convenio')),
  status text not null default 'aberta' check (status in ('aberta','pre_faturamento','com_criticas','pronta','faturada','cancelada')),
  valor_bruto numeric(14,2) not null default 0, valor_desconto numeric(14,2) not null default 0,
  valor_liquido numeric(14,2) not null default 0, fechada_em timestamptz, faturada_em timestamptz,
  auditoria_liberada boolean not null default false, contas_medicas_liberada boolean not null default false,
  contas_medicas_liberada_em timestamptz, created_at timestamptz not null default now(), created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(), updated_by uuid references auth.users(id), unique(atendimento_id)
);
create index contas_faturamento_status_idx on public.contas_faturamento(empresa_id,unidade_id,status,competencia);

create table public.conta_faturamento_grupos_ato (
  id uuid primary key default gen_random_uuid(), conta_id uuid not null references public.contas_faturamento(id) on delete cascade,
  codigo_grupo text not null, data_ato date, via_acesso text, acomodacao text, urgencia boolean not null default false,
  horario_especial boolean not null default false, observacoes text, created_at timestamptz not null default now(), unique(conta_id,codigo_grupo)
);

create table public.conta_faturamento_itens (
  id uuid primary key default gen_random_uuid(), conta_id uuid not null references public.contas_faturamento(id) on delete cascade,
  origem_tipo text not null check (origem_tipo in ('procedimento','medicamento','material','opme','taxa','diaria','honorario','laboratorio','imagem','exame','outro')),
  origem_id uuid, data_execucao timestamptz, tabela text, codigo text, descricao text not null,
  quantidade numeric(12,4) not null default 1, valor_unitario numeric(14,2) not null default 0,
  percentual_reducao_acrescimo numeric(8,4) not null default 0, valor_total numeric(14,2) not null default 0,
  profissional_id uuid references public.profissionais(id), setor text, cobravel boolean not null default true, observacao text,
  grupo_ato_id uuid references public.conta_faturamento_grupos_ato(id), sequencia_ato integer,
  via_acesso text, urgencia boolean not null default false, horario_especial boolean not null default false,
  acomodacao_individual boolean not null default false, anestesia boolean not null default false,
  numero_auxiliares integer not null default 0, quantidade_auxiliares integer not null default 0,
  filme_m2 numeric(14,4) not null default 0, percentual_aplicado numeric(8,4), valor_contratual_calculado numeric(14,2),
  valor_referencia numeric(14,4), valor_referencia_contrato numeric(14,4), origem_valor text,
  metodologia_preco text, tabela_comercial_edicao_id uuid, tabela_comercial_item_id uuid,
  tabela_procedimento_edicao_id uuid, tabela_procedimento_item_id uuid,
  memoria_calculo jsonb not null default '{}'::jsonb, memoria_calculo_comercial jsonb,
  valor_cobrado_original numeric(14,4), divergencia_valor_contratual numeric(14,4),
  regra_contratual_id uuid, valor_filme numeric(14,2), valor_anestesista numeric(14,2), valor_auxiliares numeric(14,2),
  pacote_id uuid, created_at timestamptz not null default now()
);
create index conta_faturamento_itens_conta_idx on public.conta_faturamento_itens(conta_id,origem_tipo);

create table public.conta_faturamento_criticas (
  id uuid primary key default gen_random_uuid(), conta_id uuid not null references public.contas_faturamento(id) on delete cascade,
  item_id uuid references public.conta_faturamento_itens(id) on delete cascade, codigo text not null,
  severidade text not null check (severidade in ('erro','alerta','informacao')), campo text, mensagem text not null,
  origem text not null default 'regra_tiss', resolvida boolean not null default false, resolvida_em timestamptz,
  resolvida_por uuid references auth.users(id), created_at timestamptz not null default now()
);
create index conta_faturamento_criticas_conta_idx on public.conta_faturamento_criticas(conta_id,resolvida,severidade);

-- --------------------------------------------------------------------------
-- 6. TISS / GLOSAS
-- --------------------------------------------------------------------------
create table public.tiss_versoes (
  id uuid primary key default gen_random_uuid(), codigo text not null unique, organizacional text not null,
  conteudo_estrutura text not null, tuss text not null, seguranca_privacidade text not null,
  comunicacao_principal text not null, comunicacao_secundaria text, fonte_oficial text not null,
  vigente_desde date, ativo boolean not null default true, created_at timestamptz not null default now()
);

create table public.tiss_guias (
  id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas(id),
  unidade_id uuid not null references public.unidades(id), conta_id uuid references public.contas_faturamento(id),
  atendimento_id uuid references public.atendimentos(id), paciente_id uuid references public.pacientes(id),
  convenio_id uuid references public.convenios(id), plano_id uuid references public.convenio_planos(id),
  profissional_id uuid references public.profissionais(id), versao_id uuid not null references public.tiss_versoes(id),
  tipo_guia text not null check (tipo_guia in ('consulta','sp_sadt','solicitacao_internacao','resumo_internacao','honorario_individual','tratamento_odontologico','outras_despesas','opme','quimioterapia','radioterapia','recurso_glosa')),
  numero_guia_prestador text not null, numero_guia_operadora text, numero_guia_principal text,
  numero_solicitacao_internacao text, registro_ans text, codigo_prestador_operadora text,
  numero_carteirinha text, validade_carteirinha date, senha_autorizacao text, validade_senha date,
  cid_principal text, carater_atendimento text, tipo_atendimento text, indicacao_clinica text,
  data_atendimento date, hora_inicio time, hora_fim time,
  status text not null default 'rascunho' check (status in ('rascunho','pronta','faturada','em_lote','enviada','aceita','rejeitada','cancelada')),
  valor_total numeric(14,2) not null default 0, created_at timestamptz not null default now(),
  created_by uuid references auth.users(id), updated_at timestamptz not null default now(), updated_by uuid references auth.users(id),
  unique(empresa_id,convenio_id,numero_guia_prestador)
);
create index tiss_guias_atendimento_idx on public.tiss_guias(atendimento_id);
create index tiss_guias_status_idx on public.tiss_guias(empresa_id,unidade_id,status,tipo_guia);
create index tiss_guias_conta_idx on public.tiss_guias(conta_id);

create table public.tiss_guia_itens (
  id uuid primary key default gen_random_uuid(), guia_id uuid not null references public.tiss_guias(id) on delete cascade,
  sequencial integer not null, data_execucao date, hora_inicial time, hora_final time, tabela text,
  codigo_procedimento text not null, descricao text, quantidade numeric(12,4) not null default 1,
  via_acesso text, tecnica_utilizada text, reducao_acrescimo numeric(8,4),
  valor_unitario numeric(14,2) not null default 0, valor_total numeric(14,2) not null default 0,
  codigo_glosa text, created_at timestamptz not null default now(), unique(guia_id,sequencial)
);

create table public.tiss_lotes (
  id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas(id),
  unidade_id uuid not null references public.unidades(id), convenio_id uuid not null references public.convenios(id),
  versao_id uuid not null references public.tiss_versoes(id), numero_lote text not null, competencia text,
  status text not null default 'rascunho' check (status in ('rascunho','validando','valido','invalido','gerado','enviado','protocolado','aceito','rejeitado')),
  protocolo_operadora text, enviado_em timestamptz, retorno_em timestamptz, previsao_pagamento date,
  data_envio_manual timestamptz, protocolo_envio_operadora text, origem_protocolo text, observacoes_envio text,
  quantidade_guias integer not null default 0, valor_total numeric(14,2) not null default 0,
  arquivo_nome text, hash_documento text, xsd_validado boolean not null default false,
  erros_validacao jsonb not null default '[]'::jsonb, created_at timestamptz not null default now(),
  created_by uuid references auth.users(id), unique(empresa_id,convenio_id,numero_lote)
);

create table public.tiss_lote_guias (
  lote_id uuid not null references public.tiss_lotes(id) on delete cascade,
  guia_id uuid not null references public.tiss_guias(id), primary key(lote_id,guia_id)
);

create table public.tiss_xmls (
  id uuid primary key default gen_random_uuid(), lote_id uuid references public.tiss_lotes(id) on delete cascade,
  guia_id uuid references public.tiss_guias(id) on delete cascade, tipo_mensagem text not null,
  versao_comunicacao text not null, xml_conteudo text not null, hash_documento text,
  xsd_validado boolean not null default false, validado_em timestamptz, erros_validacao jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(), check(lote_id is not null or guia_id is not null)
);

create table public.tiss_retornos (
  id uuid primary key default gen_random_uuid(), lote_id uuid references public.tiss_lotes(id), guia_id uuid references public.tiss_guias(id),
  protocolo text, tipo_retorno text not null, status text, codigo_erro text, mensagem text, xml_retorno text,
  recebido_em timestamptz not null default now()
);

create table public.tiss_protocolos (
  id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas(id),
  unidade_id uuid not null references public.unidades(id), lote_id uuid not null references public.tiss_lotes(id) on delete cascade,
  numero_protocolo text not null, data_protocolo date,
  status text not null default 'recebido' check (status in ('recebido','em_analise','processado','rejeitado','pago_parcial','pago')),
  valor_apresentado numeric(14,2) not null default 0, valor_processado numeric(14,2) not null default 0,
  valor_liberado numeric(14,2) not null default 0, valor_glosa numeric(14,2) not null default 0,
  observacoes text, created_at timestamptz not null default now(), created_by uuid references auth.users(id),
  unique(lote_id,numero_protocolo)
);

create table public.tiss_glosas (
  id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas(id),
  unidade_id uuid not null references public.unidades(id), protocolo_id uuid references public.tiss_protocolos(id) on delete cascade,
  lote_id uuid references public.tiss_lotes(id), guia_id uuid references public.tiss_guias(id), guia_item_id uuid references public.tiss_guia_itens(id),
  codigo_glosa text not null, descricao_glosa text, valor_glosado numeric(14,2) not null default 0,
  status text not null default 'aberta' check (status in ('aberta','em_recurso','aceita','deferida','indeferida','cancelada')),
  origem text not null default 'demonstrativo', created_at timestamptz not null default now()
);

create table public.tiss_recursos_glosa (
  id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas(id),
  unidade_id uuid not null references public.unidades(id), convenio_id uuid not null references public.convenios(id),
  protocolo_id uuid references public.tiss_protocolos(id), numero_recurso text not null, numero_lote_recurso text,
  status text not null default 'rascunho' check (status in ('rascunho','pronto','gerado','enviado','protocolado','deferido','indeferido','parcial')),
  valor_total_recursado numeric(14,2) not null default 0, protocolo_operadora text, enviado_em timestamptz,
  retorno_em timestamptz, created_at timestamptz not null default now(), created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(), updated_by uuid references auth.users(id),
  unique(empresa_id,convenio_id,numero_recurso)
);

create table public.tiss_recurso_itens (
  id uuid primary key default gen_random_uuid(), recurso_id uuid not null references public.tiss_recursos_glosa(id) on delete cascade,
  glosa_id uuid not null references public.tiss_glosas(id), valor_recursado numeric(14,2) not null check(valor_recursado>0),
  justificativa text not null, valor_deferido numeric(14,2) not null default 0,
  valor_indeferido numeric(14,2) not null default 0, created_at timestamptz not null default now(), unique(recurso_id,glosa_id)
);

create table public.tiss_webservice_configuracoes (
  id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas(id),
  unidade_id uuid references public.unidades(id), convenio_id uuid not null references public.convenios(id) on delete cascade,
  ambiente text not null default 'homologacao' check (ambiente in ('homologacao','producao')), ativo boolean not null default true,
  versao_comunicacao text not null, transporte text not null default 'soap' check (transporte in ('soap','http_xml','sftp','manual')),
  endpoint_url text, wsdl_url text, soap_action text, namespace_operacao text, operacao_envio text, operacao_status text,
  operacao_cancelamento text, operacao_retorno text, codigo_prestador_operadora text,
  tipo_autenticacao text not null default 'nenhuma' check (tipo_autenticacao in ('nenhuma','basic','bearer','cabecalho','certificado_mtls')),
  usuario text, segredo_referencia text, token_referencia text, certificado_referencia text,
  certificado_senha_referencia text, header_nome text, timeout_ms integer not null default 30000 check(timeout_ms between 1000 and 180000),
  validar_tls boolean not null default true, observacoes text, created_at timestamptz not null default now(),
  created_by uuid references auth.users(id), updated_at timestamptz not null default now(), updated_by uuid references auth.users(id),
  unique(convenio_id,ambiente)
);

create table public.tiss_webservice_transacoes (
  id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas(id),
  unidade_id uuid references public.unidades(id), convenio_id uuid not null references public.convenios(id),
  configuracao_id uuid references public.tiss_webservice_configuracoes(id), lote_id uuid references public.tiss_lotes(id),
  guia_id uuid references public.tiss_guias(id), xml_id uuid references public.tiss_xmls(id), tipo_operacao text not null,
  ambiente text not null, endpoint_url text, protocolo_local text not null, protocolo_operadora text,
  status text not null default 'pendente' check (status in ('pendente','enviando','enviado','aceito','rejeitado','erro','timeout','cancelado')),
  http_status integer, requisicao_headers jsonb not null default '{}'::jsonb, resposta_headers jsonb not null default '{}'::jsonb,
  requisicao_resumo text, resposta_conteudo text, codigo_erro text, mensagem_erro text,
  tentativas integer not null default 0, iniciado_em timestamptz, finalizado_em timestamptz,
  created_at timestamptz not null default now(), created_by uuid references auth.users(id)
);

create table public.tiss_operacoes_manuais (
  id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas(id),
  unidade_id uuid not null references public.unidades(id), convenio_id uuid references public.convenios(id),
  lote_id uuid references public.tiss_lotes(id) on delete set null, guia_id uuid references public.tiss_guias(id) on delete set null,
  direcao text not null check (direcao in ('saida','entrada')), tipo_documento text not null, nome_arquivo text not null,
  xml_conteudo text not null, origem text not null default 'manual' check (origem in ('manual','webservice','importacao')),
  xsd_validado boolean not null default false, erros_validacao jsonb not null default '[]'::jsonb,
  protocolo_externo text, observacoes text, processado boolean not null default false,
  created_at timestamptz not null default now(), created_by uuid references auth.users(id)
);

create table public.tiss_lote_anexos (
  id uuid primary key default gen_random_uuid(), lote_id uuid not null references public.tiss_lotes(id) on delete cascade,
  tipo text not null check (tipo in ('comprovante_envio','protocolo','retorno','demonstrativo','nota_fiscal','outro')),
  nome_arquivo text not null, storage_path text not null, mime_type text, tamanho_bytes bigint,
  observacao text, created_at timestamptz not null default now(), created_by uuid references auth.users(id)
);

create index tiss_protocolos_lote_idx on public.tiss_protocolos(lote_id);
create index tiss_glosas_status_idx on public.tiss_glosas(empresa_id,unidade_id,status);
create index tiss_recursos_status_idx on public.tiss_recursos_glosa(empresa_id,unidade_id,status);
create index tiss_webservice_transacoes_lote_idx on public.tiss_webservice_transacoes(lote_id,created_at desc);
create index tiss_webservice_transacoes_convenio_idx on public.tiss_webservice_transacoes(convenio_id,ambiente,status,created_at desc);
create index tiss_operacoes_manuais_lote_idx on public.tiss_operacoes_manuais(lote_id,created_at desc);

-- --------------------------------------------------------------------------
-- 7. CORPORATIVO / COMPRAS / ESTOQUE / AUDITORIA / CREDENCIAMENTO
-- --------------------------------------------------------------------------
create table public.fornecedores (
  id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas(id),
  razao_social text not null, nome_fantasia text, cnpj text, email text, telefone text, contato text,
  ativo boolean not null default true, created_at timestamptz not null default now(), created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(), updated_by uuid references auth.users(id)
);

create table public.estoque_produtos (
  id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas(id),
  codigo text not null, descricao text not null,
  tipo text not null check (tipo in ('medicamento','material','opme','dietas','higiene','expediente','outro')),
  unidade_medida text not null default 'UN', codigo_tuss text, codigo_brasindice text, codigo_simpro text,
  estoque_minimo numeric(14,4) not null default 0, ativo boolean not null default true,
  created_at timestamptz not null default now(), created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(), updated_by uuid references auth.users(id), unique(empresa_id,codigo)
);

create table public.estoque_locais (
  id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas(id),
  unidade_id uuid not null references public.unidades(id), nome text not null, tipo text not null default 'almoxarifado',
  ativo boolean not null default true, unique(unidade_id,nome)
);

create table public.estoque_lotes (
  id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas(id),
  unidade_id uuid not null references public.unidades(id), local_id uuid not null references public.estoque_locais(id),
  produto_id uuid not null references public.estoque_produtos(id), fornecedor_id uuid references public.fornecedores(id),
  numero_lote text, validade date, quantidade numeric(14,4) not null default 0, custo_unitario numeric(14,4) not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index estoque_lotes_produto_local_idx on public.estoque_lotes(unidade_id,local_id,produto_id,validade);

create table public.estoque_movimentos (
  id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas(id),
  unidade_id uuid not null references public.unidades(id), produto_id uuid not null references public.estoque_produtos(id),
  lote_id uuid references public.estoque_lotes(id), local_origem_id uuid references public.estoque_locais(id),
  local_destino_id uuid references public.estoque_locais(id), atendimento_id uuid references public.atendimentos(id),
  prescricao_id uuid references public.prescricoes(id),
  tipo text not null check (tipo in ('entrada','saida','transferencia','ajuste','consumo_paciente','devolucao')),
  quantidade numeric(14,4) not null check (quantidade>0), custo_unitario numeric(14,4), motivo text,
  created_at timestamptz not null default now(), created_by uuid references auth.users(id)
);

create table public.compras_solicitacoes (
  id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas(id),
  unidade_id uuid not null references public.unidades(id), numero text not null, solicitante_id uuid references auth.users(id),
  setor text, justificativa text, prioridade text not null default 'normal',
  status text not null default 'rascunho' check (status in ('rascunho','solicitada','aprovada','cotacao','em_cotacao','pedido_emitido','parcial','recebida','cancelada')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(unidade_id,numero)
);

create table public.compras_solicitacao_itens (
  id uuid primary key default gen_random_uuid(), solicitacao_id uuid not null references public.compras_solicitacoes(id) on delete cascade,
  produto_id uuid references public.estoque_produtos(id), descricao text not null, quantidade numeric(14,4) not null,
  unidade_medida text not null default 'UN', observacoes text
);

create table public.compras_cotacoes (
  id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas(id),
  unidade_id uuid not null references public.unidades(id), solicitacao_id uuid references public.compras_solicitacoes(id) on delete cascade,
  numero text not null, status text not null default 'aberta' check (status in ('aberta','em_analise','aprovada','reprovada','convertida_pedido','cancelada')),
  validade date, observacoes text, created_at timestamptz not null default now(), created_by uuid references auth.users(id),
  unique(empresa_id,unidade_id,numero)
);

create table public.compras_cotacao_fornecedores (
  id uuid primary key default gen_random_uuid(), cotacao_id uuid not null references public.compras_cotacoes(id) on delete cascade,
  fornecedor_id uuid not null references public.fornecedores(id), valor_total numeric(14,2) not null default 0,
  prazo_entrega_dias integer, condicao_pagamento text, frete numeric(14,2) not null default 0,
  selecionado boolean not null default false, observacoes text, unique(cotacao_id,fornecedor_id)
);

create table public.compras_pedidos (
  id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas(id),
  unidade_id uuid not null references public.unidades(id), solicitacao_id uuid references public.compras_solicitacoes(id),
  fornecedor_id uuid not null references public.fornecedores(id), numero text not null, data_pedido date not null default current_date,
  previsao_entrega date, valor_total numeric(14,2) not null default 0,
  status text not null default 'aberto' check(status in ('aberto','enviado','parcial','recebido','cancelado')),
  created_at timestamptz not null default now(), created_by uuid references auth.users(id), unique(unidade_id,numero)
);

create table public.compras_pedido_itens (
  id uuid primary key default gen_random_uuid(), pedido_id uuid not null references public.compras_pedidos(id) on delete cascade,
  produto_id uuid references public.estoque_produtos(id), descricao text not null, quantidade numeric(14,4) not null,
  valor_unitario numeric(14,4) not null default 0, valor_total numeric(14,2) not null default 0,
  quantidade_recebida numeric(14,4) not null default 0
);

create table public.credenciamento_contratos (
  id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas(id),
  convenio_id uuid not null references public.convenios(id), unidade_id uuid references public.unidades(id),
  numero_contrato text, data_inicio date, data_fim date,
  status text not null default 'negociacao' check(status in ('negociacao','ativo','suspenso','encerrado')),
  prazo_pagamento_dias integer, reajuste_indice text, data_base_reajuste text, contato_comercial text, email_comercial text,
  observacoes text, created_at timestamptz not null default now(), created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(), updated_by uuid references auth.users(id)
);

create table public.credenciamento_tabelas (
  id uuid primary key default gen_random_uuid(), contrato_id uuid not null references public.credenciamento_contratos(id) on delete cascade,
  nome text not null, referencia text, vigencia_inicio date, vigencia_fim date, ativo boolean not null default true
);

create table public.credenciamento_tabela_itens (
  id uuid primary key default gen_random_uuid(), tabela_id uuid not null references public.credenciamento_tabelas(id) on delete cascade,
  codigo_tabela text, codigo text not null, descricao text not null, valor numeric(14,2) not null default 0,
  unidade text, pacote boolean not null default false, quantidade_limite numeric(14,4), autorizacao_previa boolean not null default false,
  unique nulls not distinct(tabela_id,codigo_tabela,codigo)
);

create table public.auditoria_contas (
  id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas(id),
  unidade_id uuid not null references public.unidades(id), atendimento_id uuid not null references public.atendimentos(id),
  conta_id uuid references public.contas_faturamento(id), auditor_id uuid references auth.users(id),
  status text not null default 'aguardando' check(status in ('aguardando','em_auditoria','pendencia_assistencial','pendencia_autorizacao','pendencia_documental','liberada','devolvida')),
  iniciado_em timestamptz, finalizado_em timestamptz, observacoes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(atendimento_id)
);

alter table public.contas_faturamento add column auditoria_id uuid references public.auditoria_contas(id);

create table public.auditoria_conta_itens (
  id uuid primary key default gen_random_uuid(), auditoria_id uuid not null references public.auditoria_contas(id) on delete cascade,
  categoria text not null, severidade text not null default 'alerta' check(severidade in ('alerta','erro','bloqueio')),
  descricao text not null, origem text, resolvida boolean not null default false,
  resolvida_em timestamptz, resolvida_por uuid references auth.users(id)
);

create table public.central_guias (
  id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas(id),
  unidade_id uuid not null references public.unidades(id), atendimento_id uuid references public.atendimentos(id),
  paciente_id uuid references public.pacientes(id), convenio_id uuid references public.convenios(id), plano_id uuid references public.convenio_planos(id),
  tipo text not null check(tipo in ('consulta','sadt','internacao','prorrogacao','opme','medicamento','quimio','radio','outro')),
  numero_guia_prestador text, numero_guia_operadora text, senha text, validade_senha date, protocolo text,
  data_solicitacao timestamptz not null default now(), data_retorno timestamptz,
  status text not null default 'pendente' check(status in ('pendente','solicitada','em_analise','autorizada','parcial','negada','cancelada','vencida')),
  quantidade_solicitada numeric(14,4), quantidade_autorizada numeric(14,4), observacoes text,
  codigo_procedimento text, descricao_procedimento text, categoria_preco text default 'procedimentos',
  valor_contratual numeric(14,2), valor_solicitado numeric(14,2), valor_autorizado numeric(14,2), metodologia_preco text,
  edicao_preco_id uuid, memoria_calculo_preco jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(), updated_by uuid references auth.users(id)
);
create index central_guias_atendimento_idx on public.central_guias(atendimento_id,status);

-- --------------------------------------------------------------------------
-- 8. TABELAS COMERCIAIS / AMB / CBHPM / REGRAS / PACOTES
-- --------------------------------------------------------------------------
create table public.tabelas_comerciais_fontes (
  id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas(id),
  codigo text not null, nome text not null,
  tipo text not null check (tipo in ('simpro','brasindice','opme_convenio','propria_convenio','medicamentos_convenio','materiais_convenio','amb90','amb92','amb96','amb99','cbhpm','procedimentos_convenio','outra')),
  proprietaria boolean not null default false, observacoes text, ativo boolean not null default true,
  created_at timestamptz not null default now(), created_by uuid references auth.users(id), unique(empresa_id,codigo)
);

create table public.tabelas_comerciais_edicoes (
  id uuid primary key default gen_random_uuid(), fonte_id uuid not null references public.tabelas_comerciais_fontes(id) on delete cascade,
  convenio_id uuid references public.convenios(id), nome_edicao text not null, referencia text, data_publicacao date,
  vigencia_inicio date not null, vigencia_fim date,
  status text not null default 'rascunho' check (status in ('rascunho','vigente','encerrada','cancelada')),
  metodo_calculo text not null default 'fixo' check (metodo_calculo in ('fixo','ch_hm_sadt','cbhpm')),
  valor_uco numeric(14,6), moeda text not null default 'BRL', origem_arquivo text, hash_arquivo text, observacoes text,
  created_at timestamptz not null default now(), created_by uuid references auth.users(id)
);
create index tabelas_edicoes_vigencia_idx on public.tabelas_comerciais_edicoes(fonte_id,convenio_id,vigencia_inicio desc);

create table public.tabelas_comerciais_itens (
  id uuid primary key default gen_random_uuid(), edicao_id uuid not null references public.tabelas_comerciais_edicoes(id) on delete cascade,
  codigo text not null, codigo_fabricante text, codigo_anvisa text, codigo_tuss text, descricao text not null,
  fabricante text, apresentacao text, unidade text, valor_fabrica numeric(14,4), valor_referencia numeric(14,4) not null default 0,
  valor_maximo numeric(14,4), percentual_acrescimo numeric(8,4), regra_preco text, exige_autorizacao boolean not null default false,
  pontos_ch numeric(14,6), pontos_hm numeric(14,6), pontos_sadt numeric(14,6), porte text, quantidade_uco numeric(14,6),
  porte_anestesico text, codigo_auxiliar text, ativo boolean not null default true, metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), unique(edicao_id,codigo)
);
create index tabelas_itens_busca_idx on public.tabelas_comerciais_itens(edicao_id,codigo);
create index tabelas_itens_tuss_idx on public.tabelas_comerciais_itens(codigo_tuss);

create table public.cbhpm_valores_portes (
  id uuid primary key default gen_random_uuid(), edicao_id uuid not null references public.tabelas_comerciais_edicoes(id) on delete cascade,
  porte text not null, valor numeric(14,6) not null check(valor>=0), unique(edicao_id,porte)
);

create table public.contrato_tabelas_comerciais (
  id uuid primary key default gen_random_uuid(), contrato_id uuid not null references public.credenciamento_contratos(id) on delete cascade,
  fonte_id uuid not null references public.tabelas_comerciais_fontes(id), edicao_fixa_id uuid references public.tabelas_comerciais_edicoes(id),
  categoria text not null default 'geral' check (categoria in ('geral','opme','medicamentos','materiais','taxas','diarias','procedimentos','outra')),
  modo_edicao text not null default 'vigente_na_data' check (modo_edicao in ('vigente_na_data','edicao_fixa')),
  percentual_ajuste numeric(8,4) not null default 0, prioridade integer not null default 100,
  valor_ch numeric(14,6), valor_hm numeric(14,6), valor_sadt numeric(14,6), valor_uco_contratual numeric(14,6),
  regras_adicionais jsonb not null default '{}'::jsonb, arredondamento_casas integer not null default 2 check(arredondamento_casas between 0 and 6),
  ativo boolean not null default true, observacoes text, unique(contrato_id,fonte_id,categoria)
);

create table public.tabelas_procedimentos_fontes (
  id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas(id),
  codigo text not null, nome text not null,
  metodologia text not null check (metodologia in ('tabela_propria','amb90','amb92','amb96','amb99','cbhpm','outra')),
  descricao text, ativo boolean not null default true, created_at timestamptz not null default now(),
  created_by uuid references auth.users(id), unique(empresa_id,codigo)
);

create table public.tabelas_procedimentos_edicoes (
  id uuid primary key default gen_random_uuid(), fonte_id uuid not null references public.tabelas_procedimentos_fontes(id) on delete cascade,
  nome_edicao text not null, referencia text, vigencia_inicio date not null, vigencia_fim date,
  status text not null default 'ativa' check (status in ('rascunho','ativa','encerrada','cancelada')),
  observacoes text, created_at timestamptz not null default now(), created_by uuid references auth.users(id), unique(fonte_id,nome_edicao)
);
create index tab_proc_edicoes_vigencia_idx on public.tabelas_procedimentos_edicoes(fonte_id,vigencia_inicio,vigencia_fim);

create table public.tabelas_procedimentos_itens (
  id uuid primary key default gen_random_uuid(), edicao_id uuid not null references public.tabelas_procedimentos_edicoes(id) on delete cascade,
  codigo text not null, codigo_tuss text, descricao text not null, grupo text, subgrupo text,
  tipo_item text not null default 'procedimento' check (tipo_item in ('consulta','procedimento','exame','sadt','honorario','taxa','diaria','outro')),
  valor_fixo numeric(14,4), ch_hm numeric(14,4), ch_sadt numeric(14,4), porte text, porte_anestesico text,
  uco numeric(14,4), numero_auxiliares integer, filme_m2 numeric(14,4), observacoes text, ativo boolean not null default true,
  unique(edicao_id,codigo)
);
create index tab_proc_itens_codigo_idx on public.tabelas_procedimentos_itens(edicao_id,codigo);
create index tab_proc_itens_tuss_idx on public.tabelas_procedimentos_itens(edicao_id,codigo_tuss);

create table public.contrato_regras_procedimentos (
  id uuid primary key default gen_random_uuid(), contrato_id uuid not null references public.credenciamento_contratos(id) on delete cascade,
  categoria text not null default 'procedimentos' check (categoria in ('procedimentos','consultas','sadt','exames','honorarios','diarias','taxas','outro')),
  fonte_id uuid not null references public.tabelas_procedimentos_fontes(id),
  modo_edicao text not null default 'vigente_data' check (modo_edicao in ('vigente_data','edicao_fixa')),
  edicao_fixa_id uuid references public.tabelas_procedimentos_edicoes(id), valor_ch_hm numeric(14,6), valor_ch_sadt numeric(14,6),
  valor_uco numeric(14,6), percentual_ajuste numeric(8,4) not null default 0,
  adicional_urgencia_percentual numeric(8,4), adicional_apartamento_percentual numeric(8,4),
  aplicar_urgencia boolean not null default false, aplicar_acomodacao boolean not null default false,
  regras_json jsonb not null default '{}'::jsonb, vigencia_inicio date, vigencia_fim date,
  ativo boolean not null default true, created_at timestamptz not null default now(), created_by uuid references auth.users(id)
);
create index contrato_regras_proc_idx on public.contrato_regras_procedimentos(contrato_id,categoria,ativo,vigencia_inicio,vigencia_fim);

create table public.contrato_regras_faturamento (
  id uuid primary key default gen_random_uuid(), contrato_id uuid not null references public.credenciamento_contratos(id) on delete cascade,
  categoria text not null, codigo_regra text not null, descricao text not null, percentual numeric(8,4), valor_fixo numeric(14,4),
  prioridade integer not null default 100, condicoes jsonb not null default '{}'::jsonb, ativo boolean not null default true,
  vigencia_inicio date, vigencia_fim date, created_at timestamptz not null default now()
);
create unique index contrato_regras_faturamento_unique on public.contrato_regras_faturamento(contrato_id,categoria,codigo_regra,coalesce(vigencia_inicio,'0001-01-01'::date));

create table public.contrato_pacotes (
  id uuid primary key default gen_random_uuid(), contrato_id uuid not null references public.credenciamento_contratos(id) on delete cascade,
  codigo text not null, nome text not null, valor numeric(14,2) not null, vigencia_inicio date, vigencia_fim date,
  inclusoes jsonb not null default '[]'::jsonb, exclusoes jsonb not null default '[]'::jsonb,
  observacoes text, ativo boolean not null default true
);
create unique index contrato_pacotes_unique on public.contrato_pacotes(contrato_id,codigo,coalesce(vigencia_inicio,'0001-01-01'::date));

create table public.contrato_pacote_itens (
  id uuid primary key default gen_random_uuid(), pacote_id uuid not null references public.contrato_pacotes(id) on delete cascade,
  codigo text not null, tabela text, quantidade_inclusa numeric(14,4), cobranca_excedente boolean not null default false
);
create unique index contrato_pacote_itens_unique on public.contrato_pacote_itens(pacote_id,codigo,coalesce(tabela,''));

alter table public.conta_faturamento_itens
  add constraint conta_item_tabela_comercial_edicao_fk foreign key(tabela_comercial_edicao_id) references public.tabelas_comerciais_edicoes(id),
  add constraint conta_item_tabela_comercial_item_fk foreign key(tabela_comercial_item_id) references public.tabelas_comerciais_itens(id),
  add constraint conta_item_tabela_proc_edicao_fk foreign key(tabela_procedimento_edicao_id) references public.tabelas_procedimentos_edicoes(id),
  add constraint conta_item_tabela_proc_item_fk foreign key(tabela_procedimento_item_id) references public.tabelas_procedimentos_itens(id),
  add constraint conta_item_regra_fk foreign key(regra_contratual_id) references public.contrato_regras_faturamento(id),
  add constraint conta_item_pacote_fk foreign key(pacote_id) references public.contrato_pacotes(id);

alter table public.central_guias add constraint central_guias_edicao_preco_fk foreign key(edicao_preco_id) references public.tabelas_procedimentos_edicoes(id);

create table public.central_guias_itens (
  id uuid primary key default gen_random_uuid(), guia_id uuid not null references public.central_guias(id) on delete cascade,
  codigo_tabela text, codigo text not null, descricao text not null,
  categoria text not null default 'procedimentos' check (categoria in ('procedimentos','opme','medicamentos','materiais','taxas','diarias','geral')),
  quantidade_solicitada numeric(14,4) not null default 1, quantidade_autorizada numeric(14,4),
  valor_solicitado numeric(14,4), valor_autorizado numeric(14,4), valor_contratual numeric(14,4),
  tabela_comercial_edicao_id uuid references public.tabelas_comerciais_edicoes(id),
  tabela_comercial_item_id uuid references public.tabelas_comerciais_itens(id), memoria_calculo jsonb,
  divergencia_autorizacao numeric(14,4), status text not null default 'solicitado' check(status in ('solicitado','autorizado','parcial','negado','cancelado')),
  observacoes text, created_at timestamptz not null default now()
);

-- --------------------------------------------------------------------------
-- 9. GED / CONTAS MEDICAS / FINANCEIRO / RECEBIMENTO
-- --------------------------------------------------------------------------
create table public.ged_documentos (
  id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas(id), unidade_id uuid references public.unidades(id),
  atendimento_id uuid references public.atendimentos(id), paciente_id uuid references public.pacientes(id),
  profissional_id uuid references public.profissionais(id), convenio_id uuid references public.convenios(id),
  lote_tiss_id uuid references public.tiss_lotes(id), conta_faturamento_id uuid references public.contas_faturamento(id),
  categoria text not null, subcategoria text, titulo text not null, nome_arquivo text not null, storage_path text not null,
  mime_type text, tamanho_bytes bigint, hash_sha256 text, versao integer not null default 1,
  status text not null default 'ativo' check(status in ('ativo','arquivado','substituido','cancelado')),
  confidencial boolean not null default false, observacoes text, created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index ged_atendimento_idx on public.ged_documentos(atendimento_id,categoria,created_at desc);
create index ged_conta_idx on public.ged_documentos(conta_faturamento_id,categoria,created_at desc);

create table public.contas_medicas_processos (
  id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas(id),
  unidade_id uuid not null references public.unidades(id), conta_id uuid not null unique references public.contas_faturamento(id) on delete cascade,
  atendimento_id uuid not null references public.atendimentos(id), paciente_id uuid not null references public.pacientes(id),
  convenio_id uuid references public.convenios(id),
  status text not null default 'aguardando' check(status in ('aguardando','em_analise','pendente_documentacao','pendente_autorizacao','pendente_contrato','liberada_tiss','devolvida_auditoria','cancelada')),
  checklist_documental jsonb not null default '{}'::jsonb, total_itens integer not null default 0,
  total_autorizado numeric(14,2) not null default 0, total_nao_autorizado numeric(14,2) not null default 0,
  total_conta numeric(14,2) not null default 0, observacoes text, iniciado_em timestamptz, concluido_em timestamptz,
  analisado_por uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index contas_medicas_status_idx on public.contas_medicas_processos(empresa_id,unidade_id,status,created_at desc);

create table public.contas_medicas_pendencias (
  id uuid primary key default gen_random_uuid(), processo_id uuid not null references public.contas_medicas_processos(id) on delete cascade,
  tipo text not null check (tipo in ('documentacao','autorizacao','contrato','cadastro','procedimento','valor','outro')),
  severidade text not null default 'bloqueio' check(severidade in ('alerta','erro','bloqueio')),
  descricao text not null, resolvida boolean not null default false, resolvida_em timestamptz,
  resolvida_por uuid references auth.users(id), created_at timestamptz not null default now()
);

create table public.contas_medicas_checklist_modelos (
  id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas(id), convenio_id uuid references public.convenios(id),
  tipo_conta text not null default 'geral', codigo text not null, descricao text not null, obrigatorio boolean not null default true,
  categoria_documento text, exige_autorizacao boolean not null default false, ativo boolean not null default true,
  ordem integer not null default 0
);
create unique index cm_checklist_modelo_unique on public.contas_medicas_checklist_modelos(empresa_id,coalesce(convenio_id,'00000000-0000-0000-0000-000000000000'::uuid),tipo_conta,codigo);

create table public.contas_medicas_checklist_itens (
  id uuid primary key default gen_random_uuid(), processo_id uuid not null references public.contas_medicas_processos(id) on delete cascade,
  modelo_id uuid references public.contas_medicas_checklist_modelos(id), codigo text not null, descricao text not null,
  obrigatorio boolean not null default true, categoria_documento text,
  status text not null default 'pendente' check(status in ('pendente','ok','nao_aplicavel','divergente')),
  ged_documento_id uuid references public.ged_documentos(id), observacoes text, conferido_em timestamptz,
  conferido_por uuid references auth.users(id)
);
create index cm_checklist_processo_idx on public.contas_medicas_checklist_itens(processo_id,status);

create table public.compras_recebimentos (
  id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas(id), unidade_id uuid not null references public.unidades(id),
  pedido_id uuid not null references public.compras_pedidos(id) on delete restrict, fornecedor_id uuid references public.fornecedores(id),
  numero_documento text, serie_documento text, data_emissao date, data_recebimento timestamptz not null default now(),
  valor_documento numeric(14,2) not null default 0, vencimento date, ged_documento_id uuid references public.ged_documentos(id),
  status text not null default 'recebido' check(status in ('recebido','conferido','divergente','cancelado')),
  recebimento_parcial boolean not null default false, quantidade_itens_recebidos integer not null default 0,
  quantidade_itens_pendentes integer not null default 0, observacoes text,
  created_at timestamptz not null default now(), created_by uuid references auth.users(id)
);

create table public.compras_recebimento_itens (
  id uuid primary key default gen_random_uuid(), recebimento_id uuid not null references public.compras_recebimentos(id) on delete cascade,
  produto_id uuid not null references public.estoque_produtos(id), quantidade numeric(14,4) not null check(quantidade>0),
  valor_unitario numeric(14,4) not null default 0, lote text, validade date,
  local_estoque_id uuid references public.estoque_locais(id), farmacia boolean not null default false
);

create table public.financeiro_recebiveis (
  id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas(id), unidade_id uuid not null references public.unidades(id),
  lote_id uuid references public.tiss_lotes(id), convenio_id uuid references public.convenios(id), competencia text not null,
  previsao_pagamento date, data_pagamento date, valor_bruto numeric(14,2) not null default 0,
  valor_glosa numeric(14,2) not null default 0, valor_liquido_previsto numeric(14,2) not null default 0,
  valor_recebido numeric(14,2) not null default 0,
  status text not null default 'previsto' check(status in ('previsto','faturado','aguardando_pagamento','parcial','recebido','vencido','cancelado')),
  created_at timestamptz not null default now(), created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(), updated_by uuid references auth.users(id)
);

create table public.financeiro_contas_pagar (
  id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas(id), unidade_id uuid not null references public.unidades(id),
  fornecedor_id uuid references public.fornecedores(id), compra_recebimento_id uuid references public.compras_recebimentos(id),
  documento text, competencia text, vencimento date, valor_bruto numeric(14,2) not null default 0,
  descontos numeric(14,2) not null default 0, acrescimos numeric(14,2) not null default 0,
  valor_pago numeric(14,2) not null default 0,
  status text not null default 'aberto' check(status in ('aberto','parcial','pago','cancelado','vencido')),
  pago_em timestamptz, observacoes text, created_at timestamptz not null default now(), created_by uuid references auth.users(id)
);
create index financeiro_pagar_vencimento_idx on public.financeiro_contas_pagar(empresa_id,unidade_id,status,vencimento);

create table public.nfse_configuracoes (
  id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas(id), unidade_id uuid references public.unidades(id),
  municipio_ibge text not null, municipio_nome text not null, uf char(2) not null, provedor text,
  modo text not null default 'manual' check(modo in ('manual','webservice','api')),
  ambiente text not null default 'homologacao' check(ambiente in ('homologacao','producao')),
  endpoint_url text, wsdl_url text, versao text, codigo_servico_municipal text, item_lista_servico text,
  codigo_tributacao_municipio text, natureza_operacao text, regime_especial_tributacao text,
  optante_simples_nacional boolean, incentivador_cultural boolean, inscricao_municipal text,
  auth_tipo text not null default 'nenhuma' check(auth_tipo in ('nenhuma','basic','bearer','header','mtls')),
  auth_usuario_ref text, auth_segredo_ref text, certificado_ref text, ativo boolean not null default true,
  created_at timestamptz not null default now(), created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(), updated_by uuid references auth.users(id)
);
create unique index nfse_config_unique on public.nfse_configuracoes(empresa_id,coalesce(unidade_id,'00000000-0000-0000-0000-000000000000'::uuid),municipio_ibge,ambiente);

create table public.notas_fiscais_servico (
  id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas(id), unidade_id uuid not null references public.unidades(id),
  lote_id uuid references public.tiss_lotes(id), convenio_id uuid references public.convenios(id), configuracao_id uuid references public.nfse_configuracoes(id),
  competencia text not null, tomador_cnpj text, tomador_razao_social text,
  valor_servicos numeric(14,2) not null default 0, valor_deducoes numeric(14,2) not null default 0,
  valor_iss numeric(14,2) not null default 0, aliquota_iss numeric(8,4), valor_liquido numeric(14,2) not null default 0,
  numero_rps text, serie_rps text, numero_nfse text, codigo_verificacao text, protocolo_prefeitura text,
  status text not null default 'rascunho' check(status in ('rascunho','pronta','enviando','emitida','rejeitada','cancelada','erro')),
  xml_envio text, xml_retorno text, pdf_storage_path text, data_emissao timestamptz,
  created_at timestamptz not null default now(), created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(), updated_by uuid references auth.users(id)
);

create table public.nfse_transacoes (
  id uuid primary key default gen_random_uuid(), nota_id uuid not null references public.notas_fiscais_servico(id) on delete cascade,
  configuracao_id uuid references public.nfse_configuracoes(id), tipo_operacao text not null, status text not null,
  http_status integer, protocolo text, mensagem_erro text, request_payload text, response_payload text,
  created_at timestamptz not null default now()
);

-- --------------------------------------------------------------------------
-- 10. PERMISSOES
-- --------------------------------------------------------------------------
insert into public.permissoes(codigo,descricao) values
('empresas.visualizar','Visualizar empresas'),('empresas.administrar','Administrar empresas'),
('estrutura.visualizar','Visualizar estrutura'),('estrutura.criar','Criar estrutura'),('estrutura.editar','Editar estrutura'),
('usuarios.visualizar','Visualizar usuarios'),('usuarios.vincular','Vincular usuarios'),('usuarios.administrar','Administrar usuarios'),
('pacientes.visualizar','Visualizar pacientes'),('pacientes.criar','Criar pacientes'),('pacientes.editar','Editar pacientes'),
('profissionais.visualizar','Visualizar profissionais'),('profissionais.criar','Criar profissionais'),('profissionais.editar','Editar profissionais'),
('convenios.visualizar','Visualizar convenios'),('convenios.criar','Criar convenios'),('convenios.editar','Editar convenios'),
('catalogos.visualizar','Visualizar catalogos'),('catalogos.criar','Criar catalogos'),('catalogos.editar','Editar catalogos'),
('agenda.visualizar','Visualizar agenda'),('agenda.criar','Criar agendamentos'),('agenda.editar','Editar agendamentos'),
('recepcao.visualizar','Visualizar recepcao'),('atendimentos.visualizar','Visualizar atendimentos'),('atendimentos.abrir','Abrir atendimento'),
('atendimentos.transferir','Transferir atendimento'),('atendimentos.alta','Registrar alta'),
('triagem.registrar','Registrar triagem'),('triagem.encaminhar','Encaminhar apos triagem'),
('prontuario.visualizar','Visualizar prontuario'),('prontuario.evoluir','Evoluir prontuario'),
('prescricao.visualizar','Visualizar prescricoes'),('prescricao.criar','Criar prescricoes'),('prescricao.suspender','Suspender prescricoes'),
('internacao.visualizar','Visualizar internacoes'),('internacao.criar','Criar internacoes'),('internacao.editar','Editar internacoes'),('internacao.gerenciar','Gerenciar internacoes'),
('exames.visualizar','Visualizar exames'),('exames.gerenciar','Gerenciar exames'),
('senhas.visualizar','Visualizar filas e senhas'),('senhas.chamar','Chamar senhas'),('paineis.visualizar','Visualizar paineis'),('paineis.configurar','Configurar paineis'),
('autorizacoes.visualizar','Visualizar autorizacoes'),('autorizacoes.editar','Gerenciar autorizacoes'),
('fila_medica.visualizar','Visualizar fila medica'),('fila_medica.assumir','Assumir paciente'),
('faturamento.visualizar','Visualizar faturamento'),('faturamento.fechar','Fechar faturamento'),
('auditoria.visualizar','Visualizar auditoria'),('auditoria.executar','Executar auditoria'),
('guias.visualizar','Visualizar central de guias'),('guias.gerenciar','Gerenciar guias'),
('compras.visualizar','Visualizar compras'),('compras.gerenciar','Gerenciar compras'),('compras.receber','Receber compras'),
('estoque.visualizar','Visualizar estoque'),('estoque.gerenciar','Gerenciar estoque'),
('credenciamento.visualizar','Visualizar credenciamento'),('credenciamento.gerenciar','Gerenciar credenciamento'),
('ged.visualizar','Visualizar GED'),('ged.gerenciar','Gerenciar GED'),
('contas_medicas.visualizar','Visualizar contas medicas'),('contas_medicas.processar','Processar contas medicas'),
('diretoria.visualizar','Visualizar diretoria'),
('tabelas_comerciais.visualizar','Visualizar tabelas comerciais'),('tabelas_comerciais.gerenciar','Gerenciar tabelas comerciais'),
('tabelas_procedimentos.visualizar','Visualizar tabelas de procedimentos'),('tabelas_procedimentos.gerenciar','Gerenciar tabelas de procedimentos'),
('financeiro.visualizar','Visualizar financeiro'),('financeiro.gerenciar','Gerenciar financeiro'),
('nfse.visualizar','Visualizar NFSe'),('nfse.gerenciar','Gerenciar NFSe'),
('enfermagem.visualizar','Visualizar enfermagem'),('enfermagem.gerenciar','Gerenciar enfermagem'),
('farmacia.visualizar','Visualizar farmacia'),('farmacia.gerenciar','Gerenciar farmacia'),
('laboratorio.visualizar','Visualizar laboratorio'),('laboratorio.gerenciar','Gerenciar laboratorio'),
('imagem.visualizar','Visualizar imagem'),('imagem.gerenciar','Gerenciar imagem')
on conflict(codigo) do update set descricao=excluded.descricao,ativo=true;

create or replace function public.sincronizar_permissao_administradores_sistema()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.ativo then
    insert into public.perfil_permissoes(perfil_id,permissao_id,created_by)
    select pf.id,new.id,null from public.perfis pf
    where pf.ativo and pf.sistema and (lower(pf.nome)='admin' or lower(pf.nome) like '%administrador%')
    on conflict(perfil_id,permissao_id) do nothing;
  end if;
  return new;
end $$;
create trigger trg_sincronizar_permissao_administradores_sistema
after insert or update of ativo on public.permissoes for each row execute function public.sincronizar_permissao_administradores_sistema();

-- --------------------------------------------------------------------------
-- 11. RLS
-- --------------------------------------------------------------------------
-- Core
alter table public.empresas enable row level security; alter table public.empresas force row level security;
alter table public.unidades enable row level security; alter table public.unidades force row level security;
alter table public.setores enable row level security; alter table public.setores force row level security;
alter table public.locais enable row level security; alter table public.locais force row level security;
alter table public.usuarios enable row level security; alter table public.usuarios force row level security;
alter table public.permissoes enable row level security; alter table public.permissoes force row level security;
alter table public.perfis enable row level security; alter table public.perfis force row level security;
alter table public.perfil_permissoes enable row level security; alter table public.perfil_permissoes force row level security;
alter table public.usuario_empresas enable row level security; alter table public.usuario_empresas force row level security;
alter table public.usuario_unidades enable row level security; alter table public.usuario_unidades force row level security;
alter table public.usuario_perfis enable row level security; alter table public.usuario_perfis force row level security;
alter table public.auditoria_eventos enable row level security; alter table public.auditoria_eventos force row level security;

create policy usuarios_self_select on public.usuarios for select to authenticated using(id=auth.uid() and ativo and not bloqueado);
create policy usuarios_self_update on public.usuarios for update to authenticated using(id=auth.uid() and ativo and not bloqueado) with check(id=auth.uid() and ativo and not bloqueado);
create policy usuario_empresas_select on public.usuario_empresas for select to authenticated using(usuario_id=auth.uid() and public.usuario_ativo());
create policy usuario_unidades_select on public.usuario_unidades for select to authenticated using(usuario_id=auth.uid() and public.usuario_ativo());
create policy usuario_perfis_select on public.usuario_perfis for select to authenticated using(usuario_id=auth.uid() and public.usuario_ativo());
create policy empresas_select on public.empresas for select to authenticated using(public.tem_empresa(id));
create policy unidades_select on public.unidades for select to authenticated using(public.tem_unidade(empresa_id,id));
create policy setores_select on public.setores for select to authenticated using(public.tem_unidade(empresa_id,unidade_id));
create policy locais_select on public.locais for select to authenticated using(public.tem_unidade(empresa_id,unidade_id));
create policy perfis_select on public.perfis for select to authenticated using(public.tem_empresa(empresa_id));
create policy permissoes_authenticated_select on public.permissoes for select to authenticated using(public.usuario_ativo());
create policy perfil_permissoes_select on public.perfil_permissoes for select to authenticated using(exists(select 1 from public.perfis p where p.id=perfil_id and public.tem_empresa(p.empresa_id)));
create policy auditoria_eventos_select on public.auditoria_eventos for select to authenticated using(public.tem_permissao(empresa_id,unidade_id,'auditoria.visualizar'));
create policy auditoria_eventos_insert on public.auditoria_eventos for insert to authenticated with check(usuario_id=auth.uid() and public.tem_empresa(empresa_id) and (unidade_id is null or public.tem_unidade(empresa_id,unidade_id)));

-- Cadastros
alter table public.catalogos enable row level security; alter table public.catalogos force row level security;
alter table public.pacientes enable row level security; alter table public.pacientes force row level security;
alter table public.profissionais enable row level security; alter table public.profissionais force row level security;
alter table public.convenios enable row level security; alter table public.convenios force row level security;
alter table public.convenio_planos enable row level security; alter table public.convenio_planos force row level security;
alter table public.profissional_contratos enable row level security; alter table public.profissional_contratos force row level security;

create policy pacientes_select on public.pacientes for select to authenticated using(public.tem_empresa(empresa_id) and public.tem_permissao(empresa_id,null,'pacientes.visualizar'));
create policy pacientes_insert on public.pacientes for insert to authenticated with check(public.tem_empresa(empresa_id) and public.tem_permissao(empresa_id,null,'pacientes.criar') and created_by=auth.uid());
create policy pacientes_update on public.pacientes for update to authenticated using(public.tem_empresa(empresa_id) and public.tem_permissao(empresa_id,null,'pacientes.editar')) with check(public.tem_empresa(empresa_id) and public.tem_permissao(empresa_id,null,'pacientes.editar') and updated_by=auth.uid());
create policy profissionais_select on public.profissionais for select to authenticated using(public.tem_empresa(empresa_id) and public.tem_permissao(empresa_id,null,'profissionais.visualizar'));
create policy profissionais_insert on public.profissionais for insert to authenticated with check(public.tem_empresa(empresa_id) and public.tem_permissao(empresa_id,null,'profissionais.criar') and created_by=auth.uid());
create policy profissionais_update on public.profissionais for update to authenticated using(public.tem_empresa(empresa_id) and public.tem_permissao(empresa_id,null,'profissionais.editar')) with check(public.tem_empresa(empresa_id) and public.tem_permissao(empresa_id,null,'profissionais.editar') and updated_by=auth.uid());
create policy convenios_select on public.convenios for select to authenticated using(public.tem_empresa(empresa_id) and public.tem_permissao(empresa_id,null,'convenios.visualizar'));
create policy convenios_insert on public.convenios for insert to authenticated with check(public.tem_empresa(empresa_id) and public.tem_permissao(empresa_id,null,'convenios.criar') and created_by=auth.uid());
create policy convenios_update on public.convenios for update to authenticated using(public.tem_empresa(empresa_id) and public.tem_permissao(empresa_id,null,'convenios.editar')) with check(public.tem_empresa(empresa_id) and public.tem_permissao(empresa_id,null,'convenios.editar') and updated_by=auth.uid());
create policy catalogos_select on public.catalogos for select to authenticated using(public.tem_empresa(empresa_id) and public.tem_permissao(empresa_id,null,'catalogos.visualizar'));
create policy catalogos_write on public.catalogos for all to authenticated using(public.tem_empresa(empresa_id) and public.tem_permissao(empresa_id,null,'catalogos.editar')) with check(public.tem_empresa(empresa_id) and (public.tem_permissao(empresa_id,null,'catalogos.criar') or public.tem_permissao(empresa_id,null,'catalogos.editar')));
create policy catalogos_tipo_profissional_profissionais_select on public.catalogos for select to authenticated using(tipo='tipo_profissional' and ativo and public.tem_empresa(empresa_id) and (public.tem_permissao(empresa_id,null,'profissionais.visualizar') or public.tem_permissao(empresa_id,null,'profissionais.criar') or public.tem_permissao(empresa_id,null,'profissionais.editar')));
create policy convenio_planos_all on public.convenio_planos for all to authenticated using(public.tem_empresa(empresa_id) and public.tem_permissao(empresa_id,null,'convenios.visualizar')) with check(public.tem_empresa(empresa_id) and (public.tem_permissao(empresa_id,null,'convenios.criar') or public.tem_permissao(empresa_id,null,'convenios.editar')));
create policy profissional_contratos_all on public.profissional_contratos for all to authenticated using(public.tem_empresa(empresa_id) and public.tem_permissao(empresa_id,null,'profissionais.visualizar')) with check(public.tem_empresa(empresa_id) and (public.tem_permissao(empresa_id,null,'profissionais.criar') or public.tem_permissao(empresa_id,null,'profissionais.editar')));

-- Contatos filhos
alter table public.paciente_emails enable row level security; alter table public.paciente_telefones enable row level security; alter table public.paciente_enderecos enable row level security;
alter table public.profissional_emails enable row level security; alter table public.profissional_telefones enable row level security; alter table public.profissional_enderecos enable row level security;
alter table public.convenio_emails enable row level security; alter table public.convenio_telefones enable row level security; alter table public.convenio_enderecos enable row level security;
create policy paciente_emails_rw on public.paciente_emails for all to authenticated using(exists(select 1 from public.pacientes p where p.id=paciente_id and public.tem_empresa(p.empresa_id))) with check(exists(select 1 from public.pacientes p where p.id=paciente_id and public.tem_empresa(p.empresa_id)));
create policy paciente_telefones_rw on public.paciente_telefones for all to authenticated using(exists(select 1 from public.pacientes p where p.id=paciente_id and public.tem_empresa(p.empresa_id))) with check(exists(select 1 from public.pacientes p where p.id=paciente_id and public.tem_empresa(p.empresa_id)));
create policy paciente_enderecos_rw on public.paciente_enderecos for all to authenticated using(exists(select 1 from public.pacientes p where p.id=paciente_id and public.tem_empresa(p.empresa_id))) with check(exists(select 1 from public.pacientes p where p.id=paciente_id and public.tem_empresa(p.empresa_id)));
create policy profissional_emails_rw on public.profissional_emails for all to authenticated using(exists(select 1 from public.profissionais p where p.id=profissional_id and public.tem_empresa(p.empresa_id))) with check(exists(select 1 from public.profissionais p where p.id=profissional_id and public.tem_empresa(p.empresa_id)));
create policy profissional_telefones_rw on public.profissional_telefones for all to authenticated using(exists(select 1 from public.profissionais p where p.id=profissional_id and public.tem_empresa(p.empresa_id))) with check(exists(select 1 from public.profissionais p where p.id=profissional_id and public.tem_empresa(p.empresa_id)));
create policy profissional_enderecos_rw on public.profissional_enderecos for all to authenticated using(exists(select 1 from public.profissionais p where p.id=profissional_id and public.tem_empresa(p.empresa_id))) with check(exists(select 1 from public.profissionais p where p.id=profissional_id and public.tem_empresa(p.empresa_id)));
create policy convenio_emails_rw on public.convenio_emails for all to authenticated using(exists(select 1 from public.convenios c where c.id=convenio_id and public.tem_empresa(c.empresa_id))) with check(exists(select 1 from public.convenios c where c.id=convenio_id and public.tem_empresa(c.empresa_id)));
create policy convenio_telefones_rw on public.convenio_telefones for all to authenticated using(exists(select 1 from public.convenios c where c.id=convenio_id and public.tem_empresa(c.empresa_id))) with check(exists(select 1 from public.convenios c where c.id=convenio_id and public.tem_empresa(c.empresa_id)));
create policy convenio_enderecos_rw on public.convenio_enderecos for all to authenticated using(exists(select 1 from public.convenios c where c.id=convenio_id and public.tem_empresa(c.empresa_id))) with check(exists(select 1 from public.convenios c where c.id=convenio_id and public.tem_empresa(c.empresa_id)));

-- Assistencial
alter table public.atendimentos enable row level security; alter table public.agendamentos enable row level security; alter table public.triagens enable row level security;
alter table public.prontuario_evolucoes enable row level security; alter table public.prescricoes enable row level security; alter table public.internacoes enable row level security;
alter table public.solicitacoes_exames enable row level security; alter table public.setores_chamada enable row level security; alter table public.senhas_atendimento enable row level security;
alter table public.configuracoes_painel_chamadas enable row level security; alter table public.autorizacoes_atendimento enable row level security;
alter table public.encaminhamentos_assistenciais enable row level security; alter table public.filas_setoriais enable row level security;
create policy atendimentos_select on public.atendimentos for select to authenticated using(public.tem_unidade(empresa_id,unidade_id) and public.tem_permissao(empresa_id,unidade_id,'atendimentos.visualizar'));
create policy atendimentos_insert on public.atendimentos for insert to authenticated with check(public.tem_unidade(empresa_id,unidade_id) and public.tem_permissao(empresa_id,unidade_id,'atendimentos.abrir') and created_by=auth.uid());
create policy atendimentos_update on public.atendimentos for update to authenticated using(public.tem_unidade(empresa_id,unidade_id)) with check(public.tem_unidade(empresa_id,unidade_id) and updated_by=auth.uid());
create policy agendamentos_all on public.agendamentos for all to authenticated using(public.tem_unidade(empresa_id,unidade_id) and public.tem_permissao(empresa_id,unidade_id,'agenda.visualizar')) with check(public.tem_unidade(empresa_id,unidade_id) and (public.tem_permissao(empresa_id,unidade_id,'agenda.criar') or public.tem_permissao(empresa_id,unidade_id,'agenda.editar')));
create policy triagens_all on public.triagens for all to authenticated using(public.tem_unidade(empresa_id,unidade_id) and (public.tem_permissao(empresa_id,unidade_id,'triagem.registrar') or public.tem_permissao(empresa_id,unidade_id,'prontuario.visualizar'))) with check(public.tem_unidade(empresa_id,unidade_id) and public.tem_permissao(empresa_id,unidade_id,'triagem.registrar'));
create policy prontuario_evolucoes_all on public.prontuario_evolucoes for all to authenticated using(public.tem_unidade(empresa_id,unidade_id) and public.tem_permissao(empresa_id,unidade_id,'prontuario.visualizar')) with check(public.tem_unidade(empresa_id,unidade_id) and public.tem_permissao(empresa_id,unidade_id,'prontuario.evoluir'));
create policy prescricoes_all on public.prescricoes for all to authenticated using(public.tem_unidade(empresa_id,unidade_id) and (public.tem_permissao(empresa_id,unidade_id,'prescricao.visualizar') or public.tem_permissao(empresa_id,unidade_id,'prontuario.visualizar'))) with check(public.tem_unidade(empresa_id,unidade_id) and public.tem_permissao(empresa_id,unidade_id,'prescricao.criar'));
create policy internacoes_all on public.internacoes for all to authenticated using(public.tem_unidade(empresa_id,unidade_id) and (public.tem_permissao(empresa_id,unidade_id,'internacao.visualizar') or public.tem_permissao(empresa_id,unidade_id,'prontuario.visualizar'))) with check(public.tem_unidade(empresa_id,unidade_id) and (public.tem_permissao(empresa_id,unidade_id,'internacao.criar') or public.tem_permissao(empresa_id,unidade_id,'internacao.editar') or public.tem_permissao(empresa_id,unidade_id,'internacao.gerenciar')));
create policy solicitacoes_exames_all on public.solicitacoes_exames for all to authenticated using(public.tem_unidade(empresa_id,unidade_id) and (public.tem_permissao(empresa_id,unidade_id,'exames.visualizar') or public.tem_permissao(empresa_id,unidade_id,'prontuario.visualizar'))) with check(public.tem_unidade(empresa_id,unidade_id) and (public.tem_permissao(empresa_id,unidade_id,'exames.gerenciar') or public.tem_permissao(empresa_id,unidade_id,'prontuario.evoluir')));
create policy setores_chamada_select on public.setores_chamada for select to authenticated using(public.tem_unidade(empresa_id,unidade_id));
create policy senhas_select on public.senhas_atendimento for select to authenticated using(public.tem_unidade(empresa_id,unidade_id));
create policy senhas_update on public.senhas_atendimento for update to authenticated using(public.tem_unidade(empresa_id,unidade_id)) with check(public.tem_unidade(empresa_id,unidade_id));
create policy configuracoes_painel_all on public.configuracoes_painel_chamadas for all to authenticated using(public.tem_unidade(empresa_id,unidade_id)) with check(public.tem_unidade(empresa_id,unidade_id));
create policy autorizacoes_all on public.autorizacoes_atendimento for all to authenticated using(public.tem_unidade(empresa_id,unidade_id)) with check(public.tem_unidade(empresa_id,unidade_id));
create policy encaminhamentos_all on public.encaminhamentos_assistenciais for all to authenticated using(public.tem_unidade(empresa_id,unidade_id)) with check(public.tem_unidade(empresa_id,unidade_id));
create policy filas_setoriais_all on public.filas_setoriais for all to authenticated using(public.tem_unidade(empresa_id,unidade_id)) with check(public.tem_unidade(empresa_id,unidade_id));

-- Faturamento/TISS
alter table public.contas_faturamento enable row level security; alter table public.conta_faturamento_grupos_ato enable row level security;
alter table public.conta_faturamento_itens enable row level security; alter table public.conta_faturamento_criticas enable row level security;
alter table public.tiss_guias enable row level security; alter table public.tiss_guia_itens enable row level security; alter table public.tiss_lotes enable row level security;
alter table public.tiss_lote_guias enable row level security; alter table public.tiss_xmls enable row level security; alter table public.tiss_retornos enable row level security;
alter table public.tiss_protocolos enable row level security; alter table public.tiss_glosas enable row level security; alter table public.tiss_recursos_glosa enable row level security;
alter table public.tiss_recurso_itens enable row level security; alter table public.tiss_webservice_configuracoes enable row level security;
alter table public.tiss_webservice_transacoes enable row level security; alter table public.tiss_operacoes_manuais enable row level security; alter table public.tiss_lote_anexos enable row level security;
create policy contas_faturamento_all on public.contas_faturamento for all to authenticated using(public.tem_unidade(empresa_id,unidade_id)) with check(public.tem_unidade(empresa_id,unidade_id));
create policy grupos_ato_all on public.conta_faturamento_grupos_ato for all to authenticated using(exists(select 1 from public.contas_faturamento c where c.id=conta_id and public.tem_unidade(c.empresa_id,c.unidade_id))) with check(exists(select 1 from public.contas_faturamento c where c.id=conta_id and public.tem_unidade(c.empresa_id,c.unidade_id)));
create policy conta_itens_all on public.conta_faturamento_itens for all to authenticated using(exists(select 1 from public.contas_faturamento c where c.id=conta_id and public.tem_unidade(c.empresa_id,c.unidade_id))) with check(exists(select 1 from public.contas_faturamento c where c.id=conta_id and public.tem_unidade(c.empresa_id,c.unidade_id)));
create policy conta_criticas_all on public.conta_faturamento_criticas for all to authenticated using(exists(select 1 from public.contas_faturamento c where c.id=conta_id and public.tem_unidade(c.empresa_id,c.unidade_id))) with check(exists(select 1 from public.contas_faturamento c where c.id=conta_id and public.tem_unidade(c.empresa_id,c.unidade_id)));
create policy tiss_guias_all on public.tiss_guias for all to authenticated using(public.tem_unidade(empresa_id,unidade_id)) with check(public.tem_unidade(empresa_id,unidade_id));
create policy tiss_lotes_all on public.tiss_lotes for all to authenticated using(public.tem_unidade(empresa_id,unidade_id)) with check(public.tem_unidade(empresa_id,unidade_id));
create policy tiss_guia_itens_all on public.tiss_guia_itens for all to authenticated using(exists(select 1 from public.tiss_guias g where g.id=guia_id and public.tem_unidade(g.empresa_id,g.unidade_id))) with check(exists(select 1 from public.tiss_guias g where g.id=guia_id and public.tem_unidade(g.empresa_id,g.unidade_id)));
create policy tiss_lote_guias_all on public.tiss_lote_guias for all to authenticated using(exists(select 1 from public.tiss_lotes l where l.id=lote_id and public.tem_unidade(l.empresa_id,l.unidade_id))) with check(exists(select 1 from public.tiss_lotes l where l.id=lote_id and public.tem_unidade(l.empresa_id,l.unidade_id)));
create policy tiss_protocolos_all on public.tiss_protocolos for all to authenticated using(public.tem_unidade(empresa_id,unidade_id)) with check(public.tem_unidade(empresa_id,unidade_id));
create policy tiss_glosas_all on public.tiss_glosas for all to authenticated using(public.tem_unidade(empresa_id,unidade_id)) with check(public.tem_unidade(empresa_id,unidade_id));
create policy tiss_recursos_all on public.tiss_recursos_glosa for all to authenticated using(public.tem_unidade(empresa_id,unidade_id)) with check(public.tem_unidade(empresa_id,unidade_id));
create policy tiss_recurso_itens_all on public.tiss_recurso_itens for all to authenticated using(exists(select 1 from public.tiss_recursos_glosa r where r.id=recurso_id and public.tem_unidade(r.empresa_id,r.unidade_id))) with check(exists(select 1 from public.tiss_recursos_glosa r where r.id=recurso_id and public.tem_unidade(r.empresa_id,r.unidade_id)));
create policy tiss_ws_config_all on public.tiss_webservice_configuracoes for all to authenticated using(public.tem_empresa(empresa_id)) with check(public.tem_empresa(empresa_id));
create policy tiss_ws_tx_all on public.tiss_webservice_transacoes for all to authenticated using(public.tem_empresa(empresa_id)) with check(public.tem_empresa(empresa_id));
create policy tiss_operacoes_manuais_all on public.tiss_operacoes_manuais for all to authenticated using(public.tem_unidade(empresa_id,unidade_id)) with check(public.tem_unidade(empresa_id,unidade_id));
create policy tiss_lote_anexos_all on public.tiss_lote_anexos for all to authenticated using(exists(select 1 from public.tiss_lotes l where l.id=lote_id and public.tem_unidade(l.empresa_id,l.unidade_id))) with check(exists(select 1 from public.tiss_lotes l where l.id=lote_id and public.tem_unidade(l.empresa_id,l.unidade_id)));
create policy tiss_xmls_select on public.tiss_xmls for select to authenticated using((lote_id is not null and exists(select 1 from public.tiss_lotes l where l.id=lote_id and public.tem_unidade(l.empresa_id,l.unidade_id))) or (guia_id is not null and exists(select 1 from public.tiss_guias g where g.id=guia_id and public.tem_unidade(g.empresa_id,g.unidade_id))));
create policy tiss_retornos_select on public.tiss_retornos for select to authenticated using((lote_id is not null and exists(select 1 from public.tiss_lotes l where l.id=lote_id and public.tem_unidade(l.empresa_id,l.unidade_id))) or (guia_id is not null and exists(select 1 from public.tiss_guias g where g.id=guia_id and public.tem_unidade(g.empresa_id,g.unidade_id))));

-- Corporativo / comercial / financeiro
alter table public.fornecedores enable row level security; alter table public.estoque_produtos enable row level security; alter table public.estoque_locais enable row level security;
alter table public.estoque_lotes enable row level security; alter table public.estoque_movimentos enable row level security;
alter table public.compras_solicitacoes enable row level security; alter table public.compras_solicitacao_itens enable row level security;
alter table public.compras_cotacoes enable row level security; alter table public.compras_cotacao_fornecedores enable row level security;
alter table public.compras_pedidos enable row level security; alter table public.compras_pedido_itens enable row level security;
alter table public.auditoria_contas enable row level security; alter table public.auditoria_conta_itens enable row level security;
alter table public.central_guias enable row level security; alter table public.central_guias_itens enable row level security;
alter table public.credenciamento_contratos enable row level security; alter table public.credenciamento_tabelas enable row level security; alter table public.credenciamento_tabela_itens enable row level security;
alter table public.tabelas_comerciais_fontes enable row level security; alter table public.tabelas_comerciais_edicoes enable row level security; alter table public.tabelas_comerciais_itens enable row level security; alter table public.cbhpm_valores_portes enable row level security; alter table public.contrato_tabelas_comerciais enable row level security;
alter table public.tabelas_procedimentos_fontes enable row level security; alter table public.tabelas_procedimentos_edicoes enable row level security; alter table public.tabelas_procedimentos_itens enable row level security; alter table public.contrato_regras_procedimentos enable row level security;
alter table public.contrato_regras_faturamento enable row level security; alter table public.contrato_pacotes enable row level security; alter table public.contrato_pacote_itens enable row level security;
alter table public.ged_documentos enable row level security; alter table public.contas_medicas_processos enable row level security; alter table public.contas_medicas_pendencias enable row level security;
alter table public.contas_medicas_checklist_modelos enable row level security; alter table public.contas_medicas_checklist_itens enable row level security;
alter table public.compras_recebimentos enable row level security; alter table public.compras_recebimento_itens enable row level security;
alter table public.financeiro_recebiveis enable row level security; alter table public.financeiro_contas_pagar enable row level security;
alter table public.nfse_configuracoes enable row level security; alter table public.notas_fiscais_servico enable row level security; alter table public.nfse_transacoes enable row level security;

create policy fornecedores_all on public.fornecedores for all to authenticated using(public.tem_empresa(empresa_id)) with check(public.tem_empresa(empresa_id));
create policy estoque_produtos_all on public.estoque_produtos for all to authenticated using(public.tem_empresa(empresa_id)) with check(public.tem_empresa(empresa_id));
create policy estoque_locais_all on public.estoque_locais for all to authenticated using(public.tem_unidade(empresa_id,unidade_id)) with check(public.tem_unidade(empresa_id,unidade_id));
create policy estoque_lotes_all on public.estoque_lotes for all to authenticated using(public.tem_unidade(empresa_id,unidade_id)) with check(public.tem_unidade(empresa_id,unidade_id));
create policy estoque_movimentos_all on public.estoque_movimentos for all to authenticated using(public.tem_unidade(empresa_id,unidade_id)) with check(public.tem_unidade(empresa_id,unidade_id));
create policy compras_solicitacoes_all on public.compras_solicitacoes for all to authenticated using(public.tem_unidade(empresa_id,unidade_id)) with check(public.tem_unidade(empresa_id,unidade_id));
create policy compras_solicitacao_itens_all on public.compras_solicitacao_itens for all to authenticated using(exists(select 1 from public.compras_solicitacoes s where s.id=solicitacao_id and public.tem_unidade(s.empresa_id,s.unidade_id))) with check(exists(select 1 from public.compras_solicitacoes s where s.id=solicitacao_id and public.tem_unidade(s.empresa_id,s.unidade_id)));
create policy compras_cotacoes_all on public.compras_cotacoes for all to authenticated using(public.tem_unidade(empresa_id,unidade_id)) with check(public.tem_unidade(empresa_id,unidade_id));
create policy compras_cotacao_fornecedores_all on public.compras_cotacao_fornecedores for all to authenticated using(exists(select 1 from public.compras_cotacoes c where c.id=cotacao_id and public.tem_unidade(c.empresa_id,c.unidade_id))) with check(exists(select 1 from public.compras_cotacoes c where c.id=cotacao_id and public.tem_unidade(c.empresa_id,c.unidade_id)));
create policy compras_pedidos_all on public.compras_pedidos for all to authenticated using(public.tem_unidade(empresa_id,unidade_id)) with check(public.tem_unidade(empresa_id,unidade_id));
create policy compras_pedido_itens_all on public.compras_pedido_itens for all to authenticated using(exists(select 1 from public.compras_pedidos p where p.id=pedido_id and public.tem_unidade(p.empresa_id,p.unidade_id))) with check(exists(select 1 from public.compras_pedidos p where p.id=pedido_id and public.tem_unidade(p.empresa_id,p.unidade_id)));
create policy auditoria_contas_all on public.auditoria_contas for all to authenticated using(public.tem_unidade(empresa_id,unidade_id)) with check(public.tem_unidade(empresa_id,unidade_id));
create policy auditoria_conta_itens_all on public.auditoria_conta_itens for all to authenticated using(exists(select 1 from public.auditoria_contas a where a.id=auditoria_id and public.tem_unidade(a.empresa_id,a.unidade_id))) with check(exists(select 1 from public.auditoria_contas a where a.id=auditoria_id and public.tem_unidade(a.empresa_id,a.unidade_id)));
create policy central_guias_all on public.central_guias for all to authenticated using(public.tem_unidade(empresa_id,unidade_id)) with check(public.tem_unidade(empresa_id,unidade_id));
create policy central_guias_itens_all on public.central_guias_itens for all to authenticated using(exists(select 1 from public.central_guias g where g.id=guia_id and public.tem_unidade(g.empresa_id,g.unidade_id))) with check(exists(select 1 from public.central_guias g where g.id=guia_id and public.tem_unidade(g.empresa_id,g.unidade_id)));
create policy credenciamento_contratos_all on public.credenciamento_contratos for all to authenticated using(public.tem_empresa(empresa_id)) with check(public.tem_empresa(empresa_id));
create policy credenciamento_tabelas_all on public.credenciamento_tabelas for all to authenticated using(exists(select 1 from public.credenciamento_contratos c where c.id=contrato_id and public.tem_empresa(c.empresa_id))) with check(exists(select 1 from public.credenciamento_contratos c where c.id=contrato_id and public.tem_empresa(c.empresa_id)));
create policy credenciamento_tabela_itens_all on public.credenciamento_tabela_itens for all to authenticated using(exists(select 1 from public.credenciamento_tabelas t join public.credenciamento_contratos c on c.id=t.contrato_id where t.id=tabela_id and public.tem_empresa(c.empresa_id))) with check(exists(select 1 from public.credenciamento_tabelas t join public.credenciamento_contratos c on c.id=t.contrato_id where t.id=tabela_id and public.tem_empresa(c.empresa_id)));
create policy tabelas_comerciais_fontes_all on public.tabelas_comerciais_fontes for all to authenticated using(public.tem_empresa(empresa_id)) with check(public.tem_empresa(empresa_id));
create policy tabelas_comerciais_edicoes_all on public.tabelas_comerciais_edicoes for all to authenticated using(exists(select 1 from public.tabelas_comerciais_fontes f where f.id=fonte_id and public.tem_empresa(f.empresa_id))) with check(exists(select 1 from public.tabelas_comerciais_fontes f where f.id=fonte_id and public.tem_empresa(f.empresa_id)));
create policy tabelas_comerciais_itens_all on public.tabelas_comerciais_itens for all to authenticated using(exists(select 1 from public.tabelas_comerciais_edicoes e join public.tabelas_comerciais_fontes f on f.id=e.fonte_id where e.id=edicao_id and public.tem_empresa(f.empresa_id))) with check(exists(select 1 from public.tabelas_comerciais_edicoes e join public.tabelas_comerciais_fontes f on f.id=e.fonte_id where e.id=edicao_id and public.tem_empresa(f.empresa_id)));
create policy cbhpm_valores_portes_all on public.cbhpm_valores_portes for all to authenticated using(exists(select 1 from public.tabelas_comerciais_edicoes e join public.tabelas_comerciais_fontes f on f.id=e.fonte_id where e.id=edicao_id and public.tem_empresa(f.empresa_id))) with check(exists(select 1 from public.tabelas_comerciais_edicoes e join public.tabelas_comerciais_fontes f on f.id=e.fonte_id where e.id=edicao_id and public.tem_empresa(f.empresa_id)));
create policy contrato_tabelas_comerciais_all on public.contrato_tabelas_comerciais for all to authenticated using(exists(select 1 from public.credenciamento_contratos c where c.id=contrato_id and public.tem_empresa(c.empresa_id))) with check(exists(select 1 from public.credenciamento_contratos c where c.id=contrato_id and public.tem_empresa(c.empresa_id)));
create policy tabelas_procedimentos_fontes_all on public.tabelas_procedimentos_fontes for all to authenticated using(public.tem_empresa(empresa_id)) with check(public.tem_empresa(empresa_id));
create policy tabelas_procedimentos_edicoes_all on public.tabelas_procedimentos_edicoes for all to authenticated using(exists(select 1 from public.tabelas_procedimentos_fontes f where f.id=fonte_id and public.tem_empresa(f.empresa_id))) with check(exists(select 1 from public.tabelas_procedimentos_fontes f where f.id=fonte_id and public.tem_empresa(f.empresa_id)));
create policy tabelas_procedimentos_itens_all on public.tabelas_procedimentos_itens for all to authenticated using(exists(select 1 from public.tabelas_procedimentos_edicoes e join public.tabelas_procedimentos_fontes f on f.id=e.fonte_id where e.id=edicao_id and public.tem_empresa(f.empresa_id))) with check(exists(select 1 from public.tabelas_procedimentos_edicoes e join public.tabelas_procedimentos_fontes f on f.id=e.fonte_id where e.id=edicao_id and public.tem_empresa(f.empresa_id)));
create policy contrato_regras_procedimentos_all on public.contrato_regras_procedimentos for all to authenticated using(exists(select 1 from public.credenciamento_contratos c where c.id=contrato_id and public.tem_empresa(c.empresa_id))) with check(exists(select 1 from public.credenciamento_contratos c where c.id=contrato_id and public.tem_empresa(c.empresa_id)));
create policy contrato_regras_faturamento_all on public.contrato_regras_faturamento for all to authenticated using(exists(select 1 from public.credenciamento_contratos c where c.id=contrato_id and public.tem_empresa(c.empresa_id))) with check(exists(select 1 from public.credenciamento_contratos c where c.id=contrato_id and public.tem_empresa(c.empresa_id)));
create policy contrato_pacotes_all on public.contrato_pacotes for all to authenticated using(exists(select 1 from public.credenciamento_contratos c where c.id=contrato_id and public.tem_empresa(c.empresa_id))) with check(exists(select 1 from public.credenciamento_contratos c where c.id=contrato_id and public.tem_empresa(c.empresa_id)));
create policy contrato_pacote_itens_all on public.contrato_pacote_itens for all to authenticated using(exists(select 1 from public.contrato_pacotes p join public.credenciamento_contratos c on c.id=p.contrato_id where p.id=pacote_id and public.tem_empresa(c.empresa_id))) with check(exists(select 1 from public.contrato_pacotes p join public.credenciamento_contratos c on c.id=p.contrato_id where p.id=pacote_id and public.tem_empresa(c.empresa_id)));
create policy ged_documentos_all on public.ged_documentos for all to authenticated using(public.tem_empresa(empresa_id)) with check(public.tem_empresa(empresa_id));
create policy contas_medicas_processos_all on public.contas_medicas_processos for all to authenticated using(public.tem_unidade(empresa_id,unidade_id)) with check(public.tem_unidade(empresa_id,unidade_id));
create policy contas_medicas_pendencias_all on public.contas_medicas_pendencias for all to authenticated using(exists(select 1 from public.contas_medicas_processos p where p.id=processo_id and public.tem_unidade(p.empresa_id,p.unidade_id))) with check(exists(select 1 from public.contas_medicas_processos p where p.id=processo_id and public.tem_unidade(p.empresa_id,p.unidade_id)));
create policy cm_checklist_modelos_all on public.contas_medicas_checklist_modelos for all to authenticated using(public.tem_empresa(empresa_id)) with check(public.tem_empresa(empresa_id));
create policy cm_checklist_itens_all on public.contas_medicas_checklist_itens for all to authenticated using(exists(select 1 from public.contas_medicas_processos p where p.id=processo_id and public.tem_unidade(p.empresa_id,p.unidade_id))) with check(exists(select 1 from public.contas_medicas_processos p where p.id=processo_id and public.tem_unidade(p.empresa_id,p.unidade_id)));
create policy compras_recebimentos_all on public.compras_recebimentos for all to authenticated using(public.tem_unidade(empresa_id,unidade_id)) with check(public.tem_unidade(empresa_id,unidade_id));
create policy compras_recebimento_itens_all on public.compras_recebimento_itens for all to authenticated using(exists(select 1 from public.compras_recebimentos r where r.id=recebimento_id and public.tem_unidade(r.empresa_id,r.unidade_id))) with check(exists(select 1 from public.compras_recebimentos r where r.id=recebimento_id and public.tem_unidade(r.empresa_id,r.unidade_id)));
create policy financeiro_recebiveis_all on public.financeiro_recebiveis for all to authenticated using(public.tem_unidade(empresa_id,unidade_id)) with check(public.tem_unidade(empresa_id,unidade_id));
create policy financeiro_contas_pagar_all on public.financeiro_contas_pagar for all to authenticated using(public.tem_unidade(empresa_id,unidade_id)) with check(public.tem_unidade(empresa_id,unidade_id));
create policy nfse_configuracoes_all on public.nfse_configuracoes for all to authenticated using(public.tem_empresa(empresa_id)) with check(public.tem_empresa(empresa_id));
create policy notas_fiscais_servico_all on public.notas_fiscais_servico for all to authenticated using(public.tem_unidade(empresa_id,unidade_id)) with check(public.tem_unidade(empresa_id,unidade_id));
create policy nfse_transacoes_all on public.nfse_transacoes for all to authenticated using(exists(select 1 from public.notas_fiscais_servico n where n.id=nota_id and public.tem_unidade(n.empresa_id,n.unidade_id))) with check(exists(select 1 from public.notas_fiscais_servico n where n.id=nota_id and public.tem_unidade(n.empresa_id,n.unidade_id)));

-- --------------------------------------------------------------------------
-- 12. FUNCOES DE NEGOCIO
-- --------------------------------------------------------------------------
create or replace function public.criar_setores_padrao_unidade()
returns trigger language plpgsql set search_path=public as $$
begin
  insert into public.setores_chamada(empresa_id,unidade_id,codigo,nome,prefixo,permite_totem,ordem) values
    (new.empresa_id,new.id,'recepcao','Recepcao','R',true,10),
    (new.empresa_id,new.id,'triagem','Triagem','T',false,20),
    (new.empresa_id,new.id,'consultorio','Consultorio','C',false,30),
    (new.empresa_id,new.id,'laboratorio','Laboratorio','L',false,40),
    (new.empresa_id,new.id,'imagem','Diagnostico por Imagem','I',false,50),
    (new.empresa_id,new.id,'farmacia','Farmacia','F',false,60)
  on conflict(unidade_id,codigo) do nothing;
  return new;
end $$;
create trigger trg_unidades_setores_chamada after insert on public.unidades for each row execute function public.criar_setores_padrao_unidade();

create or replace function public.nome_painel_chamada(p_nome text)
returns text language sql immutable as $$
  select case when coalesce(trim(p_nome),'')='' then null
    when array_length(regexp_split_to_array(trim(p_nome),'\s+'),1)=1 then upper(trim(p_nome))
    else upper((regexp_split_to_array(trim(p_nome),'\s+'))[1]||' '||left((regexp_split_to_array(trim(p_nome),'\s+'))[array_length(regexp_split_to_array(trim(p_nome),'\s+'),1)],1)||'.') end
$$;

create or replace function public.emitir_senha_totem_v2(p_unidade_id uuid,p_setor_codigo text default 'recepcao',p_prioridade text default 'normal',p_cpf text default null)
returns table(id uuid,senha text,emitida_em timestamptz,setor_nome text,identificado boolean)
language plpgsql security definer set search_path=public,pg_catalog as $$
declare
  v_unidade public.unidades%rowtype; v_setor public.setores_chamada%rowtype; v_seq integer;
  v_data date:=(now() at time zone 'America/Sao_Paulo')::date; v_id uuid; v_senha text;
  v_paciente_id uuid:=null; v_cpf text:=regexp_replace(coalesce(p_cpf,''),'\D','','g'); v_prioridade public.prioridade_senha;
begin
  select * into v_unidade from public.unidades where id=p_unidade_id and ativo limit 1;
  if not found then raise exception using errcode='P0001',message='TOTEM_UNIDADE_INDISPONIVEL'; end if;
  begin v_prioridade:=coalesce(nullif(trim(p_prioridade),''),'normal')::public.prioridade_senha;
  exception when invalid_text_representation then raise exception using errcode='P0001',message='TOTEM_PRIORIDADE_INVALIDA'; end;
  select * into v_setor from public.setores_chamada where unidade_id=p_unidade_id and codigo=coalesce(nullif(trim(p_setor_codigo),''),'recepcao') and ativo and permite_totem limit 1;
  if not found then raise exception using errcode='P0001',message='TOTEM_SETOR_INDISPONIVEL'; end if;
  if coalesce(trim(p_cpf),'')<>'' then
    if length(v_cpf)<>11 then raise exception using errcode='P0001',message='TOTEM_CPF_INVALIDO'; end if;
    select p.id into v_paciente_id from public.pacientes p where p.empresa_id=v_unidade.empresa_id and p.cpf=v_cpf and p.ativo limit 1;
    if v_paciente_id is null then raise exception using errcode='P0001',message='TOTEM_CPF_NAO_LOCALIZADO'; end if;
  end if;
  perform pg_advisory_xact_lock(hashtext(p_unidade_id::text||v_data::text||v_setor.id::text));
  select coalesce(max(s.sequencial),0)+1 into v_seq from public.senhas_atendimento s where s.unidade_id=p_unidade_id and s.setor_id=v_setor.id and s.data_referencia=v_data;
  v_senha:=upper(v_setor.prefixo)||lpad(v_seq::text,3,'0');
  insert into public.senhas_atendimento(empresa_id,unidade_id,setor_id,data_referencia,sequencial,senha,prioridade,paciente_id)
  values(v_unidade.empresa_id,p_unidade_id,v_setor.id,v_data,v_seq,v_senha,v_prioridade,v_paciente_id) returning senhas_atendimento.id into v_id;
  return query select v_id,v_senha,now(),v_setor.nome,(v_paciente_id is not null);
end $$;
revoke all on function public.emitir_senha_totem_v2(uuid,text,text,text) from public;
grant execute on function public.emitir_senha_totem_v2(uuid,text,text,text) to anon,authenticated;

-- Wrapper legado.
create or replace function public.emitir_senha_totem(p_unidade_id uuid,p_setor_codigo text,p_prioridade public.prioridade_senha default 'normal')
returns table(id uuid,senha text,emitida_em timestamptz,setor_nome text)
language sql security definer set search_path=public as $$
  select r.id,r.senha,r.emitida_em,r.setor_nome from public.emitir_senha_totem_v2(p_unidade_id,p_setor_codigo,p_prioridade::text,null) r
$$;
grant execute on function public.emitir_senha_totem(uuid,text,public.prioridade_senha) to anon,authenticated;

create or replace function public.listar_painel_chamadas(p_unidade_id uuid)
returns table(senha text,nome_chamada text,identificado boolean,setor_nome text,ponto_atendimento text,ultima_chamada_em timestamptz)
language sql security definer set search_path=public as $$
  select s.senha,case when coalesce(s.paciente_id,a.paciente_id) is not null then public.nome_painel_chamada(p.nome_completo) else null end,
         coalesce(s.paciente_id,a.paciente_id) is not null,sc.nome,s.ponto_atendimento,s.ultima_chamada_em
  from public.senhas_atendimento s join public.setores_chamada sc on sc.id=s.setor_id
  left join public.atendimentos a on a.id=s.atendimento_id left join public.pacientes p on p.id=coalesce(s.paciente_id,a.paciente_id)
  where s.unidade_id=p_unidade_id and s.data_referencia=(now() at time zone 'America/Sao_Paulo')::date
    and s.ultima_chamada_em is not null and s.status in ('chamada','em_atendimento')
  order by s.ultima_chamada_em desc limit 8
$$;
grant execute on function public.listar_painel_chamadas(uuid) to anon,authenticated;

create or replace function public.encaminhar_conta_para_auditoria(p_atendimento_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_at public.atendimentos%rowtype; v_conta_id uuid; v_auditoria_id uuid;
begin
  select * into v_at from public.atendimentos where id=p_atendimento_id;
  if v_at.id is null then raise exception 'Atendimento nao encontrado'; end if;
  if not public.tem_unidade(v_at.empresa_id,v_at.unidade_id) then raise exception 'Sem acesso a unidade'; end if;
  select id into v_conta_id from public.contas_faturamento where atendimento_id=p_atendimento_id limit 1;
  insert into public.auditoria_contas(empresa_id,unidade_id,atendimento_id,conta_id,status)
  values(v_at.empresa_id,v_at.unidade_id,p_atendimento_id,v_conta_id,'aguardando')
  on conflict(atendimento_id) do update set conta_id=coalesce(excluded.conta_id,public.auditoria_contas.conta_id),updated_at=now()
  returning id into v_auditoria_id;
  if v_conta_id is not null then update public.contas_faturamento set auditoria_liberada=false,auditoria_id=v_auditoria_id where id=v_conta_id; end if;
  return v_auditoria_id;
end $$;
grant execute on function public.encaminhar_conta_para_auditoria(uuid) to authenticated;

create or replace function public.liberar_auditoria_conta(p_auditoria_id uuid,p_observacoes text default null)
returns void language plpgsql security definer set search_path=public as $$
declare v_a public.auditoria_contas%rowtype;
begin
  select * into v_a from public.auditoria_contas where id=p_auditoria_id;
  if v_a.id is null or not public.tem_unidade(v_a.empresa_id,v_a.unidade_id) then raise exception 'Auditoria nao encontrada ou sem acesso'; end if;
  if exists(select 1 from public.auditoria_conta_itens where auditoria_id=p_auditoria_id and not resolvida and severidade in ('erro','bloqueio')) then raise exception 'Existem pendencias impeditivas'; end if;
  update public.auditoria_contas set status='liberada',auditor_id=auth.uid(),finalizado_em=now(),observacoes=coalesce(p_observacoes,observacoes),updated_at=now() where id=p_auditoria_id;
  if v_a.conta_id is not null then update public.contas_faturamento set auditoria_liberada=true,auditoria_id=p_auditoria_id,updated_at=now(),updated_by=auth.uid() where id=v_a.conta_id; end if;
end $$;
grant execute on function public.liberar_auditoria_conta(uuid,text) to authenticated;

create or replace function public.criar_contas_medicas_pos_auditoria()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.auditoria_liberada is true and coalesce(old.auditoria_liberada,false) is false then
    insert into public.contas_medicas_processos(empresa_id,unidade_id,conta_id,atendimento_id,paciente_id,convenio_id,status,total_conta)
    values(new.empresa_id,new.unidade_id,new.id,new.atendimento_id,new.paciente_id,new.convenio_id,'aguardando',new.valor_liquido)
    on conflict(conta_id) do nothing;
  end if;
  return new;
end $$;
create trigger trg_contas_medicas_pos_auditoria after update of auditoria_liberada on public.contas_faturamento
for each row execute function public.criar_contas_medicas_pos_auditoria();

create or replace function public.gerar_checklist_conta_medica(p_processo_id uuid)
returns integer language plpgsql security definer set search_path=public as $$
declare v_proc public.contas_medicas_processos%rowtype; v_count integer;
begin
  select * into v_proc from public.contas_medicas_processos where id=p_processo_id;
  if not found then raise exception 'Processo de contas medicas nao encontrado'; end if;
  if not public.tem_unidade(v_proc.empresa_id,v_proc.unidade_id) then raise exception 'Sem acesso'; end if;
  delete from public.contas_medicas_checklist_itens where processo_id=p_processo_id;
  insert into public.contas_medicas_checklist_itens(processo_id,modelo_id,codigo,descricao,obrigatorio,categoria_documento)
  select p_processo_id,m.id,m.codigo,m.descricao,m.obrigatorio,m.categoria_documento from public.contas_medicas_checklist_modelos m
  where m.empresa_id=v_proc.empresa_id and m.ativo and (m.convenio_id is null or m.convenio_id=v_proc.convenio_id)
  order by m.convenio_id nulls first,m.ordem,m.codigo;
  get diagnostics v_count=row_count; return v_count;
end $$;

grant execute on function public.gerar_checklist_conta_medica(uuid) to authenticated;

create or replace function public.validar_checklist_conta_medica(p_processo_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_proc public.contas_medicas_processos%rowtype; v_pendentes integer;
begin
  select * into v_proc from public.contas_medicas_processos where id=p_processo_id;
  if not found or not public.tem_unidade(v_proc.empresa_id,v_proc.unidade_id) then raise exception 'Processo nao encontrado ou sem acesso'; end if;
  select count(*) into v_pendentes from public.contas_medicas_checklist_itens where processo_id=p_processo_id and obrigatorio and status not in ('ok','nao_aplicavel');
  if v_pendentes>0 then update public.contas_medicas_processos set status='pendente_documentacao',updated_at=now() where id=p_processo_id; return false; end if;
  return true;
end $$;
grant execute on function public.validar_checklist_conta_medica(uuid) to authenticated;

create or replace function public.obter_valor_comercial(p_convenio_id uuid,p_codigo text,p_data date default current_date,p_categoria text default 'geral')
returns table(fonte_id uuid,edicao_id uuid,item_id uuid,fonte text,edicao text,valor_base numeric,percentual_ajuste numeric,valor_final numeric)
language sql stable security invoker as $$
  select f.id,e.id,i.id,f.nome,e.nome_edicao,i.valor_referencia,ctc.percentual_ajuste,
         round(i.valor_referencia*(1+ctc.percentual_ajuste/100),4)
  from public.credenciamento_contratos cc
  join public.contrato_tabelas_comerciais ctc on ctc.contrato_id=cc.id and ctc.ativo
  join public.tabelas_comerciais_fontes f on f.id=ctc.fonte_id and f.ativo
  join public.tabelas_comerciais_edicoes e on e.fonte_id=f.id and e.status='vigente' and (e.convenio_id is null or e.convenio_id=p_convenio_id)
   and ((ctc.modo_edicao='edicao_fixa' and e.id=ctc.edicao_fixa_id) or (ctc.modo_edicao='vigente_na_data' and e.vigencia_inicio<=p_data and (e.vigencia_fim is null or e.vigencia_fim>=p_data)))
  join public.tabelas_comerciais_itens i on i.edicao_id=e.id and i.codigo=p_codigo and i.ativo
  where cc.convenio_id=p_convenio_id and cc.status='ativo' and (cc.data_inicio is null or cc.data_inicio<=p_data) and (cc.data_fim is null or cc.data_fim>=p_data)
    and ctc.categoria in (p_categoria,'geral')
  order by case when ctc.categoria=p_categoria then 0 else 1 end,ctc.prioridade,e.vigencia_inicio desc limit 1
$$;
grant execute on function public.obter_valor_comercial(uuid,text,date,text) to authenticated;

create or replace function public.obter_valor_procedimento_contratual(p_convenio_id uuid,p_codigo text,p_data date,p_categoria text default 'procedimentos',p_urgencia boolean default false,p_acomodacao_individual boolean default false)
returns table(valor numeric,metodologia text,fonte_id uuid,edicao_id uuid,item_id uuid,memoria jsonb)
language plpgsql security definer set search_path=public as $$
declare v_empresa uuid; v_contrato public.credenciamento_contratos%rowtype; v_regra public.contrato_regras_procedimentos%rowtype;
  v_fonte public.tabelas_procedimentos_fontes%rowtype; v_edicao public.tabelas_procedimentos_edicoes%rowtype;
  v_item public.tabelas_procedimentos_itens%rowtype; v_base numeric:=0; v_final numeric:=0; v_adicional numeric:=0;
begin
  select empresa_id into v_empresa from public.convenios where id=p_convenio_id;
  if v_empresa is null or not public.tem_empresa(v_empresa) then return; end if;
  select * into v_contrato from public.credenciamento_contratos c where c.convenio_id=p_convenio_id and c.status='ativo'
   and (c.data_inicio is null or c.data_inicio<=p_data) and (c.data_fim is null or c.data_fim>=p_data)
   order by c.data_inicio desc nulls last,c.created_at desc limit 1;
  if v_contrato.id is null then return; end if;
  select * into v_regra from public.contrato_regras_procedimentos r where r.contrato_id=v_contrato.id and r.ativo and r.categoria=p_categoria
   and (r.vigencia_inicio is null or r.vigencia_inicio<=p_data) and (r.vigencia_fim is null or r.vigencia_fim>=p_data)
   order by r.vigencia_inicio desc nulls last,r.created_at desc limit 1;
  if v_regra.id is null then select * into v_regra from public.contrato_regras_procedimentos r where r.contrato_id=v_contrato.id and r.ativo and r.categoria='procedimentos'
    and (r.vigencia_inicio is null or r.vigencia_inicio<=p_data) and (r.vigencia_fim is null or r.vigencia_fim>=p_data)
    order by r.vigencia_inicio desc nulls last,r.created_at desc limit 1; end if;
  if v_regra.id is null then return; end if;
  select * into v_fonte from public.tabelas_procedimentos_fontes where id=v_regra.fonte_id;
  if v_regra.modo_edicao='edicao_fixa' then select * into v_edicao from public.tabelas_procedimentos_edicoes where id=v_regra.edicao_fixa_id;
  else select * into v_edicao from public.tabelas_procedimentos_edicoes e where e.fonte_id=v_regra.fonte_id and e.status='ativa' and e.vigencia_inicio<=p_data and (e.vigencia_fim is null or e.vigencia_fim>=p_data) order by e.vigencia_inicio desc limit 1; end if;
  if v_edicao.id is null then return; end if;
  select * into v_item from public.tabelas_procedimentos_itens i where i.edicao_id=v_edicao.id and i.ativo and (i.codigo=p_codigo or i.codigo_tuss=p_codigo) order by case when i.codigo=p_codigo then 0 else 1 end limit 1;
  if v_item.id is null then return; end if;
  case v_fonte.metodologia
    when 'amb90' then v_base:=coalesce(v_item.ch_hm,0)*coalesce(v_regra.valor_ch_hm,0)+coalesce(v_item.ch_sadt,0)*coalesce(v_regra.valor_ch_sadt,0);
    when 'amb92' then v_base:=coalesce(v_item.ch_hm,0)*coalesce(v_regra.valor_ch_hm,0)+coalesce(v_item.ch_sadt,0)*coalesce(v_regra.valor_ch_sadt,0);
    when 'amb96' then v_base:=coalesce(v_item.valor_fixo,0); when 'amb99' then v_base:=coalesce(v_item.valor_fixo,0);
    when 'cbhpm' then v_base:=coalesce(v_item.valor_fixo,0)+coalesce(v_item.uco,0)*coalesce(v_regra.valor_uco,0);
    else v_base:=coalesce(v_item.valor_fixo,0); end case;
  v_final:=v_base*(1+coalesce(v_regra.percentual_ajuste,0)/100.0);
  if p_urgencia and v_regra.aplicar_urgencia then v_adicional:=v_adicional+coalesce(v_regra.adicional_urgencia_percentual,0); end if;
  if p_acomodacao_individual and v_regra.aplicar_acomodacao then v_adicional:=v_adicional+coalesce(v_regra.adicional_apartamento_percentual,0); end if;
  v_final:=v_final*(1+v_adicional/100.0);
  return query select round(v_final,2),v_fonte.metodologia,v_fonte.id,v_edicao.id,v_item.id,
   jsonb_build_object('base',round(v_base,4),'percentual_ajuste',v_regra.percentual_ajuste,'adicional_percentual',v_adicional,'valor_ch_hm',v_regra.valor_ch_hm,'valor_ch_sadt',v_regra.valor_ch_sadt,'valor_uco',v_regra.valor_uco,'ch_hm',v_item.ch_hm,'ch_sadt',v_item.ch_sadt,'porte',v_item.porte,'uco',v_item.uco,'edicao',v_edicao.nome_edicao,'fonte',v_fonte.nome);
end $$;
grant execute on function public.obter_valor_procedimento_contratual(uuid,text,date,text,boolean,boolean) to authenticated;

create or replace function public.obter_valor_procedimento_comercial(p_convenio_id uuid,p_codigo text,p_data date default current_date,p_categoria text default 'procedimentos',p_urgencia boolean default false,p_acomodacao text default null)
returns table(fonte_id uuid,edicao_id uuid,item_id uuid,fonte text,edicao text,metodo_calculo text,valor_base numeric,percentual_contratual numeric,adicional_urgencia numeric,adicional_acomodacao numeric,valor_final numeric,memoria_calculo jsonb)
language plpgsql stable security invoker as $$
declare v record; v_base numeric:=0; v_porte numeric:=0; v_uco numeric:=0; v_urg_pct numeric:=0; v_acom_pct numeric:=0; v_add_urg numeric:=0; v_add_acom numeric:=0; v_final numeric:=0;
begin
  select cc.id contrato_id,ctc.*,f.nome fonte_nome,e.id ed_id,e.nome_edicao,e.metodo_calculo,e.valor_uco,
    i.id item_id_sel,i.valor_referencia,i.pontos_ch,i.pontos_hm,i.pontos_sadt,i.porte,i.quantidade_uco,i.codigo,i.descricao into v
  from public.credenciamento_contratos cc join public.contrato_tabelas_comerciais ctc on ctc.contrato_id=cc.id and ctc.ativo
  join public.tabelas_comerciais_fontes f on f.id=ctc.fonte_id and f.ativo
  join public.tabelas_comerciais_edicoes e on e.fonte_id=f.id and e.status='vigente' and (e.convenio_id is null or e.convenio_id=p_convenio_id)
    and ((ctc.modo_edicao='edicao_fixa' and e.id=ctc.edicao_fixa_id) or (ctc.modo_edicao='vigente_na_data' and e.vigencia_inicio<=p_data and (e.vigencia_fim is null or e.vigencia_fim>=p_data)))
  join public.tabelas_comerciais_itens i on i.edicao_id=e.id and i.codigo=p_codigo and i.ativo
  where cc.convenio_id=p_convenio_id and cc.status='ativo' and (cc.data_inicio is null or cc.data_inicio<=p_data) and (cc.data_fim is null or cc.data_fim>=p_data)
    and ctc.categoria in (p_categoria,'geral') order by case when ctc.categoria=p_categoria then 0 else 1 end,ctc.prioridade,e.vigencia_inicio desc limit 1;
  if not found then return; end if;
  if v.metodo_calculo='fixo' then v_base:=coalesce(v.valor_referencia,0);
  elsif v.metodo_calculo='ch_hm_sadt' then v_base:=coalesce(v.pontos_ch,0)*coalesce(v.valor_ch,0)+coalesce(v.pontos_hm,0)*coalesce(v.valor_hm,0)+coalesce(v.pontos_sadt,0)*coalesce(v.valor_sadt,0);
  elsif v.metodo_calculo='cbhpm' then select coalesce(cvp.valor,0) into v_porte from public.cbhpm_valores_portes cvp where cvp.edicao_id=v.ed_id and cvp.porte=v.porte limit 1; v_uco:=coalesce(v.valor_uco_contratual,v.valor_uco,0); v_base:=coalesce(v_porte,0)+coalesce(v.quantidade_uco,0)*v_uco; end if;
  v_base:=v_base*(1+coalesce(v.percentual_ajuste,0)/100.0);
  v_urg_pct:=case when p_urgencia then coalesce((v.regras_adicionais->>'urgencia_percentual')::numeric,0) else 0 end;
  v_acom_pct:=case when lower(coalesce(p_acomodacao,'')) in ('apartamento','individual','quarto') then coalesce((v.regras_adicionais->>'apartamento_percentual')::numeric,0) else 0 end;
  v_add_urg:=v_base*v_urg_pct/100.0; v_add_acom:=v_base*v_acom_pct/100.0; v_final:=round(v_base+v_add_urg+v_add_acom,coalesce(v.arredondamento_casas,2));
  return query select v.fonte_id,v.ed_id,v.item_id_sel,v.fonte_nome,v.nome_edicao,v.metodo_calculo,round(v_base,6),coalesce(v.percentual_ajuste,0),round(v_add_urg,6),round(v_add_acom,6),v_final,
    jsonb_build_object('codigo',v.codigo,'descricao',v.descricao,'metodo',v.metodo_calculo,'pontos_ch',v.pontos_ch,'valor_ch',v.valor_ch,'pontos_hm',v.pontos_hm,'valor_hm',v.valor_hm,'pontos_sadt',v.pontos_sadt,'valor_sadt',v.valor_sadt,'porte',v.porte,'valor_porte',v_porte,'quantidade_uco',v.quantidade_uco,'valor_uco',v_uco,'percentual_ajuste',coalesce(v.percentual_ajuste,0),'urgencia_percentual',v_urg_pct,'acomodacao_percentual',v_acom_pct);
end $$;
grant execute on function public.obter_valor_procedimento_comercial(uuid,text,date,text,boolean,text) to authenticated;

create or replace function public.recalcular_item_contratual_avancado(p_item_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_item record; v_preco record; v_contrato_id uuid; v_regra_id uuid:=null; v_regra_codigo text:=null;
  v_regra_percentual numeric:=null; v_regra_valor_fixo numeric:=null; v_base numeric:=0; v_final numeric:=0;
  v_percentual numeric:=100; v_valor_fixo numeric:=0; v_categoria text:='procedimentos'; v_memoria jsonb:='{}'::jsonb;
  v_grupo_codigo text:=null; v_via_acesso text:=null; v_acomodacao text:=null; v_urgencia boolean:=false;
begin
  select i.*,c.empresa_id,c.unidade_id,c.convenio_id into v_item from public.conta_faturamento_itens i join public.contas_faturamento c on c.id=i.conta_id where i.id=p_item_id;
  if v_item.id is null then return null; end if;
  if not public.tem_unidade(v_item.empresa_id,v_item.unidade_id) then raise exception 'Sem acesso a conta'; end if;
  if v_item.convenio_id is null or v_item.codigo is null then
    update public.conta_faturamento_itens set valor_referencia=null,valor_contratual_calculado=null,percentual_aplicado=null,regra_contratual_id=null,memoria_calculo=jsonb_build_object('status','sem_referencia') where id=p_item_id;
    return null;
  end if;
  if v_item.grupo_ato_id is not null then select g.codigo_grupo,g.via_acesso,g.acomodacao,g.urgencia into v_grupo_codigo,v_via_acesso,v_acomodacao,v_urgencia from public.conta_faturamento_grupos_ato g where g.id=v_item.grupo_ato_id; end if;
  v_categoria:=case when v_item.origem_tipo in ('exame','laboratorio','imagem') then 'exames' when v_item.origem_tipo='honorario' then 'honorarios' when v_item.origem_tipo='diaria' then 'diarias' when v_item.origem_tipo='taxa' then 'taxas' else 'procedimentos' end;
  select * into v_preco from public.obter_valor_procedimento_contratual(v_item.convenio_id,v_item.codigo,coalesce(v_item.data_execucao::date,current_date),v_categoria,coalesce(v_urgencia,false),lower(coalesce(v_acomodacao,'')) in ('apartamento','individual','quarto')) limit 1;
  if v_preco.valor is null then
    update public.conta_faturamento_itens set valor_referencia=null,valor_contratual_calculado=null,percentual_aplicado=null,regra_contratual_id=null,memoria_calculo=jsonb_build_object('status','sem_preco_contratual','codigo',v_item.codigo) where id=p_item_id;
    return null;
  end if;
  v_base:=v_preco.valor; v_final:=v_base;
  select c.id into v_contrato_id from public.credenciamento_contratos c where c.convenio_id=v_item.convenio_id and c.status='ativo'
    and (c.data_inicio is null or c.data_inicio<=coalesce(v_item.data_execucao::date,current_date)) and (c.data_fim is null or c.data_fim>=coalesce(v_item.data_execucao::date,current_date))
    order by c.data_inicio desc nulls last,c.created_at desc limit 1;
  if v_contrato_id is not null and coalesce(v_item.sequencia_ato,1)>1 then
    select r.id,r.codigo_regra,r.percentual,r.valor_fixo into v_regra_id,v_regra_codigo,v_regra_percentual,v_regra_valor_fixo from public.contrato_regras_faturamento r
    where r.contrato_id=v_contrato_id and r.ativo and r.codigo_regra in ('MULTIPLO_'||v_item.sequencia_ato::text,'MULTIPLO_N')
      and (r.vigencia_inicio is null or r.vigencia_inicio<=coalesce(v_item.data_execucao::date,current_date)) and (r.vigencia_fim is null or r.vigencia_fim>=coalesce(v_item.data_execucao::date,current_date))
    order by case when r.codigo_regra='MULTIPLO_'||v_item.sequencia_ato::text then 0 else 1 end,r.prioridade limit 1;
    if v_regra_id is not null then if v_regra_percentual is not null then v_percentual:=v_regra_percentual; v_final:=v_final*(v_percentual/100.0); end if; if v_regra_valor_fixo is not null then v_valor_fixo:=v_regra_valor_fixo; v_final:=v_final+v_valor_fixo; end if; end if;
  end if;
  v_memoria:=coalesce(v_preco.memoria,'{}'::jsonb)||jsonb_build_object('valor_base',round(v_base,2),'sequencia_ato',coalesce(v_item.sequencia_ato,1),'grupo_ato',v_grupo_codigo,'via_acesso',v_via_acesso,'acomodacao',v_acomodacao,'urgencia',v_urgencia,'regra_multiplo',v_regra_codigo,'percentual_sequencia',v_percentual,'adicional_fixo',v_valor_fixo,'valor_final',round(v_final,2));
  update public.conta_faturamento_itens set metodologia_preco=v_preco.metodologia,tabela_procedimento_edicao_id=v_preco.edicao_id,tabela_procedimento_item_id=v_preco.item_id,
    valor_referencia=v_base,valor_contratual_calculado=round(v_final,2),percentual_aplicado=v_percentual,regra_contratual_id=v_regra_id,memoria_calculo=v_memoria where id=p_item_id;
  return v_memoria;
end $$;
grant execute on function public.recalcular_item_contratual_avancado(uuid) to authenticated;

create or replace function public.recalcular_conta_contratual_avancada(p_conta_id uuid)
returns integer language plpgsql security definer set search_path=public as $$
declare v_c public.contas_faturamento%rowtype; r record; v_count integer:=0;
begin
  select * into v_c from public.contas_faturamento where id=p_conta_id;
  if v_c.id is null or not public.tem_unidade(v_c.empresa_id,v_c.unidade_id) then raise exception 'Conta nao encontrada ou sem acesso'; end if;
  for r in select id from public.conta_faturamento_itens where conta_id=p_conta_id and cobravel loop perform public.recalcular_item_contratual_avancado(r.id); v_count:=v_count+1; end loop;
  return v_count;
end $$;
grant execute on function public.recalcular_conta_contratual_avancada(uuid) to authenticated;

create or replace function public.auditar_precos_conta_medica(p_processo_id uuid)
returns integer language plpgsql security definer set search_path=public as $$
declare v_proc public.contas_medicas_processos%rowtype; v_item record; v_valor numeric; v_count integer:=0;
begin
  select * into v_proc from public.contas_medicas_processos where id=p_processo_id;
  if v_proc.id is null or not public.tem_unidade(v_proc.empresa_id,v_proc.unidade_id) then raise exception 'Processo nao encontrado ou sem acesso'; end if;
  delete from public.contas_medicas_pendencias where processo_id=p_processo_id and tipo='valor' and not resolvida;
  for v_item in select i.id,i.descricao,i.codigo,i.valor_unitario,i.data_execucao,cf.convenio_id from public.conta_faturamento_itens i join public.contas_faturamento cf on cf.id=i.conta_id where i.conta_id=v_proc.conta_id and i.cobravel and i.codigo is not null loop
    if v_item.convenio_id is not null then
      perform public.recalcular_item_contratual_avancado(v_item.id);
      select valor_contratual_calculado into v_valor from public.conta_faturamento_itens where id=v_item.id;
      if v_valor is null then
        insert into public.contas_medicas_pendencias(processo_id,tipo,severidade,descricao) values(p_processo_id,'valor','alerta',format('Sem referencia contratual para %s (%s).',v_item.descricao,v_item.codigo)); v_count:=v_count+1;
      elsif coalesce(v_item.valor_unitario,0)>v_valor+0.01 then
        insert into public.contas_medicas_pendencias(processo_id,tipo,severidade,descricao) values(p_processo_id,'valor','bloqueio',format('Valor acima do contrato: %s (%s). Lancado R$ %s; contratual R$ %s.',v_item.descricao,v_item.codigo,to_char(v_item.valor_unitario,'FM999999990D00'),to_char(v_valor,'FM999999990D00'))); v_count:=v_count+1;
      elsif coalesce(v_item.valor_unitario,0)<v_valor-0.01 then
        insert into public.contas_medicas_pendencias(processo_id,tipo,severidade,descricao) values(p_processo_id,'valor','alerta',format('Possivel perda de receita: %s (%s). Lancado R$ %s; contratual R$ %s.',v_item.descricao,v_item.codigo,to_char(v_item.valor_unitario,'FM999999990D00'),to_char(v_valor,'FM999999990D00'))); v_count:=v_count+1;
      end if;
    end if;
  end loop;
  return v_count;
end $$;
grant execute on function public.auditar_precos_conta_medica(uuid) to authenticated;

create or replace function public.calcular_preco_central_guia(p_guia_id uuid)
returns numeric language plpgsql security definer set search_path=public as $$
declare v_guia public.central_guias%rowtype; v_preco record; v_valor numeric;
begin
  select * into v_guia from public.central_guias where id=p_guia_id;
  if v_guia.id is null or v_guia.convenio_id is null or v_guia.codigo_procedimento is null then return null; end if;
  if not public.tem_unidade(v_guia.empresa_id,v_guia.unidade_id) then raise exception 'Sem acesso'; end if;
  select * into v_preco from public.obter_valor_procedimento_contratual(v_guia.convenio_id,v_guia.codigo_procedimento,v_guia.data_solicitacao::date,coalesce(v_guia.categoria_preco,'procedimentos'),false,false) limit 1;
  v_valor:=v_preco.valor;
  if v_valor is not null then update public.central_guias set valor_contratual=v_valor,metodologia_preco=v_preco.metodologia,edicao_preco_id=v_preco.edicao_id,memoria_calculo_preco=v_preco.memoria where id=p_guia_id; end if;
  return v_valor;
end $$;
grant execute on function public.calcular_preco_central_guia(uuid) to authenticated;

create or replace function public.aplicar_precificacao_item_conta()
returns trigger language plpgsql security invoker as $$
declare v_conta record; v_preco record; v_categoria text; v_data date;
begin
  select convenio_id,tipo_cobranca into v_conta from public.contas_faturamento where id=new.conta_id;
  if v_conta.convenio_id is null or new.codigo is null then return new; end if;
  v_data:=coalesce(new.data_execucao::date,current_date);
  v_categoria:=case when new.origem_tipo in ('procedimento','laboratorio','imagem','exame','honorario') then 'procedimentos' when new.origem_tipo='medicamento' then 'medicamentos' when new.origem_tipo='opme' then 'opme' when new.origem_tipo='material' then 'materiais' when new.origem_tipo='taxa' then 'taxas' when new.origem_tipo='diaria' then 'diarias' else 'geral' end;
  select * into v_preco from public.obter_valor_procedimento_comercial(v_conta.convenio_id,new.codigo,v_data,v_categoria,false,null) limit 1;
  if found then new.tabela_comercial_edicao_id:=v_preco.edicao_id; new.tabela_comercial_item_id:=v_preco.item_id; new.valor_referencia_contrato:=v_preco.valor_final; new.origem_valor:=concat(v_preco.fonte,' · ',v_preco.edicao); new.memoria_calculo_comercial:=v_preco.memoria_calculo;
    if coalesce(new.valor_unitario,0)<=0 then new.valor_unitario:=v_preco.valor_final; else new.valor_cobrado_original:=new.valor_unitario; end if;
    new.divergencia_valor_contratual:=round(coalesce(new.valor_unitario,0)-coalesce(v_preco.valor_final,0),4); new.valor_total:=round(coalesce(new.quantidade,1)*coalesce(new.valor_unitario,0),2); end if;
  return new;
end $$;
create trigger trg_precificacao_item_conta before insert or update of codigo,valor_unitario,quantidade,data_execucao,origem_tipo on public.conta_faturamento_itens for each row execute function public.aplicar_precificacao_item_conta();

create or replace function public.aplicar_precificacao_item_guia()
returns trigger language plpgsql security invoker as $$
declare v_guia record; v_preco record;
begin
  select convenio_id,data_solicitacao into v_guia from public.central_guias where id=new.guia_id;
  if v_guia.convenio_id is null or new.codigo is null then return new; end if;
  select * into v_preco from public.obter_valor_procedimento_comercial(v_guia.convenio_id,new.codigo,coalesce(v_guia.data_solicitacao::date,current_date),new.categoria,false,null) limit 1;
  if found then new.valor_contratual:=v_preco.valor_final; new.tabela_comercial_edicao_id:=v_preco.edicao_id; new.tabela_comercial_item_id:=v_preco.item_id; new.memoria_calculo:=v_preco.memoria_calculo;
    if coalesce(new.valor_solicitado,0)<=0 then new.valor_solicitado:=v_preco.valor_final; end if;
    if new.valor_autorizado is not null then new.divergencia_autorizacao:=round(new.valor_autorizado-v_preco.valor_final,4); end if; end if;
  return new;
end $$;
create trigger trg_precificacao_item_guia before insert or update of codigo,categoria,valor_solicitado,valor_autorizado on public.central_guias_itens for each row execute function public.aplicar_precificacao_item_guia();

create or replace function public.liberar_conta_medica(p_processo_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_processo public.contas_medicas_processos%rowtype; v_check boolean;
begin
  select * into v_processo from public.contas_medicas_processos where id=p_processo_id;
  if not found or not public.tem_unidade(v_processo.empresa_id,v_processo.unidade_id) then raise exception 'Processo nao encontrado ou sem acesso'; end if;
  perform public.auditar_precos_conta_medica(p_processo_id);
  v_check:=public.validar_checklist_conta_medica(p_processo_id);
  if not v_check or exists(select 1 from public.contas_medicas_pendencias where processo_id=p_processo_id and not resolvida and severidade in ('erro','bloqueio')) then raise exception 'Existem pendencias impeditivas em Contas Medicas'; end if;
  update public.contas_medicas_processos set status='liberada_tiss',concluido_em=now(),analisado_por=auth.uid(),updated_at=now() where id=p_processo_id;
  update public.contas_faturamento set contas_medicas_liberada=true,contas_medicas_liberada_em=now(),updated_at=now(),updated_by=auth.uid() where id=v_processo.conta_id;
end $$;
grant execute on function public.liberar_conta_medica(uuid) to authenticated;

-- --------------------------------------------------------------------------
-- 13. VIEWS
-- --------------------------------------------------------------------------
create or replace view public.vw_atendimento_contexto_clinico with (security_invoker=true) as
select a.id atendimento_id,a.empresa_id,a.unidade_id,a.numero_atendimento,a.status,a.data_abertura,a.paciente_id,
 p.numero_registro,p.ra,p.nome_completo paciente_nome,p.cpf paciente_cpf,p.cns paciente_cns,a.cobertura,a.convenio_id,a.plano_id,
 a.numero_carteirinha,a.validade_carteirinha,a.numero_autorizacao,a.senha_autorizacao,
 (select row_to_json(t) from (select tr.peso_kg,tr.altura_cm,tr.pressao_arterial,tr.frequencia_cardiaca,tr.frequencia_respiratoria,tr.saturacao_o2,tr.temperatura_c,tr.glicemia_mg_dl,tr.dor_escala,tr.classificacao_risco,tr.queixa_principal,tr.observacoes,tr.updated_at from public.triagens tr where tr.atendimento_id=a.id order by tr.updated_at desc limit 1)t) ultima_triagem,
 (select count(*) from public.prontuario_evolucoes pe where pe.atendimento_id=a.id) total_evolucoes,
 (select count(*) from public.prescricoes pr where pr.atendimento_id=a.id) total_prescricoes,
 (select count(*) from public.internacoes i where i.atendimento_id=a.id and i.status in ('aguardando_leito','internado','transferido')) internacoes_ativas
from public.atendimentos a join public.pacientes p on p.id=a.paciente_id;

create or replace view public.vw_diretoria_indicadores with (security_invoker=true) as
select u.empresa_id,u.id unidade_id,
 (select count(*) from public.atendimentos a where a.unidade_id=u.id and a.data_abertura::date=current_date) atendimentos_hoje,
 (select count(*) from public.internacoes i where i.unidade_id=u.id and i.status in ('internado','transferido')) pacientes_internados,
 (select coalesce(sum(cf.valor_liquido),0) from public.contas_faturamento cf where cf.unidade_id=u.id and cf.competencia=to_char(current_date,'YYYY-MM')) faturamento_competencia,
 (select coalesce(sum(fr.valor_liquido_previsto-fr.valor_recebido),0) from public.financeiro_recebiveis fr where fr.unidade_id=u.id and fr.status in ('previsto','faturado','aguardando_pagamento','parcial','vencido')) contas_receber_aberto,
 (select coalesce(sum(fp.valor_bruto-fp.valor_pago),0) from public.financeiro_contas_pagar fp where fp.unidade_id=u.id and fp.status in ('aberto','parcial','vencido')) contas_pagar_aberto,
 (select coalesce(sum(g.valor_glosado),0) from public.tiss_glosas g where g.unidade_id=u.id and g.status in ('aberta','em_recurso')) glosas_abertas,
 (select count(*) from public.auditoria_contas ac where ac.unidade_id=u.id and ac.status in ('aguardando','em_auditoria','pendencia_assistencial','pendencia_autorizacao','pendencia_documental','devolvida')) contas_em_auditoria,
 (select count(*) from public.contas_medicas_processos cm where cm.unidade_id=u.id and cm.status not in ('liberada_tiss','cancelada')) contas_medicas_pendentes
from public.unidades u;

grant select on public.vw_atendimento_contexto_clinico,public.vw_diretoria_indicadores to authenticated;

-- --------------------------------------------------------------------------
-- 14. STORAGE
-- --------------------------------------------------------------------------
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
('documentos-pacientes','documentos-pacientes',false,10485760,array['application/pdf','image/jpeg','image/png']),
('prontuarios','prontuarios',false,10485760,array['application/pdf']),
('documentos-medicos','documentos-medicos',false,10485760,array['application/pdf']),
('resultados-laudos','resultados-laudos',false,26214400,array['application/pdf','image/jpeg','image/png']),
('anexos-autorizacao','anexos-autorizacao',false,10485760,array['application/pdf','image/jpeg','image/png']),
('anexos-faturamento','anexos-faturamento',false,10485760,array['application/pdf','text/xml']),
('glosas-recursos','glosas-recursos',false,10485760,array['application/pdf','text/xml']),
('cadastros-fotos','cadastros-fotos',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy storage_clinico_select on storage.objects for select to authenticated using(bucket_id in ('documentos-pacientes','prontuarios','documentos-medicos','resultados-laudos','anexos-autorizacao','anexos-faturamento','glosas-recursos') and public.tem_unidade(((storage.foldername(name))[1])::uuid,((storage.foldername(name))[2])::uuid));
create policy storage_clinico_insert on storage.objects for insert to authenticated with check(bucket_id in ('documentos-pacientes','prontuarios','documentos-medicos','resultados-laudos','anexos-autorizacao','anexos-faturamento','glosas-recursos') and array_length(storage.foldername(name),1)>=2 and public.tem_unidade(((storage.foldername(name))[1])::uuid,((storage.foldername(name))[2])::uuid));
create policy cadastros_fotos_select on storage.objects for select to authenticated using(bucket_id='cadastros-fotos' and exists(select 1 from public.usuario_empresas ue where ue.usuario_id=auth.uid() and ue.ativo and ue.empresa_id::text=(storage.foldername(name))[1]));
create policy cadastros_fotos_insert on storage.objects for insert to authenticated with check(bucket_id='cadastros-fotos' and exists(select 1 from public.usuario_empresas ue where ue.usuario_id=auth.uid() and ue.ativo and ue.empresa_id::text=(storage.foldername(name))[1]));
create policy cadastros_fotos_update on storage.objects for update to authenticated using(bucket_id='cadastros-fotos' and exists(select 1 from public.usuario_empresas ue where ue.usuario_id=auth.uid() and ue.ativo and ue.empresa_id::text=(storage.foldername(name))[1])) with check(bucket_id='cadastros-fotos' and exists(select 1 from public.usuario_empresas ue where ue.usuario_id=auth.uid() and ue.ativo and ue.empresa_id::text=(storage.foldername(name))[1]));

-- --------------------------------------------------------------------------
-- 15. DADOS BASE E CENARIO DE TESTES
-- Tudo que e teste usa prefixo [TESTE] ou codigo TESTE_*.
-- --------------------------------------------------------------------------
insert into public.tiss_versoes(id,codigo,organizacional,conteudo_estrutura,tuss,seguranca_privacidade,comunicacao_principal,comunicacao_secundaria,fonte_oficial,vigente_desde)
values('90000000-0000-4000-8000-000000000001','2026-07','202607','202511','202607','202511','04.03.00','01.06.00','https://www.gov.br/ans/pt-br/assuntos/prestadores/padrao-para-troca-de-informacao-de-saude-suplementar-2013-tiss/padrao-tiss-julho-2026','2026-07-01');

insert into public.tipos_profissional(id,codigo,nome,ordem) values
('21000000-0000-4000-8000-000000000001','medico','Medico(a)',10),
('21000000-0000-4000-8000-000000000002','enfermagem','Enfermagem',20),
('21000000-0000-4000-8000-000000000003','administrativo','Administrativo',110),
('21000000-0000-4000-8000-000000000004','farmacia','Farmacia',90),
('21000000-0000-4000-8000-000000000005','outro','Outro',999);

do $$
declare
  v_admin uuid;
  v_empresa uuid:='10000000-0000-4000-8000-000000000001';
  v_unidade uuid:='10000000-0000-4000-8000-000000000002';
  v_perfil_admin uuid:='11000000-0000-4000-8000-000000000001';
  v_perfil_recepcao uuid:='11000000-0000-4000-8000-000000000002';
  v_perfil_medico uuid:='11000000-0000-4000-8000-000000000003';
  v_perfil_enfermagem uuid:='11000000-0000-4000-8000-000000000004';
  v_medico uuid:='30000000-0000-4000-8000-000000000001';
  v_enfermagem uuid:='30000000-0000-4000-8000-000000000002';
  v_recepcao uuid:='30000000-0000-4000-8000-000000000003';
  v_paciente uuid:='70000000-0000-4000-8000-000000000001';
  v_convenio uuid:='40000000-0000-4000-8000-000000000001';
  v_plano uuid:='40000000-0000-4000-8000-000000000002';
  v_contrato uuid:='40000000-0000-4000-8000-000000000003';
  v_atendimento uuid:='72000000-0000-4000-8000-000000000001';
  v_conta uuid:='74000000-0000-4000-8000-000000000001';
  v_auditoria uuid:='74000000-0000-4000-8000-000000000002';
  v_processo uuid:='74000000-0000-4000-8000-000000000003';
  v_guia uuid:='75000000-0000-4000-8000-000000000001';
  v_lote uuid:='75000000-0000-4000-8000-000000000002';
  v_protocolo uuid:='75000000-0000-4000-8000-000000000003';
  v_glosa uuid:='75000000-0000-4000-8000-000000000004';
  v_fornecedor uuid:='50000000-0000-4000-8000-000000000001';
  v_produto uuid:='50000000-0000-4000-8000-000000000002';
  v_local_almox uuid:='50000000-0000-4000-8000-000000000003';
  v_local_farm uuid:='50000000-0000-4000-8000-000000000004';
  v_fonte_proc uuid:='60000000-0000-4000-8000-000000000001';
  v_edicao_proc uuid:='60000000-0000-4000-8000-000000000002';
  v_item_proc uuid:='60000000-0000-4000-8000-000000000003';
begin
  select id into v_admin from public.usuarios where ativo and not bloqueado order by created_at,id limit 1;
  if v_admin is null then raise exception 'RESET_ABORTADO_SEM_USUARIO_AUTH: nenhum usuario foi preservado/restaurado'; end if;

  insert into public.empresas(id,razao_social,nome_fantasia,cnpj,created_by,updated_by)
  values(v_empresa,'[TESTE] MedSync Hospital','[TESTE] MedSync','99999999000199',v_admin,v_admin);
  insert into public.unidades(id,empresa_id,nome,cnes,created_by,updated_by)
  values(v_unidade,v_empresa,'[TESTE] Unidade Principal','9999999',v_admin,v_admin);

  insert into public.setores(id,empresa_id,unidade_id,nome,created_by,updated_by) values
  ('12000000-0000-4000-8000-000000000001',v_empresa,v_unidade,'Recepcao',v_admin,v_admin),
  ('12000000-0000-4000-8000-000000000002',v_empresa,v_unidade,'Triagem',v_admin,v_admin),
  ('12000000-0000-4000-8000-000000000003',v_empresa,v_unidade,'Consultorios',v_admin,v_admin),
  ('12000000-0000-4000-8000-000000000004',v_empresa,v_unidade,'Enfermagem',v_admin,v_admin),
  ('12000000-0000-4000-8000-000000000005',v_empresa,v_unidade,'Farmacia',v_admin,v_admin),
  ('12000000-0000-4000-8000-000000000006',v_empresa,v_unidade,'Laboratorio',v_admin,v_admin),
  ('12000000-0000-4000-8000-000000000007',v_empresa,v_unidade,'Imagem',v_admin,v_admin),
  ('12000000-0000-4000-8000-000000000008',v_empresa,v_unidade,'Internacao',v_admin,v_admin),
  ('12000000-0000-4000-8000-000000000009',v_empresa,v_unidade,'Faturamento',v_admin,v_admin),
  ('12000000-0000-4000-8000-000000000010',v_empresa,v_unidade,'Auditoria',v_admin,v_admin),
  ('12000000-0000-4000-8000-000000000011',v_empresa,v_unidade,'Almoxarifado',v_admin,v_admin);
  insert into public.locais(id,empresa_id,unidade_id,setor_id,tipo,nome,created_by,updated_by) values
  ('13000000-0000-4000-8000-000000000001',v_empresa,v_unidade,'12000000-0000-4000-8000-000000000003','consultorio','Consultorio 01',v_admin,v_admin),
  ('13000000-0000-4000-8000-000000000002',v_empresa,v_unidade,'12000000-0000-4000-8000-000000000008','leito','Leito Teste 01',v_admin,v_admin);

  insert into public.perfis(id,empresa_id,nome,sistema,created_by,updated_by) values
  (v_perfil_admin,v_empresa,'Administrador',true,v_admin,v_admin),
  (v_perfil_recepcao,v_empresa,'Recepcao',true,v_admin,v_admin),
  (v_perfil_medico,v_empresa,'Medico',true,v_admin,v_admin),
  (v_perfil_enfermagem,v_empresa,'Enfermagem',true,v_admin,v_admin),
  ('11000000-0000-4000-8000-000000000005',v_empresa,'Faturamento',true,v_admin,v_admin),
  ('11000000-0000-4000-8000-000000000006',v_empresa,'Auditoria',true,v_admin,v_admin),
  ('11000000-0000-4000-8000-000000000007',v_empresa,'Financeiro',true,v_admin,v_admin),
  ('11000000-0000-4000-8000-000000000008',v_empresa,'Compras e Estoque',true,v_admin,v_admin);

  insert into public.perfil_permissoes(perfil_id,permissao_id,created_by)
  select v_perfil_admin,p.id,v_admin from public.permissoes p where p.ativo on conflict do nothing;
  insert into public.perfil_permissoes(perfil_id,permissao_id,created_by)
  select v_perfil_recepcao,p.id,v_admin from public.permissoes p where p.codigo in ('pacientes.visualizar','pacientes.criar','pacientes.editar','recepcao.visualizar','atendimentos.visualizar','atendimentos.abrir','atendimentos.transferir','agenda.visualizar','agenda.criar','agenda.editar','senhas.visualizar','senhas.chamar','autorizacoes.visualizar','autorizacoes.editar') on conflict do nothing;
  insert into public.perfil_permissoes(perfil_id,permissao_id,created_by)
  select v_perfil_medico,p.id,v_admin from public.permissoes p where p.codigo in ('pacientes.visualizar','atendimentos.visualizar','fila_medica.visualizar','fila_medica.assumir','prontuario.visualizar','prontuario.evoluir','prescricao.visualizar','prescricao.criar','exames.visualizar','exames.gerenciar','internacao.visualizar','internacao.criar') on conflict do nothing;
  insert into public.perfil_permissoes(perfil_id,permissao_id,created_by)
  select v_perfil_enfermagem,p.id,v_admin from public.permissoes p where p.codigo in ('pacientes.visualizar','atendimentos.visualizar','triagem.registrar','triagem.encaminhar','prontuario.visualizar','prontuario.evoluir','prescricao.visualizar','internacao.visualizar','enfermagem.visualizar','enfermagem.gerenciar') on conflict do nothing;

  insert into public.usuario_empresas(usuario_id,empresa_id,created_by,updated_by) values(v_admin,v_empresa,v_admin,v_admin);
  insert into public.usuario_unidades(usuario_id,empresa_id,unidade_id,created_by,updated_by) values(v_admin,v_empresa,v_unidade,v_admin,v_admin);
  insert into public.usuario_perfis(usuario_id,empresa_id,unidade_id,perfil_id,created_by,updated_by) values(v_admin,v_empresa,v_unidade,v_perfil_admin,v_admin,v_admin);

  insert into public.catalogos(id,empresa_id,tipo,codigo,descricao,created_by,updated_by) values
  ('20000000-0000-4000-8000-000000000001',v_empresa,'tipo_profissional','medico','Medico(a)',v_admin,v_admin),
  ('20000000-0000-4000-8000-000000000002',v_empresa,'tipo_profissional','enfermagem','Enfermagem',v_admin,v_admin),
  ('20000000-0000-4000-8000-000000000003',v_empresa,'tipo_profissional','recepcionista','Recepcionista',v_admin,v_admin),
  ('20000000-0000-4000-8000-000000000010',v_empresa,'especialidade','clinica_medica','Clinica Medica',v_admin,v_admin),
  ('20000000-0000-4000-8000-000000000011',v_empresa,'especialidade','enfermagem','Enfermagem',v_admin,v_admin),
  ('20000000-0000-4000-8000-000000000020',v_empresa,'cbo','225125','Medico Clinico',v_admin,v_admin),
  ('20000000-0000-4000-8000-000000000021',v_empresa,'cbo','223505','Enfermeiro',v_admin,v_admin),
  ('20000000-0000-4000-8000-000000000022',v_empresa,'cbo','422105','Recepcionista',v_admin,v_admin),
  ('20000000-0000-4000-8000-000000000030',v_empresa,'tipo_atendimento','consulta_teste','Consulta de teste',v_admin,v_admin),
  ('20000000-0000-4000-8000-000000000040',v_empresa,'tuss','TESTE-CONSULTA','Procedimento ficticio para testes',v_admin,v_admin);

  insert into public.profissionais(id,empresa_id,usuario_id,nome_completo,cpf,conselho,numero_conselho,uf_conselho,especialidade,cbo,tipo_profissional_id,tipo_profissional_catalogo_id,telefone,email,created_by,updated_by) values
  (v_medico,v_empresa,v_admin,'[TESTE] Dr. Medico','00000000001','CRM','999999','SP','Clinica Medica','225125','21000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','11999990001','medico.teste@medsync.invalid',v_admin,v_admin),
  (v_enfermagem,v_empresa,null,'[TESTE] Enfermeiro','00000000002','COREN','999998','SP','Enfermagem','223505','21000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','11999990002','enfermagem.teste@medsync.invalid',v_admin,v_admin),
  (v_recepcao,v_empresa,null,'[TESTE] Recepcionista','00000000003',null,null,null,'Recepcao','422105','21000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000003','11999990003','recepcao.teste@medsync.invalid',v_admin,v_admin);
  insert into public.profissional_contratos(id,empresa_id,profissional_id,tipo_contrato,data_inicio,tipo_remuneracao,valor_remuneracao,created_by,updated_by) values
  ('31000000-0000-4000-8000-000000000001',v_empresa,v_medico,'prestador',current_date-30,'procedimento',150,v_admin,v_admin),
  ('31000000-0000-4000-8000-000000000002',v_empresa,v_enfermagem,'clt',current_date-30,'mensal',5000,v_admin,v_admin),
  ('31000000-0000-4000-8000-000000000003',v_empresa,v_recepcao,'clt',current_date-30,'mensal',2500,v_admin,v_admin);

  insert into public.pacientes(id,empresa_id,nome_completo,cpf,cns,rg,data_nascimento,sexo,nacionalidade,estado_civil,telefone,email,cep,logradouro,numero,bairro,cidade,uf,created_by,updated_by)
  values(v_paciente,v_empresa,'[TESTE] Paciente MedSync','00000000000','000000000000000','TESTE-RG','1990-01-01','nao_informado','brasileiro','solteiro','11999990010','paciente.teste@medsync.invalid','01001000','Praca da Se','1','Se','Sao Paulo','SP',v_admin,v_admin);
  insert into public.paciente_emails(paciente_id,email,principal) values(v_paciente,'paciente.teste@medsync.invalid',true);
  insert into public.paciente_telefones(paciente_id,telefone,tipo,whatsapp,principal) values(v_paciente,'11999990010','celular',true,true);
  insert into public.paciente_enderecos(paciente_id,cep,endereco,numero,bairro,cidade,estado,tipo,principal) values(v_paciente,'01001000','Praca da Se','1','Se','Sao Paulo','SP','residencial',true);

  insert into public.convenios(id,empresa_id,registro_ans,razao_social,nome_fantasia,telefone,email,created_by,updated_by)
  values(v_convenio,v_empresa,'999999','[TESTE] Operadora de Saude','[TESTE] Convenio','1130000000','convenio.teste@medsync.invalid',v_admin,v_admin);
  insert into public.convenio_planos(id,empresa_id,convenio_id,codigo,nome,acomodacao,created_by,updated_by)
  values(v_plano,v_empresa,v_convenio,'TESTE','[TESTE] Plano Basico','apartamento',v_admin,v_admin);
  insert into public.credenciamento_contratos(id,empresa_id,convenio_id,unidade_id,numero_contrato,data_inicio,status,prazo_pagamento_dias,created_by,updated_by)
  values(v_contrato,v_empresa,v_convenio,v_unidade,'CONTRATO-TESTE',current_date-30,'ativo',30,v_admin,v_admin);

  insert into public.tabelas_procedimentos_fontes(id,empresa_id,codigo,nome,metodologia,created_by)
  values(v_fonte_proc,v_empresa,'TESTE_PROC','[TESTE] Tabela de Procedimentos','tabela_propria',v_admin);
  insert into public.tabelas_procedimentos_edicoes(id,fonte_id,nome_edicao,referencia,vigencia_inicio,status,created_by)
  values(v_edicao_proc,v_fonte_proc,'[TESTE] Edicao 1','TESTE',current_date-30,'ativa',v_admin);
  insert into public.tabelas_procedimentos_itens(id,edicao_id,codigo,codigo_tuss,descricao,tipo_item,valor_fixo)
  values(v_item_proc,v_edicao_proc,'TESTE-CONSULTA','TESTE-CONSULTA','[TESTE] Consulta ficticia','consulta',150);
  insert into public.contrato_regras_procedimentos(id,contrato_id,categoria,fonte_id,modo_edicao,percentual_ajuste,vigencia_inicio,created_by)
  values('60000000-0000-4000-8000-000000000004',v_contrato,'procedimentos',v_fonte_proc,'vigente_data',0,current_date-30,v_admin);
  insert into public.contrato_regras_faturamento(id,contrato_id,categoria,codigo_regra,descricao,percentual,prioridade,vigencia_inicio)
  values('62000000-0000-4000-8000-000000000001',v_contrato,'procedimentos','MULTIPLO_2','[TESTE] Segundo procedimento a 50%',50,10,current_date-30);
  insert into public.contrato_pacotes(id,contrato_id,codigo,nome,valor,vigencia_inicio,inclusoes)
  values('62000000-0000-4000-8000-000000000002',v_contrato,'PACOTE-TESTE','[TESTE] Pacote exemplo',300,current_date-30,'["TESTE-CONSULTA"]'::jsonb);
  insert into public.contrato_pacote_itens(id,pacote_id,codigo,quantidade_inclusa,cobranca_excedente)
  values('62000000-0000-4000-8000-000000000003','62000000-0000-4000-8000-000000000002','TESTE-CONSULTA',1,true);

  insert into public.tabelas_comerciais_fontes(id,empresa_id,codigo,nome,tipo,created_by)
  values('61000000-0000-4000-8000-000000000001',v_empresa,'TESTE_MAT','[TESTE] Tabela Materiais','propria_convenio',v_admin);
  insert into public.tabelas_comerciais_edicoes(id,fonte_id,convenio_id,nome_edicao,vigencia_inicio,status,metodo_calculo,created_by)
  values('61000000-0000-4000-8000-000000000002','61000000-0000-4000-8000-000000000001',v_convenio,'[TESTE] Edicao 1',current_date-30,'vigente','fixo',v_admin);
  insert into public.tabelas_comerciais_itens(id,edicao_id,codigo,descricao,unidade,valor_referencia)
  values('61000000-0000-4000-8000-000000000003','61000000-0000-4000-8000-000000000002','TESTE-MAT','[TESTE] Material ficticio','UN',25);
  insert into public.contrato_tabelas_comerciais(id,contrato_id,fonte_id,categoria,modo_edicao,percentual_ajuste,prioridade)
  values('61000000-0000-4000-8000-000000000004',v_contrato,'61000000-0000-4000-8000-000000000001','materiais','vigente_na_data',0,10);

  insert into public.fornecedores(id,empresa_id,razao_social,nome_fantasia,cnpj,email,telefone,created_by,updated_by)
  values(v_fornecedor,v_empresa,'[TESTE] Fornecedor MedSync','[TESTE] Fornecedor','99999999000198','fornecedor.teste@medsync.invalid','1130000001',v_admin,v_admin);
  insert into public.estoque_produtos(id,empresa_id,codigo,descricao,tipo,unidade_medida,estoque_minimo,created_by,updated_by)
  values(v_produto,v_empresa,'TESTE-MAT','[TESTE] Material hospitalar','material','UN',10,v_admin,v_admin);
  insert into public.estoque_locais(id,empresa_id,unidade_id,nome,tipo) values
  (v_local_almox,v_empresa,v_unidade,'[TESTE] Almoxarifado Central','almoxarifado'),
  (v_local_farm,v_empresa,v_unidade,'[TESTE] Farmacia Central','farmacia');
  insert into public.estoque_lotes(id,empresa_id,unidade_id,local_id,produto_id,fornecedor_id,numero_lote,validade,quantidade,custo_unitario)
  values('50000000-0000-4000-8000-000000000005',v_empresa,v_unidade,v_local_almox,v_produto,v_fornecedor,'LOTE-TESTE',current_date+365,100,10);

  insert into public.compras_solicitacoes(id,empresa_id,unidade_id,numero,solicitante_id,setor,justificativa,prioridade,status)
  values('77000000-0000-4000-8000-000000000001',v_empresa,v_unidade,'SC-TESTE-001',v_admin,'Almoxarifado','[TESTE] Reposicao de estoque','normal','solicitada');
  insert into public.compras_solicitacao_itens(id,solicitacao_id,produto_id,descricao,quantidade,unidade_medida)
  values('77000000-0000-4000-8000-000000000002','77000000-0000-4000-8000-000000000001',v_produto,'[TESTE] Material hospitalar',20,'UN');

  insert into public.agendamentos(id,empresa_id,unidade_id,paciente_id,profissional_id,convenio_id,inicio,fim,status,tipo_atendimento,observacoes,created_by,updated_by)
  values('71000000-0000-4000-8000-000000000001',v_empresa,v_unidade,v_paciente,v_medico,v_convenio,now()+interval '1 day',now()+interval '1 day 30 minutes','agendado','consulta_teste','[TESTE] Agendamento para validacao do fluxo',v_admin,v_admin);

  insert into public.atendimentos(id,empresa_id,unidade_id,paciente_id,profissional_id,tipo_atendimento,origem,status,cobertura,convenio_id,plano_id,numero_carteirinha,numero_autorizacao,senha_autorizacao,paciente_nome,paciente_cpf,paciente_cns,paciente_data_nascimento,paciente_sexo,paciente_telefone,paciente_email,paciente_cep,paciente_endereco,paciente_numero,paciente_bairro,paciente_cidade,paciente_estado,especialidade_destino,triagem_concluida_em,setor_atual,data_abertura,data_fechamento,created_by,updated_by)
  values(v_atendimento,v_empresa,v_unidade,v_paciente,v_medico,'consulta_teste','seed','alta','convenio',v_convenio,v_plano,'CARTEIRA-TESTE','AUT-TESTE','SENHA-TESTE','[TESTE] Paciente MedSync','00000000000','000000000000000','1990-01-01','nao_informado','11999990010','paciente.teste@medsync.invalid','01001000','Praca da Se','1','Se','Sao Paulo','SP','Clinica Medica',now()-interval '2 days 2 hours','alta',now()-interval '2 days 3 hours',now()-interval '2 days',v_admin,v_admin);
  insert into public.triagens(id,empresa_id,unidade_id,atendimento_id,peso_kg,altura_cm,pressao_arterial,frequencia_cardiaca,saturacao_o2,temperatura_c,dor_escala,classificacao_risco,queixa_principal,created_by,updated_by)
  values('72000000-0000-4000-8000-000000000002',v_empresa,v_unidade,v_atendimento,70,170,'120/80',72,98,36.5,0,'verde','[TESTE] Avaliacao sem queixas reais',v_admin,v_admin);
  insert into public.autorizacoes_atendimento(id,empresa_id,unidade_id,atendimento_id,paciente_id,convenio_id,plano_id,numero_guia_prestador,numero_guia_operadora,senha_autorizacao,validade,status,observacao,created_by,updated_by)
  values('72000000-0000-4000-8000-000000000003',v_empresa,v_unidade,v_atendimento,v_paciente,v_convenio,v_plano,'GUIA-TESTE','OPER-TESTE','SENHA-TESTE',current_date+30,'autorizada','[TESTE] Autorizacao ficticia',v_admin,v_admin);
  insert into public.encaminhamentos_assistenciais(id,empresa_id,unidade_id,atendimento_id,paciente_id,origem,especialidade,profissional_id,status,prioridade,created_by,concluido_em,updated_by)
  values('72000000-0000-4000-8000-000000000004',v_empresa,v_unidade,v_atendimento,v_paciente,'triagem','Clinica Medica',v_medico,'concluido','normal',v_admin,now()-interval '2 days',v_admin);
  insert into public.prontuario_evolucoes(id,empresa_id,unidade_id,atendimento_id,profissional_id,tipo_evolucao,texto_livre,assinado_em,created_by,updated_by)
  values('72000000-0000-4000-8000-000000000005',v_empresa,v_unidade,v_atendimento,v_medico,'evolucao','[TESTE] Evolucao ficticia sem valor clinico.',now()-interval '2 days',v_admin,v_admin);
  insert into public.prescricoes(id,empresa_id,unidade_id,atendimento_id,profissional_id,tipo,item,instrucoes,status,created_by,updated_by)
  values('72000000-0000-4000-8000-000000000006',v_empresa,v_unidade,v_atendimento,v_medico,'cuidado','[TESTE] Orientacao ficticia','Registro criado apenas para teste do modulo.','concluida',v_admin,v_admin);
  insert into public.solicitacoes_exames(id,empresa_id,unidade_id,atendimento_id,profissional_id,modalidade,exame,codigo_tuss,indicacao_clinica,status,resultado_resumo,resultado_em,created_by,updated_by)
  values('72000000-0000-4000-8000-000000000007',v_empresa,v_unidade,v_atendimento,v_medico,'laboratorio','[TESTE] Exame laboratorial','TESTE-EXAME','[TESTE] Indicacao ficticia','liberado','[TESTE] Resultado ficticio',now()-interval '2 days',v_admin,v_admin);

  insert into public.central_guias(id,empresa_id,unidade_id,atendimento_id,paciente_id,convenio_id,plano_id,tipo,numero_guia_prestador,numero_guia_operadora,senha,status,quantidade_solicitada,quantidade_autorizada,codigo_procedimento,descricao_procedimento,categoria_preco,valor_contratual,valor_solicitado,valor_autorizado,created_by,updated_by)
  values('73000000-0000-4000-8000-000000000001',v_empresa,v_unidade,v_atendimento,v_paciente,v_convenio,v_plano,'consulta','GUIA-TESTE','OPER-TESTE','SENHA-TESTE','autorizada',1,1,'TESTE-CONSULTA','[TESTE] Consulta ficticia','procedimentos',150,150,150,v_admin,v_admin);

  insert into public.contas_faturamento(id,empresa_id,unidade_id,atendimento_id,paciente_id,convenio_id,plano_id,competencia,tipo_cobranca,status,valor_bruto,valor_liquido,auditoria_liberada,contas_medicas_liberada,contas_medicas_liberada_em,fechada_em,faturada_em,created_by,updated_by)
  values(v_conta,v_empresa,v_unidade,v_atendimento,v_paciente,v_convenio,v_plano,to_char(current_date,'YYYY-MM'),'convenio','faturada',150,150,true,true,now()-interval '1 day',now()-interval '2 days',now()-interval '1 day',v_admin,v_admin);
  insert into public.conta_faturamento_grupos_ato(id,conta_id,codigo_grupo,data_ato,via_acesso,acomodacao,observacoes)
  values('74000000-0000-4000-8000-000000000010',v_conta,'ATO-TESTE',current_date-2,'unica','apartamento','[TESTE] Grupo de ato');
  insert into public.conta_faturamento_itens(id,conta_id,origem_tipo,data_execucao,tabela,codigo,descricao,quantidade,valor_unitario,valor_total,profissional_id,grupo_ato_id,sequencia_ato,valor_referencia,valor_contratual_calculado,metodologia_preco,tabela_procedimento_edicao_id,tabela_procedimento_item_id,memoria_calculo)
  values('74000000-0000-4000-8000-000000000011',v_conta,'procedimento',now()-interval '2 days','TESTE','TESTE-CONSULTA','[TESTE] Consulta ficticia',1,150,150,v_medico,'74000000-0000-4000-8000-000000000010',1,150,150,'tabela_propria',v_edicao_proc,v_item_proc,'{"seed":true}'::jsonb);
  insert into public.auditoria_contas(id,empresa_id,unidade_id,atendimento_id,conta_id,auditor_id,status,iniciado_em,finalizado_em,observacoes)
  values(v_auditoria,v_empresa,v_unidade,v_atendimento,v_conta,v_admin,'liberada',now()-interval '2 days',now()-interval '1 day 12 hours','[TESTE] Auditoria liberada');
  update public.contas_faturamento set auditoria_id=v_auditoria where id=v_conta;
  insert into public.contas_medicas_processos(id,empresa_id,unidade_id,conta_id,atendimento_id,paciente_id,convenio_id,status,total_itens,total_autorizado,total_conta,concluido_em,analisado_por)
  values(v_processo,v_empresa,v_unidade,v_conta,v_atendimento,v_paciente,v_convenio,'liberada_tiss',1,150,150,now()-interval '1 day',v_admin);
  insert into public.contas_medicas_checklist_modelos(id,empresa_id,convenio_id,tipo_conta,codigo,descricao,obrigatorio,categoria_documento,ordem)
  values('74000000-0000-4000-8000-000000000020',v_empresa,v_convenio,'geral','GUIA_AUT','[TESTE] Guia/autorizacao conferida',true,'autorizacao',10);
  insert into public.contas_medicas_checklist_itens(id,processo_id,modelo_id,codigo,descricao,obrigatorio,categoria_documento,status,observacoes,conferido_em,conferido_por)
  values('74000000-0000-4000-8000-000000000021',v_processo,'74000000-0000-4000-8000-000000000020','GUIA_AUT','[TESTE] Guia/autorizacao conferida',true,'autorizacao','ok','[TESTE] Item ficticio',now()-interval '1 day',v_admin);

  insert into public.tiss_guias(id,empresa_id,unidade_id,conta_id,atendimento_id,paciente_id,convenio_id,plano_id,profissional_id,versao_id,tipo_guia,numero_guia_prestador,numero_guia_operadora,registro_ans,numero_carteirinha,senha_autorizacao,tipo_atendimento,data_atendimento,status,valor_total,created_by,updated_by)
  values(v_guia,v_empresa,v_unidade,v_conta,v_atendimento,v_paciente,v_convenio,v_plano,v_medico,'90000000-0000-4000-8000-000000000001','consulta','TISS-TESTE-001','OPER-TESTE','999999','CARTEIRA-TESTE','SENHA-TESTE','consulta_teste',current_date-2,'enviada',150,v_admin,v_admin);
  insert into public.tiss_guia_itens(id,guia_id,sequencial,data_execucao,tabela,codigo_procedimento,descricao,quantidade,valor_unitario,valor_total)
  values('75000000-0000-4000-8000-000000000010',v_guia,1,current_date-2,'TESTE','TESTE-CONSULTA','[TESTE] Consulta ficticia',1,150,150);
  insert into public.tiss_lotes(id,empresa_id,unidade_id,convenio_id,versao_id,numero_lote,competencia,status,protocolo_operadora,enviado_em,previsao_pagamento,quantidade_guias,valor_total,xsd_validado,created_by)
  values(v_lote,v_empresa,v_unidade,v_convenio,'90000000-0000-4000-8000-000000000001','LOTE-TESTE-001',to_char(current_date,'YYYY-MM'),'protocolado','PROTOCOLO-TESTE',now()-interval '1 day',current_date+30,1,150,true,v_admin);
  insert into public.tiss_lote_guias(lote_id,guia_id) values(v_lote,v_guia);
  insert into public.tiss_protocolos(id,empresa_id,unidade_id,lote_id,numero_protocolo,data_protocolo,status,valor_apresentado,valor_processado,valor_liberado,valor_glosa,observacoes,created_by)
  values(v_protocolo,v_empresa,v_unidade,v_lote,'PROTOCOLO-TESTE',current_date-1,'processado',150,150,140,10,'[TESTE] Demonstrativo ficticio',v_admin);
  insert into public.tiss_glosas(id,empresa_id,unidade_id,protocolo_id,lote_id,guia_id,guia_item_id,codigo_glosa,descricao_glosa,valor_glosado,status,origem)
  values(v_glosa,v_empresa,v_unidade,v_protocolo,v_lote,v_guia,'75000000-0000-4000-8000-000000000010','TESTE-GL','[TESTE] Glosa ficticia',10,'em_recurso','demonstrativo');
  insert into public.tiss_recursos_glosa(id,empresa_id,unidade_id,convenio_id,protocolo_id,numero_recurso,status,valor_total_recursado,created_by,updated_by)
  values('75000000-0000-4000-8000-000000000005',v_empresa,v_unidade,v_convenio,v_protocolo,'RECURSO-TESTE-001','rascunho',10,v_admin,v_admin);
  insert into public.tiss_recurso_itens(id,recurso_id,glosa_id,valor_recursado,justificativa)
  values('75000000-0000-4000-8000-000000000006','75000000-0000-4000-8000-000000000005',v_glosa,10,'[TESTE] Justificativa ficticia para validacao do modulo.');

  insert into public.financeiro_recebiveis(id,empresa_id,unidade_id,lote_id,convenio_id,competencia,previsao_pagamento,valor_bruto,valor_glosa,valor_liquido_previsto,status,created_by,updated_by)
  values('76000000-0000-4000-8000-000000000001',v_empresa,v_unidade,v_lote,v_convenio,to_char(current_date,'YYYY-MM'),current_date+30,150,10,140,'aguardando_pagamento',v_admin,v_admin);
  insert into public.nfse_configuracoes(id,empresa_id,unidade_id,municipio_ibge,municipio_nome,uf,provedor,modo,ambiente,ativo,created_by,updated_by)
  values('76000000-0000-4000-8000-000000000002',v_empresa,v_unidade,'3550308','Sao Paulo','SP','[TESTE] Manual','manual','homologacao',true,v_admin,v_admin);
  insert into public.notas_fiscais_servico(id,empresa_id,unidade_id,lote_id,convenio_id,configuracao_id,competencia,tomador_razao_social,valor_servicos,valor_liquido,status,created_by,updated_by)
  values('76000000-0000-4000-8000-000000000003',v_empresa,v_unidade,v_lote,v_convenio,'76000000-0000-4000-8000-000000000002',to_char(current_date,'YYYY-MM'),'[TESTE] Operadora de Saude',150,150,'rascunho',v_admin,v_admin);

  insert into public.configuracoes_painel_chamadas(id,empresa_id,unidade_id,updated_by)
  values('14000000-0000-4000-8000-000000000001',v_empresa,v_unidade,v_admin);
end $$;

-- --------------------------------------------------------------------------
-- 16. GRANTS / REALTIME / DIAGNOSTICO
-- --------------------------------------------------------------------------
grant usage,select on all sequences in schema public to authenticated,service_role;
grant select,insert,update,delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant select on public.tipos_profissional to authenticated;
revoke all on all tables in schema public from anon;
-- Execucoes publicas do Totem foram concedidas individualmente acima.

-- Defaults para objetos futuros criados pelo papel que executa a baseline.
alter default privileges in schema public grant select,insert,update,delete on tables to authenticated;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant usage,select on sequences to authenticated,service_role;

-- Realtime nas filas principais, quando a publicacao padrao existir.
do $$
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    begin execute 'alter publication supabase_realtime add table public.senhas_atendimento'; exception when duplicate_object then null; end;
    begin execute 'alter publication supabase_realtime add table public.encaminhamentos_assistenciais'; exception when duplicate_object then null; end;
    begin execute 'alter publication supabase_realtime add table public.filas_setoriais'; exception when duplicate_object then null; end;
  end if;
end $$;

create or replace function public.validar_schema_his()
returns table(grupo text,objeto text,status text,detalhe text)
language plpgsql security definer set search_path=public,pg_catalog as $$
declare r record;
begin
  for r in select * from (values
    ('core','empresas','public.empresas'),('core','unidades','public.unidades'),('core','usuarios','public.usuarios'),
    ('core','pacientes','public.pacientes'),('core','profissionais','public.profissionais'),('core','convenios','public.convenios'),('core','atendimentos','public.atendimentos'),
    ('assistencial','triagens','public.triagens'),('assistencial','prontuario_evolucoes','public.prontuario_evolucoes'),('assistencial','prescricoes','public.prescricoes'),
    ('assistencial','internacoes','public.internacoes'),('assistencial','solicitacoes_exames','public.solicitacoes_exames'),('assistencial','senhas_atendimento','public.senhas_atendimento'),
    ('corporativo','fornecedores','public.fornecedores'),('corporativo','estoque_produtos','public.estoque_produtos'),('corporativo','compras_solicitacoes','public.compras_solicitacoes'),
    ('corporativo','auditoria_contas','public.auditoria_contas'),('corporativo','central_guias','public.central_guias'),('corporativo','credenciamento_contratos','public.credenciamento_contratos'),
    ('corporativo','ged_documentos','public.ged_documentos'),('corporativo','contas_medicas_processos','public.contas_medicas_processos'),
    ('faturamento','contas_faturamento','public.contas_faturamento'),('faturamento','conta_faturamento_itens','public.conta_faturamento_itens'),
    ('faturamento','tabelas_comerciais_fontes','public.tabelas_comerciais_fontes'),('faturamento','tabelas_procedimentos_fontes','public.tabelas_procedimentos_fontes'),
    ('tiss','tiss_guias','public.tiss_guias'),('tiss','tiss_lotes','public.tiss_lotes'),('tiss','tiss_glosas','public.tiss_glosas'),
    ('financeiro','financeiro_recebiveis','public.financeiro_recebiveis'),('financeiro','financeiro_contas_pagar','public.financeiro_contas_pagar'),('financeiro','notas_fiscais_servico','public.notas_fiscais_servico')
  ) v(grupo_nome,objeto_nome,relacao)
  loop grupo:=r.grupo_nome; objeto:=r.objeto_nome; if to_regclass(r.relacao) is null then status:='AUSENTE';detalhe:='Objeto nao encontrado'; else status:='OK';detalhe:='Objeto disponivel'; end if; return next; end loop;
end $$;
revoke all on function public.validar_schema_his() from public;
grant execute on function public.validar_schema_his() to authenticated,service_role;

-- Atualiza sequencias depois do seed.
select setval('public.paciente_registro_seq',greatest(100000,coalesce((select max(numero_registro) from public.pacientes),100000)),true);
select setval('public.atendimento_numero_seq',greatest(1000000,coalesce((select max(numero_atendimento) from public.atendimentos),1000000)),true);

notify pgrst,'reload schema';

commit;
