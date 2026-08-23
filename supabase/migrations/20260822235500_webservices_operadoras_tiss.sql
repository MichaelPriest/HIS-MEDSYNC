begin;

create table if not exists public.tiss_webservice_configuracoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas,
  unidade_id uuid references public.unidades,
  convenio_id uuid not null references public.convenios on delete cascade,
  ambiente text not null default 'homologacao' check (ambiente in ('homologacao','producao')),
  ativo boolean not null default true,
  versao_comunicacao text not null,
  transporte text not null default 'soap' check (transporte in ('soap','http_xml','sftp','manual')),
  endpoint_url text,
  wsdl_url text,
  soap_action text,
  namespace_operacao text,
  operacao_envio text,
  operacao_status text,
  operacao_cancelamento text,
  operacao_retorno text,
  codigo_prestador_operadora text,
  tipo_autenticacao text not null default 'nenhuma' check (tipo_autenticacao in ('nenhuma','basic','bearer','cabecalho','certificado_mtls')),
  usuario text,
  segredo_referencia text,
  token_referencia text,
  certificado_referencia text,
  certificado_senha_referencia text,
  header_nome text,
  timeout_ms integer not null default 30000 check (timeout_ms between 1000 and 180000),
  validar_tls boolean not null default true,
  observacoes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users,
  unique (convenio_id, ambiente)
);

create table if not exists public.tiss_webservice_transacoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas,
  unidade_id uuid references public.unidades,
  convenio_id uuid not null references public.convenios,
  configuracao_id uuid references public.tiss_webservice_configuracoes,
  lote_id uuid references public.tiss_lotes,
  guia_id uuid references public.tiss_guias,
  xml_id uuid references public.tiss_xmls,
  tipo_operacao text not null,
  ambiente text not null,
  endpoint_url text,
  protocolo_local text not null,
  protocolo_operadora text,
  status text not null default 'pendente' check (status in ('pendente','enviando','enviado','aceito','rejeitado','erro','timeout','cancelado')),
  http_status integer,
  requisicao_headers jsonb not null default '{}'::jsonb,
  resposta_headers jsonb not null default '{}'::jsonb,
  requisicao_resumo text,
  resposta_conteudo text,
  codigo_erro text,
  mensagem_erro text,
  tentativas integer not null default 0,
  iniciado_em timestamptz,
  finalizado_em timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users
);
create index if not exists tiss_webservice_transacoes_lote_idx on public.tiss_webservice_transacoes(lote_id,created_at desc);
create index if not exists tiss_webservice_transacoes_convenio_idx on public.tiss_webservice_transacoes(convenio_id,ambiente,status,created_at desc);

alter table public.tiss_webservice_configuracoes enable row level security;
alter table public.tiss_webservice_configuracoes force row level security;
alter table public.tiss_webservice_transacoes enable row level security;
alter table public.tiss_webservice_transacoes force row level security;

create policy tiss_ws_config_select on public.tiss_webservice_configuracoes for select using (public.tem_empresa(empresa_id));
create policy tiss_ws_config_insert on public.tiss_webservice_configuracoes for insert with check (public.tem_empresa(empresa_id) and created_by=auth.uid());
create policy tiss_ws_config_update on public.tiss_webservice_configuracoes for update using (public.tem_empresa(empresa_id)) with check (public.tem_empresa(empresa_id) and updated_by=auth.uid());
create policy tiss_ws_tx_select on public.tiss_webservice_transacoes for select using (public.tem_empresa(empresa_id));
create policy tiss_ws_tx_insert on public.tiss_webservice_transacoes for insert with check (public.tem_empresa(empresa_id) and created_by=auth.uid());

revoke delete,truncate on public.tiss_webservice_configuracoes, public.tiss_webservice_transacoes from anon,authenticated;

comment on column public.tiss_webservice_configuracoes.segredo_referencia is 'Referência a segredo externo/variável segura. Nunca armazenar senha em texto puro nesta tabela.';
comment on column public.tiss_webservice_configuracoes.certificado_referencia is 'Referência a certificado cliente armazenado em cofre/secret manager; não armazenar bytes do certificado nesta tabela.';

commit;
