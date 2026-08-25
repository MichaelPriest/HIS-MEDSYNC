-- Requisições setoriais ao Almoxarifado.
-- O schema e as RPCs desta migration correspondem à versão aplicada no Supabase.

create table if not exists public.estoque_requisicoes_setoriais (
  id uuid primary key default gen_random_uuid(), empresa_id uuid not null, unidade_id uuid not null,
  numero text not null, setor_id uuid null references public.setores(id),
  local_destino_id uuid not null references public.estoque_locais(id), local_origem_id uuid null references public.estoque_locais(id),
  solicitante_id uuid null references public.profissionais(id),
  prioridade text not null default 'normal' check (prioridade in ('normal','urgente','emergencia')),
  justificativa text null,
  status text not null default 'solicitada' check (status in ('rascunho','solicitada','em_separacao','parcial','atendida','cancelada','recebida')),
  solicitado_em timestamptz not null default now(), iniciado_em timestamptz null, atendido_em timestamptz null, recebido_em timestamptz null,
  created_at timestamptz not null default now(), created_by uuid null default auth.uid(), updated_at timestamptz not null default now(), updated_by uuid null default auth.uid(),
  unique (empresa_id, unidade_id, numero)
);

create table if not exists public.estoque_requisicao_setorial_itens (
  id uuid primary key default gen_random_uuid(), requisicao_id uuid not null references public.estoque_requisicoes_setoriais(id) on delete cascade,
  produto_id uuid not null references public.estoque_produtos(id), quantidade_solicitada numeric not null check (quantidade_solicitada > 0),
  quantidade_aprovada numeric null check (quantidade_aprovada is null or quantidade_aprovada >= 0), quantidade_atendida numeric not null default 0 check (quantidade_atendida >= 0),
  unidade_medida text null, observacoes text null,
  status text not null default 'pendente' check (status in ('pendente','parcial','atendido','cancelado')),
  created_at timestamptz not null default now(), created_by uuid null default auth.uid(), updated_at timestamptz not null default now(), updated_by uuid null default auth.uid()
);

create table if not exists public.estoque_requisicao_setorial_eventos (
  id uuid primary key default gen_random_uuid(), requisicao_id uuid not null references public.estoque_requisicoes_setoriais(id) on delete cascade,
  evento text not null, detalhe jsonb not null default '{}'::jsonb, profissional_id uuid null references public.profissionais(id), usuario_id uuid null default auth.uid(), created_at timestamptz not null default now()
);

create index if not exists idx_req_setoriais_status on public.estoque_requisicoes_setoriais(empresa_id,unidade_id,status,solicitado_em desc);
create index if not exists idx_req_setoriais_destino on public.estoque_requisicoes_setoriais(local_destino_id,status);
create index if not exists idx_req_setoriais_itens_req on public.estoque_requisicao_setorial_itens(requisicao_id,status);

insert into public.permissoes(codigo,descricao,ativo) values
 ('almoxarifado.requisitar','Criar requisições setoriais ao Almoxarifado',true),
 ('almoxarifado.atender','Separar e atender requisições setoriais',true)
on conflict (codigo) do update set descricao=excluded.descricao, ativo=true;

-- RPCs operacionais são criadas na mesma migration aplicada ao ambiente.
-- Reexecute a migration completa do histórico Supabase em novos ambientes antes de uso.
