create table if not exists public.ti_ativos (
  id uuid primary key default gen_random_uuid(), empresa_id uuid not null, unidade_id uuid not null, setor_id uuid null references public.setores(id) on delete set null,
  patrimonio text null, categoria text not null, fabricante text null, modelo text null, numero_serie text null, hostname text null, ip text null, mac text null,
  sistema_operacional text null, responsavel text null, localizacao text null, status text not null default 'ativo', criticidade text not null default 'media',
  data_aquisicao date null, garantia_ate date null, fornecedor text null, valor_aquisicao numeric(14,2) null, observacoes text null,
  created_at timestamptz not null default now(), created_by uuid null, updated_at timestamptz not null default now(), updated_by uuid null
);
create unique index if not exists ux_ti_ativos_patrimonio on public.ti_ativos(empresa_id,patrimonio) where patrimonio is not null;
create index if not exists ix_ti_ativos_setor on public.ti_ativos(empresa_id,unidade_id,setor_id,status);

create table if not exists public.ti_chamados (
  id uuid primary key default gen_random_uuid(), empresa_id uuid not null, unidade_id uuid not null, numero bigserial,
  setor_id uuid null references public.setores(id) on delete set null, ativo_id uuid null references public.ti_ativos(id) on delete set null,
  solicitante_usuario_id uuid null, solicitante_nome text null, titulo text not null, descricao text not null, categoria text not null default 'suporte', subcategoria text null,
  tipo text not null default 'incidente', prioridade text not null default 'media', impacto text not null default 'medio', urgencia text not null default 'media',
  status text not null default 'aberto', tecnico_responsavel_id uuid null, grupo_responsavel text null,
  sla_resposta_minutos integer null, sla_solucao_minutos integer null, primeira_resposta_em timestamptz null, prazo_sla timestamptz null,
  resolvido_em timestamptz null, fechado_em timestamptz null, resolucao text null, causa_raiz text null, satisfacao integer null,
  created_at timestamptz not null default now(), created_by uuid null, updated_at timestamptz not null default now(), updated_by uuid null
);
create unique index if not exists ux_ti_chamados_numero on public.ti_chamados(empresa_id,unidade_id,numero);
create index if not exists ix_ti_chamados_fila on public.ti_chamados(empresa_id,unidade_id,status,prioridade,created_at);

create table if not exists public.ti_chamado_interacoes (
  id uuid primary key default gen_random_uuid(), chamado_id uuid not null references public.ti_chamados(id) on delete cascade,
  tipo text not null default 'comentario', mensagem text not null, publico_solicitante boolean not null default true,
  autor_usuario_id uuid null, created_at timestamptz not null default now()
);
create index if not exists ix_ti_chamado_interacoes on public.ti_chamado_interacoes(chamado_id,created_at);

create table if not exists public.ti_licencas_contratos (
  id uuid primary key default gen_random_uuid(), empresa_id uuid not null, unidade_id uuid not null, tipo text not null default 'licenca', fornecedor text not null,
  produto_servico text not null, numero_contrato text null, quantidade integer null, valor_mensal numeric(14,2) null, valor_anual numeric(14,2) null,
  inicio_vigencia date null, fim_vigencia date null, renovacao_automatica boolean not null default false, responsavel text null, status text not null default 'ativo',
  observacoes text null, created_at timestamptz not null default now(), created_by uuid null, updated_at timestamptz not null default now(), updated_by uuid null
);
create index if not exists ix_ti_licencas_vencimento on public.ti_licencas_contratos(empresa_id,unidade_id,fim_vigencia,status);

create table if not exists public.ti_mudancas (
  id uuid primary key default gen_random_uuid(), empresa_id uuid not null, unidade_id uuid not null, titulo text not null, descricao text not null,
  tipo text not null default 'normal', risco text not null default 'medio', impacto text not null default 'medio', status text not null default 'planejada',
  janela_inicio timestamptz null, janela_fim timestamptz null, plano_implementacao text null, plano_rollback text null, validacao text null,
  solicitante_id uuid null, aprovador_id uuid null, executado_por uuid null, concluido_em timestamptz null,
  created_at timestamptz not null default now(), created_by uuid null, updated_at timestamptz not null default now(), updated_by uuid null
);

create table if not exists public.ti_base_conhecimento (
  id uuid primary key default gen_random_uuid(), empresa_id uuid not null, unidade_id uuid null, titulo text not null, categoria text not null,
  resumo text null, conteudo text not null, palavras_chave text[] not null default '{}', publicado boolean not null default false,
  autor_id uuid null, publicado_em timestamptz null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists ix_ti_base_categoria on public.ti_base_conhecimento(empresa_id,categoria,publicado);

create table if not exists public.ti_monitoramentos (
  id uuid primary key default gen_random_uuid(), empresa_id uuid not null, unidade_id uuid not null, ativo_id uuid null references public.ti_ativos(id) on delete cascade,
  nome text not null, tipo text not null, alvo text null, status text not null default 'ok', ultimo_check_em timestamptz null, latencia_ms numeric(12,2) null,
  disponibilidade_percentual numeric(6,3) null, mensagem text null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

insert into public.permissoes(codigo,descricao,ativo) values
 ('ti.visualizar','Visualizar módulo de TI',true),('ti.chamados.abrir','Abrir chamados de TI',true),('ti.chamados.atender','Atender chamados de TI',true),
 ('ti.ativos.gerenciar','Gerenciar ativos de TI',true),('ti.contratos.gerenciar','Gerenciar licenças e contratos de TI',true),('ti.mudancas.gerenciar','Gerenciar mudanças de TI',true),
 ('ti.base.gerenciar','Gerenciar base de conhecimento de TI',true),('ti.admin','Administrar módulo de TI',true)
on conflict (codigo) do update set descricao=excluded.descricao,ativo=true;
