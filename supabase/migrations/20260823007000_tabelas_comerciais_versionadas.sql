begin;

insert into public.permissoes(codigo,descricao) values
('tabelas_comerciais.visualizar','Visualizar tabelas comerciais e referenciais'),
('tabelas_comerciais.gerenciar','Gerenciar edicoes e valores de tabelas comerciais')
on conflict (codigo) do nothing;

create table if not exists public.tabelas_comerciais_fontes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas,
  codigo text not null,
  nome text not null,
  tipo text not null check (tipo in ('simpro','brasindice','opme_convenio','propria_convenio','medicamentos_convenio','materiais_convenio','outra')),
  proprietaria boolean not null default false,
  observacoes text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users,
  unique(empresa_id,codigo)
);

create table if not exists public.tabelas_comerciais_edicoes (
  id uuid primary key default gen_random_uuid(),
  fonte_id uuid not null references public.tabelas_comerciais_fontes on delete cascade,
  convenio_id uuid references public.convenios,
  nome_edicao text not null,
  referencia text,
  data_publicacao date,
  vigencia_inicio date not null,
  vigencia_fim date,
  status text not null default 'rascunho' check (status in ('rascunho','vigente','encerrada','cancelada')),
  origem_arquivo text,
  hash_arquivo text,
  observacoes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users
);
create index if not exists tabelas_edicoes_vigencia_idx on public.tabelas_comerciais_edicoes(fonte_id,convenio_id,vigencia_inicio desc);

create table if not exists public.tabelas_comerciais_itens (
  id uuid primary key default gen_random_uuid(),
  edicao_id uuid not null references public.tabelas_comerciais_edicoes on delete cascade,
  codigo text not null,
  codigo_fabricante text,
  codigo_anvisa text,
  codigo_tuss text,
  descricao text not null,
  fabricante text,
  apresentacao text,
  unidade text,
  valor_fabrica numeric(14,4),
  valor_referencia numeric(14,4) not null default 0,
  valor_maximo numeric(14,4),
  percentual_acrescimo numeric(8,4),
  regra_preco text,
  exige_autorizacao boolean not null default false,
  ativo boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(edicao_id,codigo)
);
create index if not exists tabelas_itens_busca_idx on public.tabelas_comerciais_itens(edicao_id,codigo);
create index if not exists tabelas_itens_tuss_idx on public.tabelas_comerciais_itens(codigo_tuss);

create table if not exists public.contrato_tabelas_comerciais (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.credenciamento_contratos on delete cascade,
  fonte_id uuid not null references public.tabelas_comerciais_fontes,
  edicao_fixa_id uuid references public.tabelas_comerciais_edicoes,
  categoria text not null default 'geral' check (categoria in ('geral','opme','medicamentos','materiais','taxas','diarias','procedimentos','outra')),
  modo_edicao text not null default 'vigente_na_data' check (modo_edicao in ('vigente_na_data','edicao_fixa')),
  percentual_ajuste numeric(8,4) not null default 0,
  prioridade integer not null default 100,
  ativo boolean not null default true,
  observacoes text,
  unique(contrato_id,fonte_id,categoria)
);

alter table public.conta_faturamento_itens add column if not exists tabela_comercial_edicao_id uuid references public.tabelas_comerciais_edicoes;
alter table public.conta_faturamento_itens add column if not exists tabela_comercial_item_id uuid references public.tabelas_comerciais_itens;
alter table public.conta_faturamento_itens add column if not exists valor_referencia_contrato numeric(14,4);
alter table public.conta_faturamento_itens add column if not exists origem_valor text;

create or replace function public.obter_valor_comercial(
  p_convenio_id uuid,
  p_codigo text,
  p_data date default current_date,
  p_categoria text default 'geral'
) returns table(
  fonte_id uuid,
  edicao_id uuid,
  item_id uuid,
  fonte text,
  edicao text,
  valor_base numeric,
  percentual_ajuste numeric,
  valor_final numeric
)
language sql stable security invoker as $$
  select f.id, e.id, i.id, f.nome, e.nome_edicao,
         i.valor_referencia,
         ctc.percentual_ajuste,
         round(i.valor_referencia * (1 + ctc.percentual_ajuste/100), 4)
  from public.credenciamento_contratos cc
  join public.contrato_tabelas_comerciais ctc on ctc.contrato_id=cc.id and ctc.ativo
  join public.tabelas_comerciais_fontes f on f.id=ctc.fonte_id and f.ativo
  join public.tabelas_comerciais_edicoes e on e.fonte_id=f.id
    and e.status='vigente'
    and (e.convenio_id is null or e.convenio_id=p_convenio_id)
    and (
      (ctc.modo_edicao='edicao_fixa' and e.id=ctc.edicao_fixa_id)
      or
      (ctc.modo_edicao='vigente_na_data' and e.vigencia_inicio<=p_data and (e.vigencia_fim is null or e.vigencia_fim>=p_data))
    )
  join public.tabelas_comerciais_itens i on i.edicao_id=e.id and i.codigo=p_codigo and i.ativo
  where cc.convenio_id=p_convenio_id
    and cc.status='ativo'
    and (cc.data_inicio is null or cc.data_inicio<=p_data)
    and (cc.data_fim is null or cc.data_fim>=p_data)
    and ctc.categoria in (p_categoria,'geral')
  order by case when ctc.categoria=p_categoria then 0 else 1 end, ctc.prioridade, e.vigencia_inicio desc
  limit 1;
$$;

grant execute on function public.obter_valor_comercial(uuid,text,date,text) to authenticated;

alter table public.tabelas_comerciais_fontes enable row level security;
alter table public.tabelas_comerciais_edicoes enable row level security;
alter table public.tabelas_comerciais_itens enable row level security;
alter table public.contrato_tabelas_comerciais enable row level security;

create policy tabelas_fontes_select on public.tabelas_comerciais_fontes for select using (public.tem_empresa(empresa_id));
create policy tabelas_fontes_write on public.tabelas_comerciais_fontes for all using (public.tem_empresa(empresa_id) and public.tem_permissao(empresa_id,null,'tabelas_comerciais.gerenciar')) with check (public.tem_empresa(empresa_id) and public.tem_permissao(empresa_id,null,'tabelas_comerciais.gerenciar'));
create policy tabelas_edicoes_select on public.tabelas_comerciais_edicoes for select using (exists(select 1 from public.tabelas_comerciais_fontes f where f.id=fonte_id and public.tem_empresa(f.empresa_id)));
create policy tabelas_itens_select on public.tabelas_comerciais_itens for select using (exists(select 1 from public.tabelas_comerciais_edicoes e join public.tabelas_comerciais_fontes f on f.id=e.fonte_id where e.id=edicao_id and public.tem_empresa(f.empresa_id)));
create policy contrato_tabelas_select on public.contrato_tabelas_comerciais for select using (exists(select 1 from public.credenciamento_contratos c where c.id=contrato_id and public.tem_empresa(c.empresa_id)));

comment on table public.tabelas_comerciais_edicoes is 'Cada atualização SIMPRO, BRASINDICE, OPME ou tabela própria cria nova edição; históricos nunca são sobrescritos.';
comment on function public.obter_valor_comercial is 'Resolve o valor contratual vigente por convênio, código, data e categoria, respeitando edição fixa ou vigente na data.';

commit;
