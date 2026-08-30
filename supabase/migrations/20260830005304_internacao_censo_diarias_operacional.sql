create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

alter table public.internacao_diarias add column if not exists origem text not null default 'manual';
alter table public.internacao_diarias add column if not exists gerada_automaticamente boolean not null default false;
alter table public.internacao_diarias add column if not exists censo_referencia_em timestamptz null;
alter table public.internacao_diarias add column if not exists updated_at timestamptz not null default now();
alter table public.internacao_diarias add column if not exists updated_by uuid null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.internacao_diarias'::regclass
      and conname='internacao_diarias_origem_check'
  ) then
    alter table public.internacao_diarias
      add constraint internacao_diarias_origem_check
      check (origem in ('manual','censo_automatico','admissao','reprocessamento'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.internacao_diarias'::regclass
      and conname='internacao_diarias_updated_by_fkey'
  ) then
    alter table public.internacao_diarias
      add constraint internacao_diarias_updated_by_fkey
      foreign key (updated_by) references auth.users(id);
  end if;
end $$;

create index if not exists idx_internacao_diarias_censo_aberto
  on public.internacao_diarias (empresa_id, unidade_id, data_referencia, status)
  where status='aberta';

create or replace function public.sincronizar_diaria_internacao_internal(
  p_internacao_id uuid,
  p_data date default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public','pg_catalog','extensions'
as $$
declare
  v_i public.internacoes%rowtype;
  v_data date := coalesce(p_data,(now() at time zone 'America/Sao_Paulo')::date);
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_leito_id uuid;
  v_setor text;
  v_acomodacao text;
  v_id uuid;
  v_status text;
  v_fim_dia timestamptz;
begin
  select * into v_i from public.internacoes where id=p_internacao_id;
  if not found then return null; end if;
  if v_data > v_hoje then raise exception 'CENSO_DATA_FUTURA_NAO_PERMITIDA'; end if;
  if v_data < (v_i.data_internacao at time zone 'America/Sao_Paulo')::date then return null; end if;
  if v_i.data_alta is not null and v_data > (v_i.data_alta at time zone 'America/Sao_Paulo')::date then return null; end if;

  v_fim_dia := ((v_data + 1)::timestamp at time zone 'America/Sao_Paulo');

  select m.leito_destino_id,l.setor,l.acomodacao
    into v_leito_id,v_setor,v_acomodacao
  from public.movimentacoes_leitos m
  left join public.leitos l on l.id=m.leito_destino_id
  where m.internacao_id=v_i.id
    and m.leito_destino_id is not null
    and m.movimentado_em < v_fim_dia
  order by m.movimentado_em desc, m.created_at desc
  limit 1;

  if v_leito_id is null
     and v_data=v_hoje
     and v_i.leito_id is not null
     and v_i.status in ('internado','transferido') then
    v_leito_id:=v_i.leito_id;
    v_setor:=v_i.setor;
    v_acomodacao:=v_i.acomodacao;
  end if;

  if v_leito_id is null then return null; end if;

  v_status:=case
    when v_data < v_hoje then 'fechada'
    when v_i.data_alta is not null and (v_i.data_alta at time zone 'America/Sao_Paulo')::date <= v_data then 'fechada'
    else 'aberta'
  end;

  insert into public.internacao_diarias(
    empresa_id,unidade_id,internacao_id,atendimento_id,data_referencia,
    acomodacao,setor,leito_id,status,observacoes,created_by,
    origem,gerada_automaticamente,censo_referencia_em,updated_at,updated_by
  ) values (
    v_i.empresa_id,v_i.unidade_id,v_i.id,v_i.atendimento_id,v_data,
    coalesce(v_acomodacao,v_i.acomodacao),coalesce(v_setor,v_i.setor),v_leito_id,v_status,
    'Censo automático de permanência hospitalar',auth.uid(),
    'censo_automatico',true,now(),now(),auth.uid()
  )
  on conflict (internacao_id,data_referencia) do update set
    acomodacao=excluded.acomodacao,
    setor=excluded.setor,
    leito_id=excluded.leito_id,
    status=excluded.status,
    censo_referencia_em=excluded.censo_referencia_em,
    gerada_automaticamente=true,
    updated_at=now(),
    updated_by=auth.uid()
  where public.internacao_diarias.origem<>'manual'
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.internacao_diarias
    where internacao_id=v_i.id and data_referencia=v_data;
  end if;
  return v_id;
end $$;

create or replace function public.recompor_diarias_internacao_internal(
  p_internacao_id uuid,
  p_ate date default null
)
returns integer
language plpgsql
security definer
set search_path to 'public','pg_catalog','extensions'
as $$
declare
  v_i public.internacoes%rowtype;
  v_inicio date;
  v_fim date;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_data date;
  v_id uuid;
  v_total integer:=0;
begin
  select * into v_i from public.internacoes where id=p_internacao_id;
  if not found then return 0; end if;
  v_inicio:=(v_i.data_internacao at time zone 'America/Sao_Paulo')::date;
  v_fim:=least(coalesce(p_ate,v_hoje),coalesce((v_i.data_alta at time zone 'America/Sao_Paulo')::date,v_hoje));
  if v_fim<v_inicio then return 0; end if;

  for v_data in
    select gs::date
    from generate_series(v_inicio::timestamp,v_fim::timestamp,interval '1 day') gs
    where not exists(
      select 1 from public.internacao_diarias d
      where d.internacao_id=v_i.id and d.data_referencia=gs::date and d.status='fechada'
    )
  loop
    v_id:=public.sincronizar_diaria_internacao_internal(v_i.id,v_data);
    if v_id is not null then v_total:=v_total+1; end if;
  end loop;

  update public.internacao_diarias
     set status='fechada',updated_at=now(),updated_by=auth.uid()
   where internacao_id=v_i.id
     and data_referencia<v_hoje
     and status='aberta';

  return v_total;
end $$;

create or replace function public.gerar_censo_internacao_diario_internal(p_data date default null)
returns integer
language plpgsql
security definer
set search_path to 'public','pg_catalog','extensions'
as $$
declare
  v_data date:=coalesce(p_data,(now() at time zone 'America/Sao_Paulo')::date);
  v_id uuid;
  v_total integer:=0;
begin
  if v_data>(now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'CENSO_DATA_FUTURA_NAO_PERMITIDA';
  end if;

  for v_id in
    select i.id
    from public.internacoes i
    where (i.data_internacao at time zone 'America/Sao_Paulo')::date<=v_data
      and (i.data_alta is null or (i.data_alta at time zone 'America/Sao_Paulo')::date>=v_data)
      and i.status in ('internado','transferido','alta')
  loop
    v_total:=v_total+public.recompor_diarias_internacao_internal(v_id,v_data);
  end loop;

  update public.internacao_diarias
     set status='fechada',updated_at=now(),updated_by=null
   where gerada_automaticamente=true
     and data_referencia<(now() at time zone 'America/Sao_Paulo')::date
     and status='aberta';

  return v_total;
end $$;

create or replace function public.sincronizar_censo_por_internacao_trigger()
returns trigger
language plpgsql
security definer
set search_path to 'public','pg_catalog','extensions'
as $$
begin
  if new.status in ('internado','transferido','alta') then
    perform public.recompor_diarias_internacao_internal(
      new.id,
      coalesce((new.data_alta at time zone 'America/Sao_Paulo')::date,(now() at time zone 'America/Sao_Paulo')::date)
    );
  end if;
  return new;
end $$;

drop trigger if exists trg_sincronizar_censo_por_internacao on public.internacoes;
create trigger trg_sincronizar_censo_por_internacao
after insert or update of status,leito_id,setor,acomodacao,data_alta
on public.internacoes
for each row execute function public.sincronizar_censo_por_internacao_trigger();

revoke all on function public.sincronizar_diaria_internacao_internal(uuid,date) from public,anon,authenticated;
revoke all on function public.recompor_diarias_internacao_internal(uuid,date) from public,anon,authenticated;
revoke all on function public.gerar_censo_internacao_diario_internal(date) from public,anon,authenticated;
revoke all on function public.sincronizar_censo_por_internacao_trigger() from public,anon,authenticated;
grant execute on function public.sincronizar_diaria_internacao_internal(uuid,date) to postgres;
grant execute on function public.recompor_diarias_internacao_internal(uuid,date) to postgres;
grant execute on function public.gerar_censo_internacao_diario_internal(date) to postgres;
grant execute on function public.sincronizar_censo_por_internacao_trigger() to postgres;

create or replace function public.reconciliar_pendencias_internacao_internal(p_empresa_id uuid, p_unidade_id uuid, p_atendimento_id uuid default null::uuid, p_resolvida_por uuid default null::uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare v_resolvidas integer:=0; v_abertas integer:=0; v_hoje date:=(now() at time zone 'America/Sao_Paulo')::date;
begin
  insert into public.integracao_pendencias(empresa_id,unidade_id,atendimento_id,paciente_id,regra_chave,origem_tabela,origem_id,setor_origem,setor_destino,severidade,titulo,detalhes,contexto)
  select i.empresa_id,i.unidade_id,i.atendimento_id,a.paciente_id,'internacao_sem_leito_status_internado','internacoes',i.id,'internacao','nir','critica',
    'Internação marcada como internado sem leito físico','A internação está em status internado, mas não possui leito_id. Regularize a alocação pelo NIR/Mapa de Leitos.',
    jsonb_build_object('internacao_id',i.id,'setor',i.setor,'status',i.status)
  from public.internacoes i join public.atendimentos a on a.id=i.atendimento_id
  where i.empresa_id=p_empresa_id and i.unidade_id=p_unidade_id and i.status='internado' and i.leito_id is null and (p_atendimento_id is null or i.atendimento_id=p_atendimento_id)
  on conflict do nothing;

  insert into public.integracao_pendencias(empresa_id,unidade_id,atendimento_id,paciente_id,regra_chave,origem_tabela,origem_id,setor_origem,setor_destino,severidade,titulo,detalhes,contexto)
  select i.empresa_id,i.unidade_id,i.atendimento_id,a.paciente_id,'internacao_leito_inconsistente','internacoes',i.id,'internacao','nir','critica',
    'Internação e ocupação física do leito divergentes','A internação aponta um leito, mas o cadastro físico não está ocupado de forma compatível com o episódio.',
    jsonb_build_object('internacao_id',i.id,'leito_id',i.leito_id,'setor',i.setor)
  from public.internacoes i join public.atendimentos a on a.id=i.atendimento_id
  where i.empresa_id=p_empresa_id and i.unidade_id=p_unidade_id and i.status='internado' and i.leito_id is not null and (p_atendimento_id is null or i.atendimento_id=p_atendimento_id)
    and not exists(select 1 from public.leitos l where l.id=i.leito_id and l.empresa_id=i.empresa_id and l.unidade_id=i.unidade_id and l.status='ocupado')
  on conflict do nothing;

  insert into public.integracao_pendencias(empresa_id,unidade_id,atendimento_id,paciente_id,regra_chave,origem_tabela,origem_id,setor_origem,setor_destino,severidade,titulo,detalhes,contexto)
  select i.empresa_id,i.unidade_id,i.atendimento_id,a.paciente_id,'internacao_sem_diaria_censo','internacoes',i.id,'internacao','faturamento','critica',
    'Internação ativa sem diária factual do censo','A internação possui leito físico ativo, mas não existe diária factual para a data local atual. O censo automático deve ser recomposto antes do fechamento.',
    jsonb_build_object('internacao_id',i.id,'data_referencia',v_hoje,'leito_id',i.leito_id,'setor',i.setor)
  from public.internacoes i join public.atendimentos a on a.id=i.atendimento_id
  where i.empresa_id=p_empresa_id and i.unidade_id=p_unidade_id and i.status='internado' and i.leito_id is not null
    and (p_atendimento_id is null or i.atendimento_id=p_atendimento_id)
    and not exists(select 1 from public.internacao_diarias d where d.internacao_id=i.id and d.data_referencia=v_hoje and lower(coalesce(d.status,''))<>'cancelada')
  on conflict do nothing;

  insert into public.integracao_pendencias(empresa_id,unidade_id,atendimento_id,paciente_id,regra_chave,origem_tabela,origem_id,setor_origem,setor_destino,severidade,titulo,detalhes,contexto)
  select d.empresa_id,d.unidade_id,d.atendimento_id,a.paciente_id,'diaria_internacao_sem_producao','internacao_diarias',d.id,'internacao','faturamento','alta',
    'Diária de internação sem evento no Livro de Produção','Existe fato diário de internação ativo sem evento de produção correspondente.',
    jsonb_build_object('internacao_id',d.internacao_id,'data_referencia',d.data_referencia,'setor',d.setor,'acomodacao',d.acomodacao)
  from public.internacao_diarias d join public.atendimentos a on a.id=d.atendimento_id
  where d.empresa_id=p_empresa_id and d.unidade_id=p_unidade_id and lower(coalesce(d.status,''))<>'cancelada' and (p_atendimento_id is null or d.atendimento_id=p_atendimento_id)
    and not exists(select 1 from public.producao_assistencial_eventos e where e.origem_tipo='internacao_diaria' and e.origem_id=d.id and e.status in ('registrado','consolidado'))
  on conflict do nothing;

  insert into public.integracao_pendencias(empresa_id,unidade_id,atendimento_id,paciente_id,regra_chave,origem_tabela,origem_id,setor_origem,setor_destino,severidade,titulo,detalhes,contexto)
  select i.empresa_id,i.unidade_id,i.atendimento_id,a.paciente_id,'alta_sem_conta_faturamento','internacoes',i.id,'internacao','faturamento','critica',
    'Alta hospitalar sem conta pós-alta preparada','A internação foi encerrada, mas não existe conta de faturamento vinculada ao mesmo atendimento.',
    jsonb_build_object('internacao_id',i.id,'data_alta',i.data_alta)
  from public.internacoes i join public.atendimentos a on a.id=i.atendimento_id
  where i.empresa_id=p_empresa_id and i.unidade_id=p_unidade_id and i.status='alta' and (p_atendimento_id is null or i.atendimento_id=p_atendimento_id)
    and not exists(select 1 from public.contas_faturamento c where c.atendimento_id=i.atendimento_id)
  on conflict do nothing;

  insert into public.integracao_pendencias(empresa_id,unidade_id,atendimento_id,paciente_id,regra_chave,origem_tabela,origem_id,setor_origem,setor_destino,severidade,titulo,detalhes,contexto)
  select ap.empresa_id,ap.unidade_id,ap.atendimento_id,ap.paciente_id,'alta_com_aprazamento_vencido_pendente','prescricao_aprazamentos',ap.id,'enfermagem','enfermagem','alta',
    'Alta com aprazamento hospitalar vencido ainda pendente','Há dose programada até o momento da alta que permaneceu pendente. O setor deve registrar administração, omissão, recusa ou cancelamento com justificativa.',
    jsonb_build_object('prescricao_id',ap.prescricao_id,'programado_em',ap.programado_em,'internacao_id',i.id)
  from public.internacoes i join public.prescricao_aprazamentos ap on ap.atendimento_id=i.atendimento_id and ap.empresa_id=i.empresa_id and ap.unidade_id=i.unidade_id
  where i.empresa_id=p_empresa_id and i.unidade_id=p_unidade_id and i.status='alta' and ap.status='pendente' and ap.programado_em<=coalesce(i.data_alta,now()) and (p_atendimento_id is null or i.atendimento_id=p_atendimento_id)
  on conflict do nothing;

  insert into public.integracao_pendencias(empresa_id,unidade_id,atendimento_id,paciente_id,regra_chave,origem_tabela,origem_id,setor_origem,setor_destino,severidade,titulo,detalhes,contexto)
  select m.empresa_id,m.unidade_id,m.atendimento_id,a.paciente_id,'alta_sem_higienizacao_leito','movimentacoes_leitos',m.id,'internacao','nir','alta',
    'Leito de alta sem ciclo de higienização rastreável','A alta retirou o paciente do leito, mas não existe solicitação/ciclo de higienização vinculado à internação e ao leito de origem.',
    jsonb_build_object('internacao_id',m.internacao_id,'leito_id',m.leito_origem_id,'movimentado_em',m.movimentado_em)
  from public.movimentacoes_leitos m join public.internacoes i on i.id=m.internacao_id join public.atendimentos a on a.id=m.atendimento_id
  where m.empresa_id=p_empresa_id and m.unidade_id=p_unidade_id and m.tipo='alta' and m.leito_origem_id is not null and i.status='alta' and (p_atendimento_id is null or m.atendimento_id=p_atendimento_id)
    and not exists(select 1 from public.leito_higienizacoes h where h.internacao_id=m.internacao_id and h.leito_id=m.leito_origem_id)
  on conflict do nothing;

  update public.integracao_pendencias x set status='resolvida',resolvida_em=now(),resolvida_por=p_resolvida_por,updated_at=now()
  where x.empresa_id=p_empresa_id and x.unidade_id=p_unidade_id and x.status='aberta' and (p_atendimento_id is null or x.atendimento_id=p_atendimento_id) and (
    (x.regra_chave='internacao_sem_leito_status_internado' and not exists(select 1 from public.internacoes i where i.id=x.origem_id and i.status='internado' and i.leito_id is null)) or
    (x.regra_chave='internacao_leito_inconsistente' and not exists(select 1 from public.internacoes i where i.id=x.origem_id and i.status='internado' and i.leito_id is not null and not exists(select 1 from public.leitos l where l.id=i.leito_id and l.empresa_id=i.empresa_id and l.unidade_id=i.unidade_id and l.status='ocupado'))) or
    (x.regra_chave='internacao_sem_diaria_censo' and not exists(select 1 from public.internacoes i where i.id=x.origem_id and i.status='internado' and i.leito_id is not null and not exists(select 1 from public.internacao_diarias d where d.internacao_id=i.id and d.data_referencia=v_hoje and lower(coalesce(d.status,''))<>'cancelada'))) or
    (x.regra_chave='diaria_internacao_sem_producao' and not exists(select 1 from public.internacao_diarias d where d.id=x.origem_id and lower(coalesce(d.status,''))<>'cancelada' and not exists(select 1 from public.producao_assistencial_eventos e where e.origem_tipo='internacao_diaria' and e.origem_id=d.id and e.status in ('registrado','consolidado')))) or
    (x.regra_chave='alta_sem_conta_faturamento' and not exists(select 1 from public.internacoes i where i.id=x.origem_id and i.status='alta' and not exists(select 1 from public.contas_faturamento c where c.atendimento_id=i.atendimento_id))) or
    (x.regra_chave='alta_com_aprazamento_vencido_pendente' and not exists(select 1 from public.prescricao_aprazamentos ap join public.internacoes i on i.atendimento_id=ap.atendimento_id where ap.id=x.origem_id and i.status='alta' and ap.status='pendente' and ap.programado_em<=coalesce(i.data_alta,now()))) or
    (x.regra_chave='alta_sem_higienizacao_leito' and not exists(select 1 from public.movimentacoes_leitos m join public.internacoes i on i.id=m.internacao_id where m.id=x.origem_id and m.tipo='alta' and m.leito_origem_id is not null and i.status='alta' and not exists(select 1 from public.leito_higienizacoes h where h.internacao_id=m.internacao_id and h.leito_id=m.leito_origem_id))) or
    (x.regra_chave='alta_faturamento_nao_preparado' and exists(select 1 from public.contas_faturamento c where c.atendimento_id=x.atendimento_id))
  );
  get diagnostics v_resolvidas=row_count;
  select count(*) into v_abertas from public.integracao_pendencias where empresa_id=p_empresa_id and unidade_id=p_unidade_id and status='aberta'
    and regra_chave in ('internacao_sem_leito_status_internado','internacao_leito_inconsistente','internacao_sem_diaria_censo','diaria_internacao_sem_producao','alta_sem_conta_faturamento','alta_com_aprazamento_vencido_pendente','alta_sem_higienizacao_leito','alta_faturamento_nao_preparado')
    and (p_atendimento_id is null or atendimento_id=p_atendimento_id);
  return jsonb_build_object('abertas_internacao',v_abertas,'resolvidas_nesta_execucao',v_resolvidas);
end $$;

revoke all on function public.reconciliar_pendencias_internacao_internal(uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.reconciliar_pendencias_internacao_internal(uuid,uuid,uuid,uuid) to postgres;

do $$
declare v_jobid bigint;
begin
  for v_jobid in select jobid from cron.job where jobname='medsync-internacao-censo-horario'
  loop
    perform cron.unschedule(v_jobid);
  end loop;
end $$;

select cron.schedule(
  'medsync-internacao-censo-horario',
  '17 * * * *',
  $$select public.gerar_censo_internacao_diario_internal();$$
);
