alter table public.producao_assistencial_eventos
  add column if not exists setor_paciente text,
  add column if not exists andar_paciente text,
  add column if not exists origem_operacional text,
  add column if not exists localizacao_memoria jsonb not null default '{}'::jsonb;

alter table public.conta_faturamento_itens
  add column if not exists setor_paciente text,
  add column if not exists andar_paciente text,
  add column if not exists origem_operacional text,
  add column if not exists localizacao_memoria jsonb not null default '{}'::jsonb;

create or replace function public.estrutura_andar_por_local_internal(p_estrutura_id uuid)
returns text
language sql
security definer
set search_path='public','pg_catalog'
as $$
  with recursive arvore as (
    select e.id,e.parent_id,e.nome,e.tipo,0 as nivel
      from public.estruturas_fisicas e where e.id=p_estrutura_id
    union all
    select p.id,p.parent_id,p.nome,p.tipo,a.nivel+1
      from arvore a join public.estruturas_fisicas p on p.id=a.parent_id
     where a.nivel<10
  )
  select nome from arvore where tipo='andar' order by nivel limit 1
$$;

create or replace function public.faturamento_resolver_localizacao_evento_internal(
  p_atendimento_id uuid,
  p_ocorrido_em timestamptz,
  p_setor_fallback text default null
)
returns jsonb
language plpgsql
security definer
set search_path='public','pg_catalog'
as $$
declare
  v_momento timestamptz:=coalesce(p_ocorrido_em,now());
  v_internacao public.internacoes%rowtype;
  v_mov_id uuid;
  v_leito_destino_id uuid;
  v_leito public.leitos%rowtype;
  v_setor text;
  v_andar text;
  v_origem text;
  v_at_setor text;
begin
  select i.* into v_internacao
    from public.internacoes i
   where i.atendimento_id=p_atendimento_id
     and i.data_internacao<=v_momento
     and (i.data_alta is null or i.data_alta>=v_momento)
   order by i.data_internacao desc,i.id desc limit 1;

  if v_internacao.id is not null then
    select m.id,m.leito_destino_id
      into v_mov_id,v_leito_destino_id
      from public.movimentacoes_leitos m
     where m.internacao_id=v_internacao.id
       and m.movimentado_em<=v_momento
       and m.leito_destino_id is not null
     order by m.movimentado_em desc,m.created_at desc,m.id desc limit 1;

    if v_leito_destino_id is not null then
      select * into v_leito from public.leitos where id=v_leito_destino_id;
      v_setor:=nullif(btrim(coalesce(v_leito.setor,'')),'');
      v_andar:=public.estrutura_andar_por_local_internal(v_leito.estrutura_fisica_id);
      v_origem:='movimentacao_leito';
    elsif v_internacao.leito_id is not null
          and not exists(select 1 from public.movimentacoes_leitos m where m.internacao_id=v_internacao.id) then
      select * into v_leito from public.leitos where id=v_internacao.leito_id;
      v_setor:=nullif(btrim(coalesce(v_leito.setor,'')),'');
      v_andar:=public.estrutura_andar_por_local_internal(v_leito.estrutura_fisica_id);
      v_origem:='leito_internacao_sem_historico';
    end if;

    if v_setor is null then
      v_setor:=nullif(btrim(coalesce(v_internacao.setor,'')),'');
      v_origem:=coalesce(v_origem,'internacao');
    end if;
  end if;

  if v_setor is null then
    v_setor:=nullif(btrim(coalesce(p_setor_fallback,'')),'');
    if v_setor is not null then v_origem:='evento_fallback'; end if;
  end if;

  if v_setor is null then
    select nullif(btrim(coalesce(a.setor_atual,'')),'') into v_at_setor
      from public.atendimentos a where a.id=p_atendimento_id;
    v_setor:=v_at_setor;
    if v_setor is not null then v_origem:='atendimento_atual_fallback'; end if;
  end if;

  return jsonb_build_object(
    'setor',v_setor,
    'andar',v_andar,
    'origem',coalesce(v_origem,'nao_identificada'),
    'internacao_id',v_internacao.id,
    'leito_id',v_leito.id,
    'movimentacao_id',v_mov_id,
    'momento',v_momento
  );
end $$;

create or replace function public.producao_snapshot_localizacao_before_internal()
returns trigger
language plpgsql
security definer
set search_path='public','pg_catalog'
as $$
declare v jsonb;
begin
  new.origem_operacional:=coalesce(new.origem_operacional,nullif(btrim(coalesce(new.setor,'')),''),nullif(new.metadados->>'origem_operacional',''));
  if new.setor_paciente is null or new.localizacao_memoria='{}'::jsonb then
    v:=public.faturamento_resolver_localizacao_evento_internal(new.atendimento_id,new.ocorrido_em,new.setor);
    new.setor_paciente:=coalesce(new.setor_paciente,v->>'setor');
    new.andar_paciente:=coalesce(new.andar_paciente,v->>'andar');
    new.localizacao_memoria:=coalesce(nullif(new.localizacao_memoria,'{}'::jsonb),v);
  end if;
  return new;
end $$;

drop trigger if exists trg_producao_snapshot_localizacao on public.producao_assistencial_eventos;
create trigger trg_producao_snapshot_localizacao
before insert or update of atendimento_id,ocorrido_em,setor,setor_paciente,andar_paciente
on public.producao_assistencial_eventos
for each row execute function public.producao_snapshot_localizacao_before_internal();

create or replace function public.faturamento_item_snapshot_localizacao_before_internal()
returns trigger
language plpgsql
security definer
set search_path='public','pg_catalog'
as $$
declare v_evento public.producao_assistencial_eventos%rowtype;
begin
  if new.producao_evento_id is not null then
    select * into v_evento from public.producao_assistencial_eventos where id=new.producao_evento_id;
    if found then
      new.setor_paciente:=coalesce(new.setor_paciente,v_evento.setor_paciente);
      new.andar_paciente:=coalesce(new.andar_paciente,v_evento.andar_paciente);
      new.origem_operacional:=coalesce(new.origem_operacional,v_evento.origem_operacional,v_evento.setor);
      new.localizacao_memoria:=coalesce(nullif(new.localizacao_memoria,'{}'::jsonb),v_evento.localizacao_memoria);
    end if;
  end if;
  if new.setor_paciente is null then new.setor_paciente:=nullif(btrim(coalesce(new.setor,'')),''); end if;
  if new.origem_operacional is null then new.origem_operacional:=nullif(btrim(coalesce(new.setor,'')),''); end if;
  return new;
end $$;

drop trigger if exists trg_faturamento_item_snapshot_localizacao on public.conta_faturamento_itens;
create trigger trg_faturamento_item_snapshot_localizacao
before insert or update of producao_evento_id,setor,setor_paciente,andar_paciente,origem_operacional
on public.conta_faturamento_itens
for each row execute function public.faturamento_item_snapshot_localizacao_before_internal();

update public.producao_assistencial_eventos e
   set origem_operacional=coalesce(e.origem_operacional,nullif(btrim(coalesce(e.setor,'')),'')),
       setor_paciente=coalesce(e.setor_paciente,(public.faturamento_resolver_localizacao_evento_internal(e.atendimento_id,e.ocorrido_em,e.setor))->>'setor'),
       andar_paciente=coalesce(e.andar_paciente,(public.faturamento_resolver_localizacao_evento_internal(e.atendimento_id,e.ocorrido_em,e.setor))->>'andar'),
       localizacao_memoria=case when e.localizacao_memoria='{}'::jsonb then public.faturamento_resolver_localizacao_evento_internal(e.atendimento_id,e.ocorrido_em,e.setor) else e.localizacao_memoria end;

update public.conta_faturamento_itens i
   set setor_paciente=coalesce(i.setor_paciente,e.setor_paciente,i.setor),
       andar_paciente=coalesce(i.andar_paciente,e.andar_paciente),
       origem_operacional=coalesce(i.origem_operacional,e.origem_operacional,i.setor),
       localizacao_memoria=case when i.localizacao_memoria='{}'::jsonb then coalesce(e.localizacao_memoria,jsonb_build_object('origem','legacy_setor')) else i.localizacao_memoria end
  from public.producao_assistencial_eventos e
 where e.id=i.producao_evento_id;

update public.conta_faturamento_itens i
   set setor_paciente=coalesce(i.setor_paciente,i.setor),
       origem_operacional=coalesce(i.origem_operacional,i.setor),
       localizacao_memoria=case when i.localizacao_memoria='{}'::jsonb then jsonb_build_object('origem','legacy_setor') else i.localizacao_memoria end
 where i.producao_evento_id is null;

revoke all on function public.estrutura_andar_por_local_internal(uuid) from public,anon,authenticated;
revoke all on function public.faturamento_resolver_localizacao_evento_internal(uuid,timestamptz,text) from public,anon,authenticated;
revoke all on function public.producao_snapshot_localizacao_before_internal() from public,anon,authenticated;
revoke all on function public.faturamento_item_snapshot_localizacao_before_internal() from public,anon,authenticated;
