begin;

create table if not exists public.cirurgia_eventos (
  id uuid primary key default extensions.gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  unidade_id uuid not null references public.unidades(id),
  cirurgia_id uuid not null references public.cirurgias(id) on delete cascade,
  atendimento_id uuid not null references public.atendimentos(id) on delete cascade,
  tipo_evento text not null,
  status_anterior text,
  status_novo text,
  detalhes jsonb not null default '{}'::jsonb,
  profissional_id uuid references public.profissionais(id),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists public.cirurgia_cme_ciclos (
  id uuid primary key default extensions.gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  unidade_id uuid not null references public.unidades(id),
  cirurgia_id uuid not null references public.cirurgias(id) on delete cascade,
  ciclo_id uuid not null references public.cme_ciclos(id),
  observacoes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(cirurgia_id,ciclo_id)
);

create index if not exists idx_cirurgia_eventos_cirurgia on public.cirurgia_eventos(cirurgia_id,created_at desc);
create index if not exists idx_cirurgia_eventos_atendimento on public.cirurgia_eventos(atendimento_id,created_at desc);
create index if not exists idx_cirurgia_cme_ciclos_cirurgia on public.cirurgia_cme_ciclos(cirurgia_id,created_at desc);
create unique index if not exists ux_cirurgia_agendamento_operacional
  on public.cirurgias(atendimento_id,coalesce(codigo_tuss,''),inicio_previsto)
  where status <> 'cancelada' and inicio_previsto is not null;

alter table public.cirurgia_eventos enable row level security;
alter table public.cirurgia_eventos force row level security;
alter table public.cirurgia_cme_ciclos enable row level security;
alter table public.cirurgia_cme_ciclos force row level security;

drop policy if exists cirurgia_eventos_select_funcional on public.cirurgia_eventos;
create policy cirurgia_eventos_select_funcional on public.cirurgia_eventos
for select to authenticated using (
  public.tem_unidade(empresa_id,unidade_id) and (
    public.tem_permissao(empresa_id,unidade_id,'centro_cirurgico.visualizar') or
    public.tem_permissao(empresa_id,unidade_id,'centro_cirurgico.operar') or
    public.tem_permissao(empresa_id,unidade_id,'centro_cirurgico.gerenciar') or
    public.tem_permissao(empresa_id,unidade_id,'prontuario.visualizar')
  )
);

drop policy if exists cirurgia_cme_ciclos_select_funcional on public.cirurgia_cme_ciclos;
create policy cirurgia_cme_ciclos_select_funcional on public.cirurgia_cme_ciclos
for select to authenticated using (
  public.tem_unidade(empresa_id,unidade_id) and (
    public.tem_permissao(empresa_id,unidade_id,'centro_cirurgico.visualizar') or
    public.tem_permissao(empresa_id,unidade_id,'centro_cirurgico.operar') or
    public.tem_permissao(empresa_id,unidade_id,'centro_cirurgico.gerenciar') or
    public.tem_permissao(empresa_id,unidade_id,'cme.visualizar') or
    public.tem_permissao(empresa_id,unidade_id,'cme.gerenciar') or
    public.tem_permissao(empresa_id,unidade_id,'prontuario.visualizar')
  )
);

grant select on public.cirurgia_eventos, public.cirurgia_cme_ciclos to authenticated;
revoke insert,update,delete on public.cirurgia_eventos,public.cirurgia_cme_ciclos from authenticated,anon;

-- Leitura funcional ampliada; mutacao direta bloqueada e substituida por RPCs.
do $do$
declare t text;
begin
  foreach t in array array['cirurgias','cirurgia_checklist','anestesia_registros','rpa_registros','cirurgia_opme'] loop
    execute format('drop policy if exists %I on public.%I',t||'_select',t);
    execute format('drop policy if exists %I on public.%I',t||'_insert',t);
    execute format('drop policy if exists %I on public.%I',t||'_update',t);
    execute format('drop policy if exists %I on public.%I',t||'_delete',t);
    execute format($p$create policy %I on public.%I for select to authenticated using (
      public.tem_unidade(empresa_id,unidade_id) and (
        public.tem_permissao(empresa_id,unidade_id,'centro_cirurgico.visualizar') or
        public.tem_permissao(empresa_id,unidade_id,'centro_cirurgico.operar') or
        public.tem_permissao(empresa_id,unidade_id,'centro_cirurgico.gerenciar') or
        public.tem_permissao(empresa_id,unidade_id,'prontuario.visualizar')
      )
    )$p$,t||'_select_funcional',t);
    execute format('revoke insert,update,delete on public.%I from authenticated,anon',t);
    execute format('grant select on public.%I to authenticated',t);
  end loop;
end $do$;

drop policy if exists cme_ciclos_select on public.cme_ciclos;
drop policy if exists cme_ciclos_insert on public.cme_ciclos;
drop policy if exists cme_ciclos_update on public.cme_ciclos;
drop policy if exists cme_ciclos_delete on public.cme_ciclos;
drop policy if exists cme_ciclos_select_funcional on public.cme_ciclos;
create policy cme_ciclos_select_funcional on public.cme_ciclos
for select to authenticated using (
  public.tem_unidade(empresa_id,unidade_id) and (
    public.tem_permissao(empresa_id,unidade_id,'cme.visualizar') or
    public.tem_permissao(empresa_id,unidade_id,'cme.gerenciar') or
    public.tem_permissao(empresa_id,unidade_id,'centro_cirurgico.visualizar') or
    public.tem_permissao(empresa_id,unidade_id,'centro_cirurgico.operar') or
    public.tem_permissao(empresa_id,unidade_id,'centro_cirurgico.gerenciar') or
    public.tem_permissao(empresa_id,unidade_id,'prontuario.visualizar')
  )
);
revoke insert,update,delete on public.cme_ciclos from authenticated,anon;
grant select on public.cme_ciclos to authenticated;

create or replace function public.validar_checklist_cirurgico_concluido()
returns trigger language plpgsql set search_path=public,pg_catalog as $$
declare v_chaves text[]; v_chave text;
begin
  if not coalesce(new.concluido,false) then return new; end if;
  v_chaves:=case lower(new.etapa)
    when 'entrada' then array['identidade','procedimento','lateralidade','consentimento','jejum','alergias']
    when 'pausa' then array['equipe','procedimento_confirmado','antibiotico','equipamentos','esterilidade']
    when 'saida' then array['contagem','amostras','opme','intercorrencias','destino']
    else null end;
  if v_chaves is null then raise exception 'CC_ETAPA_CHECKLIST_INVALIDA'; end if;
  foreach v_chave in array v_chaves loop
    if lower(coalesce(new.itens->>v_chave,'false')) not in ('true','t','1','yes','on') then
      raise exception 'CC_CHECKLIST_ITEM_OBRIGATORIO_%',upper(v_chave);
    end if;
  end loop;
  new.concluido_em:=coalesce(new.concluido_em,now());
  return new;
end $$;

drop trigger if exists trg_validar_checklist_cirurgico_concluido on public.cirurgia_checklist;
create trigger trg_validar_checklist_cirurgico_concluido before insert or update of itens,concluido on public.cirurgia_checklist
for each row execute function public.validar_checklist_cirurgico_concluido();

create or replace function public.validar_cancelamento_cirurgia_com_motivo()
returns trigger language plpgsql set search_path=public,pg_catalog as $$
begin
  if new.status='cancelada' and old.status is distinct from new.status and coalesce(btrim(new.intercorrencias),'')='' then
    raise exception 'CC_CANCELAMENTO_EXIGE_MOTIVO';
  end if;
  return new;
end $$;

drop trigger if exists trg_validar_cancelamento_cirurgia_com_motivo on public.cirurgias;
create trigger trg_validar_cancelamento_cirurgia_com_motivo before update of status on public.cirurgias
for each row execute function public.validar_cancelamento_cirurgia_com_motivo();

create or replace function public.proteger_ciclo_cme_liberado()
returns trigger language plpgsql set search_path=public,pg_catalog as $$
begin
  if old.status='liberado' then raise exception 'CME_CICLO_LIBERADO_IMUTAVEL'; end if;
  return new;
end $$;

drop trigger if exists trg_proteger_ciclo_cme_liberado on public.cme_ciclos;
create trigger trg_proteger_ciclo_cme_liberado before update on public.cme_ciclos
for each row execute function public.proteger_ciclo_cme_liberado();

revoke execute on function public.validar_checklist_cirurgico_concluido() from public,anon,authenticated;
revoke execute on function public.validar_cancelamento_cirurgia_com_motivo() from public,anon,authenticated;
revoke execute on function public.proteger_ciclo_cme_liberado() from public,anon,authenticated;

create or replace function public.centro_cirurgico_agendar_operacional(
  p_atendimento_id uuid,
  p_cirurgia_id uuid default null,
  p_procedimento text default null,
  p_codigo_tuss text default null,
  p_cirurgia text default null,
  p_lateralidade text default null,
  p_sala text default null,
  p_classificacao text default null,
  p_porte text default null,
  p_inicio_previsto timestamptz default null,
  p_cirurgiao_id uuid default null,
  p_anestesista_id uuid default null,
  p_diagnostico_pre text default null
) returns uuid language plpgsql security definer set search_path=public,pg_catalog,extensions as $$
declare
  v_at public.atendimentos%rowtype; v_c public.cirurgias%rowtype; v_id uuid; v_prof uuid; v_sala_id uuid;
  v_proc text:=nullif(btrim(p_procedimento),'');
begin
  if auth.uid() is null then raise exception 'CC_AUTENTICACAO_OBRIGATORIA' using errcode='42501'; end if;
  select * into v_at from public.atendimentos where id=p_atendimento_id for update;
  if not found or v_at.paciente_id is null then raise exception 'CC_ATENDIMENTO_NAO_LOCALIZADO'; end if;
  if not public.tem_permissao(v_at.empresa_id,v_at.unidade_id,'centro_cirurgico.gerenciar') then raise exception 'CC_AGENDAMENTO_EXIGE_GERENCIA' using errcode='42501'; end if;
  if v_proc is null then raise exception 'CC_PROCEDIMENTO_OBRIGATORIO'; end if;
  if p_inicio_previsto is null then raise exception 'CC_INICIO_PREVISTO_OBRIGATORIO'; end if;
  if p_cirurgiao_id is not null and not exists(select 1 from public.profissionais p where p.id=p_cirurgiao_id and p.empresa_id=v_at.empresa_id and p.ativo) then raise exception 'CC_CIRURGIAO_INVALIDO'; end if;
  if p_anestesista_id is not null and not exists(select 1 from public.profissionais p where p.id=p_anestesista_id and p.empresa_id=v_at.empresa_id and p.ativo) then raise exception 'CC_ANESTESISTA_INVALIDO'; end if;
  if coalesce(btrim(p_sala),'')<>'' then
    select s.id into v_sala_id from public.salas_cirurgicas s where s.empresa_id=v_at.empresa_id and s.unidade_id=v_at.unidade_id and s.ativo and (lower(s.codigo)=lower(btrim(p_sala)) or lower(s.nome)=lower(btrim(p_sala))) limit 1;
  end if;
  v_prof:=public.profissional_logado(v_at.empresa_id);
  if p_cirurgia_id is not null then
    select * into v_c from public.cirurgias where id=p_cirurgia_id for update;
    if not found or v_c.atendimento_id<>v_at.id or v_c.empresa_id<>v_at.empresa_id or v_c.unidade_id<>v_at.unidade_id then raise exception 'CC_CIRURGIA_NAO_LOCALIZADA'; end if;
    if v_c.status not in ('agendada','em_preparo') then raise exception 'CC_AGENDAMENTO_NAO_EDITAVEL'; end if;
    update public.cirurgias set procedimento=v_proc,codigo_tuss=nullif(btrim(p_codigo_tuss),''),cirurgia=nullif(btrim(p_cirurgia),''),lateralidade=nullif(btrim(p_lateralidade),''),sala=nullif(btrim(p_sala),''),sala_id=v_sala_id,classificacao=nullif(btrim(p_classificacao),''),porte=nullif(btrim(p_porte),''),inicio_previsto=p_inicio_previsto,cirurgiao_id=p_cirurgiao_id,anestesista_id=p_anestesista_id,diagnostico_pre=nullif(btrim(p_diagnostico_pre),''),updated_at=now(),updated_by=auth.uid() where id=v_c.id returning id into v_id;
    insert into public.cirurgia_eventos(empresa_id,unidade_id,cirurgia_id,atendimento_id,tipo_evento,detalhes,profissional_id,created_by) values(v_at.empresa_id,v_at.unidade_id,v_id,v_at.id,'agendamento_atualizado',jsonb_build_object('inicio_previsto',p_inicio_previsto,'sala',p_sala,'procedimento',v_proc,'codigo_tuss',p_codigo_tuss),v_prof,auth.uid());
    return v_id;
  end if;
  select c.id into v_id from public.cirurgias c where c.atendimento_id=v_at.id and coalesce(c.codigo_tuss,'')=coalesce(nullif(btrim(p_codigo_tuss),''),'') and c.inicio_previsto is not distinct from p_inicio_previsto and c.status<>'cancelada' limit 1 for update;
  if v_id is not null then return v_id; end if;
  insert into public.cirurgias(empresa_id,unidade_id,atendimento_id,paciente_id,procedimento,codigo_tuss,cirurgia,lateralidade,sala,sala_id,classificacao,porte,status,inicio_previsto,cirurgiao_id,anestesista_id,diagnostico_pre,created_by,updated_by)
  values(v_at.empresa_id,v_at.unidade_id,v_at.id,v_at.paciente_id,v_proc,nullif(btrim(p_codigo_tuss),''),nullif(btrim(p_cirurgia),''),nullif(btrim(p_lateralidade),''),nullif(btrim(p_sala),''),v_sala_id,nullif(btrim(p_classificacao),''),nullif(btrim(p_porte),''),'agendada',p_inicio_previsto,p_cirurgiao_id,p_anestesista_id,nullif(btrim(p_diagnostico_pre),''),auth.uid(),auth.uid()) returning id into v_id;
  insert into public.cirurgia_eventos(empresa_id,unidade_id,cirurgia_id,atendimento_id,tipo_evento,status_novo,detalhes,profissional_id,created_by) values(v_at.empresa_id,v_at.unidade_id,v_id,v_at.id,'cirurgia_agendada','agendada',jsonb_build_object('inicio_previsto',p_inicio_previsto,'sala',p_sala,'procedimento',v_proc,'codigo_tuss',p_codigo_tuss),v_prof,auth.uid());
  return v_id;
exception when unique_violation then
  select c.id into v_id from public.cirurgias c where c.atendimento_id=v_at.id and coalesce(c.codigo_tuss,'')=coalesce(nullif(btrim(p_codigo_tuss),''),'') and c.inicio_previsto is not distinct from p_inicio_previsto and c.status<>'cancelada' limit 1;
  if v_id is not null then return v_id; end if; raise;
end $$;

create or replace function public.centro_cirurgico_salvar_checklist_operacional(p_cirurgia_id uuid,p_etapa text,p_itens jsonb default '{}'::jsonb,p_concluido boolean default false,p_observacoes text default null)
returns uuid language plpgsql security definer set search_path=public,pg_catalog,extensions as $$
declare v_c public.cirurgias%rowtype; v_id uuid; v_prof uuid; v_etapa text:=lower(coalesce(btrim(p_etapa),''));
begin
  if auth.uid() is null then raise exception 'CC_AUTENTICACAO_OBRIGATORIA' using errcode='42501'; end if;
  select * into v_c from public.cirurgias where id=p_cirurgia_id for update;
  if not found then raise exception 'CC_CIRURGIA_NAO_LOCALIZADA'; end if;
  if not (public.tem_permissao(v_c.empresa_id,v_c.unidade_id,'centro_cirurgico.operar') or public.tem_permissao(v_c.empresa_id,v_c.unidade_id,'centro_cirurgico.gerenciar')) then raise exception 'CC_SEM_PERMISSAO_OPERAR' using errcode='42501'; end if;
  if v_c.status in ('concluida','cancelada') then raise exception 'CC_CIRURGIA_ENCERRADA'; end if;
  if v_etapa not in ('entrada','pausa','saida') then raise exception 'CC_ETAPA_CHECKLIST_INVALIDA'; end if;
  v_prof:=public.profissional_logado(v_c.empresa_id); if v_prof is null then raise exception 'CC_USUARIO_SEM_PROFISSIONAL'; end if;
  select id into v_id from public.cirurgia_checklist where cirurgia_id=v_c.id and etapa=v_etapa order by created_at desc limit 1 for update;
  if v_id is null then
    insert into public.cirurgia_checklist(empresa_id,unidade_id,cirurgia_id,atendimento_id,etapa,itens,concluido,concluido_em,profissional_id,observacoes,created_by,updated_by)
    values(v_c.empresa_id,v_c.unidade_id,v_c.id,v_c.atendimento_id,v_etapa,coalesce(p_itens,'{}'::jsonb),coalesce(p_concluido,false),case when p_concluido then now() else null end,v_prof,nullif(btrim(p_observacoes),''),auth.uid(),auth.uid()) returning id into v_id;
  else
    update public.cirurgia_checklist set itens=coalesce(p_itens,'{}'::jsonb),concluido=coalesce(p_concluido,false),concluido_em=case when p_concluido then coalesce(concluido_em,now()) else null end,profissional_id=v_prof,observacoes=nullif(btrim(p_observacoes),''),updated_at=now(),updated_by=auth.uid() where id=v_id;
  end if;
  insert into public.cirurgia_eventos(empresa_id,unidade_id,cirurgia_id,atendimento_id,tipo_evento,detalhes,profissional_id,created_by) values(v_c.empresa_id,v_c.unidade_id,v_c.id,v_c.atendimento_id,'checklist_atualizado',jsonb_build_object('etapa',v_etapa,'concluido',coalesce(p_concluido,false),'itens',coalesce(p_itens,'{}'::jsonb)),v_prof,auth.uid());
  return v_id;
end $$;

create or replace function public.centro_cirurgico_salvar_anestesia_operacional(p_cirurgia_id uuid,p_tecnica text default null,p_asa text default null,p_via_aerea text default null,p_monitorizacao jsonb default '{}'::jsonb,p_medicamentos jsonb default '[]'::jsonb,p_fluidos jsonb default '[]'::jsonb,p_eventos jsonb default '[]'::jsonb,p_iniciar boolean default false,p_finalizar boolean default false,p_observacoes text default null)
returns uuid language plpgsql security definer set search_path=public,pg_catalog,extensions as $$
declare v_c public.cirurgias%rowtype; v_a public.anestesia_registros%rowtype; v_prof uuid;
begin
  if auth.uid() is null then raise exception 'CC_AUTENTICACAO_OBRIGATORIA' using errcode='42501'; end if;
  select * into v_c from public.cirurgias where id=p_cirurgia_id for update; if not found then raise exception 'CC_CIRURGIA_NAO_LOCALIZADA'; end if;
  if not (public.tem_permissao(v_c.empresa_id,v_c.unidade_id,'centro_cirurgico.operar') or public.tem_permissao(v_c.empresa_id,v_c.unidade_id,'centro_cirurgico.gerenciar')) then raise exception 'CC_SEM_PERMISSAO_OPERAR' using errcode='42501'; end if;
  if v_c.status in ('concluida','cancelada') then raise exception 'CC_CIRURGIA_ENCERRADA'; end if;
  v_prof:=public.profissional_logado(v_c.empresa_id); if v_prof is null then raise exception 'CC_USUARIO_SEM_PROFISSIONAL'; end if;
  select * into v_a from public.anestesia_registros where cirurgia_id=v_c.id order by created_at desc limit 1 for update;
  if found then
    update public.anestesia_registros set anestesista_id=coalesce(anestesista_id,v_c.anestesista_id,v_prof),tecnica=nullif(btrim(p_tecnica),''),asa=nullif(btrim(p_asa),''),via_aerea=nullif(btrim(p_via_aerea),''),monitorizacao=coalesce(p_monitorizacao,'{}'::jsonb),medicamentos=coalesce(p_medicamentos,'[]'::jsonb),fluidos=coalesce(p_fluidos,'[]'::jsonb),eventos=coalesce(p_eventos,'[]'::jsonb),inicio_em=case when p_iniciar then coalesce(inicio_em,now()) else inicio_em end,fim_em=case when p_finalizar then coalesce(fim_em,now()) else fim_em end,observacoes=nullif(btrim(p_observacoes),''),updated_at=now(),updated_by=auth.uid() where id=v_a.id returning * into v_a;
  else
    insert into public.anestesia_registros(empresa_id,unidade_id,cirurgia_id,atendimento_id,anestesista_id,tecnica,asa,via_aerea,monitorizacao,medicamentos,fluidos,eventos,inicio_em,fim_em,observacoes,created_by,updated_by)
    values(v_c.empresa_id,v_c.unidade_id,v_c.id,v_c.atendimento_id,coalesce(v_c.anestesista_id,v_prof),nullif(btrim(p_tecnica),''),nullif(btrim(p_asa),''),nullif(btrim(p_via_aerea),''),coalesce(p_monitorizacao,'{}'::jsonb),coalesce(p_medicamentos,'[]'::jsonb),coalesce(p_fluidos,'[]'::jsonb),coalesce(p_eventos,'[]'::jsonb),case when p_iniciar then now() else null end,case when p_finalizar then now() else null end,nullif(btrim(p_observacoes),''),auth.uid(),auth.uid()) returning * into v_a;
  end if;
  insert into public.cirurgia_eventos(empresa_id,unidade_id,cirurgia_id,atendimento_id,tipo_evento,detalhes,profissional_id,created_by) values(v_c.empresa_id,v_c.unidade_id,v_c.id,v_c.atendimento_id,case when p_finalizar then 'anestesia_finalizada' when p_iniciar then 'anestesia_iniciada' else 'anestesia_atualizada' end,jsonb_build_object('anestesia_id',v_a.id,'tecnica',p_tecnica,'asa',p_asa),v_prof,auth.uid());
  return v_a.id;
end $$;

create or replace function public.centro_cirurgico_salvar_rpa_operacional(p_cirurgia_id uuid,p_aldrete_entrada numeric default null,p_aldrete_alta numeric default null,p_dor numeric default null,p_nauseas boolean default false,p_sinais_vitais jsonb default '{}'::jsonb,p_intercorrencias text default null,p_destino text default null,p_alta boolean default false)
returns uuid language plpgsql security definer set search_path=public,pg_catalog,extensions as $$
declare v_c public.cirurgias%rowtype; v_r public.rpa_registros%rowtype; v_prof uuid;
begin
  if auth.uid() is null then raise exception 'CC_AUTENTICACAO_OBRIGATORIA' using errcode='42501'; end if;
  select * into v_c from public.cirurgias where id=p_cirurgia_id for update; if not found then raise exception 'CC_CIRURGIA_NAO_LOCALIZADA'; end if;
  if not (public.tem_permissao(v_c.empresa_id,v_c.unidade_id,'centro_cirurgico.operar') or public.tem_permissao(v_c.empresa_id,v_c.unidade_id,'centro_cirurgico.gerenciar')) then raise exception 'CC_SEM_PERMISSAO_OPERAR' using errcode='42501'; end if;
  if v_c.status='cancelada' then raise exception 'CC_CIRURGIA_CANCELADA'; end if;
  v_prof:=public.profissional_logado(v_c.empresa_id); if v_prof is null then raise exception 'CC_USUARIO_SEM_PROFISSIONAL'; end if;
  if p_alta and p_aldrete_alta is null then raise exception 'CC_RPA_ALDRETE_ALTA_OBRIGATORIO'; end if;
  select * into v_r from public.rpa_registros where cirurgia_id=v_c.id order by created_at desc limit 1 for update;
  if found then
    update public.rpa_registros set aldrete_entrada=coalesce(p_aldrete_entrada,aldrete_entrada),aldrete_alta=p_aldrete_alta,dor=p_dor,nauseas=coalesce(p_nauseas,false),sinais_vitais=coalesce(p_sinais_vitais,'{}'::jsonb),intercorrencias=nullif(btrim(p_intercorrencias),''),destino=nullif(btrim(p_destino),''),profissional_id=v_prof,status=case when p_alta then 'alta' else 'em_rpa' end,alta_em=case when p_alta then coalesce(alta_em,now()) else alta_em end,updated_at=now(),updated_by=auth.uid() where id=v_r.id returning * into v_r;
  else
    insert into public.rpa_registros(empresa_id,unidade_id,cirurgia_id,atendimento_id,aldrete_entrada,aldrete_alta,dor,nauseas,sinais_vitais,intercorrencias,destino,profissional_id,status,alta_em,created_by,updated_by)
    values(v_c.empresa_id,v_c.unidade_id,v_c.id,v_c.atendimento_id,p_aldrete_entrada,p_aldrete_alta,p_dor,coalesce(p_nauseas,false),coalesce(p_sinais_vitais,'{}'::jsonb),nullif(btrim(p_intercorrencias),''),nullif(btrim(p_destino),''),v_prof,case when p_alta then 'alta' else 'em_rpa' end,case when p_alta then now() else null end,auth.uid(),auth.uid()) returning * into v_r;
  end if;
  insert into public.cirurgia_eventos(empresa_id,unidade_id,cirurgia_id,atendimento_id,tipo_evento,detalhes,profissional_id,created_by) values(v_c.empresa_id,v_c.unidade_id,v_c.id,v_c.atendimento_id,case when p_alta then 'rpa_alta' else 'rpa_atualizada' end,jsonb_build_object('rpa_id',v_r.id,'aldrete_entrada',p_aldrete_entrada,'aldrete_alta',p_aldrete_alta,'destino',p_destino),v_prof,auth.uid());
  return v_r.id;
end $$;

create or replace function public.centro_cirurgico_registrar_opme_operacional(p_cirurgia_id uuid,p_item text,p_codigo text default null,p_fabricante text default null,p_lote text default null,p_serie text default null,p_registro_anvisa text default null,p_quantidade numeric default 1,p_status text default 'previsto',p_observacoes text default null)
returns uuid language plpgsql security definer set search_path=public,pg_catalog,extensions as $$
declare v_c public.cirurgias%rowtype; v_id uuid; v_prof uuid; v_status text:=lower(coalesce(btrim(p_status),'previsto'));
begin
  if auth.uid() is null then raise exception 'CC_AUTENTICACAO_OBRIGATORIA' using errcode='42501'; end if;
  select * into v_c from public.cirurgias where id=p_cirurgia_id for update; if not found then raise exception 'CC_CIRURGIA_NAO_LOCALIZADA'; end if;
  if not (public.tem_permissao(v_c.empresa_id,v_c.unidade_id,'centro_cirurgico.operar') or public.tem_permissao(v_c.empresa_id,v_c.unidade_id,'centro_cirurgico.gerenciar')) then raise exception 'CC_SEM_PERMISSAO_OPERAR' using errcode='42501'; end if;
  if v_c.status in ('concluida','cancelada') then raise exception 'CC_CIRURGIA_ENCERRADA'; end if;
  if coalesce(btrim(p_item),'')='' then raise exception 'CC_OPME_ITEM_OBRIGATORIO'; end if;
  if coalesce(p_quantidade,0)<=0 then raise exception 'CC_OPME_QUANTIDADE_INVALIDA'; end if;
  if v_status not in ('previsto','utilizado','nao_utilizado','cancelado') then raise exception 'CC_OPME_STATUS_INVALIDO'; end if;
  v_prof:=public.profissional_logado(v_c.empresa_id);
  insert into public.cirurgia_opme(empresa_id,unidade_id,cirurgia_id,atendimento_id,item,codigo,fabricante,lote,serie,registro_anvisa,quantidade,status,utilizado_em,observacoes,created_by,updated_by)
  values(v_c.empresa_id,v_c.unidade_id,v_c.id,v_c.atendimento_id,btrim(p_item),nullif(btrim(p_codigo),''),nullif(btrim(p_fabricante),''),nullif(btrim(p_lote),''),nullif(btrim(p_serie),''),nullif(btrim(p_registro_anvisa),''),p_quantidade,v_status,case when v_status='utilizado' then now() else null end,nullif(btrim(p_observacoes),''),auth.uid(),auth.uid()) returning id into v_id;
  insert into public.cirurgia_eventos(empresa_id,unidade_id,cirurgia_id,atendimento_id,tipo_evento,detalhes,profissional_id,created_by) values(v_c.empresa_id,v_c.unidade_id,v_c.id,v_c.atendimento_id,'opme_registrada',jsonb_build_object('opme_id',v_id,'item',btrim(p_item),'codigo',p_codigo,'lote',p_lote,'serie',p_serie,'status',v_status,'quantidade',p_quantidade),v_prof,auth.uid());
  return v_id;
end $$;

create or replace function public.cme_salvar_ciclo_operacional(p_empresa_id uuid,p_unidade_id uuid,p_ciclo_id uuid default null,p_codigo_ciclo text default null,p_equipamento text default null,p_metodo text default null,p_carga text default null,p_indicadores jsonb default '{}'::jsonb,p_resultado text default null,p_status text default 'em_processamento',p_observacoes text default null,p_liberar boolean default false)
returns uuid language plpgsql security definer set search_path=public,pg_catalog,extensions as $$
declare v_c public.cme_ciclos%rowtype; v_id uuid; v_prof uuid; v_status text:=lower(coalesce(btrim(p_status),'em_processamento'));
begin
  if auth.uid() is null then raise exception 'CME_AUTENTICACAO_OBRIGATORIA' using errcode='42501'; end if;
  if not public.tem_unidade(p_empresa_id,p_unidade_id) or not public.tem_permissao(p_empresa_id,p_unidade_id,'cme.gerenciar') then raise exception 'CME_SEM_PERMISSAO_GERENCIAR' using errcode='42501'; end if;
  if v_status not in ('em_processamento','concluido','liberado','reprovado') then raise exception 'CME_STATUS_INVALIDO'; end if;
  if p_liberar and (coalesce(btrim(p_resultado),'')='' or coalesce(p_indicadores,'{}'::jsonb)='{}'::jsonb) then raise exception 'CME_LIBERACAO_EXIGE_RESULTADO_E_INDICADORES'; end if;
  v_prof:=public.profissional_logado(p_empresa_id); if p_liberar and v_prof is null then raise exception 'CME_USUARIO_SEM_PROFISSIONAL'; end if;
  if p_ciclo_id is not null then
    select * into v_c from public.cme_ciclos where id=p_ciclo_id for update;
    if not found or v_c.empresa_id<>p_empresa_id or v_c.unidade_id<>p_unidade_id then raise exception 'CME_CICLO_NAO_LOCALIZADO'; end if;
    if v_c.status='liberado' then return v_c.id; end if;
    update public.cme_ciclos set codigo_ciclo=coalesce(nullif(btrim(p_codigo_ciclo),''),codigo_ciclo),equipamento=nullif(btrim(p_equipamento),''),metodo=nullif(btrim(p_metodo),''),carga=nullif(btrim(p_carga),''),indicadores=coalesce(p_indicadores,'{}'::jsonb),resultado=nullif(btrim(p_resultado),''),status=case when p_liberar then 'liberado' else v_status end,inicio_em=coalesce(inicio_em,now()),fim_em=case when v_status in ('concluido','liberado','reprovado') or p_liberar then coalesce(fim_em,now()) else fim_em end,liberado_por=case when p_liberar then v_prof else liberado_por end,liberado_em=case when p_liberar then coalesce(liberado_em,now()) else liberado_em end,observacoes=nullif(btrim(p_observacoes),''),updated_at=now(),updated_by=auth.uid() where id=v_c.id returning id into v_id;
  else
    if coalesce(btrim(p_codigo_ciclo),'')='' then raise exception 'CME_CODIGO_CICLO_OBRIGATORIO'; end if;
    insert into public.cme_ciclos(empresa_id,unidade_id,codigo_ciclo,equipamento,metodo,carga,inicio_em,fim_em,indicadores,resultado,liberado_por,liberado_em,status,observacoes,created_by,updated_by)
    values(p_empresa_id,p_unidade_id,btrim(p_codigo_ciclo),nullif(btrim(p_equipamento),''),nullif(btrim(p_metodo),''),nullif(btrim(p_carga),''),now(),case when v_status in ('concluido','liberado','reprovado') or p_liberar then now() else null end,coalesce(p_indicadores,'{}'::jsonb),nullif(btrim(p_resultado),''),case when p_liberar then v_prof else null end,case when p_liberar then now() else null end,case when p_liberar then 'liberado' else v_status end,nullif(btrim(p_observacoes),''),auth.uid(),auth.uid()) returning id into v_id;
  end if;
  return v_id;
end $$;

create or replace function public.centro_cirurgico_vincular_ciclo_cme_operacional(p_cirurgia_id uuid,p_ciclo_id uuid,p_observacoes text default null)
returns uuid language plpgsql security definer set search_path=public,pg_catalog,extensions as $$
declare v_c public.cirurgias%rowtype; v_ciclo public.cme_ciclos%rowtype; v_id uuid; v_prof uuid;
begin
  if auth.uid() is null then raise exception 'CC_AUTENTICACAO_OBRIGATORIA' using errcode='42501'; end if;
  select * into v_c from public.cirurgias where id=p_cirurgia_id for update; if not found then raise exception 'CC_CIRURGIA_NAO_LOCALIZADA'; end if;
  if not (public.tem_permissao(v_c.empresa_id,v_c.unidade_id,'centro_cirurgico.operar') or public.tem_permissao(v_c.empresa_id,v_c.unidade_id,'centro_cirurgico.gerenciar')) then raise exception 'CC_SEM_PERMISSAO_OPERAR' using errcode='42501'; end if;
  if v_c.status in ('concluida','cancelada') then raise exception 'CC_CIRURGIA_ENCERRADA'; end if;
  select * into v_ciclo from public.cme_ciclos where id=p_ciclo_id;
  if not found or v_ciclo.empresa_id<>v_c.empresa_id or v_ciclo.unidade_id<>v_c.unidade_id then raise exception 'CC_CME_CICLO_NAO_LOCALIZADO'; end if;
  if v_ciclo.status<>'liberado' or v_ciclo.liberado_em is null then raise exception 'CC_CME_CICLO_NAO_LIBERADO'; end if;
  insert into public.cirurgia_cme_ciclos(empresa_id,unidade_id,cirurgia_id,ciclo_id,observacoes,created_by) values(v_c.empresa_id,v_c.unidade_id,v_c.id,v_ciclo.id,nullif(btrim(p_observacoes),''),auth.uid()) on conflict(cirurgia_id,ciclo_id) do update set observacoes=excluded.observacoes returning id into v_id;
  v_prof:=public.profissional_logado(v_c.empresa_id);
  insert into public.cirurgia_eventos(empresa_id,unidade_id,cirurgia_id,atendimento_id,tipo_evento,detalhes,profissional_id,created_by) values(v_c.empresa_id,v_c.unidade_id,v_c.id,v_c.atendimento_id,'cme_vinculado',jsonb_build_object('ciclo_id',v_ciclo.id,'codigo_ciclo',v_ciclo.codigo_ciclo,'metodo',v_ciclo.metodo,'liberado_em',v_ciclo.liberado_em),v_prof,auth.uid());
  return v_id;
end $$;

create or replace function public.centro_cirurgico_transicionar_operacional(p_cirurgia_id uuid,p_novo_status text,p_observacoes text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_catalog,extensions as $$
declare
  v_c public.cirurgias%rowtype; v_novo text:=lower(coalesce(btrim(p_novo_status),'')); v_antigo text; v_prof uuid; v_checklists integer; v_sala_pronta boolean; v_conta uuid; v_evento uuid; r record;
begin
  if auth.uid() is null then raise exception 'CC_AUTENTICACAO_OBRIGATORIA' using errcode='42501'; end if;
  select * into v_c from public.cirurgias where id=p_cirurgia_id for update; if not found then raise exception 'CC_CIRURGIA_NAO_LOCALIZADA'; end if;
  if not (public.tem_permissao(v_c.empresa_id,v_c.unidade_id,'centro_cirurgico.operar') or public.tem_permissao(v_c.empresa_id,v_c.unidade_id,'centro_cirurgico.gerenciar')) then raise exception 'CC_SEM_PERMISSAO_OPERAR' using errcode='42501'; end if;
  if v_novo not in ('agendada','em_preparo','em_andamento','recuperacao','concluida','cancelada') then raise exception 'CC_STATUS_INVALIDO'; end if;
  if v_novo=v_c.status then return jsonb_build_object('cirurgia_id',v_c.id,'status',v_c.status,'idempotente',true); end if;
  if v_novo='cancelada' then
    if not public.tem_permissao(v_c.empresa_id,v_c.unidade_id,'centro_cirurgico.gerenciar') then raise exception 'CC_CANCELAMENTO_EXIGE_GERENCIA' using errcode='42501'; end if;
    if coalesce(btrim(p_observacoes),'')='' then raise exception 'CC_CANCELAMENTO_EXIGE_MOTIVO'; end if;
  end if;
  if not ((v_c.status='agendada' and v_novo in ('em_preparo','cancelada')) or (v_c.status='em_preparo' and v_novo in ('agendada','em_andamento','cancelada')) or (v_c.status='em_andamento' and v_novo in ('recuperacao','cancelada')) or (v_c.status='recuperacao' and v_novo='concluida')) then raise exception 'CC_TRANSICAO_INVALIDA_%_PARA_%',v_c.status,v_novo; end if;
  v_prof:=public.profissional_logado(v_c.empresa_id); if v_prof is null then raise exception 'CC_USUARIO_SEM_PROFISSIONAL'; end if;
  if v_novo='em_andamento' then
    if v_c.sala_id is not null then select s.equipamentos_prontos into v_sala_pronta from public.vw_salas_cirurgicas_prontidao s where s.sala_id=v_c.sala_id and s.empresa_id=v_c.empresa_id and s.unidade_id=v_c.unidade_id limit 1;
    elsif coalesce(btrim(v_c.sala),'')<>'' then select s.equipamentos_prontos into v_sala_pronta from public.vw_salas_cirurgicas_prontidao s where s.empresa_id=v_c.empresa_id and s.unidade_id=v_c.unidade_id and (lower(s.codigo)=lower(v_c.sala) or lower(s.nome)=lower(v_c.sala)) limit 1;
    else raise exception 'CC_SALA_OBRIGATORIA'; end if;
    if v_sala_pronta is false then raise exception 'CC_SALA_COM_EQUIPAMENTO_INDISPONIVEL'; end if;
    select count(distinct etapa) into v_checklists from public.cirurgia_checklist where cirurgia_id=v_c.id and etapa in ('entrada','pausa') and concluido;
    if v_checklists<2 then raise exception 'CC_CHECKLIST_ENTRADA_E_PAUSA_OBRIGATORIOS'; end if;
  end if;
  if v_novo='recuperacao' then
    if not exists(select 1 from public.cirurgia_checklist where cirurgia_id=v_c.id and etapa='saida' and concluido) then raise exception 'CC_CHECKLIST_SAIDA_OBRIGATORIO'; end if;
    if v_c.anestesista_id is not null and not exists(select 1 from public.anestesia_registros where cirurgia_id=v_c.id and fim_em is not null) then raise exception 'CC_ANESTESIA_DEVE_SER_FINALIZADA'; end if;
  end if;
  if v_novo='concluida' and v_c.anestesista_id is not null and not exists(select 1 from public.rpa_registros where cirurgia_id=v_c.id and status='alta' and alta_em is not null) then raise exception 'CC_RPA_DEVE_TER_ALTA'; end if;
  v_antigo:=v_c.status;
  update public.cirurgias set status=v_novo,inicio_em=case when v_novo='em_andamento' then coalesce(inicio_em,now()) else inicio_em end,fim_em=case when v_novo in ('recuperacao','concluida') then coalesce(fim_em,now()) else fim_em end,intercorrencias=case when coalesce(btrim(p_observacoes),'')<>'' then concat_ws(E'\n',nullif(intercorrencias,''),btrim(p_observacoes)) else intercorrencias end,updated_at=now(),updated_by=auth.uid() where id=v_c.id returning * into v_c;
  insert into public.cirurgia_eventos(empresa_id,unidade_id,cirurgia_id,atendimento_id,tipo_evento,status_anterior,status_novo,detalhes,profissional_id,created_by) values(v_c.empresa_id,v_c.unidade_id,v_c.id,v_c.atendimento_id,'status_alterado',v_antigo,v_novo,jsonb_build_object('observacoes',nullif(btrim(p_observacoes),''),'sala',v_c.sala,'procedimento',v_c.procedimento),v_prof,auth.uid());
  if v_novo='concluida' then
    v_evento:=public.registrar_evento_producao_assistencial_internal(v_c.atendimento_id,'procedimento','cirurgia',v_c.id,coalesce(v_c.fim_em,now()),1,'procedimentos',coalesce(v_c.cirurgiao_id,v_prof),'centro_cirurgico',null,null,v_c.codigo_tuss,true,jsonb_build_object('procedimento',v_c.procedimento,'cirurgia',v_c.cirurgia,'sala',v_c.sala,'porte',v_c.porte,'classificacao',v_c.classificacao));
    for r in select o.* from public.cirurgia_opme o where o.cirurgia_id=v_c.id and o.status='utilizado' loop
      perform public.registrar_evento_producao_assistencial_internal(v_c.atendimento_id,'opme','cirurgia_opme',r.id,coalesce(r.utilizado_em,v_c.fim_em,now()),r.quantidade,'opme',coalesce(v_c.cirurgiao_id,v_prof),'centro_cirurgico',null,null,r.codigo,true,jsonb_build_object('item',r.item,'fabricante',r.fabricante,'lote',r.lote,'serie',r.serie,'registro_anvisa',r.registro_anvisa,'cirurgia_id',v_c.id));
    end loop;
    select c.id into v_conta from public.contas_faturamento c where c.atendimento_id=v_c.atendimento_id and c.status in ('aberta','pre_faturamento','com_criticas') limit 1 for update;
    if v_conta is not null then
      insert into public.conta_faturamento_grupos_ato(conta_id,codigo_grupo,data_ato,observacoes,procedimento_principal_codigo,procedimento_principal_descricao,sala,inicio_ato,fim_ato,porte_sala)
      values(v_conta,'CIRURGIA-'||v_c.id::text,coalesce(v_c.inicio_em,v_c.inicio_previsto,now())::date,nullif(btrim(p_observacoes),''),v_c.codigo_tuss,coalesce(v_c.cirurgia,v_c.procedimento),v_c.sala,v_c.inicio_em,v_c.fim_em,v_c.porte)
      on conflict(conta_id,codigo_grupo) do update set procedimento_principal_codigo=excluded.procedimento_principal_codigo,procedimento_principal_descricao=excluded.procedimento_principal_descricao,sala=excluded.sala,inicio_ato=excluded.inicio_ato,fim_ato=excluded.fim_ato,porte_sala=excluded.porte_sala,observacoes=coalesce(excluded.observacoes,public.conta_faturamento_grupos_ato.observacoes);
    end if;
  end if;
  return jsonb_build_object('cirurgia_id',v_c.id,'status_anterior',v_antigo,'status',v_novo,'producao_evento_id',v_evento,'conta_id',v_conta);
end $$;

revoke all on function public.centro_cirurgico_agendar_operacional(uuid,uuid,text,text,text,text,text,text,text,timestamptz,uuid,uuid,text) from public,anon;
revoke all on function public.centro_cirurgico_salvar_checklist_operacional(uuid,text,jsonb,boolean,text) from public,anon;
revoke all on function public.centro_cirurgico_salvar_anestesia_operacional(uuid,text,text,text,jsonb,jsonb,jsonb,jsonb,boolean,boolean,text) from public,anon;
revoke all on function public.centro_cirurgico_salvar_rpa_operacional(uuid,numeric,numeric,numeric,boolean,jsonb,text,text,boolean) from public,anon;
revoke all on function public.centro_cirurgico_registrar_opme_operacional(uuid,text,text,text,text,text,text,numeric,text,text) from public,anon;
revoke all on function public.cme_salvar_ciclo_operacional(uuid,uuid,uuid,text,text,text,text,jsonb,text,text,text,boolean) from public,anon;
revoke all on function public.centro_cirurgico_vincular_ciclo_cme_operacional(uuid,uuid,text) from public,anon;
revoke all on function public.centro_cirurgico_transicionar_operacional(uuid,text,text) from public,anon;

grant execute on function public.centro_cirurgico_agendar_operacional(uuid,uuid,text,text,text,text,text,text,text,timestamptz,uuid,uuid,text) to authenticated;
grant execute on function public.centro_cirurgico_salvar_checklist_operacional(uuid,text,jsonb,boolean,text) to authenticated;
grant execute on function public.centro_cirurgico_salvar_anestesia_operacional(uuid,text,text,text,jsonb,jsonb,jsonb,jsonb,boolean,boolean,text) to authenticated;
grant execute on function public.centro_cirurgico_salvar_rpa_operacional(uuid,numeric,numeric,numeric,boolean,jsonb,text,text,boolean) to authenticated;
grant execute on function public.centro_cirurgico_registrar_opme_operacional(uuid,text,text,text,text,text,text,numeric,text,text) to authenticated;
grant execute on function public.cme_salvar_ciclo_operacional(uuid,uuid,uuid,text,text,text,text,jsonb,text,text,text,boolean) to authenticated;
grant execute on function public.centro_cirurgico_vincular_ciclo_cme_operacional(uuid,uuid,text) to authenticated;
grant execute on function public.centro_cirurgico_transicionar_operacional(uuid,text,text) to authenticated;

comment on table public.cirurgia_eventos is 'Linha do tempo imutavel do fluxo operacional do centro cirurgico.';
comment on table public.cirurgia_cme_ciclos is 'Rastreabilidade entre cirurgia e ciclos CME liberados.';

commit;
