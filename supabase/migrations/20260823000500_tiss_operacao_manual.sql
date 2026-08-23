create table if not exists public.tiss_operacoes_manuais (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas,
  unidade_id uuid not null references public.unidades,
  convenio_id uuid null references public.convenios,
  lote_id uuid null references public.tiss_lotes on delete set null,
  guia_id uuid null references public.tiss_guias on delete set null,
  direcao text not null check (direcao in ('saida','entrada')),
  tipo_documento text not null,
  nome_arquivo text not null,
  xml_conteudo text not null,
  origem text not null default 'manual' check (origem in ('manual','webservice','importacao')),
  xsd_validado boolean not null default false,
  erros_validacao jsonb not null default '[]'::jsonb,
  protocolo_externo text null,
  observacoes text null,
  processado boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users
);
create index if not exists tiss_operacoes_manuais_lote_idx on public.tiss_operacoes_manuais(lote_id,created_at desc);
create index if not exists tiss_operacoes_manuais_convenio_idx on public.tiss_operacoes_manuais(convenio_id,created_at desc);
alter table public.tiss_operacoes_manuais enable row level security;
alter table public.tiss_operacoes_manuais force row level security;
create policy tiss_operacoes_manuais_select on public.tiss_operacoes_manuais for select using (public.tem_unidade(empresa_id,unidade_id));
create policy tiss_operacoes_manuais_insert on public.tiss_operacoes_manuais for insert with check (public.tem_unidade(empresa_id,unidade_id) and created_by=auth.uid());
revoke delete,truncate on public.tiss_operacoes_manuais from anon,authenticated;
