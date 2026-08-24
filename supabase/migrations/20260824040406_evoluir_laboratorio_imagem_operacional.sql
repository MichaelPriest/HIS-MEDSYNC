-- Evolucao operacional de Laboratorio e Diagnostico por Imagem.
-- Reconstituida no repositorio para manter o historico remoto reproduzivel.

insert into public.permissoes(codigo,descricao,ativo) values
 ('laboratorio.visualizar','Visualizar operacao laboratorial',true),
 ('laboratorio.coletar','Registrar coleta e recebimento de amostras',true),
 ('laboratorio.resultar','Registrar resultados laboratoriais',true),
 ('laboratorio.liberar','Liberar resultados laboratoriais',true),
 ('laboratorio.gerenciar_catalogo','Gerenciar catálogo técnico de exames laboratoriais',true),
 ('laboratorio.interface_equipamento','Gerenciar interfaces de equipamentos laboratoriais',true),
 ('laboratorio.notificar_critico','Registrar comunicação de resultado crítico',true),
 ('imagem.visualizar','Visualizar operacao de diagnostico por imagem',true),
 ('imagem.agendar','Gerenciar agenda de diagnóstico por imagem',true),
 ('imagem.executar','Registrar execucao de exames de imagem',true),
 ('imagem.laudar','Criar laudos de imagem',true),
 ('imagem.liberar_laudo','Liberar e retificar laudos de imagem',true),
 ('imagem.protocolos','Gerenciar protocolos técnicos de imagem',true),
 ('imagem.contraste_dose','Registrar contraste e dose de radiação',true)
on conflict(codigo) do update set descricao=excluded.descricao,ativo=true;

create table if not exists public.laboratorio_catalogo_exames(
 id uuid primary key default extensions.gen_random_uuid(), empresa_id uuid not null references public.empresas(id) on delete cascade,
 codigo text not null, codigo_tuss text, descricao text not null, mnemonico text, material text, recipiente text, volume_minimo text, preparo text,
 jejum_horas integer, prazo_minutos integer, ativo boolean not null default true, created_at timestamptz not null default now(), created_by uuid references auth.users(id),
 updated_at timestamptz not null default now(), updated_by uuid references auth.users(id), unique(empresa_id,codigo));
create table if not exists public.laboratorio_catalogo_analitos(
 id uuid primary key default extensions.gen_random_uuid(), empresa_id uuid not null references public.empresas(id) on delete cascade,
 exame_id uuid not null references public.laboratorio_catalogo_exames(id) on delete cascade, codigo text, analito text not null, unidade_medida text,
 referencia_min numeric, referencia_max numeric, referencia_texto text, critico_min numeric, critico_max numeric, metodo text, ordem integer not null default 0,
 ativo boolean not null default true, created_at timestamptz not null default now(), created_by uuid references auth.users(id), unique(exame_id,analito));
create table if not exists public.laboratorio_equipamentos(
 id uuid primary key default extensions.gen_random_uuid(), empresa_id uuid not null references public.empresas(id) on delete cascade,
 unidade_id uuid not null references public.unidades(id) on delete cascade, codigo text not null, nome text not null, fabricante text, modelo text,
 protocolo_interface text, endereco_interface text, ativo boolean not null default true, created_at timestamptz not null default now(), created_by uuid references auth.users(id),
 updated_at timestamptz not null default now(), updated_by uuid references auth.users(id), unique(unidade_id,codigo));
create table if not exists public.laboratorio_interfaces_mensagens(
 id uuid primary key default extensions.gen_random_uuid(), empresa_id uuid not null references public.empresas(id) on delete cascade,
 unidade_id uuid not null references public.unidades(id) on delete cascade, equipamento_id uuid references public.laboratorio_equipamentos(id) on delete set null,
 direcao text not null check(direcao in ('entrada','saida')), protocolo text not null default 'MANUAL', identificador text, conteudo jsonb not null default '{}'::jsonb,
 status text not null default 'recebida' check(status in ('recebida','processada','erro','enviada')), erro text, recebido_em timestamptz, processado_em timestamptz,
 created_at timestamptz not null default now(), created_by uuid references auth.users(id));
create table if not exists public.laboratorio_notificacoes_criticas(
 id uuid primary key default extensions.gen_random_uuid(), empresa_id uuid not null references public.empresas(id) on delete cascade,
 unidade_id uuid not null references public.unidades(id) on delete cascade, atendimento_id uuid not null references public.atendimentos(id) on delete cascade,
 resultado_id uuid not null references public.laboratorio_resultados(id) on delete cascade, notificado_a text not null, meio text, readback_confirmado boolean not null default false,
 notificado_em timestamptz not null default now(), profissional_id uuid references public.profissionais(id) on delete set null, observacoes text,
 created_at timestamptz not null default now(), created_by uuid references auth.users(id));

alter table public.solicitacoes_exames add column if not exists catalogo_exame_id uuid references public.laboratorio_catalogo_exames(id) on delete set null;
alter table public.solicitacoes_exames add column if not exists prioridade text not null default 'rotina';
alter table public.laboratorio_amostras add column if not exists accession_number text;
alter table public.laboratorio_amostras add column if not exists prioridade text not null default 'rotina';
alter table public.laboratorio_amostras add column if not exists temperatura_recebimento numeric;
alter table public.laboratorio_amostras add column if not exists cadeia_custodia jsonb not null default '[]'::jsonb;
alter table public.laboratorio_amostras add column if not exists etiqueta_codigo text;
alter table public.laboratorio_amostras add column if not exists coleta_prevista_em timestamptz;
alter table public.laboratorio_amostras add column if not exists rejeitada_em timestamptz;
alter table public.laboratorio_amostras add column if not exists rejeitada_por uuid references public.profissionais(id) on delete set null;
alter table public.laboratorio_resultados add column if not exists criticidade text;
alter table public.laboratorio_resultados add column if not exists valor_critico boolean not null default false;
alter table public.laboratorio_resultados add column if not exists notificado_em timestamptz;
alter table public.laboratorio_resultados add column if not exists notificado_a text;

create table if not exists public.imagem_protocolos(
 id uuid primary key default extensions.gen_random_uuid(), empresa_id uuid not null references public.empresas(id) on delete cascade,
 unidade_id uuid references public.unidades(id) on delete cascade, codigo text not null, nome text not null, modalidade text not null, preparo text, posicionamento text, tecnica text,
 contraste_padrao text, requer_funcao_renal boolean not null default false, requer_consentimento boolean not null default false, ativo boolean not null default true,
 created_at timestamptz not null default now(), created_by uuid references auth.users(id), updated_at timestamptz not null default now(), updated_by uuid references auth.users(id), unique(empresa_id,codigo));
create table if not exists public.imagem_agendamentos(
 id uuid primary key default extensions.gen_random_uuid(), empresa_id uuid not null references public.empresas(id) on delete cascade,
 unidade_id uuid not null references public.unidades(id) on delete cascade, solicitacao_id uuid not null references public.solicitacoes_exames(id) on delete cascade,
 atendimento_id uuid not null references public.atendimentos(id) on delete cascade, paciente_id uuid not null references public.pacientes(id) on delete restrict,
 protocolo_id uuid references public.imagem_protocolos(id) on delete set null, agendado_em timestamptz not null, duracao_minutos integer, sala text, equipamento text,
 status text not null default 'agendado' check(status in ('agendado','confirmado','chegou','em_execucao','concluido','faltou','cancelado')), observacoes text,
 created_at timestamptz not null default now(), created_by uuid references auth.users(id), updated_at timestamptz not null default now(), updated_by uuid references auth.users(id));
create table if not exists public.imagem_contraste_registros(
 id uuid primary key default extensions.gen_random_uuid(), empresa_id uuid not null references public.empresas(id) on delete cascade,
 unidade_id uuid not null references public.unidades(id) on delete cascade, atendimento_id uuid not null references public.atendimentos(id) on delete cascade,
 execucao_id uuid not null references public.imagem_execucoes(id) on delete cascade, contraste text not null, lote text, validade date, volume_ml numeric, via text,
 alergia_questionada boolean not null default false, alergia_negada boolean, funcao_renal_verificada boolean not null default false, creatinina numeric, egfr numeric,
 consentimento_confirmado boolean not null default false, administrado_em timestamptz, administrado_por uuid references public.profissionais(id) on delete set null,
 reacao_adversa text, conduta_reacao text, created_at timestamptz not null default now(), created_by uuid references auth.users(id));
create table if not exists public.imagem_dose_radiacao(
 id uuid primary key default extensions.gen_random_uuid(), empresa_id uuid not null references public.empresas(id) on delete cascade,
 unidade_id uuid not null references public.unidades(id) on delete cascade, atendimento_id uuid not null references public.atendimentos(id) on delete cascade,
 execucao_id uuid not null references public.imagem_execucoes(id) on delete cascade, modalidade text, ctdivol numeric, dlp numeric, dap numeric, dose_mgy numeric,
 tempo_fluoroscopia_segundos numeric, observacoes text, created_at timestamptz not null default now(), created_by uuid references auth.users(id));

alter table public.imagem_execucoes add column if not exists accession_number text;
alter table public.imagem_execucoes add column if not exists study_instance_uid text;
alter table public.imagem_execucoes add column if not exists series_instance_uid text;
alter table public.imagem_execucoes add column if not exists pacs_url text;
alter table public.imagem_execucoes add column if not exists protocolo_id uuid references public.imagem_protocolos(id) on delete set null;
alter table public.imagem_execucoes add column if not exists agendamento_id uuid references public.imagem_agendamentos(id) on delete set null;

create index if not exists ix_lab_amostra_status_prevista on public.laboratorio_amostras(unidade_id,status,coleta_prevista_em);
create index if not exists ix_imagem_agenda_unidade_data on public.imagem_agendamentos(unidade_id,agendado_em,status);

alter table public.laboratorio_catalogo_exames enable row level security;
alter table public.laboratorio_catalogo_analitos enable row level security;
alter table public.laboratorio_equipamentos enable row level security;
alter table public.laboratorio_interfaces_mensagens enable row level security;
alter table public.laboratorio_notificacoes_criticas enable row level security;
alter table public.imagem_protocolos enable row level security;
alter table public.imagem_agendamentos enable row level security;
alter table public.imagem_contraste_registros enable row level security;
alter table public.imagem_dose_radiacao enable row level security;

revoke all on public.laboratorio_catalogo_exames,public.laboratorio_catalogo_analitos,public.laboratorio_equipamentos,public.laboratorio_interfaces_mensagens,public.laboratorio_notificacoes_criticas,public.imagem_protocolos,public.imagem_agendamentos,public.imagem_contraste_registros,public.imagem_dose_radiacao from anon;
grant select,insert,update,delete on public.laboratorio_catalogo_exames,public.laboratorio_catalogo_analitos,public.laboratorio_equipamentos,public.laboratorio_interfaces_mensagens,public.laboratorio_notificacoes_criticas,public.imagem_protocolos,public.imagem_agendamentos,public.imagem_contraste_registros,public.imagem_dose_radiacao to authenticated;

drop policy if exists lab_catalogo_exames_select on public.laboratorio_catalogo_exames;
create policy lab_catalogo_exames_select on public.laboratorio_catalogo_exames for select to authenticated using(public.tem_permissao(empresa_id,null,'laboratorio.visualizar'));
drop policy if exists lab_catalogo_exames_write on public.laboratorio_catalogo_exames;
create policy lab_catalogo_exames_write on public.laboratorio_catalogo_exames for all to authenticated using(public.tem_permissao(empresa_id,null,'laboratorio.gerenciar_catalogo')) with check(public.tem_permissao(empresa_id,null,'laboratorio.gerenciar_catalogo'));
drop policy if exists lab_catalogo_analitos_select on public.laboratorio_catalogo_analitos;
create policy lab_catalogo_analitos_select on public.laboratorio_catalogo_analitos for select to authenticated using(public.tem_permissao(empresa_id,null,'laboratorio.visualizar'));
drop policy if exists lab_catalogo_analitos_write on public.laboratorio_catalogo_analitos;
create policy lab_catalogo_analitos_write on public.laboratorio_catalogo_analitos for all to authenticated using(public.tem_permissao(empresa_id,null,'laboratorio.gerenciar_catalogo')) with check(public.tem_permissao(empresa_id,null,'laboratorio.gerenciar_catalogo'));
drop policy if exists lab_equipamentos_select on public.laboratorio_equipamentos;
create policy lab_equipamentos_select on public.laboratorio_equipamentos for select to authenticated using(public.tem_permissao(empresa_id,unidade_id,'laboratorio.visualizar'));
drop policy if exists lab_equipamentos_write on public.laboratorio_equipamentos;
create policy lab_equipamentos_write on public.laboratorio_equipamentos for all to authenticated using(public.tem_permissao(empresa_id,unidade_id,'laboratorio.interface_equipamento')) with check(public.tem_permissao(empresa_id,unidade_id,'laboratorio.interface_equipamento'));
drop policy if exists lab_interfaces_select on public.laboratorio_interfaces_mensagens;
create policy lab_interfaces_select on public.laboratorio_interfaces_mensagens for select to authenticated using(public.tem_permissao(empresa_id,unidade_id,'laboratorio.interface_equipamento'));
drop policy if exists lab_interfaces_write on public.laboratorio_interfaces_mensagens;
create policy lab_interfaces_write on public.laboratorio_interfaces_mensagens for all to authenticated using(public.tem_permissao(empresa_id,unidade_id,'laboratorio.interface_equipamento')) with check(public.tem_permissao(empresa_id,unidade_id,'laboratorio.interface_equipamento'));
drop policy if exists lab_criticos_select on public.laboratorio_notificacoes_criticas;
create policy lab_criticos_select on public.laboratorio_notificacoes_criticas for select to authenticated using(public.tem_permissao(empresa_id,unidade_id,'laboratorio.visualizar'));
drop policy if exists lab_criticos_write on public.laboratorio_notificacoes_criticas;
create policy lab_criticos_write on public.laboratorio_notificacoes_criticas for all to authenticated using(public.tem_permissao(empresa_id,unidade_id,'laboratorio.notificar_critico')) with check(public.tem_permissao(empresa_id,unidade_id,'laboratorio.notificar_critico'));

drop policy if exists imagem_protocolos_select on public.imagem_protocolos;
create policy imagem_protocolos_select on public.imagem_protocolos for select to authenticated using(public.tem_permissao(empresa_id,unidade_id,'imagem.visualizar') or (unidade_id is null and public.tem_permissao(empresa_id,null,'imagem.visualizar')));
drop policy if exists imagem_protocolos_write on public.imagem_protocolos;
create policy imagem_protocolos_write on public.imagem_protocolos for all to authenticated using(public.tem_permissao(empresa_id,unidade_id,'imagem.protocolos') or (unidade_id is null and public.tem_permissao(empresa_id,null,'imagem.protocolos'))) with check(public.tem_permissao(empresa_id,unidade_id,'imagem.protocolos') or (unidade_id is null and public.tem_permissao(empresa_id,null,'imagem.protocolos')));
drop policy if exists imagem_agenda_select on public.imagem_agendamentos;
create policy imagem_agenda_select on public.imagem_agendamentos for select to authenticated using(public.tem_permissao(empresa_id,unidade_id,'imagem.visualizar'));
drop policy if exists imagem_agenda_write on public.imagem_agendamentos;
create policy imagem_agenda_write on public.imagem_agendamentos for all to authenticated using(public.tem_permissao(empresa_id,unidade_id,'imagem.agendar')) with check(public.tem_permissao(empresa_id,unidade_id,'imagem.agendar'));
drop policy if exists imagem_contraste_select on public.imagem_contraste_registros;
create policy imagem_contraste_select on public.imagem_contraste_registros for select to authenticated using(public.tem_permissao(empresa_id,unidade_id,'imagem.visualizar'));
drop policy if exists imagem_contraste_write on public.imagem_contraste_registros;
create policy imagem_contraste_write on public.imagem_contraste_registros for all to authenticated using(public.tem_permissao(empresa_id,unidade_id,'imagem.contraste_dose')) with check(public.tem_permissao(empresa_id,unidade_id,'imagem.contraste_dose'));
drop policy if exists imagem_dose_select on public.imagem_dose_radiacao;
create policy imagem_dose_select on public.imagem_dose_radiacao for select to authenticated using(public.tem_permissao(empresa_id,unidade_id,'imagem.visualizar'));
drop policy if exists imagem_dose_write on public.imagem_dose_radiacao;
create policy imagem_dose_write on public.imagem_dose_radiacao for all to authenticated using(public.tem_permissao(empresa_id,unidade_id,'imagem.contraste_dose')) with check(public.tem_permissao(empresa_id,unidade_id,'imagem.contraste_dose'));

create or replace function public.registrar_notificacao_resultado_critico(p_resultado_id uuid,p_notificado_a text,p_meio text default null,p_readback boolean default false,p_observacoes text default null)
returns uuid language plpgsql set search_path='public','pg_catalog' as $$
declare v_r public.laboratorio_resultados%rowtype; v_prof uuid; v_id uuid;
begin
 select * into v_r from public.laboratorio_resultados where id=p_resultado_id;
 if not found then raise exception 'RESULTADO_NAO_ENCONTRADO'; end if;
 if not v_r.valor_critico then raise exception 'RESULTADO_NAO_MARCADO_COMO_CRITICO'; end if;
 if not(public.tem_permissao(v_r.empresa_id,v_r.unidade_id,'laboratorio.notificar_critico') or public.tem_permissao(v_r.empresa_id,v_r.unidade_id,'laboratorio.liberar')) then raise exception 'SEM_PERMISSAO'; end if;
 if coalesce(btrim(p_notificado_a),'')='' then raise exception 'DESTINATARIO_OBRIGATORIO'; end if;
 select id into v_prof from public.profissionais where usuario_id=auth.uid() and empresa_id=v_r.empresa_id and ativo limit 1;
 insert into public.laboratorio_notificacoes_criticas(empresa_id,unidade_id,atendimento_id,resultado_id,notificado_a,meio,readback_confirmado,profissional_id,observacoes,created_by)
 values(v_r.empresa_id,v_r.unidade_id,v_r.atendimento_id,v_r.id,p_notificado_a,p_meio,p_readback,v_prof,p_observacoes,auth.uid()) returning id into v_id;
 update public.laboratorio_resultados set notificado_em=now(),notificado_a=p_notificado_a,updated_at=now(),updated_by=auth.uid() where id=v_r.id;
 return v_id;
end $$;
revoke all on function public.registrar_notificacao_resultado_critico(uuid,text,text,boolean,text) from public,anon;
grant execute on function public.registrar_notificacao_resultado_critico(uuid,text,text,boolean,text) to authenticated;
notify pgrst,'reload schema';
