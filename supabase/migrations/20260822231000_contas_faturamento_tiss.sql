-- Contas hospitalares e pré-faturamento integrados ao TISS
create table if not exists public.contas_faturamento (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas,
  unidade_id uuid not null references public.unidades,
  atendimento_id uuid not null references public.atendimentos,
  paciente_id uuid not null references public.pacientes,
  convenio_id uuid null references public.convenios,
  plano_id uuid null references public.convenio_planos,
  competencia text not null,
  tipo_cobranca text not null check (tipo_cobranca in ('particular','convenio')),
  status text not null default 'aberta' check (status in ('aberta','pre_faturamento','com_criticas','pronta','faturada','cancelada')),
  valor_bruto numeric(14,2) not null default 0,
  valor_desconto numeric(14,2) not null default 0,
  valor_liquido numeric(14,2) not null default 0,
  fechada_em timestamptz null,
  faturada_em timestamptz null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users,
  unique (atendimento_id)
);

create table if not exists public.conta_faturamento_itens (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references public.contas_faturamento on delete cascade,
  origem_tipo text not null check (origem_tipo in ('procedimento','medicamento','material','taxa','diaria','honorario','laboratorio','imagem','outro')),
  origem_id uuid null,
  data_execucao timestamptz null,
  tabela text null,
  codigo text null,
  descricao text not null,
  quantidade numeric(12,4) not null default 1,
  valor_unitario numeric(14,2) not null default 0,
  percentual_reducao_acrescimo numeric(8,4) not null default 0,
  valor_total numeric(14,2) not null default 0,
  profissional_id uuid null references public.profissionais,
  setor text null,
  cobravel boolean not null default true,
  observacao text null,
  created_at timestamptz not null default now(),
  unique (conta_id, origem_tipo, origem_id)
);

create table if not exists public.conta_faturamento_criticas (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references public.contas_faturamento on delete cascade,
  item_id uuid null references public.conta_faturamento_itens on delete cascade,
  codigo text not null,
  severidade text not null check (severidade in ('erro','alerta','informacao')),
  campo text null,
  mensagem text not null,
  origem text not null default 'regra_tiss',
  resolvida boolean not null default false,
  resolvida_em timestamptz null,
  resolvida_por uuid null references auth.users,
  created_at timestamptz not null default now()
);

create index if not exists contas_faturamento_status_idx on public.contas_faturamento(empresa_id,unidade_id,status,competencia);
create index if not exists conta_faturamento_itens_conta_idx on public.conta_faturamento_itens(conta_id,origem_tipo);
create index if not exists conta_faturamento_criticas_conta_idx on public.conta_faturamento_criticas(conta_id,resolvida,severidade);

alter table public.contas_faturamento enable row level security;
alter table public.contas_faturamento force row level security;
alter table public.conta_faturamento_itens enable row level security;
alter table public.conta_faturamento_itens force row level security;
alter table public.conta_faturamento_criticas enable row level security;
alter table public.conta_faturamento_criticas force row level security;

create policy contas_faturamento_select on public.contas_faturamento for select using (public.tem_unidade(empresa_id,unidade_id));
create policy contas_faturamento_insert on public.contas_faturamento for insert with check (public.tem_unidade(empresa_id,unidade_id) and created_by=auth.uid());
create policy contas_faturamento_update on public.contas_faturamento for update using (public.tem_unidade(empresa_id,unidade_id)) with check (public.tem_unidade(empresa_id,unidade_id) and updated_by=auth.uid());

create policy conta_itens_select on public.conta_faturamento_itens for select using (exists (select 1 from public.contas_faturamento c where c.id=conta_id and public.tem_unidade(c.empresa_id,c.unidade_id)));
create policy conta_itens_insert on public.conta_faturamento_itens for insert with check (exists (select 1 from public.contas_faturamento c where c.id=conta_id and public.tem_unidade(c.empresa_id,c.unidade_id)));
create policy conta_itens_update on public.conta_faturamento_itens for update using (exists (select 1 from public.contas_faturamento c where c.id=conta_id and public.tem_unidade(c.empresa_id,c.unidade_id)));

create policy conta_criticas_select on public.conta_faturamento_criticas for select using (exists (select 1 from public.contas_faturamento c where c.id=conta_id and public.tem_unidade(c.empresa_id,c.unidade_id)));
create policy conta_criticas_insert on public.conta_faturamento_criticas for insert with check (exists (select 1 from public.contas_faturamento c where c.id=conta_id and public.tem_unidade(c.empresa_id,c.unidade_id)));
create policy conta_criticas_update on public.conta_faturamento_criticas for update using (exists (select 1 from public.contas_faturamento c where c.id=conta_id and public.tem_unidade(c.empresa_id,c.unidade_id)));

alter table public.tiss_guias add column if not exists conta_id uuid null references public.contas_faturamento;
create index if not exists tiss_guias_conta_idx on public.tiss_guias(conta_id);

comment on table public.contas_faturamento is 'Conta consolidada do episódio assistencial; fonte do pré-faturamento e das guias TISS.';
comment on table public.conta_faturamento_criticas is 'Críticas impeditivas ou alertas de faturamento/TISS antes da geração de guias e XML.';
