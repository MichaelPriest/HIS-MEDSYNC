begin;

alter table public.tiss_lotes
  add column if not exists quantidade_guias integer not null default 0,
  add column if not exists valor_total numeric(14,2) not null default 0,
  add column if not exists arquivo_nome text,
  add column if not exists hash_documento text,
  add column if not exists xsd_validado boolean not null default false,
  add column if not exists erros_validacao jsonb not null default '[]'::jsonb;

create table if not exists public.tiss_protocolos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas,
  unidade_id uuid not null references public.unidades,
  lote_id uuid not null references public.tiss_lotes on delete cascade,
  numero_protocolo text not null,
  data_protocolo date,
  status text not null default 'recebido' check (status in ('recebido','em_analise','processado','rejeitado','pago_parcial','pago')),
  valor_apresentado numeric(14,2) not null default 0,
  valor_processado numeric(14,2) not null default 0,
  valor_liberado numeric(14,2) not null default 0,
  valor_glosa numeric(14,2) not null default 0,
  observacoes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users,
  unique (lote_id, numero_protocolo)
);

create table if not exists public.tiss_glosas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas,
  unidade_id uuid not null references public.unidades,
  protocolo_id uuid references public.tiss_protocolos on delete cascade,
  lote_id uuid references public.tiss_lotes,
  guia_id uuid references public.tiss_guias,
  guia_item_id uuid references public.tiss_guia_itens,
  codigo_glosa text not null,
  descricao_glosa text,
  valor_glosado numeric(14,2) not null default 0,
  status text not null default 'aberta' check (status in ('aberta','em_recurso','aceita','deferida','indeferida','cancelada')),
  origem text not null default 'demonstrativo',
  created_at timestamptz not null default now()
);

create table if not exists public.tiss_recursos_glosa (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas,
  unidade_id uuid not null references public.unidades,
  convenio_id uuid not null references public.convenios,
  protocolo_id uuid references public.tiss_protocolos,
  numero_recurso text not null,
  numero_lote_recurso text,
  status text not null default 'rascunho' check (status in ('rascunho','pronto','gerado','enviado','protocolado','deferido','indeferido','parcial')),
  valor_total_recursado numeric(14,2) not null default 0,
  protocolo_operadora text,
  enviado_em timestamptz,
  retorno_em timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users,
  unique (empresa_id, convenio_id, numero_recurso)
);

create table if not exists public.tiss_recurso_itens (
  id uuid primary key default gen_random_uuid(),
  recurso_id uuid not null references public.tiss_recursos_glosa on delete cascade,
  glosa_id uuid not null references public.tiss_glosas,
  valor_recursado numeric(14,2) not null check (valor_recursado > 0),
  justificativa text not null,
  valor_deferido numeric(14,2) not null default 0,
  valor_indeferido numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (recurso_id, glosa_id)
);

create index if not exists tiss_protocolos_lote_idx on public.tiss_protocolos(lote_id);
create index if not exists tiss_glosas_status_idx on public.tiss_glosas(empresa_id,unidade_id,status);
create index if not exists tiss_recursos_status_idx on public.tiss_recursos_glosa(empresa_id,unidade_id,status);

alter table public.tiss_protocolos enable row level security;
alter table public.tiss_protocolos force row level security;
alter table public.tiss_glosas enable row level security;
alter table public.tiss_glosas force row level security;
alter table public.tiss_recursos_glosa enable row level security;
alter table public.tiss_recursos_glosa force row level security;
alter table public.tiss_recurso_itens enable row level security;
alter table public.tiss_recurso_itens force row level security;

create policy tiss_protocolos_select on public.tiss_protocolos for select using (public.tem_unidade(empresa_id,unidade_id));
create policy tiss_protocolos_insert on public.tiss_protocolos for insert with check (public.tem_unidade(empresa_id,unidade_id) and created_by=auth.uid());
create policy tiss_glosas_select on public.tiss_glosas for select using (public.tem_unidade(empresa_id,unidade_id));
create policy tiss_glosas_insert on public.tiss_glosas for insert with check (public.tem_unidade(empresa_id,unidade_id));
create policy tiss_recursos_select on public.tiss_recursos_glosa for select using (public.tem_unidade(empresa_id,unidade_id));
create policy tiss_recursos_insert on public.tiss_recursos_glosa for insert with check (public.tem_unidade(empresa_id,unidade_id) and created_by=auth.uid());
create policy tiss_recursos_update on public.tiss_recursos_glosa for update using (public.tem_unidade(empresa_id,unidade_id)) with check (public.tem_unidade(empresa_id,unidade_id) and updated_by=auth.uid());
create policy tiss_recurso_itens_select on public.tiss_recurso_itens for select using (exists(select 1 from public.tiss_recursos_glosa r where r.id=recurso_id and public.tem_unidade(r.empresa_id,r.unidade_id)));
create policy tiss_recurso_itens_insert on public.tiss_recurso_itens for insert with check (exists(select 1 from public.tiss_recursos_glosa r where r.id=recurso_id and public.tem_unidade(r.empresa_id,r.unidade_id)));

commit;
