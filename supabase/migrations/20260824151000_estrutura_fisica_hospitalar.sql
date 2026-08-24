-- Estrutura física hospitalar hierárquica.
-- Permite representar bloco > andar > ala > setor/UTI/centro cirúrgico/salas sem duplicar
-- as tabelas operacionais já existentes (setores, leitos e salas_cirurgicas).

create table if not exists public.estruturas_fisicas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  unidade_id uuid not null references public.unidades(id),
  parent_id uuid null,
  codigo text not null,
  nome text not null,
  tipo text not null check (tipo in (
    'bloco',
    'andar',
    'ala',
    'setor',
    'uti',
    'centro_cirurgico',
    'centro_obstetrico',
    'pronto_socorro',
    'enfermaria',
    'ambulatorio',
    'consultorio',
    'sala',
    'posto_enfermagem',
    'apoio',
    'outro'
  )),
  descricao text null,
  capacidade_leitos integer null check (capacidade_leitos is null or capacidade_leitos >= 0),
  permite_internacao boolean not null default false,
  permite_cirurgia boolean not null default false,
  permite_atendimento boolean not null default true,
  ordem integer not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id),
  unique (unidade_id, codigo),
  unique (id, unidade_id),
  foreign key (parent_id, unidade_id)
    references public.estruturas_fisicas(id, unidade_id)
    on delete restrict
);

create index if not exists estruturas_fisicas_unidade_tipo_idx
  on public.estruturas_fisicas(unidade_id, tipo, ativo, ordem, nome);
create index if not exists estruturas_fisicas_parent_idx
  on public.estruturas_fisicas(parent_id, ordem, nome)
  where parent_id is not null;

alter table public.setores
  add column if not exists estrutura_fisica_id uuid null references public.estruturas_fisicas(id) on delete set null;
create index if not exists setores_estrutura_fisica_idx on public.setores(estrutura_fisica_id) where estrutura_fisica_id is not null;

alter table public.leitos
  add column if not exists estrutura_fisica_id uuid null references public.estruturas_fisicas(id) on delete set null;
create index if not exists leitos_estrutura_fisica_idx on public.leitos(estrutura_fisica_id) where estrutura_fisica_id is not null;

alter table public.salas_cirurgicas
  add column if not exists estrutura_fisica_id uuid null references public.estruturas_fisicas(id) on delete set null;
create index if not exists salas_cirurgicas_estrutura_fisica_idx on public.salas_cirurgicas(estrutura_fisica_id) where estrutura_fisica_id is not null;

alter table public.estruturas_fisicas enable row level security;
alter table public.estruturas_fisicas force row level security;

revoke all on table public.estruturas_fisicas from anon, authenticated;
grant select, insert, update on table public.estruturas_fisicas to authenticated;

drop policy if exists estruturas_fisicas_select on public.estruturas_fisicas;
create policy estruturas_fisicas_select
on public.estruturas_fisicas
for select
to authenticated
using (
  public.tem_unidade(empresa_id, unidade_id)
  and public.tem_permissao(empresa_id, unidade_id, 'estrutura.visualizar')
);

drop policy if exists estruturas_fisicas_insert on public.estruturas_fisicas;
create policy estruturas_fisicas_insert
on public.estruturas_fisicas
for insert
to authenticated
with check (
  public.tem_unidade(empresa_id, unidade_id)
  and public.tem_permissao(empresa_id, unidade_id, 'estrutura.criar')
  and created_by = (select auth.uid())
);

drop policy if exists estruturas_fisicas_update on public.estruturas_fisicas;
create policy estruturas_fisicas_update
on public.estruturas_fisicas
for update
to authenticated
using (
  public.tem_unidade(empresa_id, unidade_id)
  and public.tem_permissao(empresa_id, unidade_id, 'estrutura.editar')
)
with check (
  public.tem_unidade(empresa_id, unidade_id)
  and public.tem_permissao(empresa_id, unidade_id, 'estrutura.editar')
  and updated_by = (select auth.uid())
);

-- A tela de estrutura também mantém a tabela operacional de setores.
-- Mantemos SELECT já existente e adicionamos somente escrita autorizada.
grant select, insert, update on table public.setores to authenticated;

drop policy if exists setores_insert_estrutura on public.setores;
create policy setores_insert_estrutura
on public.setores
for insert
to authenticated
with check (
  public.tem_unidade(empresa_id, unidade_id)
  and public.tem_permissao(empresa_id, unidade_id, 'estrutura.criar')
  and created_by = (select auth.uid())
);

drop policy if exists setores_update_estrutura on public.setores;
create policy setores_update_estrutura
on public.setores
for update
to authenticated
using (
  public.tem_unidade(empresa_id, unidade_id)
  and public.tem_permissao(empresa_id, unidade_id, 'estrutura.editar')
)
with check (
  public.tem_unidade(empresa_id, unidade_id)
  and public.tem_permissao(empresa_id, unidade_id, 'estrutura.editar')
  and updated_by = (select auth.uid())
);

comment on table public.estruturas_fisicas is
  'Hierarquia física da unidade hospitalar: blocos, andares, alas, setores, UTI, centro cirúrgico, consultórios e demais áreas.';
comment on column public.estruturas_fisicas.parent_id is
  'Elemento físico superior da mesma unidade, permitindo hierarquia bloco > andar > ala > setor/sala.';

notify pgrst, 'reload schema';
