create or replace function public.finalizar_atendimento_medico(
  p_atendimento_id uuid,
  p_desfecho text,
  p_orientacoes text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_catalog', 'extensions'
as $function$
declare
  v_at public.atendimentos%rowtype;
  v_prof uuid;
  v_evolucao_id uuid;
  v_assinatura_hash text;
  v_agora timestamptz := now();
  v_qtd integer;
  v_filas_concluidas integer := 0;
  v_encaminhamentos_concluidos integer := 0;
  v_pendencias text[] := array[]::text[];
  v_desfecho text := lower(trim(coalesce(p_desfecho, '')));
  v_orientacoes text := trim(coalesce(p_orientacoes, ''));
begin
  if auth.uid() is null then
    raise exception 'ALTA_USUARIO_NAO_AUTENTICADO' using errcode = '42501';
  end if;

  select *
    into v_at
    from public.atendimentos
   where id = p_atendimento_id
   for update;

  if not found then
    raise exception 'ALTA_ATENDIMENTO_NAO_LOCALIZADO';
  end if;

  if not public.tem_unidade(v_at.empresa_id, v_at.unidade_id) then
    raise exception 'ALTA_SEM_ACESSO_UNIDADE' using errcode = '42501';
  end if;

  if not public.tem_permissao(v_at.empresa_id, v_at.unidade_id, 'atendimentos.alta')
     or not public.tem_permissao(v_at.empresa_id, v_at.unidade_id, 'prontuario.assinar') then
    raise exception 'ALTA_SEM_PERMISSAO' using errcode = '42501';
  end if;

  v_prof := public.profissional_logado(v_at.empresa_id);
  if v_prof is null then
    raise exception 'ALTA_USUARIO_SEM_PROFISSIONAL' using errcode = '42501';
  end if;

  if v_at.status = 'alta' then
    return jsonb_build_object(
      'atendimento_id', v_at.id,
      'status', 'alta',
      'ja_finalizado', true,
      'data_fechamento', v_at.data_fechamento
    );
  end if;

  if v_at.status = 'cancelado' then
    raise exception 'ALTA_ATENDIMENTO_CANCELADO';
  end if;

  if v_at.status not in ('aberto', 'em_espera', 'em_atendimento') then
    raise exception 'ALTA_ATENDIMENTO_NAO_ATIVO';
  end if;

  if v_desfecho not in ('alta', 'alta_com_retorno', 'encaminhamento_externo') then
    raise exception 'ALTA_DESFECHO_INVALIDO';
  end if;

  if v_orientacoes = '' then
    raise exception 'ALTA_ORIENTACOES_OBRIGATORIAS';
  end if;

  if exists (
    select 1
      from public.internacoes i
     where i.atendimento_id = v_at.id
       and i.empresa_id = v_at.empresa_id
       and i.unidade_id = v_at.unidade_id
       and i.data_alta is null
       and i.status = 'internado'
  ) then
    raise exception 'ALTA_INTERNACAO_ATIVA';
  end if;

  if not exists (
       select 1
         from public.prontuario_anamneses a
        where a.atendimento_id = v_at.id
          and a.empresa_id = v_at.empresa_id
          and a.unidade_id = v_at.unidade_id
          and a.assinado_em is not null
     )
     and not exists (
       select 1
         from public.prontuario_evolucoes e
        where e.atendimento_id = v_at.id
          and e.empresa_id = v_at.empresa_id
          and e.unidade_id = v_at.unidade_id
          and e.assinado_em is not null
     ) then
    raise exception 'ALTA_SEM_REGISTRO_CLINICO_ASSINADO';
  end if;

  select count(*) into v_qtd
    from public.prescricoes p
   where p.atendimento_id = v_at.id
     and p.empresa_id = v_at.empresa_id
     and p.unidade_id = v_at.unidade_id
     and p.status = 'rascunho';
  if v_qtd > 0 then
    v_pendencias := array_append(v_pendencias, format('%s item(ns) de prescrição em rascunho', v_qtd));
  end if;

  select count(*) into v_qtd
    from public.solicitacoes_exames s
   where s.atendimento_id = v_at.id
     and s.empresa_id = v_at.empresa_id
     and s.unidade_id = v_at.unidade_id
     and s.status = 'rascunho';
  if v_qtd > 0 then
    v_pendencias := array_append(v_pendencias, format('%s exame(s) em rascunho', v_qtd));
  end if;

  select count(*) into v_qtd
    from public.procedimentos_assistenciais p
   where p.atendimento_id = v_at.id
     and p.empresa_id = v_at.empresa_id
     and p.unidade_id = v_at.unidade_id
     and p.status = 'rascunho';
  if v_qtd > 0 then
    v_pendencias := array_append(v_pendencias, format('%s procedimento(s) em rascunho', v_qtd));
  end if;

  select count(*) into v_qtd
    from public.solicitacoes_materiais_assistenciais s
   where s.atendimento_id = v_at.id
     and s.empresa_id = v_at.empresa_id
     and s.unidade_id = v_at.unidade_id
     and s.status = 'rascunho';
  if v_qtd > 0 then
    v_pendencias := array_append(v_pendencias, format('%s material(is) em rascunho', v_qtd));
  end if;

  select count(*) into v_qtd
    from public.prescricao_aprazamentos a
   where a.atendimento_id = v_at.id
     and a.empresa_id = v_at.empresa_id
     and a.unidade_id = v_at.unidade_id
     and a.status = 'pendente';
  if v_qtd > 0 then
    v_pendencias := array_append(v_pendencias, format('%s administração(ões) de medicamento pendente(s)', v_qtd));
  end if;

  select count(*) into v_qtd
    from public.filas_setoriais f
   where f.atendimento_id = v_at.id
     and f.empresa_id = v_at.empresa_id
     and f.unidade_id = v_at.unidade_id
     and f.status not in ('concluido', 'cancelado')
     and not (
       f.setor_codigo in ('consultorio', 'pronto_socorro')
       and (f.profissional_destino_id is null or f.profissional_destino_id = v_prof)
     );
  if v_qtd > 0 then
    v_pendencias := array_append(v_pendencias, format('%s fila(s) assistencial(is) ainda ativa(s)', v_qtd));
  end if;

  select count(*) into v_qtd
    from public.encaminhamentos_assistenciais e
   where e.atendimento_id = v_at.id
     and e.empresa_id = v_at.empresa_id
     and e.unidade_id = v_at.unidade_id
     and e.status not in ('concluido', 'cancelado')
     and e.profissional_id is distinct from v_prof;
  if v_qtd > 0 then
    v_pendencias := array_append(v_pendencias, format('%s encaminhamento(s) assistencial(is) ainda ativo(s)', v_qtd));
  end if;

  if coalesce(array_length(v_pendencias, 1), 0) > 0 then
    raise exception 'ALTA_PENDENCIAS_BLOQUEANTES: %', array_to_string(v_pendencias, '; ');
  end if;

  insert into public.prontuario_evolucoes (
    empresa_id,
    unidade_id,
    atendimento_id,
    profissional_id,
    tipo_evolucao,
    plano,
    texto_livre,
    conteudo_estruturado,
    created_by,
    updated_by
  ) values (
    v_at.empresa_id,
    v_at.unidade_id,
    v_at.id,
    v_prof,
    'alta_medica',
    v_orientacoes,
    concat('Desfecho: ', replace(v_desfecho, '_', ' '), E'\nOrientações: ', v_orientacoes),
    jsonb_build_object(
      'desfecho', v_desfecho,
      'orientacoes', v_orientacoes,
      'tipo_documento', 'alta_medica'
    ),
    auth.uid(),
    auth.uid()
  ) returning id into v_evolucao_id;

  v_assinatura_hash := public.assinar_prontuario_evolucao(v_evolucao_id);

  update public.filas_setoriais
     set status = 'concluido',
         concluido_em = coalesce(concluido_em, v_agora),
         updated_at = v_agora,
         updated_by = auth.uid()
   where atendimento_id = v_at.id
     and empresa_id = v_at.empresa_id
     and unidade_id = v_at.unidade_id
     and status not in ('concluido', 'cancelado')
     and setor_codigo in ('consultorio', 'pronto_socorro')
     and (profissional_destino_id is null or profissional_destino_id = v_prof);
  get diagnostics v_filas_concluidas = row_count;

  update public.encaminhamentos_assistenciais
     set status = 'concluido',
         concluido_em = coalesce(concluido_em, v_agora),
         updated_at = v_agora,
         updated_by = auth.uid()
   where atendimento_id = v_at.id
     and empresa_id = v_at.empresa_id
     and unidade_id = v_at.unidade_id
     and status not in ('concluido', 'cancelado')
     and profissional_id = v_prof;
  get diagnostics v_encaminhamentos_concluidos = row_count;

  update public.atendimentos
     set status = 'alta',
         data_fechamento = coalesce(data_fechamento, v_agora),
         setor_atual = 'alta',
         ultima_movimentacao_em = v_agora,
         updated_at = v_agora,
         updated_by = auth.uid()
   where id = v_at.id;

  return jsonb_build_object(
    'atendimento_id', v_at.id,
    'status', 'alta',
    'ja_finalizado', false,
    'desfecho', v_desfecho,
    'evolucao_alta_id', v_evolucao_id,
    'assinatura_hash', v_assinatura_hash,
    'filas_concluidas', v_filas_concluidas,
    'encaminhamentos_concluidos', v_encaminhamentos_concluidos,
    'data_fechamento', v_agora
  );
end
$function$;

revoke all on function public.finalizar_atendimento_medico(uuid, text, text) from public;
grant execute on function public.finalizar_atendimento_medico(uuid, text, text) to authenticated;

comment on function public.finalizar_atendimento_medico(uuid, text, text) is
  'Finaliza atendimento medico de forma transacional: valida permissao, vinculo profissional, registro clinico assinado e pendencias; assina evolucao de alta e encerra filas clinicas do profissional.';
