begin;

-- Helpers desta migration são privados aos wrappers SECURITY DEFINER.
create or replace function public.tem_alguma_permissao_funcional(
  p_empresa uuid,
  p_unidade uuid,
  p_codigos text[]
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select public.usuario_ativo()
    and exists (
      select 1
      from public.usuario_perfis up
      join public.perfis pf on pf.id = up.perfil_id and pf.ativo
      join public.perfil_permissoes pp on pp.perfil_id = pf.id
      join public.permissoes pe on pe.id = pp.permissao_id and pe.ativo
      where up.usuario_id = auth.uid()
        and up.empresa_id = p_empresa
        and up.ativo
        and (p_unidade is null or up.unidade_id is null or up.unidade_id = p_unidade)
        and pe.codigo = any(p_codigos)
    )
$$;
revoke all on function public.tem_alguma_permissao_funcional(uuid,uuid,text[]) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Motor contratual: mantém o cálculo original isolado e exige papel funcional.
-- ---------------------------------------------------------------------------
alter function public.recalcular_item_contratual_avancado(uuid)
  rename to recalcular_item_contratual_avancado_internal;
revoke all on function public.recalcular_item_contratual_avancado_internal(uuid)
  from public, anon, authenticated;

create function public.recalcular_item_contratual_avancado(p_item_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_item record;
begin
  select c.empresa_id, c.unidade_id
    into v_item
  from public.conta_faturamento_itens i
  join public.contas_faturamento c on c.id = i.conta_id
  where i.id = p_item_id;

  if v_item.empresa_id is null
     or not public.tem_unidade(v_item.empresa_id, v_item.unidade_id)
     or not public.tem_alguma_permissao_funcional(
       v_item.empresa_id,
       v_item.unidade_id,
       array[
         'faturamento.criar','faturamento.fechar',
         'contas_medicas.processar','contas_medicas.analisar','contas_medicas.liberar',
         'auditoria.executar','auditoria.analisar','auditoria.liberar'
       ]
     ) then
    raise exception 'SEM_PERMISSAO_RECALCULO_CONTRATUAL' using errcode = '42501';
  end if;

  return public.recalcular_item_contratual_avancado_internal(p_item_id);
end
$$;
revoke all on function public.recalcular_item_contratual_avancado(uuid) from public, anon;
grant execute on function public.recalcular_item_contratual_avancado(uuid) to authenticated;

alter function public.recalcular_conta_contratual_avancada(uuid)
  rename to recalcular_conta_contratual_avancada_internal;
revoke all on function public.recalcular_conta_contratual_avancada_internal(uuid)
  from public, anon, authenticated;

create function public.recalcular_conta_contratual_avancada(p_conta_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_conta record;
begin
  select empresa_id, unidade_id
    into v_conta
  from public.contas_faturamento
  where id = p_conta_id;

  if v_conta.empresa_id is null
     or not public.tem_unidade(v_conta.empresa_id, v_conta.unidade_id)
     or not public.tem_alguma_permissao_funcional(
       v_conta.empresa_id,
       v_conta.unidade_id,
       array[
         'faturamento.criar','faturamento.fechar',
         'contas_medicas.processar','contas_medicas.analisar','contas_medicas.liberar',
         'auditoria.executar','auditoria.analisar','auditoria.liberar'
       ]
     ) then
    raise exception 'SEM_PERMISSAO_RECALCULO_CONTA' using errcode = '42501';
  end if;

  return public.recalcular_conta_contratual_avancada_internal(p_conta_id);
end
$$;
revoke all on function public.recalcular_conta_contratual_avancada(uuid) from public, anon;
grant execute on function public.recalcular_conta_contratual_avancada(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Central de Guias.
-- ---------------------------------------------------------------------------
alter function public.calcular_preco_central_guia(uuid)
  rename to calcular_preco_central_guia_internal;
revoke all on function public.calcular_preco_central_guia_internal(uuid)
  from public, anon, authenticated;

create function public.calcular_preco_central_guia(p_guia_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_guia record;
begin
  select empresa_id, unidade_id
    into v_guia
  from public.central_guias
  where id = p_guia_id;

  if v_guia.empresa_id is null
     or not public.tem_unidade(v_guia.empresa_id, v_guia.unidade_id)
     or not public.tem_alguma_permissao_funcional(
       v_guia.empresa_id,
       v_guia.unidade_id,
       array['guias.gerenciar','autorizacoes.editar']
     ) then
    raise exception 'SEM_PERMISSAO_CALCULO_GUIA' using errcode = '42501';
  end if;

  return public.calcular_preco_central_guia_internal(p_guia_id);
end
$$;
revoke all on function public.calcular_preco_central_guia(uuid) from public, anon;
grant execute on function public.calcular_preco_central_guia(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Entrada no ciclo pós-alta / Auditoria.
-- ---------------------------------------------------------------------------
alter function public.encaminhar_conta_para_auditoria(uuid)
  rename to encaminhar_conta_para_auditoria_internal;
revoke all on function public.encaminhar_conta_para_auditoria_internal(uuid)
  from public, anon, authenticated;

create function public.encaminhar_conta_para_auditoria(p_atendimento_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_atendimento record;
begin
  select empresa_id, unidade_id
    into v_atendimento
  from public.atendimentos
  where id = p_atendimento_id;

  if v_atendimento.empresa_id is null
     or not public.tem_unidade(v_atendimento.empresa_id, v_atendimento.unidade_id)
     or not public.tem_alguma_permissao_funcional(
       v_atendimento.empresa_id,
       v_atendimento.unidade_id,
       array['faturamento.criar','faturamento.fechar','contas_medicas.processar']
     ) then
    raise exception 'SEM_PERMISSAO_ENCAMINHAR_AUDITORIA' using errcode = '42501';
  end if;

  return public.encaminhar_conta_para_auditoria_internal(p_atendimento_id);
end
$$;
revoke all on function public.encaminhar_conta_para_auditoria(uuid) from public, anon;
grant execute on function public.encaminhar_conta_para_auditoria(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Auditoria de contas.
-- ---------------------------------------------------------------------------
alter function public.executar_auditoria_conta_automatica(uuid)
  rename to executar_auditoria_conta_automatica_internal;
revoke all on function public.executar_auditoria_conta_automatica_internal(uuid)
  from public, anon, authenticated;

create function public.executar_auditoria_conta_automatica(p_auditoria_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_auditoria record;
begin
  select empresa_id, unidade_id
    into v_auditoria
  from public.auditoria_contas
  where id = p_auditoria_id;

  if v_auditoria.empresa_id is null
     or not public.tem_unidade(v_auditoria.empresa_id, v_auditoria.unidade_id)
     or not public.tem_alguma_permissao_funcional(
       v_auditoria.empresa_id,
       v_auditoria.unidade_id,
       array['auditoria.executar','auditoria.analisar','auditoria.liberar']
     ) then
    raise exception 'SEM_PERMISSAO_EXECUTAR_AUDITORIA' using errcode = '42501';
  end if;

  return public.executar_auditoria_conta_automatica_internal(p_auditoria_id);
end
$$;
revoke all on function public.executar_auditoria_conta_automatica(uuid) from public, anon;
grant execute on function public.executar_auditoria_conta_automatica(uuid) to authenticated;

alter function public.resolver_item_auditoria(uuid,text)
  rename to resolver_item_auditoria_internal;
revoke all on function public.resolver_item_auditoria_internal(uuid,text)
  from public, anon, authenticated;

create function public.resolver_item_auditoria(p_item_id uuid, p_resolucao text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_auditoria record;
begin
  select a.empresa_id, a.unidade_id
    into v_auditoria
  from public.auditoria_conta_itens i
  join public.auditoria_contas a on a.id = i.auditoria_id
  where i.id = p_item_id;

  if v_auditoria.empresa_id is null
     or not public.tem_unidade(v_auditoria.empresa_id, v_auditoria.unidade_id)
     or not public.tem_alguma_permissao_funcional(
       v_auditoria.empresa_id,
       v_auditoria.unidade_id,
       array['auditoria.executar','auditoria.analisar']
     ) then
    raise exception 'SEM_PERMISSAO_RESOLVER_AUDITORIA' using errcode = '42501';
  end if;

  perform public.resolver_item_auditoria_internal(p_item_id, p_resolucao);
end
$$;
revoke all on function public.resolver_item_auditoria(uuid,text) from public, anon;
grant execute on function public.resolver_item_auditoria(uuid,text) to authenticated;

alter function public.reabrir_item_auditoria(uuid)
  rename to reabrir_item_auditoria_internal;
revoke all on function public.reabrir_item_auditoria_internal(uuid)
  from public, anon, authenticated;

create function public.reabrir_item_auditoria(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_auditoria record;
begin
  select a.empresa_id, a.unidade_id
    into v_auditoria
  from public.auditoria_conta_itens i
  join public.auditoria_contas a on a.id = i.auditoria_id
  where i.id = p_item_id;

  if v_auditoria.empresa_id is null
     or not public.tem_unidade(v_auditoria.empresa_id, v_auditoria.unidade_id)
     or not public.tem_alguma_permissao_funcional(
       v_auditoria.empresa_id,
       v_auditoria.unidade_id,
       array['auditoria.executar','auditoria.analisar']
     ) then
    raise exception 'SEM_PERMISSAO_REABRIR_AUDITORIA' using errcode = '42501';
  end if;

  perform public.reabrir_item_auditoria_internal(p_item_id);
end
$$;
revoke all on function public.reabrir_item_auditoria(uuid) from public, anon;
grant execute on function public.reabrir_item_auditoria(uuid) to authenticated;

alter function public.liberar_auditoria_conta(uuid,text)
  rename to liberar_auditoria_conta_internal;
revoke all on function public.liberar_auditoria_conta_internal(uuid,text)
  from public, anon, authenticated;

create function public.liberar_auditoria_conta(p_auditoria_id uuid, p_observacoes text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_auditoria record;
begin
  select empresa_id, unidade_id
    into v_auditoria
  from public.auditoria_contas
  where id = p_auditoria_id;

  if v_auditoria.empresa_id is null
     or not public.tem_unidade(v_auditoria.empresa_id, v_auditoria.unidade_id)
     or not public.tem_alguma_permissao_funcional(
       v_auditoria.empresa_id,
       v_auditoria.unidade_id,
       array['auditoria.liberar','auditoria.executar']
     ) then
    raise exception 'SEM_PERMISSAO_LIBERAR_AUDITORIA' using errcode = '42501';
  end if;

  perform public.liberar_auditoria_conta_internal(p_auditoria_id, p_observacoes);
end
$$;
revoke all on function public.liberar_auditoria_conta(uuid,text) from public, anon;
grant execute on function public.liberar_auditoria_conta(uuid,text) to authenticated;

-- ---------------------------------------------------------------------------
-- Contas Médicas.
-- ---------------------------------------------------------------------------
alter function public.gerar_checklist_conta_medica(uuid)
  rename to gerar_checklist_conta_medica_internal;
revoke all on function public.gerar_checklist_conta_medica_internal(uuid)
  from public, anon, authenticated;

create function public.gerar_checklist_conta_medica(p_processo_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_processo record;
begin
  select empresa_id, unidade_id
    into v_processo
  from public.contas_medicas_processos
  where id = p_processo_id;

  if v_processo.empresa_id is null
     or not public.tem_unidade(v_processo.empresa_id, v_processo.unidade_id)
     or not public.tem_alguma_permissao_funcional(
       v_processo.empresa_id,
       v_processo.unidade_id,
       array['contas_medicas.processar','contas_medicas.analisar','contas_medicas.liberar']
     ) then
    raise exception 'SEM_PERMISSAO_CHECKLIST_CONTAS_MEDICAS' using errcode = '42501';
  end if;

  return public.gerar_checklist_conta_medica_internal(p_processo_id);
end
$$;
revoke all on function public.gerar_checklist_conta_medica(uuid) from public, anon;
grant execute on function public.gerar_checklist_conta_medica(uuid) to authenticated;

alter function public.validar_checklist_conta_medica(uuid)
  rename to validar_checklist_conta_medica_internal;
revoke all on function public.validar_checklist_conta_medica_internal(uuid)
  from public, anon, authenticated;

create function public.validar_checklist_conta_medica(p_processo_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_processo record;
begin
  select empresa_id, unidade_id
    into v_processo
  from public.contas_medicas_processos
  where id = p_processo_id;

  if v_processo.empresa_id is null
     or not public.tem_unidade(v_processo.empresa_id, v_processo.unidade_id)
     or not public.tem_alguma_permissao_funcional(
       v_processo.empresa_id,
       v_processo.unidade_id,
       array['contas_medicas.processar','contas_medicas.analisar','contas_medicas.liberar']
     ) then
    raise exception 'SEM_PERMISSAO_VALIDAR_CONTAS_MEDICAS' using errcode = '42501';
  end if;

  return public.validar_checklist_conta_medica_internal(p_processo_id);
end
$$;
revoke all on function public.validar_checklist_conta_medica(uuid) from public, anon;
grant execute on function public.validar_checklist_conta_medica(uuid) to authenticated;

alter function public.auditar_precos_conta_medica(uuid)
  rename to auditar_precos_conta_medica_internal;
revoke all on function public.auditar_precos_conta_medica_internal(uuid)
  from public, anon, authenticated;

create function public.auditar_precos_conta_medica(p_processo_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_processo record;
begin
  select empresa_id, unidade_id
    into v_processo
  from public.contas_medicas_processos
  where id = p_processo_id;

  if v_processo.empresa_id is null
     or not public.tem_unidade(v_processo.empresa_id, v_processo.unidade_id)
     or not public.tem_alguma_permissao_funcional(
       v_processo.empresa_id,
       v_processo.unidade_id,
       array[
         'contas_medicas.processar','contas_medicas.analisar','contas_medicas.liberar',
         'auditoria.executar','auditoria.analisar','auditoria.liberar'
       ]
     ) then
    raise exception 'SEM_PERMISSAO_AUDITAR_PRECOS' using errcode = '42501';
  end if;

  return public.auditar_precos_conta_medica_internal(p_processo_id);
end
$$;
revoke all on function public.auditar_precos_conta_medica(uuid) from public, anon;
grant execute on function public.auditar_precos_conta_medica(uuid) to authenticated;

alter function public.liberar_conta_medica(uuid)
  rename to liberar_conta_medica_internal;
revoke all on function public.liberar_conta_medica_internal(uuid)
  from public, anon, authenticated;

create function public.liberar_conta_medica(p_processo_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_processo record;
begin
  select empresa_id, unidade_id
    into v_processo
  from public.contas_medicas_processos
  where id = p_processo_id;

  if v_processo.empresa_id is null
     or not public.tem_unidade(v_processo.empresa_id, v_processo.unidade_id)
     or not public.tem_alguma_permissao_funcional(
       v_processo.empresa_id,
       v_processo.unidade_id,
       array['contas_medicas.liberar','contas_medicas.processar']
     ) then
    raise exception 'SEM_PERMISSAO_LIBERAR_CONTA_MEDICA' using errcode = '42501';
  end if;

  perform public.liberar_conta_medica_internal(p_processo_id);
end
$$;
revoke all on function public.liberar_conta_medica(uuid) from public, anon;
grant execute on function public.liberar_conta_medica(uuid) to authenticated;

-- Diagnóstico de schema é ferramenta interna de administração, não endpoint da UI.
revoke all on function public.validar_schema_his() from public, anon, authenticated;
grant execute on function public.validar_schema_his() to service_role;

commit;
