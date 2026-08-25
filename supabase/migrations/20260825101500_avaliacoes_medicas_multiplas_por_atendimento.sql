alter table public.encaminhamentos_assistenciais
  drop constraint if exists encaminhamentos_assistenciais_atendimento_id_key;

alter table public.encaminhamentos_assistenciais
  add column if not exists tipo_solicitacao text not null default 'encaminhamento',
  add column if not exists motivo text null,
  add column if not exists solicitante_profissional_id uuid null references public.profissionais(id) on delete set null;

alter table public.encaminhamentos_assistenciais
  drop constraint if exists encaminhamentos_assistenciais_tipo_solicitacao_check;
alter table public.encaminhamentos_assistenciais
  add constraint encaminhamentos_assistenciais_tipo_solicitacao_check
  check (tipo_solicitacao in ('encaminhamento','avaliacao_medica','interconsulta'));

create index if not exists idx_encaminhamentos_atendimento_status
  on public.encaminhamentos_assistenciais(atendimento_id,status,created_at desc);
create index if not exists idx_encaminhamentos_fila_especialidade
  on public.encaminhamentos_assistenciais(unidade_id,especialidade,status,created_at);
create unique index if not exists ux_encaminhamento_triagem_ativo
  on public.encaminhamentos_assistenciais(atendimento_id)
  where origem='triagem' and status in ('aguardando_profissional','chamado','em_atendimento');
create unique index if not exists ux_avaliacao_medica_ativa_especialidade
  on public.encaminhamentos_assistenciais(atendimento_id,especialidade)
  where tipo_solicitacao in ('avaliacao_medica','interconsulta') and status in ('aguardando_profissional','chamado','em_atendimento');
