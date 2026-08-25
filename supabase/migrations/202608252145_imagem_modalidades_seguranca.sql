alter table public.solicitacoes_exames add column if not exists modalidade_codigo text;
update public.solicitacoes_exames set modalidade_codigo=case
 when upper(coalesce(modalidade,'')) ~ '(RESSON|\bRM\b|MRI)' then 'RM'
 when upper(coalesce(modalidade,'')) ~ '(TOMOG|\bTC\b|CT)' then 'TC'
 when upper(coalesce(modalidade,'')) ~ '(RAIO|RADIOG|\bRX\b|X-RAY)' then 'RX'
 else modalidade_codigo end where modalidade_codigo is null;
create index if not exists idx_solicitacoes_exames_modalidade_fila on public.solicitacoes_exames(unidade_id,modalidade_codigo,status,created_at);

create table if not exists public.imagem_checklists_seguranca(
 id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas(id) on delete cascade,
 unidade_id uuid not null references public.unidades(id) on delete cascade, atendimento_id uuid not null references public.atendimentos(id) on delete cascade,
 solicitacao_id uuid references public.solicitacoes_exames(id) on delete cascade, agendamento_id uuid references public.imagem_agendamentos(id) on delete cascade,
 execucao_id uuid references public.imagem_execucoes(id) on delete cascade, modalidade text not null check(modalidade in ('RX','TC','RM')),
 gestacao_questionada boolean not null default false, gestacao_descartada boolean,
 alergia_contraste_questionada boolean not null default false, alergia_contraste_negada boolean,
 funcao_renal_verificada boolean not null default false, creatinina numeric, egfr numeric,
 implante_metalico_questionado boolean not null default false, implante_metalico_negado boolean,
 marcapasso_questionado boolean not null default false, marcapasso_negado boolean,
 corpo_estranho_metalico_questionado boolean not null default false, corpo_estranho_metalico_negado boolean,
 claustrofobia_questionada boolean not null default false, claustrofobia_negada boolean,
 contraste_previsto boolean not null default false, consentimento_confirmado boolean not null default false,
 jejum_confirmado boolean, checklist_json jsonb not null default '{}'::jsonb, observacoes text,
 apto boolean not null default false, bloqueio_motivo text, verificado_em timestamptz, verificado_por uuid references public.profissionais(id) on delete set null,
 created_at timestamptz not null default now(), created_by uuid references auth.users(id), updated_at timestamptz not null default now(), updated_by uuid references auth.users(id)
);
create index if not exists idx_imagem_checklist_solicitacao on public.imagem_checklists_seguranca(solicitacao_id,created_at desc);
alter table public.imagem_checklists_seguranca enable row level security;
create policy imagem_checklist_select on public.imagem_checklists_seguranca for select to authenticated using(public.tem_permissao(empresa_id,unidade_id,'imagem.visualizar'));
create policy imagem_checklist_write on public.imagem_checklists_seguranca for all to authenticated using(public.tem_permissao(empresa_id,unidade_id,'imagem.executar')) with check(public.tem_permissao(empresa_id,unidade_id,'imagem.executar'));
revoke all on public.imagem_checklists_seguranca from anon; grant select,insert,update on public.imagem_checklists_seguranca to authenticated;

comment on table public.imagem_checklists_seguranca is 'Checklist de segurança pré-exame por modalidade. RM não utiliza dose de radiação ionizante; TC/RX mantêm rastreio radiológico conforme aplicável.';
comment on column public.solicitacoes_exames.modalidade_codigo is 'Código operacional normalizado: RX, TC, RM ou outra modalidade futura.';