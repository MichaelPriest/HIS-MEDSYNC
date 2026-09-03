-- Evita confundir o setor que forneceu/gerou um item com a localização física do paciente.
-- Setor/andar do paciente só podem vir de evidência assistencial histórica confiável.

create or replace function public.faturamento_resolver_localizacao_evento_internal(
  p_atendimento_id uuid,
  p_ocorrido_em timestamptz,
  p_setor_fallback text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
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
    select case
      when lower(btrim(coalesce(a.setor_atual,''))) in ('alta','encerrado','encerrada','finalizado','finalizada','faturamento') then null
      else nullif(btrim(coalesce(a.setor_atual,'')),'')
    end
    into v_at_setor
    from public.atendimentos a where a.id=p_atendimento_id;
    v_setor:=v_at_setor;
    if v_setor is not null then v_origem:='atendimento_atual_fallback'; end if;
  end if;

  if v_setor is null then
    v_setor:=nullif(btrim(coalesce(p_setor_fallback,'')),'');
    if v_setor is not null then v_origem:='evento_fallback'; end if;
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
end
$function$;

create or replace function public.producao_snapshot_localizacao_before_internal()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
declare
  v jsonb;
  v_fallback text;
begin
  new.origem_operacional:=coalesce(
    new.origem_operacional,
    nullif(btrim(coalesce(new.setor,'')),''),
    nullif(new.metadados->>'origem_operacional','')
  );

  -- Somente eventos que representam atendimento/local de execução podem usar o próprio setor
  -- como fallback de localização do paciente. Farmácia/almoxarifado/estoque continuam como origem.
  v_fallback:=case
    when new.tipo_evento in ('consulta_ambulatorial','consulta_pronto_atendimento','procedimento','diaria','taxa_assistencial')
      then nullif(btrim(coalesce(new.setor,'')),'')
    else null
  end;

  if new.setor_paciente is null or new.localizacao_memoria='{}'::jsonb then
    v:=public.faturamento_resolver_localizacao_evento_internal(new.atendimento_id,new.ocorrido_em,v_fallback);
    new.setor_paciente:=coalesce(new.setor_paciente,v->>'setor');
    new.andar_paciente:=coalesce(new.andar_paciente,v->>'andar');
    new.localizacao_memoria:=coalesce(nullif(new.localizacao_memoria,'{}'::jsonb),v);
  end if;
  return new;
end
$function$;

create or replace function public.faturamento_item_snapshot_localizacao_before_internal()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
declare
  v_evento public.producao_assistencial_eventos%rowtype;
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
  if new.origem_operacional is null then
    new.origem_operacional:=nullif(btrim(coalesce(new.setor,'')),'');
  end if;
  return new;
end
$function$;

-- Recalcula snapshots históricos que usaram o setor de fornecimento como localização do paciente.
with recalculada as (
  select
    p.id,
    public.faturamento_resolver_localizacao_evento_internal(p.atendimento_id,p.ocorrido_em,null) as localizacao
  from public.producao_assistencial_eventos p
  where coalesce(p.localizacao_memoria->>'origem','')='evento_fallback'
    and p.tipo_evento not in ('consulta_ambulatorial','consulta_pronto_atendimento','procedimento','diaria','taxa_assistencial')
    and lower(btrim(coalesce(p.origem_operacional,p.setor,''))) in ('farmacia','almoxarifado','estoque','cme')
)
update public.producao_assistencial_eventos p
set setor_paciente=nullif(r.localizacao->>'setor',''),
    andar_paciente=nullif(r.localizacao->>'andar',''),
    localizacao_memoria=r.localizacao
from recalculada r
where p.id=r.id
  and (
    p.setor_paciente is distinct from nullif(r.localizacao->>'setor','')
    or p.andar_paciente is distinct from nullif(r.localizacao->>'andar','')
    or p.localizacao_memoria is distinct from r.localizacao
  );

-- Mantém o snapshot da conta coerente com o evento assistencial, sem alterar a origem operacional.
update public.conta_faturamento_itens c
set setor_paciente=p.setor_paciente,
    andar_paciente=p.andar_paciente,
    origem_operacional=coalesce(c.origem_operacional,p.origem_operacional,c.setor),
    localizacao_memoria=p.localizacao_memoria
from public.producao_assistencial_eventos p
where c.producao_evento_id=p.id
  and (
    c.setor_paciente is distinct from p.setor_paciente
    or c.andar_paciente is distinct from p.andar_paciente
    or c.localizacao_memoria is distinct from p.localizacao_memoria
  );
