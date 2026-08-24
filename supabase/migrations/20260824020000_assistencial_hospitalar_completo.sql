-- Fundação Assistencial Hospitalar Integrada
-- Mantém compatibilidade com prontuario_evolucoes, prescricoes, solicitacoes_exames e internacoes existentes.
-- Novas tabelas usam UUID, escopo empresa/unidade, RLS e grants explícitos para authenticated.

begin;

alter table public.prontuario_evolucoes add column if not exists exame_fisico text;
alter table public.prontuario_evolucoes add column if not exists conduta text;
alter table public.prontuario_evolucoes add column if not exists conteudo_estruturado jsonb not null default '{}'::jsonb;
alter table public.prontuario_evolucoes add column if not exists assinatura_hash text;
alter table public.prontuario_evolucoes add column if not exists assinatura_usuario_id uuid references public.usuarios(id);
alter table public.prontuario_evolucoes add column if not exists versao integer not null default 1;
alter table public.prontuario_evolucoes add column if not exists bloqueado boolean not null default false;

create table if not exists public.prontuario_anamneses (
  id uuid primary key default extensions.gen_random_uuid(), empresa_id uuid not null references public.empresas(id), unidade_id uuid not null references public.unidades(id), atendimento_id uuid not null references public.atendimentos(id) on delete cascade, paciente_id uuid not null references public.pacientes(id), profissional_id uuid not null references public.profissionais(id), queixa_principal text, historia_doenca_atual text, antecedentes_pessoais text, antecedentes_familiares text, habitos_vida text, medicacoes_uso text, revisao_sistemas jsonb not null default '{}'::jsonb, exame_fisico_geral text, hipotese_diagnostica text, conduta_inicial text, assinado_em timestamptz, assinatura_hash text, assinatura_usuario_id uuid references public.usuarios(id), bloqueado boolean not null default false, created_at timestamptz not null default now(), created_by uuid references auth.users(id), updated_at timestamptz not null default now(), updated_by uuid references auth.users(id)
);
create table if not exists public.paciente_alergias (
  id uuid primary key default extensions.gen_random_uuid(), empresa_id uuid not null references public.empresas(id), unidade_id uuid not null references public.unidades(id), paciente_id uuid not null references public.pacientes(id) on delete cascade, substancia text not null, tipo text not null default 'medicamento', reacao text, gravidade text, status text not null default 'ativa', observacoes text, created_at timestamptz not null default now(), created_by uuid references auth.users(id), updated_at timestamptz not null default now(), updated_by uuid references auth.users(id)
);
create table if not exists public.paciente_problemas (
  id uuid primary key default extensions.gen_random_uuid(), empresa_id uuid not null references public.empresas(id), unidade_id uuid not null references public.unidades(id), paciente_id uuid not null references public.pacientes(id) on delete cascade, atendimento_id uuid references public.atendimentos(id) on delete set null, descricao text not null, cid10 text, data_inicio date, data_fim date, status text not null default 'ativo', principal boolean not null default false, observacoes text, created_at timestamptz not null default now(), created_by uuid references auth.users(id), updated_at timestamptz not null default now(), updated_by uuid references auth.users(id)
);
create table if not exists public.prontuario_diagnosticos (
  id uuid primary key default extensions.gen_random_uuid(), empresa_id uuid not null references public.empresas(id), unidade_id uuid not null references public.unidades(id), atendimento_id uuid not null references public.atendimentos(id) on delete cascade, paciente_id uuid not null references public.pacientes(id), profissional_id uuid not null references public.profissionais(id), cid10 text, descricao text not null, tipo text not null default 'hipotese', principal boolean not null default false, confirmado boolean not null default false, created_at timestamptz not null default now(), created_by uuid references auth.users(id), updated_at timestamptz not null default now(), updated_by uuid references auth.users(id)
);
create table if not exists public.prontuario_escalas (
  id uuid primary key default extensions.gen_random_uuid(), empresa_id uuid not null references public.empresas(id), unidade_id uuid not null references public.unidades(id), atendimento_id uuid not null references public.atendimentos(id) on delete cascade, paciente_id uuid not null references public.pacientes(id), profissional_id uuid references public.profissionais(id), escala text not null, pontuacao numeric(10,2), classificacao text, respostas jsonb not null default '{}'::jsonb, observacoes text, aplicada_em timestamptz not null default now(), created_at timestamptz not null default now(), created_by uuid references auth.users(id), updated_at timestamptz not null default now(), updated_by uuid references auth.users(id)
);

create table if not exists public.sae_avaliacoes (
  id uuid primary key default extensions.gen_random_uuid(), empresa_id uuid not null references public.empresas(id), unidade_id uuid not null references public.unidades(id), atendimento_id uuid not null references public.atendimentos(id) on delete cascade, paciente_id uuid not null references public.pacientes(id), profissional_id uuid not null references public.profissionais(id), historico_enfermagem text, exame_fisico text, necessidades jsonb not null default '{}'::jsonb, riscos jsonb not null default '{}'::jsonb, dispositivos jsonb not null default '[]'::jsonb, pele_lesoes jsonb not null default '[]'::jsonb, observacoes text, assinado_em timestamptz, assinatura_hash text, created_at timestamptz not null default now(), created_by uuid references auth.users(id), updated_at timestamptz not null default now(), updated_by uuid references auth.users(id)
);
create table if not exists public.sae_diagnosticos (
  id uuid primary key default extensions.gen_random_uuid(), empresa_id uuid not null references public.empresas(id), unidade_id uuid not null references public.unidades(id), atendimento_id uuid not null references public.atendimentos(id) on delete cascade, avaliacao_id uuid references public.sae_avaliacoes(id) on delete cascade, codigo text, diagnostico text not null, dominio text, prioridade text not null default 'normal', status text not null default 'ativo', created_at timestamptz not null default now(), created_by uuid references auth.users(id), updated_at timestamptz not null default now(), updated_by uuid references auth.users(id)
);
create table if not exists public.sae_cuidados (
  id uuid primary key default extensions.gen_random_uuid(), empresa_id uuid not null references public.empresas(id), unidade_id uuid not null references public.unidades(id), atendimento_id uuid not null references public.atendimentos(id) on delete cascade, diagnostico_id uuid references public.sae_diagnosticos(id) on delete set null, cuidado text not null, frequencia text, horario_programado timestamptz, responsavel_perfil text, status text not null default 'prescrito', observacoes text, created_at timestamptz not null default now(), created_by uuid references auth.users(id), updated_at timestamptz not null default now(), updated_by uuid references auth.users(id)
);
create table if not exists public.sae_checagens (
  id uuid primary key default extensions.gen_random_uuid(), empresa_id uuid not null references public.empresas(id), unidade_id uuid not null references public.unidades(id), atendimento_id uuid not null references public.atendimentos(id) on delete cascade, cuidado_id uuid not null references public.sae_cuidados(id) on delete cascade, profissional_id uuid references public.profissionais(id), status text not null default 'realizado', checado_em timestamptz not null default now(), justificativa text, observacoes text, created_at timestamptz not null default now(), created_by uuid references auth.users(id)
);

alter table public.prescricoes add column if not exists inicio_em timestamptz;
alter table public.prescricoes add column if not exists fim_em timestamptz;
alter table public.prescricoes add column if not exists horarios jsonb not null default '[]'::jsonb;
alter table public.prescricoes add column if not exists se_necessario boolean not null default false;
alter table public.prescricoes add column if not exists diluente text;
alter table public.prescricoes add column if not exists velocidade_infusao text;
alter table public.prescricoes add column if not exists aprazamento jsonb not null default '[]'::jsonb;
create table if not exists public.prescricao_checagens (
  id uuid primary key default extensions.gen_random_uuid(), empresa_id uuid not null references public.empresas(id), unidade_id uuid not null references public.unidades(id), atendimento_id uuid not null references public.atendimentos(id) on delete cascade, prescricao_id uuid not null references public.prescricoes(id) on delete cascade, paciente_id uuid not null references public.pacientes(id), profissional_id uuid references public.profissionais(id), horario_previsto timestamptz, checado_em timestamptz, status text not null default 'pendente', codigo_barras_paciente text, codigo_barras_item text, justificativa text, observacoes text, created_at timestamptz not null default now(), created_by uuid references auth.users(id), updated_at timestamptz not null default now(), updated_by uuid references auth.users(id)
);
create table if not exists public.dispensacoes_medicamentos (
  id uuid primary key default extensions.gen_random_uuid(), empresa_id uuid not null references public.empresas(id), unidade_id uuid not null references public.unidades(id), atendimento_id uuid not null references public.atendimentos(id) on delete cascade, prescricao_id uuid references public.prescricoes(id) on delete set null, paciente_id uuid not null references public.pacientes(id), item text not null, lote text, validade date, quantidade numeric(14,4) not null default 1, unidade_medida text, dispensado_por uuid references public.profissionais(id), dispensado_em timestamptz not null default now(), status text not null default 'dispensado', created_at timestamptz not null default now(), created_by uuid references auth.users(id), updated_at timestamptz not null default now(), updated_by uuid references auth.users(id)
);
create table if not exists public.devolucoes_medicamentos (
  id uuid primary key default extensions.gen_random_uuid(), empresa_id uuid not null references public.empresas(id), unidade_id uuid not null references public.unidades(id), atendimento_id uuid not null references public.atendimentos(id) on delete cascade, dispensacao_id uuid references public.dispensacoes_medicamentos(id) on delete set null, item text not null, lote text, quantidade numeric(14,4) not null default 1, motivo text not null, devolvido_por uuid references public.profissionais(id), devolvido_em timestamptz not null default now(), created_at timestamptz not null default now(), created_by uuid references auth.users(id)
);
create table if not exists public.administracoes_medicamentos (
  id uuid primary key default extensions.gen_random_uuid(), empresa_id uuid not null references public.empresas(id), unidade_id uuid not null references public.unidades(id), atendimento_id uuid not null references public.atendimentos(id) on delete cascade, prescricao_id uuid not null references public.prescricoes(id) on delete cascade, paciente_id uuid not null references public.pacientes(id), profissional_id uuid references public.profissionais(id), administrado_em timestamptz, status text not null default 'pendente', dose_administrada text, via text, lote text, dupla_checagem boolean not null default false, segundo_profissional_id uuid references public.profissionais(id), reacao_adversa text, justificativa text, created_at timestamptz not null default now(), created_by uuid references auth.users(id), updated_at timestamptz not null default now(), updated_by uuid references auth.users(id)
);

create table if not exists public.laboratorio_amostras (
  id uuid primary key default extensions.gen_random_uuid(), empresa_id uuid not null references public.empresas(id), unidade_id uuid not null references public.unidades(id), solicitacao_id uuid not null references public.solicitacoes_exames(id) on delete cascade, atendimento_id uuid not null references public.atendimentos(id) on delete cascade, paciente_id uuid not null references public.pacientes(id), codigo_amostra text not null, material text, recipiente text, coletada_em timestamptz, recebida_em timestamptz, coletada_por uuid references public.profissionais(id), recebida_por uuid references public.profissionais(id), status text not null default 'aguardando_coleta', rejeitada_motivo text, created_at timestamptz not null default now(), created_by uuid references auth.users(id), updated_at timestamptz not null default now(), updated_by uuid references auth.users(id), unique(unidade_id,codigo_amostra)
);
create table if not exists public.laboratorio_resultados (
  id uuid primary key default extensions.gen_random_uuid(), empresa_id uuid not null references public.empresas(id), unidade_id uuid not null references public.unidades(id), solicitacao_id uuid not null references public.solicitacoes_exames(id) on delete cascade, amostra_id uuid references public.laboratorio_amostras(id) on delete set null, atendimento_id uuid not null references public.atendimentos(id) on delete cascade, analito text not null, resultado text, valor_numerico numeric(18,6), unidade_medida text, referencia_min numeric(18,6), referencia_max numeric(18,6), referencia_texto text, flag text, metodo text, liberado boolean not null default false, liberado_em timestamptz, liberado_por uuid references public.profissionais(id), assinatura_hash text, observacoes text, created_at timestamptz not null default now(), created_by uuid references auth.users(id), updated_at timestamptz not null default now(), updated_by uuid references auth.users(id)
);
create table if not exists public.imagem_execucoes (
  id uuid primary key default extensions.gen_random_uuid(), empresa_id uuid not null references public.empresas(id), unidade_id uuid not null references public.unidades(id), solicitacao_id uuid not null references public.solicitacoes_exames(id) on delete cascade, atendimento_id uuid not null references public.atendimentos(id) on delete cascade, paciente_id uuid not null references public.pacientes(id), sala text, equipamento text, accession_number text, iniciado_em timestamptz, finalizado_em timestamptz, executado_por uuid references public.profissionais(id), status text not null default 'aguardando', contraste text, intercorrencias text, observacoes text, created_at timestamptz not null default now(), created_by uuid references auth.users(id), updated_at timestamptz not null default now(), updated_by uuid references auth.users(id)
);
create table if not exists public.imagem_laudos (
  id uuid primary key default extensions.gen_random_uuid(), empresa_id uuid not null references public.empresas(id), unidade_id uuid not null references public.unidades(id), solicitacao_id uuid not null references public.solicitacoes_exames(id) on delete cascade, execucao_id uuid references public.imagem_execucoes(id) on delete set null, atendimento_id uuid not null references public.atendimentos(id) on delete cascade, tecnica text, achados text, conclusao text, recomendacoes text, status text not null default 'rascunho', laudo_por uuid references public.profissionais(id), liberado_em timestamptz, assinatura_hash text, created_at timestamptz not null default now(), created_by uuid references auth.users(id), updated_at timestamptz not null default now(), updated_by uuid references auth.users(id)
);

create table if not exists public.leitos (
  id uuid primary key default extensions.gen_random_uuid(), empresa_id uuid not null references public.empresas(id), unidade_id uuid not null references public.unidades(id), setor text not null, quarto text, codigo text not null, tipo text, acomodacao text, sexo_restricao text, isolamento_capaz boolean not null default false, status text not null default 'livre', ativo boolean not null default true, created_at timestamptz not null default now(), created_by uuid references auth.users(id), updated_at timestamptz not null default now(), updated_by uuid references auth.users(id), unique(unidade_id,codigo)
);
alter table public.internacoes add column if not exists leito_id uuid references public.leitos(id) on delete set null;
alter table public.internacoes add column if not exists isolamento boolean not null default false;
alter table public.internacoes add column if not exists tipo_isolamento text;
alter table public.internacoes add column if not exists motivo_alta text;
create table if not exists public.movimentacoes_leitos (
  id uuid primary key default extensions.gen_random_uuid(), empresa_id uuid not null references public.empresas(id), unidade_id uuid not null references public.unidades(id), internacao_id uuid not null references public.internacoes(id) on delete cascade, atendimento_id uuid not null references public.atendimentos(id) on delete cascade, leito_origem_id uuid references public.leitos(id), leito_destino_id uuid references public.leitos(id), tipo text not null default 'transferencia', motivo text, movimentado_em timestamptz not null default now(), profissional_id uuid references public.profissionais(id), created_at timestamptz not null default now(), created_by uuid references auth.users(id)
);
create table if not exists public.internacao_diarias (
  id uuid primary key default extensions.gen_random_uuid(), empresa_id uuid not null references public.empresas(id), unidade_id uuid not null references public.unidades(id), internacao_id uuid not null references public.internacoes(id) on delete cascade, atendimento_id uuid not null references public.atendimentos(id) on delete cascade, data_referencia date not null, acomodacao text, setor text, leito_id uuid references public.leitos(id), status text not null default 'aberta', observacoes text, created_at timestamptz not null default now(), created_by uuid references auth.users(id), unique(internacao_id,data_referencia)
);
create table if not exists public.internacao_isolamentos (
  id uuid primary key default extensions.gen_random_uuid(), empresa_id uuid not null references public.empresas(id), unidade_id uuid not null references public.unidades(id), internacao_id uuid not null references public.internacoes(id) on delete cascade, atendimento_id uuid not null references public.atendimentos(id) on delete cascade, tipo text not null, motivo text, inicio_em timestamptz not null default now(), fim_em timestamptz, status text not null default 'ativo', orientacoes text, created_at timestamptz not null default now(), created_by uuid references auth.users(id), updated_at timestamptz not null default now(), updated_by uuid references auth.users(id)
);

create table if not exists public.emergencia_registros (
  id uuid primary key default extensions.gen_random_uuid(), empresa_id uuid not null references public.empresas(id), unidade_id uuid not null references public.unidades(id), atendimento_id uuid not null references public.atendimentos(id) on delete cascade, paciente_id uuid not null references public.pacientes(id), profissional_id uuid references public.profissionais(id), origem text, mecanismo text, classificacao_risco text, protocolo text, sala text, estado_geral text, via_aerea text, respiracao text, circulacao text, neurologico text, exposicao text, procedimentos_imediatos jsonb not null default '[]'::jsonb, reavaliacao_em timestamptz, destino text, observacoes text, status text not null default 'em_atendimento', created_at timestamptz not null default now(), created_by uuid references auth.users(id), updated_at timestamptz not null default now(), updated_by uuid references auth.users(id)
);

create table if not exists public.cirurgias (
  id uuid primary key default extensions.gen_random_uuid(), empresa_id uuid not null references public.empresas(id), unidade_id uuid not null references public.unidades(id), atendimento_id uuid not null references public.atendimentos(id) on delete cascade, paciente_id uuid not null references public.pacientes(id), procedimento text not null, codigo_tuss text, cirurgia text, lateralidade text, sala text, classificacao text, porte text, status text not null default 'agendada', inicio_previsto timestamptz, inicio_em timestamptz, fim_em timestamptz, cirurgiao_id uuid references public.profissionais(id), anestesista_id uuid references public.profissionais(id), equipe jsonb not null default '[]'::jsonb, diagnostico_pre text, diagnostico_pos text, intercorrencias text, created_at timestamptz not null default now(), created_by uuid references auth.users(id), updated_at timestamptz not null default now(), updated_by uuid references auth.users(id)
);
create table if not exists public.cirurgia_checklist (
  id uuid primary key default extensions.gen_random_uuid(), empresa_id uuid not null references public.empresas(id), unidade_id uuid not null references public.unidades(id), cirurgia_id uuid not null references public.cirurgias(id) on delete cascade, atendimento_id uuid not null references public.atendimentos(id) on delete cascade, etapa text not null, itens jsonb not null default '{}'::jsonb, concluido boolean not null default false, concluido_em timestamptz, profissional_id uuid references public.profissionais(id), observacoes text, created_at timestamptz not null default now(), created_by uuid references auth.users(id), updated_at timestamptz not null default now(), updated_by uuid references auth.users(id)
);
create table if not exists public.anestesia_registros (
  id uuid primary key default extensions.gen_random_uuid(), empresa_id uuid not null references public.empresas(id), unidade_id uuid not null references public.unidades(id), cirurgia_id uuid not null references public.cirurgias(id) on delete cascade, atendimento_id uuid not null references public.atendimentos(id) on delete cascade, anestesista_id uuid references public.profissionais(id), tecnica text, asa text, via_aerea text, monitorizacao jsonb not null default '{}'::jsonb, medicamentos jsonb not null default '[]'::jsonb, fluidos jsonb not null default '[]'::jsonb, eventos jsonb not null default '[]'::jsonb, inicio_em timestamptz, fim_em timestamptz, observacoes text, assinado_em timestamptz, assinatura_hash text, created_at timestamptz not null default now(), created_by uuid references auth.users(id), updated_at timestamptz not null default now(), updated_by uuid references auth.users(id)
);
create table if not exists public.rpa_registros (
  id uuid primary key default extensions.gen_random_uuid(), empresa_id uuid not null references public.empresas(id), unidade_id uuid not null references public.unidades(id), cirurgia_id uuid not null references public.cirurgias(id) on delete cascade, atendimento_id uuid not null references public.atendimentos(id) on delete cascade, entrada_em timestamptz not null default now(), alta_em timestamptz, aldrete_entrada numeric(5,2), aldrete_alta numeric(5,2), dor numeric(5,2), nauseas boolean, sinais_vitais jsonb not null default '{}'::jsonb, intercorrencias text, destino text, profissional_id uuid references public.profissionais(id), status text not null default 'em_rpa', created_at timestamptz not null default now(), created_by uuid references auth.users(id), updated_at timestamptz not null default now(), updated_by uuid references auth.users(id)
);
create table if not exists public.cirurgia_opme (
  id uuid primary key default extensions.gen_random_uuid(), empresa_id uuid not null references public.empresas(id), unidade_id uuid not null references public.unidades(id), cirurgia_id uuid not null references public.cirurgias(id) on delete cascade, atendimento_id uuid not null references public.atendimentos(id) on delete cascade, item text not null, codigo text, fabricante text, lote text, serie text, registro_anvisa text, quantidade numeric(14,4) not null default 1, status text not null default 'previsto', utilizado_em timestamptz, observacoes text, created_at timestamptz not null default now(), created_by uuid references auth.users(id), updated_at timestamptz not null default now(), updated_by uuid references auth.users(id)
);
create table if not exists public.cme_ciclos (
  id uuid primary key default extensions.gen_random_uuid(), empresa_id uuid not null references public.empresas(id), unidade_id uuid not null references public.unidades(id), codigo_ciclo text not null, equipamento text, metodo text, carga text, inicio_em timestamptz, fim_em timestamptz, indicadores jsonb not null default '{}'::jsonb, resultado text, liberado_por uuid references public.profissionais(id), liberado_em timestamptz, status text not null default 'em_processamento', observacoes text, created_at timestamptz not null default now(), created_by uuid references auth.users(id), updated_at timestamptz not null default now(), updated_by uuid references auth.users(id), unique(unidade_id,codigo_ciclo)
);

create table if not exists public.nutricao_avaliacoes (
  id uuid primary key default extensions.gen_random_uuid(), empresa_id uuid not null references public.empresas(id), unidade_id uuid not null references public.unidades(id), atendimento_id uuid not null references public.atendimentos(id) on delete cascade, paciente_id uuid not null references public.pacientes(id), profissional_id uuid references public.profissionais(id), peso_kg numeric(8,3), altura_cm numeric(8,2), imc numeric(8,2), risco_nutricional text, triagem jsonb not null default '{}'::jsonb, diagnostico_nutricional text, necessidades_kcal numeric(10,2), necessidades_proteina_g numeric(10,2), observacoes text, assinado_em timestamptz, created_at timestamptz not null default now(), created_by uuid references auth.users(id), updated_at timestamptz not null default now(), updated_by uuid references auth.users(id)
);
create table if not exists public.nutricao_dietas (
  id uuid primary key default extensions.gen_random_uuid(), empresa_id uuid not null references public.empresas(id), unidade_id uuid not null references public.unidades(id), atendimento_id uuid not null references public.atendimentos(id) on delete cascade, paciente_id uuid not null references public.pacientes(id), avaliacao_id uuid references public.nutricao_avaliacoes(id) on delete set null, tipo text not null, consistencia text, via text, restricoes text, suplementos text, horario jsonb not null default '[]'::jsonb, inicio_em timestamptz not null default now(), fim_em timestamptz, status text not null default 'ativa', observacoes text, created_at timestamptz not null default now(), created_by uuid references auth.users(id), updated_at timestamptz not null default now(), updated_by uuid references auth.users(id)
);
create table if not exists public.hemoterapia_solicitacoes (
  id uuid primary key default extensions.gen_random_uuid(), empresa_id uuid not null references public.empresas(id), unidade_id uuid not null references public.unidades(id), atendimento_id uuid not null references public.atendimentos(id) on delete cascade, paciente_id uuid not null references public.pacientes(id), solicitante_id uuid references public.profissionais(id), hemocomponente text not null, quantidade numeric(10,2) not null default 1, indicacao text, urgencia text not null default 'rotina', tipagem_abo text, fator_rh text, prova_compatibilidade text, status text not null default 'solicitado', solicitado_em timestamptz not null default now(), liberado_em timestamptz, observacoes text, created_at timestamptz not null default now(), created_by uuid references auth.users(id), updated_at timestamptz not null default now(), updated_by uuid references auth.users(id)
);
create table if not exists public.hemoterapia_transfusoes (
  id uuid primary key default extensions.gen_random_uuid(), empresa_id uuid not null references public.empresas(id), unidade_id uuid not null references public.unidades(id), solicitacao_id uuid not null references public.hemoterapia_solicitacoes(id) on delete cascade, atendimento_id uuid not null references public.atendimentos(id) on delete cascade, paciente_id uuid not null references public.pacientes(id), bolsa_codigo text not null, hemocomponente text not null, lote text, validade timestamptz, dupla_checagem boolean not null default false, profissional_id uuid references public.profissionais(id), segundo_profissional_id uuid references public.profissionais(id), inicio_em timestamptz, fim_em timestamptz, sinais_vitais_pre jsonb not null default '{}'::jsonb, sinais_vitais_pos jsonb not null default '{}'::jsonb, reacao_transfusional text, status text not null default 'preparada', observacoes text, created_at timestamptz not null default now(), created_by uuid references auth.users(id), updated_at timestamptz not null default now(), updated_by uuid references auth.users(id)
);

create index if not exists idx_prontuario_anamneses_atendimento on public.prontuario_anamneses(atendimento_id,created_at desc);
create index if not exists idx_paciente_alergias_paciente on public.paciente_alergias(paciente_id,status);
create index if not exists idx_paciente_problemas_paciente on public.paciente_problemas(paciente_id,status);
create index if not exists idx_prontuario_diag_atendimento on public.prontuario_diagnosticos(atendimento_id,principal desc);
create index if not exists idx_sae_avaliacoes_atendimento on public.sae_avaliacoes(atendimento_id,created_at desc);
create index if not exists idx_prescricao_checagens_atendimento on public.prescricao_checagens(atendimento_id,status,horario_previsto);
create index if not exists idx_lab_amostras_solicitacao on public.laboratorio_amostras(solicitacao_id,status);
create index if not exists idx_lab_resultados_solicitacao on public.laboratorio_resultados(solicitacao_id,liberado);
create index if not exists idx_imagem_execucoes_solicitacao on public.imagem_execucoes(solicitacao_id,status);
create index if not exists idx_leitos_unidade_status on public.leitos(unidade_id,status,setor);
create index if not exists idx_cirurgias_data on public.cirurgias(unidade_id,inicio_previsto,status);
create index if not exists idx_hemoterapia_status on public.hemoterapia_solicitacoes(unidade_id,status,solicitado_em);

DO $do$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['prontuario_anamneses','paciente_alergias','paciente_problemas','prontuario_diagnosticos','prontuario_escalas','sae_avaliacoes','sae_diagnosticos','sae_cuidados','sae_checagens','prescricao_checagens','dispensacoes_medicamentos','devolucoes_medicamentos','administracoes_medicamentos','laboratorio_amostras','laboratorio_resultados','imagem_execucoes','imagem_laudos','leitos','movimentacoes_leitos','internacao_diarias','internacao_isolamentos','emergencia_registros','cirurgias','cirurgia_checklist','anestesia_registros','rpa_registros','cirurgia_opme','cme_ciclos','nutricao_avaliacoes','nutricao_dietas','hemoterapia_solicitacoes','hemoterapia_transfusoes'] LOOP
    EXECUTE format('alter table public.%I enable row level security', t);
    EXECUTE format('alter table public.%I force row level security', t);
    EXECUTE format('drop policy if exists %I on public.%I', t || '_escopo', t);
    EXECUTE format('create policy %I on public.%I for all to authenticated using (public.tem_unidade(empresa_id, unidade_id)) with check (public.tem_unidade(empresa_id, unidade_id))', t || '_escopo', t);
    EXECUTE format('grant select, insert, update, delete on public.%I to authenticated', t);
    EXECUTE format('revoke all on public.%I from anon', t);
  END LOOP;
END
$do$;

insert into public.permissoes(codigo,descricao,ativo) values
 ('assistencial.central.visualizar','Visualizar central assistencial',true),('assistencial.prontuario.editar','Editar prontuário clínico estruturado',true),('assistencial.enfermagem.editar','Operar SAE de enfermagem',true),('assistencial.medicamentos.checar','Checar, administrar e movimentar medicamentos',true),('assistencial.laboratorio.operar','Operar laboratório clínico',true),('assistencial.imagem.operar','Operar diagnóstico por imagem',true),('assistencial.internacao.operar','Operar internação e mapa de leitos',true),('assistencial.urgencia.operar','Operar urgência e emergência',true),('assistencial.cirurgia.operar','Operar centro cirúrgico, anestesia, RPA, OPME e CME',true),('assistencial.nutricao.operar','Operar nutrição clínica',true),('assistencial.hemoterapia.operar','Operar banco de sangue e hemoterapia',true)
on conflict (codigo) do update set descricao=excluded.descricao, ativo=true, updated_at=now();

insert into public.perfil_permissoes(perfil_id,permissao_id)
select pf.id,p.id from public.perfis pf cross join public.permissoes p
where pf.ativo and pf.sistema and (
  lower(pf.nome) in ('administrador','admin')
  or (lower(pf.nome)='medico' and p.codigo in ('assistencial.central.visualizar','assistencial.prontuario.editar','assistencial.medicamentos.checar','assistencial.laboratorio.operar','assistencial.imagem.operar','assistencial.internacao.operar','assistencial.urgencia.operar','assistencial.cirurgia.operar','assistencial.hemoterapia.operar'))
  or (lower(pf.nome)='enfermagem' and p.codigo in ('assistencial.central.visualizar','assistencial.prontuario.editar','assistencial.enfermagem.editar','assistencial.medicamentos.checar','assistencial.laboratorio.operar','assistencial.internacao.operar','assistencial.urgencia.operar','assistencial.cirurgia.operar','assistencial.nutricao.operar','assistencial.hemoterapia.operar'))
)
on conflict do nothing;

commit;
