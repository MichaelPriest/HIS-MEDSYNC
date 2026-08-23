-- Painéis configuráveis + autorização + roteamento pós-triagem.
-- O HIS usa UUID nas entidades assistenciais e cadastrais.

alter table public.profissionais add column if not exists usuario_id uuid references auth.users(id);
create unique index if not exists profissionais_usuario_unique on public.profissionais(usuario_id) where usuario_id is not null;

alter table public.atendimentos add column if not exists especialidade_destino text;
alter table public.atendimentos add column if not exists triagem_concluida_em timestamptz;
alter table public.senhas_atendimento add column if not exists setor_destino_id uuid references public.setores_chamada(id);

create table if not exists public.configuracoes_painel_chamadas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  unidade_id uuid not null references public.unidades(id),
  modo text not null default 'integrado' check (modo in ('integrado','setorial')),
  recepcao_chama_todos boolean not null default true,
  chamar_por_nome_apos_identificacao boolean not null default true,
  exibir_senha_apoio boolean not null default true,
  tocar_audio boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  unique (unidade_id)
);

create table if not exists public.autorizacoes_atendimento (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  unidade_id uuid not null references public.unidades(id),
  atendimento_id uuid not null references public.atendimentos(id) on delete restrict,
  paciente_id uuid not null references public.pacientes(id) on delete restrict,
  convenio_id uuid references public.convenios(id) on delete restrict,
  plano_id uuid references public.convenio_planos(id) on delete restrict,
  numero_guia_prestador text,
  numero_guia_operadora text,
  senha_autorizacao text,
  validade date,
  status text not null default 'pendente' check (status in ('pendente','solicitada','autorizada','negada','dispensada')),
  observacao text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  unique(atendimento_id)
);

create table if not exists public.encaminhamentos_assistenciais (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  unidade_id uuid not null references public.unidades(id),
  atendimento_id uuid not null references public.atendimentos(id) on delete restrict,
  paciente_id uuid not null references public.pacientes(id) on delete restrict,
  origem text not null default 'triagem',
  especialidade text not null,
  profissional_id uuid references public.profissionais(id) on delete restrict,
  status text not null default 'aguardando_profissional' check (status in ('aguardando_profissional','chamado','em_atendimento','concluido','cancelado')),
  prioridade text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  chamado_em timestamptz,
  iniciado_em timestamptz,
  concluido_em timestamptz,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  unique(atendimento_id)
);

create index if not exists idx_encaminhamentos_especialidade_status on public.encaminhamentos_assistenciais(unidade_id,especialidade,status,created_at);
create index if not exists idx_autorizacoes_atendimento on public.autorizacoes_atendimento(unidade_id,atendimento_id,status);

insert into public.permissoes(codigo,descricao) values
('autorizacoes.visualizar','Visualizar autorizações assistenciais'),
('autorizacoes.editar','Solicitar e atualizar autorizações'),
('triagem.encaminhar','Definir especialidade e encaminhar paciente'),
('fila_medica.visualizar','Visualizar fila médica da própria especialidade'),
('fila_medica.assumir','Assumir paciente da própria especialidade'),
('paineis.configurar','Configurar painéis e chamadas')
on conflict (codigo) do nothing;

alter table public.configuracoes_painel_chamadas enable row level security;
alter table public.autorizacoes_atendimento enable row level security;
alter table public.encaminhamentos_assistenciais enable row level security;

create policy config_painel_select on public.configuracoes_painel_chamadas for select to authenticated
using (public.tem_unidade(empresa_id,unidade_id));
create policy config_painel_write on public.configuracoes_painel_chamadas for all to authenticated
using (public.tem_unidade(empresa_id,unidade_id) and public.tem_permissao(empresa_id,unidade_id,'paineis.configurar'))
with check (public.tem_unidade(empresa_id,unidade_id) and updated_by=auth.uid());

create policy autorizacoes_select on public.autorizacoes_atendimento for select to authenticated
using (public.tem_unidade(empresa_id,unidade_id) and (public.tem_permissao(empresa_id,unidade_id,'autorizacoes.visualizar') or public.tem_permissao(empresa_id,unidade_id,'atendimentos.visualizar')));
create policy autorizacoes_insert on public.autorizacoes_atendimento for insert to authenticated
with check (public.tem_unidade(empresa_id,unidade_id) and created_by=auth.uid());
create policy autorizacoes_update on public.autorizacoes_atendimento for update to authenticated
using (public.tem_unidade(empresa_id,unidade_id) and public.tem_permissao(empresa_id,unidade_id,'autorizacoes.editar'))
with check (public.tem_unidade(empresa_id,unidade_id) and updated_by=auth.uid());

create policy encaminhamentos_select on public.encaminhamentos_assistenciais for select to authenticated
using (public.tem_unidade(empresa_id,unidade_id));
create policy encaminhamentos_insert on public.encaminhamentos_assistenciais for insert to authenticated
with check (public.tem_unidade(empresa_id,unidade_id) and created_by=auth.uid());
create policy encaminhamentos_update on public.encaminhamentos_assistenciais for update to authenticated
using (public.tem_unidade(empresa_id,unidade_id))
with check (public.tem_unidade(empresa_id,unidade_id) and updated_by=auth.uid());

-- A aplicação executa o fluxo:
-- Recepção -> autorização (quando convênio) -> triagem define especialidade ->
-- encaminhamento -> fila do profissional logado compatível -> prontuário.
