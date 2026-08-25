create table if not exists public.solicitacoes_materiais_assistenciais (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas,
  unidade_id uuid not null references public.unidades,
  atendimento_id uuid not null references public.atendimentos on delete cascade,
  paciente_id uuid not null references public.pacientes,
  profissional_id uuid null references public.profissionais,
  item_assistencial_id uuid not null references public.itens_assistenciais,
  produto_id uuid null references public.estoque_produtos,
  categoria text not null check (categoria in ('material','opme','gas_medicinal')),
  descricao text not null,
  quantidade numeric(14,4) not null default 1 check (quantidade > 0),
  unidade_medida text null,
  observacoes text null,
  status text not null default 'solicitado' check (status in ('solicitado','separacao','dispensado','entregue','cancelado')),
  solicitado_em timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users
);

create index if not exists idx_sol_mat_atendimento
  on public.solicitacoes_materiais_assistenciais(atendimento_id,status);
create index if not exists idx_sol_mat_unidade
  on public.solicitacoes_materiais_assistenciais(empresa_id,unidade_id,status);

alter table public.solicitacoes_materiais_assistenciais enable row level security;

drop policy if exists solicitacoes_materiais_assistenciais_all on public.solicitacoes_materiais_assistenciais;
create policy solicitacoes_materiais_assistenciais_all
on public.solicitacoes_materiais_assistenciais
for all
using (public.tem_unidade(empresa_id,unidade_id))
with check (public.tem_unidade(empresa_id,unidade_id));
