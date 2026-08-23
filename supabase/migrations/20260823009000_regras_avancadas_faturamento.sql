begin;

create table if not exists public.contrato_regras_faturamento (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.credenciamento_contratos on delete cascade,
  categoria text not null,
  codigo_regra text not null,
  descricao text not null,
  percentual numeric(8,4),
  valor_fixo numeric(14,4),
  prioridade integer not null default 100,
  condicoes jsonb not null default '{}'::jsonb,
  ativo boolean not null default true,
  vigencia_inicio date,
  vigencia_fim date,
  created_at timestamptz not null default now(),
  unique(contrato_id,categoria,codigo_regra,vigencia_inicio)
);

create table if not exists public.conta_faturamento_grupos_ato (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references public.contas_faturamento on delete cascade,
  codigo_grupo text not null,
  data_ato date,
  via_acesso text,
  acomodacao text,
  urgencia boolean not null default false,
  horario_especial boolean not null default false,
  observacoes text,
  created_at timestamptz not null default now(),
  unique(conta_id,codigo_grupo)
);

alter table public.conta_faturamento_itens add column if not exists grupo_ato_id uuid references public.conta_faturamento_grupos_ato;
alter table public.conta_faturamento_itens add column if not exists sequencia_ato integer;
alter table public.conta_faturamento_itens add column if not exists percentual_aplicado numeric(8,4);
alter table public.conta_faturamento_itens add column if not exists valor_contratual_calculado numeric(14,2);
alter table public.conta_faturamento_itens add column if not exists memoria_calculo jsonb;
alter table public.conta_faturamento_itens add column if not exists regra_contratual_id uuid references public.contrato_regras_faturamento;
alter table public.conta_faturamento_itens add column if not exists valor_filme numeric(14,2);
alter table public.conta_faturamento_itens add column if not exists valor_anestesista numeric(14,2);
alter table public.conta_faturamento_itens add column if not exists valor_auxiliares numeric(14,2);
alter table public.conta_faturamento_itens add column if not exists pacote_id uuid;

create table if not exists public.contrato_pacotes (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.credenciamento_contratos on delete cascade,
  codigo text not null,
  nome text not null,
  valor numeric(14,2) not null,
  vigencia_inicio date,
  vigencia_fim date,
  inclusoes jsonb not null default '[]'::jsonb,
  exclusoes jsonb not null default '[]'::jsonb,
  observacoes text,
  ativo boolean not null default true,
  unique(contrato_id,codigo,vigencia_inicio)
);

create table if not exists public.contrato_pacote_itens (
  id uuid primary key default gen_random_uuid(),
  pacote_id uuid not null references public.contrato_pacotes on delete cascade,
  codigo text not null,
  tabela text,
  quantidade_inclusa numeric(14,4),
  cobranca_excedente boolean not null default false,
  unique(pacote_id,codigo,tabela)
);

alter table public.contrato_regras_faturamento enable row level security;
alter table public.conta_faturamento_grupos_ato enable row level security;
alter table public.contrato_pacotes enable row level security;
alter table public.contrato_pacote_itens enable row level security;

create policy contrato_regras_select on public.contrato_regras_faturamento for select using (
  exists(select 1 from public.credenciamento_contratos c where c.id=contrato_id and public.tem_empresa(c.empresa_id))
);
create policy contrato_pacotes_select on public.contrato_pacotes for select using (
  exists(select 1 from public.credenciamento_contratos c where c.id=contrato_id and public.tem_empresa(c.empresa_id))
);
create policy grupos_ato_select on public.conta_faturamento_grupos_ato for select using (
  exists(select 1 from public.contas_faturamento c where c.id=conta_id and public.tem_unidade(c.empresa_id,c.unidade_id))
);

comment on table public.contrato_regras_faturamento is 'Regras contratuais avançadas: múltiplos procedimentos, via de acesso, urgência, acomodação, auxiliares, anestesia, filme e demais adicionais.';
comment on table public.contrato_pacotes is 'Pacotes negociados por contrato, com inclusões/exclusões e vigência.';

commit;
