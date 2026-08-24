-- Catálogo mestre de itens assistenciais e integração com tabelas comerciais.
-- Referência TISS vigente em 2026: TUSS 18 (diárias/taxas/gases),
-- TUSS 19 (materiais/OPME), TUSS 20 (medicamentos) e TUSS 22 (procedimentos).

create table if not exists public.itens_assistenciais (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete restrict,
  codigo_interno text not null,
  categoria text not null,
  tabela_tuss smallint null,
  codigo_tuss text null,
  descricao text not null,
  unidade_medida text null,
  fabricante text null,
  marca text null,
  apresentacao text null,
  principio_ativo text null,
  concentracao text null,
  forma_farmaceutica text null,
  tipo_opme text null,
  codigo_anvisa text null,
  ean text null,
  ggrem text null,
  codigo_brasindice text null,
  codigo_simpro text null,
  cobranca_fracionada boolean not null default false,
  fracao_minima numeric(14,6) null,
  ativo boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id),
  constraint itens_assistenciais_empresa_codigo_key unique (empresa_id, codigo_interno),
  constraint itens_assistenciais_categoria_check check (
    categoria = any (array[
      'diaria'::text,
      'taxa'::text,
      'gas_medicinal'::text,
      'material'::text,
      'opme'::text,
      'medicamento'::text,
      'procedimento'::text,
      'pacote'::text,
      'outro'::text
    ])
  ),
  constraint itens_assistenciais_tabela_tuss_check check (
    tabela_tuss is null or tabela_tuss = any (array[18::smallint,19::smallint,20::smallint,22::smallint])
  ),
  constraint itens_assistenciais_categoria_tuss_check check (
    tabela_tuss is null
    or (tabela_tuss = 18 and categoria = any (array['diaria'::text,'taxa'::text,'gas_medicinal'::text]))
    or (tabela_tuss = 19 and categoria = any (array['material'::text,'opme'::text]))
    or (tabela_tuss = 20 and categoria = 'medicamento'::text)
    or (tabela_tuss = 22 and categoria = 'procedimento'::text)
  )
);

comment on table public.itens_assistenciais is 'Cadastro mestre interno dos itens assistenciais, com classificação TISS/TUSS e códigos comerciais auxiliares.';
comment on column public.itens_assistenciais.tabela_tuss is 'Tabela TUSS aplicável: 18 diárias/taxas/gases, 19 materiais/OPME, 20 medicamentos, 22 procedimentos.';
comment on column public.itens_assistenciais.codigo_brasindice is 'Código de referência Brasíndice, quando houver licença/fonte válida.';
comment on column public.itens_assistenciais.codigo_simpro is 'Código de referência SIMPRO, quando houver licença/fonte válida.';

create index if not exists idx_itens_assistenciais_empresa_categoria on public.itens_assistenciais (empresa_id, categoria, ativo);
create index if not exists idx_itens_assistenciais_tuss on public.itens_assistenciais (empresa_id, tabela_tuss, codigo_tuss) where codigo_tuss is not null;
create index if not exists idx_itens_assistenciais_brasindice on public.itens_assistenciais (empresa_id, codigo_brasindice) where codigo_brasindice is not null;
create index if not exists idx_itens_assistenciais_simpro on public.itens_assistenciais (empresa_id, codigo_simpro) where codigo_simpro is not null;
create index if not exists idx_itens_assistenciais_descricao_trgm on public.itens_assistenciais using gin (descricao gin_trgm_ops);

alter table public.itens_assistenciais enable row level security;
alter table public.itens_assistenciais force row level security;

drop policy if exists itens_assistenciais_select on public.itens_assistenciais;
create policy itens_assistenciais_select on public.itens_assistenciais
for select to authenticated
using (public.tem_empresa(empresa_id));

drop policy if exists itens_assistenciais_insert on public.itens_assistenciais;
create policy itens_assistenciais_insert on public.itens_assistenciais
for insert to authenticated
with check (public.tem_empresa(empresa_id));

drop policy if exists itens_assistenciais_update on public.itens_assistenciais;
create policy itens_assistenciais_update on public.itens_assistenciais
for update to authenticated
using (public.tem_empresa(empresa_id))
with check (public.tem_empresa(empresa_id));

grant select, insert, update on public.itens_assistenciais to authenticated;
revoke delete on public.itens_assistenciais from anon, authenticated;

-- Fontes comerciais: CMED passa a ser fonte regulatória possível além de
-- Brasíndice/SIMPRO e tabelas próprias/contratuais já existentes.
alter table public.tabelas_comerciais_fontes
  drop constraint if exists tabelas_comerciais_fontes_tipo_check;
alter table public.tabelas_comerciais_fontes
  add constraint tabelas_comerciais_fontes_tipo_check check (
    tipo = any (array[
      'simpro'::text,
      'brasindice'::text,
      'cmed'::text,
      'opme_convenio'::text,
      'propria_convenio'::text,
      'propria_hospital'::text,
      'medicamentos_convenio'::text,
      'materiais_convenio'::text,
      'amb90'::text,
      'amb92'::text,
      'amb96'::text,
      'amb99'::text,
      'cbhpm'::text,
      'procedimentos_convenio'::text,
      'outra'::text
    ])
  );

-- Gases precisam ter regra própria de contrato, pois pertencem à TUSS 18
-- mas são cobrados com lógica diferente de diária/taxa em muitos contratos.
alter table public.contrato_tabelas_comerciais
  drop constraint if exists contrato_tabelas_comerciais_categoria_check;
alter table public.contrato_tabelas_comerciais
  add constraint contrato_tabelas_comerciais_categoria_check check (
    categoria = any (array[
      'geral'::text,
      'opme'::text,
      'medicamentos'::text,
      'materiais'::text,
      'taxas'::text,
      'diarias'::text,
      'gases'::text,
      'procedimentos'::text,
      'outra'::text
    ])
  );

alter table public.tabelas_comerciais_itens
  add column if not exists item_assistencial_id uuid null references public.itens_assistenciais(id) on delete set null,
  add column if not exists categoria_item text not null default 'outro',
  add column if not exists tabela_tuss smallint null,
  add column if not exists codigo_brasindice text null,
  add column if not exists codigo_simpro text null,
  add column if not exists ean text null,
  add column if not exists ggrem text null,
  add column if not exists valor_pmc numeric(16,4) null,
  add column if not exists icms_percentual numeric(7,4) null,
  add column if not exists tipo_lista_cmed text null;

alter table public.tabelas_comerciais_itens
  drop constraint if exists tabelas_comerciais_itens_categoria_item_check;
alter table public.tabelas_comerciais_itens
  add constraint tabelas_comerciais_itens_categoria_item_check check (
    categoria_item = any (array[
      'diaria'::text,
      'taxa'::text,
      'gas_medicinal'::text,
      'material'::text,
      'opme'::text,
      'medicamento'::text,
      'procedimento'::text,
      'pacote'::text,
      'outro'::text
    ])
  );

alter table public.tabelas_comerciais_itens
  drop constraint if exists tabelas_comerciais_itens_tabela_tuss_check;
alter table public.tabelas_comerciais_itens
  add constraint tabelas_comerciais_itens_tabela_tuss_check check (
    tabela_tuss is null or tabela_tuss = any (array[18::smallint,19::smallint,20::smallint,22::smallint])
  );

create index if not exists idx_tabelas_comerciais_itens_master on public.tabelas_comerciais_itens (item_assistencial_id) where item_assistencial_id is not null;
create index if not exists idx_tabelas_comerciais_itens_categoria on public.tabelas_comerciais_itens (edicao_id, categoria_item);
create index if not exists idx_tabelas_comerciais_itens_tuss on public.tabelas_comerciais_itens (tabela_tuss, codigo_tuss) where codigo_tuss is not null;

-- Estoque passa a apontar para o cadastro mestre; o código interno continua
-- sendo preservado para não quebrar integrações já existentes.
alter table public.estoque_produtos
  add column if not exists item_assistencial_id uuid null references public.itens_assistenciais(id) on delete set null,
  add column if not exists codigo_anvisa text null,
  add column if not exists ean text null,
  add column if not exists ggrem text null;

alter table public.estoque_produtos
  drop constraint if exists estoque_produtos_tipo_check;
alter table public.estoque_produtos
  add constraint estoque_produtos_tipo_check check (
    tipo = any (array[
      'medicamento'::text,
      'material'::text,
      'opme'::text,
      'gas_medicinal'::text,
      'dietas'::text,
      'higiene'::text,
      'expediente'::text,
      'outro'::text
    ])
  );

create index if not exists idx_estoque_produtos_item_assistencial on public.estoque_produtos (item_assistencial_id) where item_assistencial_id is not null;

-- Conta hospitalar mantém snapshot do código/tabela usado no faturamento,
-- mas ganha vínculo com o cadastro mestre para auditoria e recálculo.
alter table public.conta_faturamento_itens
  add column if not exists item_assistencial_id uuid null references public.itens_assistenciais(id) on delete set null,
  add column if not exists categoria_item text null,
  add column if not exists tabela_tuss smallint null;

alter table public.conta_faturamento_itens
  drop constraint if exists conta_faturamento_itens_categoria_item_check;
alter table public.conta_faturamento_itens
  add constraint conta_faturamento_itens_categoria_item_check check (
    categoria_item is null or categoria_item = any (array[
      'diaria'::text,
      'taxa'::text,
      'gas_medicinal'::text,
      'material'::text,
      'opme'::text,
      'medicamento'::text,
      'procedimento'::text,
      'pacote'::text,
      'outro'::text
    ])
  );

alter table public.conta_faturamento_itens
  drop constraint if exists conta_faturamento_itens_tabela_tuss_check;
alter table public.conta_faturamento_itens
  add constraint conta_faturamento_itens_tabela_tuss_check check (
    tabela_tuss is null or tabela_tuss = any (array[18::smallint,19::smallint,20::smallint,22::smallint])
  );

create index if not exists idx_conta_faturamento_itens_master on public.conta_faturamento_itens (item_assistencial_id) where item_assistencial_id is not null;

-- Prescrição pode preservar o item mestre mesmo quando não houver estoque local.
alter table public.prescricoes
  add column if not exists item_assistencial_id uuid null references public.itens_assistenciais(id) on delete set null;
create index if not exists idx_prescricoes_item_assistencial on public.prescricoes (item_assistencial_id) where item_assistencial_id is not null;

-- Migra o estoque já existente para o cadastro mestre sem excluir/alterar códigos.
insert into public.itens_assistenciais (
  empresa_id,
  codigo_interno,
  categoria,
  tabela_tuss,
  codigo_tuss,
  descricao,
  unidade_medida,
  codigo_brasindice,
  codigo_simpro,
  codigo_anvisa,
  ean,
  ggrem,
  ativo,
  created_by,
  updated_by
)
select
  p.empresa_id,
  p.codigo,
  case
    when p.tipo = 'medicamento' then 'medicamento'
    when p.tipo = 'opme' then 'opme'
    when p.tipo = 'gas_medicinal' then 'gas_medicinal'
    when p.tipo = 'material' then 'material'
    else 'outro'
  end,
  case
    when p.tipo = 'medicamento' then 20
    when p.tipo in ('material','opme') then 19
    when p.tipo = 'gas_medicinal' then 18
    else null
  end,
  p.codigo_tuss,
  p.descricao,
  p.unidade_medida,
  p.codigo_brasindice,
  p.codigo_simpro,
  p.codigo_anvisa,
  p.ean,
  p.ggrem,
  p.ativo,
  p.created_by,
  p.updated_by
from public.estoque_produtos p
on conflict (empresa_id, codigo_interno) do update set
  descricao = excluded.descricao,
  unidade_medida = excluded.unidade_medida,
  codigo_tuss = coalesce(excluded.codigo_tuss, public.itens_assistenciais.codigo_tuss),
  codigo_brasindice = coalesce(excluded.codigo_brasindice, public.itens_assistenciais.codigo_brasindice),
  codigo_simpro = coalesce(excluded.codigo_simpro, public.itens_assistenciais.codigo_simpro),
  updated_at = now();

update public.estoque_produtos p
set item_assistencial_id = i.id
from public.itens_assistenciais i
where i.empresa_id = p.empresa_id
  and i.codigo_interno = p.codigo
  and p.item_assistencial_id is null;

update public.conta_faturamento_itens
set categoria_item = case origem_tipo
  when 'medicamento' then 'medicamento'
  when 'material' then 'material'
  when 'taxa' then 'taxa'
  when 'diaria' then 'diaria'
  when 'procedimento' then 'procedimento'
  when 'laboratorio' then 'procedimento'
  when 'imagem' then 'procedimento'
  else categoria_item
end
where categoria_item is null;

update public.conta_faturamento_itens
set tabela_tuss = tabela::smallint
where tabela_tuss is null
  and tabela ~ '^(18|19|20|22)$';

-- Fontes padrão sem conteúdo proprietário. Os dados Brasíndice/SIMPRO só devem
-- ser importados quando a instituição possuir licença de uso válida.
insert into public.tabelas_comerciais_fontes (empresa_id, codigo, nome, tipo, proprietaria, observacoes, ativo)
select e.id, 'BRASINDICE', 'Brasíndice', 'brasindice', true,
       'Fonte comercial licenciada. Importar apenas dados obtidos por assinatura/licença da instituição.', true
from public.empresas e where e.ativo = true
on conflict (empresa_id, codigo) do nothing;

insert into public.tabelas_comerciais_fontes (empresa_id, codigo, nome, tipo, proprietaria, observacoes, ativo)
select e.id, 'SIMPRO', 'SIMPRO Hospitalar', 'simpro', true,
       'Fonte comercial licenciada. Importar apenas dados obtidos por assinatura/licença da instituição.', true
from public.empresas e where e.ativo = true
on conflict (empresa_id, codigo) do nothing;

insert into public.tabelas_comerciais_fontes (empresa_id, codigo, nome, tipo, proprietaria, observacoes, ativo)
select e.id, 'CMED', 'CMED / ANVISA', 'cmed', false,
       'Referência regulatória para preços de medicamentos. Manter edição/vigência do arquivo utilizado.', true
from public.empresas e where e.ativo = true
on conflict (empresa_id, codigo) do nothing;
