alter table public.atendimentos add column if not exists ambiente_assistencial text;
update public.atendimentos set ambiente_assistencial=case
  when coalesce(setor_atual,'') in ('pronto_socorro','urgencia','emergencia') then 'pronto_atendimento'
  when coalesce(setor_atual,'') in ('internacao','uti','unidade_internacao') then 'internacao'
  else 'ambulatorial' end
where ambiente_assistencial is null;
alter table public.atendimentos alter column ambiente_assistencial set default 'ambulatorial';
alter table public.atendimentos add constraint atendimentos_ambiente_assistencial_ck check (ambiente_assistencial in ('ambulatorial','pronto_atendimento','internacao','hospital_dia','dialise','domiciliar')) not valid;
create index if not exists idx_atendimentos_ambiente_fila on public.atendimentos(empresa_id,unidade_id,ambiente_assistencial,status,data_abertura);

create table if not exists public.documentos_clinicos_atendimento (
 id uuid primary key default gen_random_uuid(), empresa_id uuid not null, unidade_id uuid not null,
 atendimento_id uuid not null references public.atendimentos(id) on delete restrict,
 paciente_id uuid not null references public.pacientes(id) on delete restrict,
 profissional_id uuid references public.profissionais(id) on delete restrict,
 tipo text not null check (tipo in ('atestado','declaracao_comparecimento','alta_ambulatorial','alta_pronto_atendimento','alta_hospitalar','encaminhamento_svo','declaracao_obito','resumo_alta','orientacoes_alta','relatorio_medico','outro')),
 titulo text not null, conteudo text not null, cid10 text, dias_afastamento integer,
 data_inicio date, data_fim date, acompanhante_nome text, destino_svo text,
 causa_obito_imediata text, causa_obito_antecedente text, causa_obito_basica text,
 assinado_em timestamptz, status text not null default 'rascunho' check(status in ('rascunho','assinado','cancelado')),
 cancelado_em timestamptz, motivo_cancelamento text,
 created_at timestamptz not null default now(), created_by uuid, updated_at timestamptz not null default now(), updated_by uuid
);
create index if not exists idx_documentos_clinicos_atendimento on public.documentos_clinicos_atendimento(atendimento_id,created_at desc);
alter table public.documentos_clinicos_atendimento enable row level security;
create policy documentos_clinicos_select on public.documentos_clinicos_atendimento for select to authenticated using(public.tem_unidade(empresa_id,unidade_id) and public.tem_permissao(empresa_id,unidade_id,'prontuario.visualizar'));
create policy documentos_clinicos_insert on public.documentos_clinicos_atendimento for insert to authenticated with check(public.tem_unidade(empresa_id,unidade_id) and public.tem_permissao(empresa_id,unidade_id,'prontuario.evoluir') and created_by=auth.uid());
create policy documentos_clinicos_update on public.documentos_clinicos_atendimento for update to authenticated using(public.tem_unidade(empresa_id,unidade_id) and public.tem_permissao(empresa_id,unidade_id,'prontuario.evoluir')) with check(updated_by=auth.uid());
revoke delete,truncate on public.documentos_clinicos_atendimento from anon,authenticated;
comment on column public.atendimentos.ambiente_assistencial is 'Define o contexto operacional do episodio e separa ambulatorio, pronto atendimento, internacao e demais fluxos.';
comment on table public.documentos_clinicos_atendimento is 'Documentos emitidos no episodio: atestados, comparecimento, alta, SVO, obito e relatorios.';