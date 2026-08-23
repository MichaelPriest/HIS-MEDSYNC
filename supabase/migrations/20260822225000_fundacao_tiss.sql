-- Fundação TISS baseada na página oficial ANS Padrão TISS Julho/2026.
-- Versões vigentes publicadas pela ANS em 03/08/2026:
-- Organizacional 202607; Conteúdo/Estrutura 202511; TUSS 202607;
-- Segurança/Privacidade 202511; Comunicação 04.03.00 e 01.06.00.

create table if not exists public.tiss_versoes (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  organizacional text not null,
  conteudo_estrutura text not null,
  tuss text not null,
  seguranca_privacidade text not null,
  comunicacao_principal text not null,
  comunicacao_secundaria text null,
  fonte_oficial text not null,
  vigente_desde date null,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.tiss_versoes(codigo,organizacional,conteudo_estrutura,tuss,seguranca_privacidade,comunicacao_principal,comunicacao_secundaria,fonte_oficial,vigente_desde)
values ('2026-07','202607','202511','202607','202511','04.03.00','01.06.00','https://www.gov.br/ans/pt-br/assuntos/prestadores/padrao-para-troca-de-informacao-de-saude-suplementar-2013-tiss/padrao-tiss-julho-2026','2026-07-01')
on conflict (codigo) do update set organizacional=excluded.organizacional,conteudo_estrutura=excluded.conteudo_estrutura,tuss=excluded.tuss,seguranca_privacidade=excluded.seguranca_privacidade,comunicacao_principal=excluded.comunicacao_principal,comunicacao_secundaria=excluded.comunicacao_secundaria,fonte_oficial=excluded.fonte_oficial,ativo=true;

create table if not exists public.tiss_guias (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas,
  unidade_id uuid not null references public.unidades,
  atendimento_id uuid null references public.atendimentos,
  paciente_id uuid null references public.pacientes,
  convenio_id uuid null references public.convenios,
  plano_id uuid null references public.convenio_planos,
  profissional_id uuid null references public.profissionais,
  versao_id uuid not null references public.tiss_versoes,
  tipo_guia text not null check (tipo_guia in ('consulta','sp_sadt','solicitacao_internacao','resumo_internacao','honorario_individual','tratamento_odontologico','outras_despesas','opme','quimioterapia','radioterapia','recurso_glosa')),
  numero_guia_prestador text not null,
  numero_guia_operadora text null,
  numero_guia_principal text null,
  numero_solicitacao_internacao text null,
  registro_ans text null,
  codigo_prestador_operadora text null,
  numero_carteirinha text null,
  validade_carteirinha date null,
  senha_autorizacao text null,
  validade_senha date null,
  cid_principal text null,
  carater_atendimento text null,
  tipo_atendimento text null,
  indicacao_clinica text null,
  data_atendimento date null,
  hora_inicio time null,
  hora_fim time null,
  status text not null default 'rascunho' check (status in ('rascunho','pronta','faturada','em_lote','enviada','aceita','rejeitada','cancelada')),
  valor_total numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users,
  unique (empresa_id, convenio_id, numero_guia_prestador)
);
create index if not exists tiss_guias_atendimento_idx on public.tiss_guias(atendimento_id);
create index if not exists tiss_guias_status_idx on public.tiss_guias(empresa_id,unidade_id,status,tipo_guia);

create table if not exists public.tiss_guia_itens (
  id uuid primary key default gen_random_uuid(),
  guia_id uuid not null references public.tiss_guias on delete cascade,
  sequencial integer not null,
  data_execucao date null,
  hora_inicial time null,
  hora_final time null,
  tabela text null,
  codigo_procedimento text not null,
  descricao text null,
  quantidade numeric(12,4) not null default 1,
  via_acesso text null,
  tecnica_utilizada text null,
  reducao_acrescimo numeric(8,4) null,
  valor_unitario numeric(14,2) not null default 0,
  valor_total numeric(14,2) not null default 0,
  codigo_glosa text null,
  created_at timestamptz not null default now(),
  unique (guia_id, sequencial)
);

create table if not exists public.tiss_lotes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas,
  unidade_id uuid not null references public.unidades,
  convenio_id uuid not null references public.convenios,
  versao_id uuid not null references public.tiss_versoes,
  numero_lote text not null,
  competencia text null,
  status text not null default 'rascunho' check (status in ('rascunho','validando','valido','invalido','gerado','enviado','protocolado','aceito','rejeitado')),
  protocolo_operadora text null,
  enviado_em timestamptz null,
  retorno_em timestamptz null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users,
  unique (empresa_id, convenio_id, numero_lote)
);

create table if not exists public.tiss_lote_guias (
  lote_id uuid not null references public.tiss_lotes on delete cascade,
  guia_id uuid not null references public.tiss_guias,
  primary key (lote_id, guia_id)
);

create table if not exists public.tiss_xmls (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid null references public.tiss_lotes on delete cascade,
  guia_id uuid null references public.tiss_guias on delete cascade,
  tipo_mensagem text not null,
  versao_comunicacao text not null,
  xml_conteudo text not null,
  hash_documento text null,
  xsd_validado boolean not null default false,
  validado_em timestamptz null,
  erros_validacao jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  check (lote_id is not null or guia_id is not null)
);

create table if not exists public.tiss_retornos (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid null references public.tiss_lotes,
  guia_id uuid null references public.tiss_guias,
  protocolo text null,
  tipo_retorno text not null,
  status text null,
  codigo_erro text null,
  mensagem text null,
  xml_retorno text null,
  recebido_em timestamptz not null default now()
);

alter table public.tiss_guias enable row level security;
alter table public.tiss_guias force row level security;
alter table public.tiss_lotes enable row level security;
alter table public.tiss_lotes force row level security;

create policy tiss_guias_select on public.tiss_guias for select using (public.tem_unidade(empresa_id,unidade_id));
create policy tiss_guias_insert on public.tiss_guias for insert with check (public.tem_unidade(empresa_id,unidade_id) and created_by=auth.uid());
create policy tiss_guias_update on public.tiss_guias for update using (public.tem_unidade(empresa_id,unidade_id)) with check (public.tem_unidade(empresa_id,unidade_id) and updated_by=auth.uid());
create policy tiss_lotes_select on public.tiss_lotes for select using (public.tem_unidade(empresa_id,unidade_id));
create policy tiss_lotes_insert on public.tiss_lotes for insert with check (public.tem_unidade(empresa_id,unidade_id) and created_by=auth.uid());

comment on table public.tiss_guias is 'Snapshot de cobrança TISS derivado do episódio assistencial/faturamento; não substitui o prontuário.';
comment on table public.tiss_xmls is 'XML gerado deve ser validado contra XSD oficial da versão de comunicação antes de envio.';
