begin;

insert into public.permissoes(codigo,descricao) values
('ged.visualizar','Visualizar documentos GED'),
('ged.gerenciar','Gerenciar documentos GED'),
('contas_medicas.visualizar','Visualizar contas médicas'),
('contas_medicas.processar','Processar contas médicas'),
('diretoria.visualizar','Visualizar painel da diretoria'),
('compras.receber','Receber pedidos de compra e integrar estoque/financeiro')
on conflict (codigo) do nothing;

create table if not exists public.ged_documentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas,
  unidade_id uuid references public.unidades,
  atendimento_id uuid references public.atendimentos,
  paciente_id uuid references public.pacientes,
  profissional_id uuid references public.profissionais,
  convenio_id uuid references public.convenios,
  lote_tiss_id uuid references public.tiss_lotes,
  conta_faturamento_id uuid references public.contas_faturamento,
  categoria text not null,
  subcategoria text,
  titulo text not null,
  nome_arquivo text not null,
  storage_path text not null,
  mime_type text,
  tamanho_bytes bigint,
  hash_sha256 text,
  versao integer not null default 1,
  status text not null default 'ativo' check (status in ('ativo','arquivado','substituido','cancelado')),
  confidencial boolean not null default false,
  observacoes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users
);
create index if not exists ged_atendimento_idx on public.ged_documentos(atendimento_id,categoria,created_at desc);
create index if not exists ged_conta_idx on public.ged_documentos(conta_faturamento_id,categoria,created_at desc);

create table if not exists public.contas_medicas_processos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas,
  unidade_id uuid not null references public.unidades,
  conta_id uuid not null unique references public.contas_faturamento on delete cascade,
  atendimento_id uuid not null references public.atendimentos,
  paciente_id uuid not null references public.pacientes,
  convenio_id uuid references public.convenios,
  status text not null default 'aguardando' check (status in ('aguardando','em_analise','pendente_documentacao','pendente_autorizacao','pendente_contrato','liberada_tiss','devolvida_auditoria','cancelada')),
  checklist_documental jsonb not null default '{}'::jsonb,
  total_itens integer not null default 0,
  total_autorizado numeric(14,2) not null default 0,
  total_nao_autorizado numeric(14,2) not null default 0,
  total_conta numeric(14,2) not null default 0,
  observacoes text,
  iniciado_em timestamptz,
  concluido_em timestamptz,
  analisado_por uuid references auth.users,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists contas_medicas_status_idx on public.contas_medicas_processos(empresa_id,unidade_id,status,created_at desc);

create table if not exists public.contas_medicas_pendencias (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid not null references public.contas_medicas_processos on delete cascade,
  tipo text not null check (tipo in ('documentacao','autorizacao','contrato','cadastro','procedimento','valor','outro')),
  severidade text not null default 'bloqueio' check (severidade in ('alerta','erro','bloqueio')),
  descricao text not null,
  resolvida boolean not null default false,
  resolvida_em timestamptz,
  resolvida_por uuid references auth.users,
  created_at timestamptz not null default now()
);

alter table public.contas_faturamento add column if not exists contas_medicas_liberada boolean not null default false;
alter table public.contas_faturamento add column if not exists contas_medicas_liberada_em timestamptz;

create table if not exists public.compras_recebimentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas,
  unidade_id uuid not null references public.unidades,
  pedido_id uuid not null references public.compras_pedidos on delete restrict,
  fornecedor_id uuid references public.fornecedores,
  numero_documento text,
  serie_documento text,
  data_emissao date,
  data_recebimento timestamptz not null default now(),
  valor_documento numeric(14,2) not null default 0,
  vencimento date,
  ged_documento_id uuid references public.ged_documentos,
  status text not null default 'recebido' check (status in ('recebido','conferido','divergente','cancelado')),
  observacoes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users
);

create table if not exists public.compras_recebimento_itens (
  id uuid primary key default gen_random_uuid(),
  recebimento_id uuid not null references public.compras_recebimentos on delete cascade,
  produto_id uuid not null references public.estoque_produtos,
  quantidade numeric(14,4) not null check (quantidade > 0),
  valor_unitario numeric(14,4) not null default 0,
  lote text,
  validade date,
  local_estoque_id uuid references public.estoque_locais,
  farmacia boolean not null default false
);

create table if not exists public.financeiro_contas_pagar (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas,
  unidade_id uuid not null references public.unidades,
  fornecedor_id uuid references public.fornecedores,
  compra_recebimento_id uuid references public.compras_recebimentos,
  documento text,
  competencia text,
  vencimento date,
  valor_bruto numeric(14,2) not null default 0,
  descontos numeric(14,2) not null default 0,
  acrescimos numeric(14,2) not null default 0,
  valor_pago numeric(14,2) not null default 0,
  status text not null default 'aberto' check (status in ('aberto','parcial','pago','cancelado','vencido')),
  pago_em timestamptz,
  observacoes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users
);
create index if not exists financeiro_pagar_vencimento_idx on public.financeiro_contas_pagar(empresa_id,unidade_id,status,vencimento);

create or replace view public.vw_diretoria_indicadores
with (security_invoker=true)
as
select
  u.empresa_id,
  u.id as unidade_id,
  (select count(*) from public.atendimentos a where a.unidade_id=u.id and a.data_abertura::date=current_date) as atendimentos_hoje,
  (select count(*) from public.internacoes i where i.unidade_id=u.id and i.status in ('internado','transferido')) as pacientes_internados,
  (select coalesce(sum(cf.valor_liquido),0) from public.contas_faturamento cf where cf.unidade_id=u.id and cf.competencia=to_char(current_date,'YYYY-MM')) as faturamento_competencia,
  (select coalesce(sum(fr.valor_previsto),0) from public.financeiro_recebiveis fr where fr.unidade_id=u.id and fr.status in ('previsto','faturado','parcial')) as contas_receber_aberto,
  (select coalesce(sum(fp.valor_bruto-fp.valor_pago),0) from public.financeiro_contas_pagar fp where fp.unidade_id=u.id and fp.status in ('aberto','parcial','vencido')) as contas_pagar_aberto,
  (select coalesce(sum(g.valor_glosado),0) from public.tiss_glosas g where g.unidade_id=u.id and g.status in ('aberta','em_recurso')) as glosas_abertas,
  (select count(*) from public.auditoria_contas ac where ac.unidade_id=u.id and ac.status in ('aguardando','em_auditoria','com_pendencias')) as contas_em_auditoria,
  (select count(*) from public.contas_medicas_processos cm where cm.unidade_id=u.id and cm.status not in ('liberada_tiss','cancelada')) as contas_medicas_pendentes
from public.unidades u;

grant select on public.vw_diretoria_indicadores to authenticated;

alter table public.ged_documentos enable row level security;
alter table public.contas_medicas_processos enable row level security;
alter table public.contas_medicas_pendencias enable row level security;
alter table public.compras_recebimentos enable row level security;
alter table public.compras_recebimento_itens enable row level security;
alter table public.financeiro_contas_pagar enable row level security;

create policy ged_select on public.ged_documentos for select using (public.tem_empresa(empresa_id) and public.tem_permissao(empresa_id,unidade_id,'ged.visualizar'));
create policy ged_insert on public.ged_documentos for insert with check (public.tem_empresa(empresa_id) and public.tem_permissao(empresa_id,unidade_id,'ged.gerenciar') and created_by=auth.uid());
create policy contas_medicas_select on public.contas_medicas_processos for select using (public.tem_unidade(empresa_id,unidade_id) and public.tem_permissao(empresa_id,unidade_id,'contas_medicas.visualizar'));
create policy contas_medicas_write on public.contas_medicas_processos for all using (public.tem_unidade(empresa_id,unidade_id) and public.tem_permissao(empresa_id,unidade_id,'contas_medicas.processar')) with check (public.tem_unidade(empresa_id,unidade_id) and public.tem_permissao(empresa_id,unidade_id,'contas_medicas.processar'));
create policy compras_recebimentos_select on public.compras_recebimentos for select using (public.tem_unidade(empresa_id,unidade_id));
create policy compras_recebimentos_write on public.compras_recebimentos for all using (public.tem_unidade(empresa_id,unidade_id) and public.tem_permissao(empresa_id,unidade_id,'compras.receber')) with check (public.tem_unidade(empresa_id,unidade_id) and public.tem_permissao(empresa_id,unidade_id,'compras.receber'));
create policy contas_pagar_select on public.financeiro_contas_pagar for select using (public.tem_unidade(empresa_id,unidade_id));

commit;
