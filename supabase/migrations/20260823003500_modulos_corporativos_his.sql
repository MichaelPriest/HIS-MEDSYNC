begin;

insert into public.permissoes(codigo,descricao) values
('compras.visualizar','Visualizar compras'),('compras.gerenciar','Gerenciar compras'),
('estoque.visualizar','Visualizar estoque e almoxarifado'),('estoque.gerenciar','Gerenciar estoque e almoxarifado'),
('auditoria.visualizar','Visualizar auditoria de contas'),('auditoria.executar','Auditar e liberar contas'),
('guias.visualizar','Visualizar central de guias'),('guias.gerenciar','Gerenciar autorizações e guias'),
('credenciamento.visualizar','Visualizar comercial e credenciamento'),('credenciamento.gerenciar','Gerenciar contratos e credenciamento')
on conflict (codigo) do nothing;

create table if not exists public.fornecedores (
  id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas,
  razao_social text not null, nome_fantasia text, cnpj text, email text, telefone text,
  contato text, ativo boolean not null default true, created_at timestamptz not null default now(),
  created_by uuid references auth.users, updated_at timestamptz not null default now(), updated_by uuid references auth.users
);

create table if not exists public.estoque_produtos (
  id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas,
  codigo text not null, descricao text not null,
  tipo text not null check (tipo in ('medicamento','material','opme','dietas','higiene','expediente','outro')),
  unidade_medida text not null default 'UN', codigo_tuss text, codigo_brasindice text, codigo_simpro text,
  estoque_minimo numeric(14,4) not null default 0, ativo boolean not null default true,
  created_at timestamptz not null default now(), created_by uuid references auth.users,
  updated_at timestamptz not null default now(), updated_by uuid references auth.users,
  unique(empresa_id,codigo)
);

create table if not exists public.estoque_locais (
  id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas,
  unidade_id uuid not null references public.unidades, nome text not null, tipo text not null default 'almoxarifado', ativo boolean not null default true,
  unique(unidade_id,nome)
);

create table if not exists public.estoque_lotes (
  id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas,
  unidade_id uuid not null references public.unidades, local_id uuid not null references public.estoque_locais,
  produto_id uuid not null references public.estoque_produtos, fornecedor_id uuid references public.fornecedores,
  numero_lote text, validade date, quantidade numeric(14,4) not null default 0, custo_unitario numeric(14,4) not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists estoque_lotes_produto_local_idx on public.estoque_lotes(unidade_id,local_id,produto_id,validade);

create table if not exists public.estoque_movimentos (
  id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas,
  unidade_id uuid not null references public.unidades, produto_id uuid not null references public.estoque_produtos,
  lote_id uuid references public.estoque_lotes, local_origem_id uuid references public.estoque_locais, local_destino_id uuid references public.estoque_locais,
  atendimento_id uuid references public.atendimentos, prescricao_id uuid references public.prescricoes,
  tipo text not null check (tipo in ('entrada','saida','transferencia','ajuste','consumo_paciente','devolucao')),
  quantidade numeric(14,4) not null check (quantidade > 0), custo_unitario numeric(14,4), motivo text,
  created_at timestamptz not null default now(), created_by uuid references auth.users
);

create table if not exists public.compras_solicitacoes (
  id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas,
  unidade_id uuid not null references public.unidades, numero text not null, solicitante_id uuid references auth.users,
  setor text, justificativa text, prioridade text not null default 'normal',
  status text not null default 'rascunho' check(status in ('rascunho','solicitada','aprovada','cotacao','pedido_emitido','parcial','recebida','cancelada')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(unidade_id,numero)
);

create table if not exists public.compras_solicitacao_itens (
  id uuid primary key default gen_random_uuid(), solicitacao_id uuid not null references public.compras_solicitacoes on delete cascade,
  produto_id uuid references public.estoque_produtos, descricao text not null, quantidade numeric(14,4) not null, unidade_medida text not null default 'UN', observacoes text
);

create table if not exists public.compras_pedidos (
  id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas,
  unidade_id uuid not null references public.unidades, solicitacao_id uuid references public.compras_solicitacoes,
  fornecedor_id uuid not null references public.fornecedores, numero text not null, data_pedido date not null default current_date,
  previsao_entrega date, valor_total numeric(14,2) not null default 0,
  status text not null default 'aberto' check(status in ('aberto','enviado','parcial','recebido','cancelado')),
  created_at timestamptz not null default now(), created_by uuid references auth.users, unique(unidade_id,numero)
);

create table if not exists public.compras_pedido_itens (
  id uuid primary key default gen_random_uuid(), pedido_id uuid not null references public.compras_pedidos on delete cascade,
  produto_id uuid references public.estoque_produtos, descricao text not null, quantidade numeric(14,4) not null,
  valor_unitario numeric(14,4) not null default 0, valor_total numeric(14,2) not null default 0, quantidade_recebida numeric(14,4) not null default 0
);

create table if not exists public.auditoria_contas (
  id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas,
  unidade_id uuid not null references public.unidades, atendimento_id uuid not null references public.atendimentos,
  conta_id uuid references public.contas_faturamento, auditor_id uuid references auth.users,
  status text not null default 'aguardando' check(status in ('aguardando','em_auditoria','pendencia_assistencial','pendencia_autorizacao','pendencia_documental','liberada','devolvida')),
  iniciado_em timestamptz, finalizado_em timestamptz, observacoes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(atendimento_id)
);

create table if not exists public.auditoria_conta_itens (
  id uuid primary key default gen_random_uuid(), auditoria_id uuid not null references public.auditoria_contas on delete cascade,
  categoria text not null, severidade text not null default 'alerta' check(severidade in ('alerta','erro','bloqueio')),
  descricao text not null, origem text, resolvida boolean not null default false, resolvida_em timestamptz, resolvida_por uuid references auth.users
);

alter table public.contas_faturamento add column if not exists auditoria_liberada boolean not null default false;
alter table public.contas_faturamento add column if not exists auditoria_id uuid references public.auditoria_contas;

create table if not exists public.central_guias (
  id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas,
  unidade_id uuid not null references public.unidades, atendimento_id uuid references public.atendimentos,
  paciente_id uuid references public.pacientes, convenio_id uuid references public.convenios, plano_id uuid references public.convenio_planos,
  tipo text not null check(tipo in ('consulta','sadt','internacao','prorrogacao','opme','medicamento','quimio','radio','outro')),
  numero_guia_prestador text, numero_guia_operadora text, senha text, validade_senha date,
  protocolo text, data_solicitacao timestamptz not null default now(), data_retorno timestamptz,
  status text not null default 'pendente' check(status in ('pendente','solicitada','em_analise','autorizada','parcial','negada','cancelada','vencida')),
  quantidade_solicitada numeric(14,4), quantidade_autorizada numeric(14,4), observacoes text,
  created_at timestamptz not null default now(), created_by uuid references auth.users, updated_at timestamptz not null default now(), updated_by uuid references auth.users
);
create index if not exists central_guias_atendimento_idx on public.central_guias(atendimento_id,status);

create table if not exists public.credenciamento_contratos (
  id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas,
  convenio_id uuid not null references public.convenios, unidade_id uuid references public.unidades,
  numero_contrato text, data_inicio date, data_fim date, status text not null default 'negociacao' check(status in ('negociacao','ativo','suspenso','encerrado')),
  prazo_pagamento_dias integer, reajuste_indice text, data_base_reajuste text, contato_comercial text, email_comercial text,
  observacoes text, created_at timestamptz not null default now(), created_by uuid references auth.users,
  updated_at timestamptz not null default now(), updated_by uuid references auth.users
);

create table if not exists public.credenciamento_tabelas (
  id uuid primary key default gen_random_uuid(), contrato_id uuid not null references public.credenciamento_contratos on delete cascade,
  nome text not null, referencia text, vigencia_inicio date, vigencia_fim date, ativo boolean not null default true
);

create table if not exists public.credenciamento_tabela_itens (
  id uuid primary key default gen_random_uuid(), tabela_id uuid not null references public.credenciamento_tabelas on delete cascade,
  codigo_tabela text, codigo text not null, descricao text not null, valor numeric(14,2) not null default 0,
  unidade text, pacote boolean not null default false, quantidade_limite numeric(14,4), autorizacao_previa boolean not null default false,
  unique(tabela_id,codigo_tabela,codigo)
);

alter table public.fornecedores enable row level security;
alter table public.estoque_produtos enable row level security;
alter table public.estoque_locais enable row level security;
alter table public.estoque_lotes enable row level security;
alter table public.estoque_movimentos enable row level security;
alter table public.compras_solicitacoes enable row level security;
alter table public.compras_pedidos enable row level security;
alter table public.auditoria_contas enable row level security;
alter table public.auditoria_conta_itens enable row level security;
alter table public.central_guias enable row level security;
alter table public.credenciamento_contratos enable row level security;
alter table public.credenciamento_tabelas enable row level security;
alter table public.credenciamento_tabela_itens enable row level security;

create policy fornecedores_select on public.fornecedores for select using (public.tem_empresa(empresa_id));
create policy estoque_produtos_select on public.estoque_produtos for select using (public.tem_empresa(empresa_id));
create policy estoque_locais_select on public.estoque_locais for select using (public.tem_unidade(empresa_id,unidade_id));
create policy estoque_lotes_select on public.estoque_lotes for select using (public.tem_unidade(empresa_id,unidade_id));
create policy estoque_movimentos_select on public.estoque_movimentos for select using (public.tem_unidade(empresa_id,unidade_id));
create policy compras_solicitacoes_select on public.compras_solicitacoes for select using (public.tem_unidade(empresa_id,unidade_id));
create policy compras_pedidos_select on public.compras_pedidos for select using (public.tem_unidade(empresa_id,unidade_id));
create policy auditoria_contas_select on public.auditoria_contas for select using (public.tem_unidade(empresa_id,unidade_id));
create policy central_guias_select on public.central_guias for select using (public.tem_unidade(empresa_id,unidade_id));
create policy credenciamento_contratos_select on public.credenciamento_contratos for select using (public.tem_empresa(empresa_id));

comment on table public.auditoria_contas is 'Auditoria pós-alta e pré-faturamento. A conta só deve seguir ao TISS após auditoria_liberada=true.';
comment on table public.central_guias is 'Central corporativa de autorizações assistenciais vinculadas à conta/atendimento.';
comment on table public.credenciamento_contratos is 'Contratos comerciais com operadoras, incluindo vigência e parâmetros financeiros.';

commit;
