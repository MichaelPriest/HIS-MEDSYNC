alter table public.emergencia_registros
  add column if not exists prioridade integer,
  add column if not exists sla_minutos integer,
  add column if not exists classificado_em timestamptz,
  add column if not exists reavaliado_em timestamptz,
  add column if not exists sla_cumprido_em timestamptz;

alter table public.emergencia_registros
  drop constraint if exists emergencia_registros_prioridade_check,
  add constraint emergencia_registros_prioridade_check check (prioridade is null or prioridade > 0),
  drop constraint if exists emergencia_registros_sla_minutos_check,
  add constraint emergencia_registros_sla_minutos_check check (sla_minutos is null or sla_minutos > 0);

alter table public.emergencia_reavaliacoes
  add column if not exists atraso_minutos integer;

alter table public.emergencia_reavaliacoes
  drop constraint if exists emergencia_reavaliacoes_atraso_minutos_check,
  add constraint emergencia_reavaliacoes_atraso_minutos_check check (atraso_minutos is null or atraso_minutos >= 0);

update public.emergencia_registros
set classificado_em = created_at
where classificacao_risco is not null and classificado_em is null;

update public.emergencia_registros e
set reavaliado_em = r.ultima_reavaliacao
from (
  select emergencia_id, max(reavaliado_em) as ultima_reavaliacao
  from public.emergencia_reavaliacoes
  group by emergencia_id
) r
where r.emergencia_id = e.id and e.reavaliado_em is null;

create index if not exists emergencia_registros_sla_ativo_idx
  on public.emergencia_registros (empresa_id, unidade_id, classificado_em, sla_minutos)
  where status <> 'encerrado' and sla_minutos is not null and sla_cumprido_em is null;

create index if not exists emergencia_registros_reavaliacao_pendente_idx
  on public.emergencia_registros (empresa_id, unidade_id, reavaliacao_em)
  where status <> 'encerrado' and reavaliacao_em is not null;

create or replace function public.auditar_classificacao_emergencia_internal()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if new.classificacao_risco is not null and (tg_op = 'INSERT' or old.classificacao_risco is distinct from new.classificacao_risco) then
    new.classificado_em := coalesce(new.classificado_em, now());
  end if;
  return new;
end;
$$;

revoke all on function public.auditar_classificacao_emergencia_internal() from public, anon, authenticated;

drop trigger if exists emergencia_registros_auditar_classificacao on public.emergencia_registros;
create trigger emergencia_registros_auditar_classificacao
before insert or update of classificacao_risco on public.emergencia_registros
for each row execute function public.auditar_classificacao_emergencia_internal();

create or replace function public.atualizar_registro_emergencia_operacional(
  p_emergencia_id uuid,
  p_classificacao_risco text default null,
  p_prioridade integer default null,
  p_sla_minutos integer default null,
  p_reavaliacao_em timestamptz default null,
  p_destino text default null,
  p_observacoes text default null
) returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_registro public.emergencia_registros%rowtype;
  v_classificacao text;
begin
  if auth.uid() is null then
    raise exception 'EMERGENCIA_NAO_AUTENTICADO' using errcode='42501';
  end if;

  select * into v_registro
  from public.emergencia_registros
  where id = p_emergencia_id
  for update;

  if v_registro.id is null or v_registro.status = 'encerrado' then
    raise exception 'EMERGENCIA_REGISTRO_INDISPONIVEL' using errcode='P0002';
  end if;

  if not public.tem_unidade(v_registro.empresa_id, v_registro.unidade_id)
     or not public.tem_permissao(v_registro.empresa_id, v_registro.unidade_id, 'emergencia.gerenciar') then
    raise exception 'EMERGENCIA_SEM_PERMISSAO_GERENCIAR' using errcode='42501';
  end if;

  v_classificacao := lower(nullif(trim(p_classificacao_risco),''));
  if v_classificacao is not null and v_classificacao not in ('vermelho','laranja','amarelo','verde','azul') then
    raise exception 'EMERGENCIA_CLASSIFICACAO_INVALIDA' using errcode='22023';
  end if;
  if p_prioridade is not null and p_prioridade <= 0 then
    raise exception 'EMERGENCIA_PRIORIDADE_INVALIDA' using errcode='22023';
  end if;
  if p_sla_minutos is not null and p_sla_minutos <= 0 then
    raise exception 'EMERGENCIA_SLA_INVALIDO' using errcode='22023';
  end if;
  if p_destino is not null and p_destino not in ('observacao','internacao','uti','centro_cirurgico','alta','transferencia') then
    raise exception 'EMERGENCIA_DESTINO_INVALIDO' using errcode='22023';
  end if;

  update public.emergencia_registros
  set classificacao_risco = coalesce(v_classificacao, classificacao_risco),
      prioridade = coalesce(p_prioridade, prioridade),
      sla_minutos = coalesce(p_sla_minutos, sla_minutos),
      reavaliacao_em = coalesce(p_reavaliacao_em, reavaliacao_em),
      destino = coalesce(nullif(trim(p_destino),''), destino),
      observacoes = coalesce(nullif(trim(p_observacoes),''), observacoes),
      sla_cumprido_em = case
        when sla_cumprido_em is not null then sla_cumprido_em
        when reavaliado_em is not null and coalesce(p_sla_minutos, sla_minutos) is not null then reavaliado_em
        else null
      end,
      updated_at = now(),
      updated_by = auth.uid()
  where id = v_registro.id;
end;
$$;

revoke all on function public.atualizar_registro_emergencia_operacional(uuid,text,integer,integer,timestamptz,text,text) from public, anon;
grant execute on function public.atualizar_registro_emergencia_operacional(uuid,text,integer,integer,timestamptz,text,text) to authenticated;

create or replace function public.registrar_reavaliacao_emergencia(
  p_emergencia_id uuid,
  p_queixa text,
  p_classificacao_risco text,
  p_abcde jsonb,
  p_sinais_vitais jsonb,
  p_dor integer,
  p_conduta text,
  p_destino text,
  p_observacoes text,
  p_proxima_reavaliacao_em timestamptz
) returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_registro public.emergencia_registros%rowtype;
  v_profissional_id uuid;
  v_reavaliacao_id uuid;
  v_classificacao text;
  v_atraso integer;
begin
  if auth.uid() is null then
    raise exception 'EMERGENCIA_NAO_AUTENTICADO' using errcode='42501';
  end if;

  select * into v_registro
  from public.emergencia_registros
  where id = p_emergencia_id
  for update;

  if v_registro.id is null or v_registro.status = 'encerrado' then
    raise exception 'EMERGENCIA_REGISTRO_INDISPONIVEL' using errcode='P0002';
  end if;

  if not public.tem_unidade(v_registro.empresa_id, v_registro.unidade_id)
     or not public.tem_permissao(v_registro.empresa_id, v_registro.unidade_id, 'emergencia.reavaliar') then
    raise exception 'EMERGENCIA_SEM_PERMISSAO_REAVALIAR' using errcode='42501';
  end if;

  if p_dor is not null and (p_dor < 0 or p_dor > 10) then
    raise exception 'EMERGENCIA_DOR_INVALIDA' using errcode='22023';
  end if;

  v_classificacao := lower(nullif(trim(p_classificacao_risco),''));
  if v_classificacao is not null and v_classificacao not in ('vermelho','laranja','amarelo','verde','azul') then
    raise exception 'EMERGENCIA_CLASSIFICACAO_INVALIDA' using errcode='22023';
  end if;
  if p_destino is not null and p_destino not in ('observacao','internacao','uti','centro_cirurgico','alta','transferencia') then
    raise exception 'EMERGENCIA_DESTINO_INVALIDO' using errcode='22023';
  end if;

  v_profissional_id := public.profissional_logado(v_registro.empresa_id);
  v_atraso := case
    when v_registro.reavaliacao_em is not null and now() > v_registro.reavaliacao_em
      then greatest(0, floor(extract(epoch from (now() - v_registro.reavaliacao_em)) / 60)::integer)
    else 0
  end;

  insert into public.emergencia_reavaliacoes(
    empresa_id, unidade_id, emergencia_id, atendimento_id, profissional_id,
    reavaliado_em, queixa, classificacao_risco, abcde, sinais_vitais, dor,
    conduta, destino, observacoes, created_by, atraso_minutos
  ) values (
    v_registro.empresa_id, v_registro.unidade_id, v_registro.id, v_registro.atendimento_id, v_profissional_id,
    now(), p_queixa, v_classificacao, coalesce(p_abcde,'{}'::jsonb), coalesce(p_sinais_vitais,'{}'::jsonb), p_dor,
    p_conduta, p_destino, p_observacoes, auth.uid(), v_atraso
  ) returning id into v_reavaliacao_id;

  update public.emergencia_registros
  set classificacao_risco = coalesce(v_classificacao, classificacao_risco),
      reavaliado_em = now(),
      sla_cumprido_em = case when sla_cumprido_em is null and sla_minutos is not null then now() else sla_cumprido_em end,
      reavaliacao_em = p_proxima_reavaliacao_em,
      destino = coalesce(nullif(trim(p_destino),''), destino),
      updated_at = now(),
      updated_by = auth.uid()
  where id = v_registro.id;

  return v_reavaliacao_id;
end;
$$;

revoke all on function public.registrar_reavaliacao_emergencia(uuid,text,text,jsonb,jsonb,integer,text,text,text,timestamptz) from public, anon;
grant execute on function public.registrar_reavaliacao_emergencia(uuid,text,text,jsonb,jsonb,integer,text,text,text,timestamptz) to authenticated;

create or replace view public.emergencia_fila_operacional
with (security_invoker = true)
as
select
  e.*,
  case when e.sla_minutos is not null and e.classificado_em is not null
       then e.classificado_em + make_interval(mins => e.sla_minutos) end as sla_vencimento_em,
  (e.status <> 'encerrado' and e.sla_minutos is not null and e.classificado_em is not null
    and e.sla_cumprido_em is null and now() > e.classificado_em + make_interval(mins => e.sla_minutos)) as sla_vencido,
  (e.status <> 'encerrado' and e.reavaliacao_em is not null and now() > e.reavaliacao_em) as reavaliacao_vencida,
  case when e.sla_minutos is not null and e.classificado_em is not null and e.sla_cumprido_em is null
    then greatest(0, floor(extract(epoch from (now() - (e.classificado_em + make_interval(mins => e.sla_minutos)))) / 60)::integer)
    else 0 end as minutos_atraso_sla,
  case when e.reavaliacao_em is not null and now() > e.reavaliacao_em
    then greatest(0, floor(extract(epoch from (now() - e.reavaliacao_em)) / 60)::integer)
    else 0 end as minutos_atraso_reavaliacao
from public.emergencia_registros e;

revoke all on public.emergencia_fila_operacional from public, anon;
grant select on public.emergencia_fila_operacional to authenticated;

create or replace function public.reconciliar_pendencias_urgencia_internal(
  p_empresa_id uuid,
  p_unidade_id uuid,
  p_atendimento_id uuid default null,
  p_resolvida_por uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_resolvidas integer := 0;
  v_abertas integer := 0;
begin
  insert into public.integracao_pendencias(
    empresa_id,unidade_id,atendimento_id,paciente_id,regra_chave,origem_tabela,origem_id,
    setor_origem,setor_destino,severidade,titulo,detalhes,contexto
  )
  select e.empresa_id,e.unidade_id,e.atendimento_id,e.paciente_id,
         'urgencia_sla_atendimento_vencido','emergencia_registros',e.id,
         'urgencia','urgencia','alta','SLA inicial da urgência vencido',
         'O registro permanece ativo e a primeira reavaliação clínica não ocorreu dentro do SLA configurado.',
         jsonb_build_object('classificacao_risco',e.classificacao_risco,'sla_minutos',e.sla_minutos,
           'classificado_em',e.classificado_em,'sla_vencimento_em',e.classificado_em + make_interval(mins=>e.sla_minutos))
  from public.emergencia_registros e
  where e.empresa_id=p_empresa_id and e.unidade_id=p_unidade_id
    and e.status <> 'encerrado'
    and (p_atendimento_id is null or e.atendimento_id=p_atendimento_id)
    and e.sla_minutos is not null and e.classificado_em is not null and e.sla_cumprido_em is null
    and now() > e.classificado_em + make_interval(mins=>e.sla_minutos)
  on conflict do nothing;

  insert into public.integracao_pendencias(
    empresa_id,unidade_id,atendimento_id,paciente_id,regra_chave,origem_tabela,origem_id,
    setor_origem,setor_destino,severidade,titulo,detalhes,contexto
  )
  select e.empresa_id,e.unidade_id,e.atendimento_id,e.paciente_id,
         'urgencia_reavaliacao_vencida','emergencia_registros',e.id,
         'urgencia','urgencia','alta','Reavaliação da urgência vencida',
         'A próxima reavaliação programada está vencida e o episódio permanece ativo.',
         jsonb_build_object('classificacao_risco',e.classificacao_risco,'reavaliacao_em',e.reavaliacao_em,
           'destino',e.destino)
  from public.emergencia_registros e
  where e.empresa_id=p_empresa_id and e.unidade_id=p_unidade_id
    and e.status <> 'encerrado'
    and (p_atendimento_id is null or e.atendimento_id=p_atendimento_id)
    and e.reavaliacao_em is not null and now() > e.reavaliacao_em
  on conflict do nothing;

  update public.integracao_pendencias x
  set status='resolvida',resolvida_em=now(),resolvida_por=p_resolvida_por,updated_at=now()
  where x.empresa_id=p_empresa_id and x.unidade_id=p_unidade_id and x.status='aberta'
    and (p_atendimento_id is null or x.atendimento_id=p_atendimento_id)
    and (
      (x.regra_chave='urgencia_sla_atendimento_vencido' and not exists(
        select 1 from public.emergencia_registros e where e.id=x.origem_id and e.status <> 'encerrado'
          and e.sla_minutos is not null and e.classificado_em is not null and e.sla_cumprido_em is null
          and now() > e.classificado_em + make_interval(mins=>e.sla_minutos)
      ))
      or
      (x.regra_chave='urgencia_reavaliacao_vencida' and not exists(
        select 1 from public.emergencia_registros e where e.id=x.origem_id and e.status <> 'encerrado'
          and e.reavaliacao_em is not null and now() > e.reavaliacao_em
      ))
    );
  get diagnostics v_resolvidas = row_count;

  select count(*) into v_abertas
  from public.integracao_pendencias
  where empresa_id=p_empresa_id and unidade_id=p_unidade_id and status='aberta'
    and regra_chave in ('urgencia_sla_atendimento_vencido','urgencia_reavaliacao_vencida')
    and (p_atendimento_id is null or atendimento_id=p_atendimento_id);

  return jsonb_build_object('abertas_urgencia',v_abertas,'resolvidas_nesta_execucao',v_resolvidas);
end;
$$;

revoke all on function public.reconciliar_pendencias_urgencia_internal(uuid,uuid,uuid,uuid) from public, anon, authenticated;

create or replace function public.reconciliar_pendencias_integracao(
  p_empresa_id uuid,
  p_unidade_id uuid,
  p_atendimento_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_cir jsonb; v_med jsonb; v_int jsonb; v_fat jsonb; v_fin jsonb; v_pag jsonb; v_urg jsonb; v_base jsonb;
  v_resolvidas integer;
begin
  if auth.uid() is null then raise exception 'INTEGRACAO_AUTENTICACAO_OBRIGATORIA' using errcode='42501'; end if;
  if not public.tem_unidade(p_empresa_id,p_unidade_id) then raise exception 'INTEGRACAO_UNIDADE_FORA_ESCOPO' using errcode='42501'; end if;
  if not public.tem_permissao(p_empresa_id,p_unidade_id,'integracao.reconciliar') then raise exception 'INTEGRACAO_SEM_PERMISSAO' using errcode='42501'; end if;
  if p_atendimento_id is not null and not exists(select 1 from public.atendimentos a where a.id=p_atendimento_id and a.empresa_id=p_empresa_id and a.unidade_id=p_unidade_id) then raise exception 'INTEGRACAO_ATENDIMENTO_FORA_ESCOPO' using errcode='42501'; end if;

  v_cir:=public.reconciliar_pendencias_cirurgia_estoque_internal(p_empresa_id,p_unidade_id,p_atendimento_id,auth.uid());
  v_med:=public.reconciliar_pendencias_medicamentos_internal(p_empresa_id,p_unidade_id,p_atendimento_id,auth.uid());
  v_int:=public.reconciliar_pendencias_internacao_internal(p_empresa_id,p_unidade_id,p_atendimento_id,auth.uid());
  v_fat:=public.reconciliar_pendencias_faturamento_internal(p_empresa_id,p_unidade_id,p_atendimento_id,auth.uid());
  v_fin:=case when p_atendimento_id is null then public.reconciliar_pendencias_financeiro_recebimentos_internal(p_empresa_id,p_unidade_id,auth.uid()) else jsonb_build_object('abertas_financeiro_recebimentos',0,'resolvidas_nesta_execucao',0) end;
  v_pag:=case when p_atendimento_id is null then public.reconciliar_pendencias_financeiro_pagamentos_internal(p_empresa_id,p_unidade_id,auth.uid()) else jsonb_build_object('abertas_financeiro_pagamentos',0,'resolvidas_nesta_execucao',0) end;
  v_urg:=public.reconciliar_pendencias_urgencia_internal(p_empresa_id,p_unidade_id,p_atendimento_id,auth.uid());
  v_base:=public.reconciliar_pendencias_integracao_internal(p_empresa_id,p_unidade_id,p_atendimento_id,auth.uid());

  v_resolvidas:=coalesce((v_cir->>'resolvidas_nesta_execucao')::integer,0)+coalesce((v_med->>'resolvidas_nesta_execucao')::integer,0)+coalesce((v_int->>'resolvidas_nesta_execucao')::integer,0)+coalesce((v_fat->>'resolvidas_nesta_execucao')::integer,0)+coalesce((v_fin->>'resolvidas_nesta_execucao')::integer,0)+coalesce((v_pag->>'resolvidas_nesta_execucao')::integer,0)+coalesce((v_urg->>'resolvidas_nesta_execucao')::integer,0)+coalesce((v_base->>'resolvidas_nesta_execucao')::integer,0);

  return jsonb_build_object(
    'abertas',coalesce((v_base->>'abertas')::integer,0),
    'resolvidas_nesta_execucao',v_resolvidas,
    'abertas_medicamentos',coalesce((v_med->>'abertas_medicamentos')::integer,0),
    'abertas_cirurgia_estoque',coalesce((v_cir->>'abertas_cirurgia_estoque')::integer,0),
    'abertas_internacao',coalesce((v_int->>'abertas_internacao')::integer,0),
    'abertas_faturamento',coalesce((v_fat->>'abertas_faturamento')::integer,0),
    'abertas_financeiro_recebimentos',coalesce((v_fin->>'abertas_financeiro_recebimentos')::integer,0),
    'abertas_financeiro_pagamentos',coalesce((v_pag->>'abertas_financeiro_pagamentos')::integer,0),
    'abertas_urgencia',coalesce((v_urg->>'abertas_urgencia')::integer,0)
  );
end;
$$;

revoke all on function public.reconciliar_pendencias_integracao(uuid,uuid,uuid) from public, anon;
grant execute on function public.reconciliar_pendencias_integracao(uuid,uuid,uuid) to authenticated;
