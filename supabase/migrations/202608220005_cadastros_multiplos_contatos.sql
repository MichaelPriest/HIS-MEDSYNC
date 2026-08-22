begin;

alter type public.sexo_paciente add value if not exists 'outros';

create type public.nacionalidade_tipo as enum ('brasileiro','estrangeiro');
create type public.estado_civil_tipo as enum ('solteiro','casado','divorciado','viuvo');
create type public.tipo_telefone as enum ('celular','residencial','comercial');
create type public.tipo_endereco as enum ('residencial','comercial','outro');

alter table public.pacientes
  add column if not exists rg text,
  add column if not exists nacionalidade public.nacionalidade_tipo,
  add column if not exists estado_civil public.estado_civil_tipo;

alter table public.profissionais
  add column if not exists rg text,
  add column if not exists data_nascimento date,
  add column if not exists nacionalidade public.nacionalidade_tipo,
  add column if not exists estado_civil public.estado_civil_tipo,
  add column if not exists sexo public.sexo_paciente;

create table public.tipos_profissional (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nome text not null,
  ativo boolean not null default true,
  ordem integer not null default 100
);

insert into public.tipos_profissional(codigo,nome,ordem) values
('medico','Médico(a)',10),('enfermagem','Enfermagem',20),('anestesista','Anestesista',30),('fisioterapia','Fisioterapia',40),('fonoaudiologia','Fonoaudiologia',50),('psicologia','Psicologia',60),('terapia_ocupacional','Terapia Ocupacional',70),('nutricao','Nutrição',80),('farmacia','Farmácia',90),('odontologia','Odontologia',100),('administrativo','Administrativo',110),('outro','Outro',999)
on conflict (codigo) do nothing;

alter table public.profissionais add column if not exists tipo_profissional_id uuid references public.tipos_profissional(id);

grant select on public.tipos_profissional to authenticated;

create table public.paciente_emails (
  id uuid primary key default gen_random_uuid(), paciente_id uuid not null references public.pacientes(id) on delete cascade,
  email text not null, principal boolean not null default false, created_at timestamptz not null default now()
);
create table public.paciente_telefones (
  id uuid primary key default gen_random_uuid(), paciente_id uuid not null references public.pacientes(id) on delete cascade,
  telefone text not null, tipo public.tipo_telefone not null default 'celular', whatsapp boolean not null default false, principal boolean not null default false, created_at timestamptz not null default now()
);
create table public.paciente_enderecos (
  id uuid primary key default gen_random_uuid(), paciente_id uuid not null references public.pacientes(id) on delete cascade,
  cep text, endereco text not null, numero text not null, complemento text, bairro text not null, cidade text not null, estado text not null check (estado ~ '^[A-Z]{2}$'), tipo public.tipo_endereco not null default 'residencial', principal boolean not null default false, created_at timestamptz not null default now()
);

create table public.profissional_emails (
  id uuid primary key default gen_random_uuid(), profissional_id uuid not null references public.profissionais(id) on delete cascade,
  email text not null, principal boolean not null default false, created_at timestamptz not null default now()
);
create table public.profissional_telefones (
  id uuid primary key default gen_random_uuid(), profissional_id uuid not null references public.profissionais(id) on delete cascade,
  telefone text not null, tipo public.tipo_telefone not null default 'celular', whatsapp boolean not null default false, principal boolean not null default false, created_at timestamptz not null default now()
);
create table public.profissional_enderecos (
  id uuid primary key default gen_random_uuid(), profissional_id uuid not null references public.profissionais(id) on delete cascade,
  cep text, endereco text not null, numero text not null, complemento text, bairro text not null, cidade text not null, estado text not null check (estado ~ '^[A-Z]{2}$'), tipo public.tipo_endereco not null default 'residencial', principal boolean not null default false, created_at timestamptz not null default now()
);

create table public.convenio_emails (
  id uuid primary key default gen_random_uuid(), convenio_id uuid not null references public.convenios(id) on delete cascade,
  email text not null, principal boolean not null default false, created_at timestamptz not null default now()
);
create table public.convenio_telefones (
  id uuid primary key default gen_random_uuid(), convenio_id uuid not null references public.convenios(id) on delete cascade,
  telefone text not null, tipo public.tipo_telefone not null default 'comercial', whatsapp boolean not null default false, principal boolean not null default false, created_at timestamptz not null default now()
);
create table public.convenio_enderecos (
  id uuid primary key default gen_random_uuid(), convenio_id uuid not null references public.convenios(id) on delete cascade,
  cep text, endereco text not null, numero text not null, complemento text, bairro text not null, cidade text not null, estado text not null check (estado ~ '^[A-Z]{2}$'), tipo public.tipo_endereco not null default 'comercial', principal boolean not null default false, created_at timestamptz not null default now()
);

alter table public.paciente_emails enable row level security; alter table public.paciente_emails force row level security;
alter table public.paciente_telefones enable row level security; alter table public.paciente_telefones force row level security;
alter table public.paciente_enderecos enable row level security; alter table public.paciente_enderecos force row level security;
alter table public.profissional_emails enable row level security; alter table public.profissional_emails force row level security;
alter table public.profissional_telefones enable row level security; alter table public.profissional_telefones force row level security;
alter table public.profissional_enderecos enable row level security; alter table public.profissional_enderecos force row level security;
alter table public.convenio_emails enable row level security; alter table public.convenio_emails force row level security;
alter table public.convenio_telefones enable row level security; alter table public.convenio_telefones force row level security;
alter table public.convenio_enderecos enable row level security; alter table public.convenio_enderecos force row level security;

create policy paciente_emails_rw on public.paciente_emails for all using (exists(select 1 from public.pacientes p where p.id=paciente_id and public.tem_empresa(p.empresa_id))) with check (exists(select 1 from public.pacientes p where p.id=paciente_id and public.tem_empresa(p.empresa_id)));
create policy paciente_telefones_rw on public.paciente_telefones for all using (exists(select 1 from public.pacientes p where p.id=paciente_id and public.tem_empresa(p.empresa_id))) with check (exists(select 1 from public.pacientes p where p.id=paciente_id and public.tem_empresa(p.empresa_id)));
create policy paciente_enderecos_rw on public.paciente_enderecos for all using (exists(select 1 from public.pacientes p where p.id=paciente_id and public.tem_empresa(p.empresa_id))) with check (exists(select 1 from public.pacientes p where p.id=paciente_id and public.tem_empresa(p.empresa_id)));
create policy profissional_emails_rw on public.profissional_emails for all using (exists(select 1 from public.profissionais p where p.id=profissional_id and public.tem_empresa(p.empresa_id))) with check (exists(select 1 from public.profissionais p where p.id=profissional_id and public.tem_empresa(p.empresa_id)));
create policy profissional_telefones_rw on public.profissional_telefones for all using (exists(select 1 from public.profissionais p where p.id=profissional_id and public.tem_empresa(p.empresa_id))) with check (exists(select 1 from public.profissionais p where p.id=profissional_id and public.tem_empresa(p.empresa_id)));
create policy profissional_enderecos_rw on public.profissional_enderecos for all using (exists(select 1 from public.profissionais p where p.id=profissional_id and public.tem_empresa(p.empresa_id))) with check (exists(select 1 from public.profissionais p where p.id=profissional_id and public.tem_empresa(p.empresa_id)));
create policy convenio_emails_rw on public.convenio_emails for all using (exists(select 1 from public.convenios c where c.id=convenio_id and public.tem_empresa(c.empresa_id))) with check (exists(select 1 from public.convenios c where c.id=convenio_id and public.tem_empresa(c.empresa_id)));
create policy convenio_telefones_rw on public.convenio_telefones for all using (exists(select 1 from public.convenios c where c.id=convenio_id and public.tem_empresa(c.empresa_id))) with check (exists(select 1 from public.convenios c where c.id=convenio_id and public.tem_empresa(c.empresa_id)));
create policy convenio_enderecos_rw on public.convenio_enderecos for all using (exists(select 1 from public.convenios c where c.id=convenio_id and public.tem_empresa(c.empresa_id))) with check (exists(select 1 from public.convenios c where c.id=convenio_id and public.tem_empresa(c.empresa_id)));

commit;