create table if not exists public.referencia_equivalencias (
  id uuid primary key default gen_random_uuid(),
  sistema_origem text not null,
  codigo_origem text not null,
  descricao_origem text,
  sistema_destino text not null,
  codigo_destino text not null,
  descricao_destino text,
  fonte text,
  status text not null default 'ativa' check (status in ('ativa','revisar','inativa')),
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(sistema_origem,codigo_origem,sistema_destino,codigo_destino,fonte)
);
create index if not exists idx_ref_equiv_origem on public.referencia_equivalencias(sistema_origem,codigo_origem);
create index if not exists idx_ref_equiv_destino on public.referencia_equivalencias(sistema_destino,codigo_destino);

create table if not exists public.referencia_glosas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  motivo text not null,
  fonte text not null default 'XML legado',
  ativo boolean not null default true,
  metadados jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.referencia_equivalencias enable row level security;
alter table public.referencia_glosas enable row level security;
create policy referencia_equivalencias_read on public.referencia_equivalencias for select to authenticated using (public.usuario_ativo());
create policy referencia_glosas_read on public.referencia_glosas for select to authenticated using (public.usuario_ativo());
revoke insert,update,delete,truncate on public.referencia_equivalencias,public.referencia_glosas from anon,authenticated;

comment on table public.referencia_equivalencias is 'Mapeamentos históricos entre sistemas de codificação, como AMB para TUSS, preservando a fonte do de-para.';
comment on table public.referencia_glosas is 'Catálogo mestre de códigos e motivos de glosa, separado das ocorrências reais em tiss_glosas.';
