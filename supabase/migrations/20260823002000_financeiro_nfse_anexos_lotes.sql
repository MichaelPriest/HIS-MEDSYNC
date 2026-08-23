alter table public.tiss_lotes
  add column if not exists previsao_pagamento date,
  add column if not exists data_envio_manual timestamptz,
  add column if not exists protocolo_envio_operadora text,
  add column if not exists origem_protocolo text,
  add column if not exists observacoes_envio text;

create table if not exists public.tiss_lote_anexos (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid not null references public.tiss_lotes on delete cascade,
  tipo text not null check (tipo in ('comprovante_envio','protocolo','retorno','demonstrativo','nota_fiscal','outro')),
  nome_arquivo text not null,
  storage_path text not null,
  mime_type text null,
  tamanho_bytes bigint null,
  observacao text null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users
);

create table if not exists public.financeiro_recebiveis (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas,
  unidade_id uuid not null references public.unidades,
  lote_id uuid null references public.tiss_lotes,
  convenio_id uuid null references public.convenios,
  competencia text not null,
  previsao_pagamento date null,
  data_pagamento date null,
  valor_bruto numeric(14,2) not null default 0,
  valor_glosa numeric(14,2) not null default 0,
  valor_liquido_previsto numeric(14,2) not null default 0,
  valor_recebido numeric(14,2) not null default 0,
  status text not null default 'previsto' check (status in ('previsto','faturado','aguardando_pagamento','parcial','recebido','vencido','cancelado')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users
);

create table if not exists public.nfse_configuracoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas,
  unidade_id uuid null references public.unidades,
  municipio_ibge text not null,
  municipio_nome text not null,
  uf char(2) not null,
  provedor text null,
  modo text not null default 'manual' check (modo in ('manual','webservice','api')),
  ambiente text not null default 'homologacao' check (ambiente in ('homologacao','producao')),
  endpoint_url text null,
  wsdl_url text null,
  versao text null,
  codigo_servico_municipal text null,
  item_lista_servico text null,
  codigo_tributacao_municipio text null,
  natureza_operacao text null,
  regime_especial_tributacao text null,
  optante_simples_nacional boolean null,
  incentivador_cultural boolean null,
  inscricao_municipal text null,
  auth_tipo text not null default 'nenhuma' check (auth_tipo in ('nenhuma','basic','bearer','header','mtls')),
  auth_usuario_ref text null,
  auth_segredo_ref text null,
  certificado_ref text null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users,
  unique (empresa_id, unidade_id, municipio_ibge, ambiente)
);

create table if not exists public.notas_fiscais_servico (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas,
  unidade_id uuid not null references public.unidades,
  lote_id uuid null references public.tiss_lotes,
  convenio_id uuid null references public.convenios,
  configuracao_id uuid null references public.nfse_configuracoes,
  competencia text not null,
  tomador_cnpj text null,
  tomador_razao_social text null,
  valor_servicos numeric(14,2) not null default 0,
  valor_deducoes numeric(14,2) not null default 0,
  valor_iss numeric(14,2) not null default 0,
  aliquota_iss numeric(8,4) null,
  valor_liquido numeric(14,2) not null default 0,
  numero_rps text null,
  serie_rps text null,
  numero_nfse text null,
  codigo_verificacao text null,
  protocolo_prefeitura text null,
  status text not null default 'rascunho' check (status in ('rascunho','pronta','enviando','emitida','rejeitada','cancelada','erro')),
  xml_envio text null,
  xml_retorno text null,
  pdf_storage_path text null,
  data_emissao timestamptz null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users
);

create table if not exists public.nfse_transacoes (
  id uuid primary key default gen_random_uuid(),
  nota_id uuid not null references public.notas_fiscais_servico on delete cascade,
  configuracao_id uuid null references public.nfse_configuracoes,
  tipo_operacao text not null,
  status text not null,
  http_status integer null,
  protocolo text null,
  mensagem_erro text null,
  request_payload text null,
  response_payload text null,
  created_at timestamptz not null default now()
);

alter table public.financeiro_recebiveis enable row level security;
alter table public.notas_fiscais_servico enable row level security;
alter table public.nfse_configuracoes enable row level security;
alter table public.tiss_lote_anexos enable row level security;

create policy financeiro_recebiveis_all on public.financeiro_recebiveis for all using (public.tem_unidade(empresa_id,unidade_id)) with check (public.tem_unidade(empresa_id,unidade_id));
create policy nfse_configuracoes_all on public.nfse_configuracoes for all using (public.tem_empresa(empresa_id)) with check (public.tem_empresa(empresa_id));
create policy notas_fiscais_servico_all on public.notas_fiscais_servico for all using (public.tem_unidade(empresa_id,unidade_id)) with check (public.tem_unidade(empresa_id,unidade_id));
create policy tiss_lote_anexos_select on public.tiss_lote_anexos for select using (exists(select 1 from public.tiss_lotes l where l.id=lote_id and public.tem_unidade(l.empresa_id,l.unidade_id)));
create policy tiss_lote_anexos_insert on public.tiss_lote_anexos for insert with check (exists(select 1 from public.tiss_lotes l where l.id=lote_id and public.tem_unidade(l.empresa_id,l.unidade_id)) and created_by=auth.uid());
