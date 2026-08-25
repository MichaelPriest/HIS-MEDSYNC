create table if not exists public.auditorias_in_loco (
  id uuid primary key default gen_random_uuid(), empresa_id uuid not null, unidade_id uuid not null, numero bigserial,
  convenio_id uuid null, operadora_nome text not null, protocolo_operadora text null, tipo_auditoria text not null default 'in_loco',
  escopo text null, data_inicio timestamptz not null, data_fim_prevista timestamptz null, data_fim_real timestamptz null,
  status text not null default 'agendada' check (status in ('agendada','em_andamento','aguardando_resposta','em_contestacao','concluida','cancelada')),
  responsavel_hospital_id uuid null, sala_local text null, observacoes text null,
  created_at timestamptz not null default now(), created_by uuid null, updated_at timestamptz not null default now(), updated_by uuid null
);
create unique index if not exists ux_auditorias_in_loco_numero on public.auditorias_in_loco(empresa_id,unidade_id,numero);
create index if not exists ix_auditorias_in_loco_status on public.auditorias_in_loco(empresa_id,unidade_id,status,data_inicio desc);
create table if not exists public.auditoria_in_loco_auditores (
  id uuid primary key default gen_random_uuid(), auditoria_id uuid not null references public.auditorias_in_loco(id) on delete cascade,
  nome text not null, documento text null, conselho text null, numero_conselho text null, cargo text null, email text null, telefone text null, empresa text null,
  created_at timestamptz not null default now()
);
create index if not exists ix_auditoria_in_loco_auditores on public.auditoria_in_loco_auditores(auditoria_id);
create table if not exists public.auditoria_in_loco_amostras (
  id uuid primary key default gen_random_uuid(), auditoria_id uuid not null references public.auditorias_in_loco(id) on delete cascade,
  atendimento_id uuid null references public.atendimentos(id) on delete set null, conta_id uuid null references public.contas_faturamento(id) on delete set null,
  paciente_id uuid null references public.pacientes(id) on delete set null, numero_guia text null, competencia text null, motivo_selecao text null,
  status text not null default 'em_analise' check (status in ('em_analise','sem_achado','com_achado','respondida','encerrada')),
  created_at timestamptz not null default now(), created_by uuid null, updated_at timestamptz not null default now(), updated_by uuid null
);
create index if not exists ix_auditoria_in_loco_amostras_auditoria on public.auditoria_in_loco_amostras(auditoria_id,status);
create table if not exists public.auditoria_in_loco_documentos (
  id uuid primary key default gen_random_uuid(), auditoria_id uuid not null references public.auditorias_in_loco(id) on delete cascade,
  amostra_id uuid null references public.auditoria_in_loco_amostras(id) on delete cascade, tipo_documento text not null, descricao text null,
  solicitado_em timestamptz not null default now(), prazo_entrega timestamptz null, entregue_em timestamptz null,
  status text not null default 'solicitado' check (status in ('solicitado','em_separacao','entregue','indisponivel','dispensado')),
  responsavel_id uuid null, observacoes text null, created_at timestamptz not null default now(), created_by uuid null, updated_at timestamptz not null default now(), updated_by uuid null
);
create index if not exists ix_auditoria_in_loco_documentos on public.auditoria_in_loco_documentos(auditoria_id,status,prazo_entrega);
create table if not exists public.auditoria_in_loco_achados (
  id uuid primary key default gen_random_uuid(), auditoria_id uuid not null references public.auditorias_in_loco(id) on delete cascade,
  amostra_id uuid null references public.auditoria_in_loco_amostras(id) on delete cascade, categoria text not null, codigo_glosa text null,
  descricao text not null, fundamentacao text null, valor_questionado numeric(14,2) not null default 0,
  severidade text not null default 'media' check (severidade in ('baixa','media','alta','critica')),
  status text not null default 'aberto' check (status in ('aberto','em_analise','aceito','contestado','revertido','mantido','encerrado')),
  resposta_hospital text null, resposta_operadora text null, prazo_resposta timestamptz null, respondido_em timestamptz null, responsavel_id uuid null,
  created_at timestamptz not null default now(), created_by uuid null, updated_at timestamptz not null default now(), updated_by uuid null
);
create index if not exists ix_auditoria_in_loco_achados on public.auditoria_in_loco_achados(auditoria_id,status,severidade);
create table if not exists public.auditoria_in_loco_eventos (
  id uuid primary key default gen_random_uuid(), auditoria_id uuid not null references public.auditorias_in_loco(id) on delete cascade,
  tipo text not null, descricao text not null, usuario_id uuid null, created_at timestamptz not null default now()
);
create index if not exists ix_auditoria_in_loco_eventos on public.auditoria_in_loco_eventos(auditoria_id,created_at desc);
insert into public.permissoes(codigo,descricao,ativo) values
 ('auditoria.in_loco.visualizar','Visualizar auditorias in loco de operadoras',true),
 ('auditoria.in_loco.gerenciar','Gerenciar auditorias in loco de operadoras',true),
 ('auditoria.in_loco.responder','Responder achados de auditoria in loco',true),
 ('auditoria.in_loco.encerrar','Encerrar auditorias in loco',true)
on conflict (codigo) do update set descricao=excluded.descricao,ativo=true;
