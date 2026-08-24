begin;

-- Dados assistenciais de urgência são históricos: não podem ser apagados pelo cliente.
drop policy if exists emergencia_registros_delete on public.emergencia_registros;
drop policy if exists emergencia_reavaliacoes_delete on public.emergencia_reavaliacoes;
revoke delete on public.emergencia_registros from authenticated;
revoke delete on public.emergencia_reavaliacoes from authenticated;

create index if not exists emergencia_registros_unidade_status_reavaliacao_idx
  on public.emergencia_registros(unidade_id, status, reavaliacao_em)
  where status <> 'encerrado';

create index if not exists emergencia_reavaliacoes_emergencia_data_idx
  on public.emergencia_reavaliacoes(emergencia_id, reavaliado_em desc);

-- A equipe com emergencia.reavaliar pode acrescentar uma reavaliação e atualizar
-- somente os campos operacionais necessários da fila. Não abrimos UPDATE genérico
-- em emergencia_registros para esse perfil.
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
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_registro public.emergencia_registros%rowtype;
  v_profissional_id uuid;
  v_reavaliacao_id uuid;
begin
  select *
    into v_registro
  from public.emergencia_registros
  where id = p_emergencia_id
  for update;

  if v_registro.id is null or v_registro.status = 'encerrado' then
    raise exception 'EMERGENCIA_REGISTRO_INDISPONIVEL' using errcode = 'P0002';
  end if;

  if not public.tem_unidade(v_registro.empresa_id, v_registro.unidade_id)
     or not public.tem_permissao(v_registro.empresa_id, v_registro.unidade_id, 'emergencia.reavaliar') then
    raise exception 'EMERGENCIA_SEM_PERMISSAO_REAVALIAR' using errcode = '42501';
  end if;

  if p_dor is not null and (p_dor < 0 or p_dor > 10) then
    raise exception 'EMERGENCIA_DOR_INVALIDA' using errcode = '22023';
  end if;

  v_profissional_id := public.profissional_logado(v_registro.empresa_id);

  insert into public.emergencia_reavaliacoes(
    empresa_id,
    unidade_id,
    emergencia_id,
    atendimento_id,
    profissional_id,
    reavaliado_em,
    queixa,
    classificacao_risco,
    abcde,
    sinais_vitais,
    dor,
    conduta,
    destino,
    observacoes,
    created_by
  ) values (
    v_registro.empresa_id,
    v_registro.unidade_id,
    v_registro.id,
    v_registro.atendimento_id,
    v_profissional_id,
    now(),
    p_queixa,
    p_classificacao_risco,
    coalesce(p_abcde, '{}'::jsonb),
    coalesce(p_sinais_vitais, '{}'::jsonb),
    p_dor,
    p_conduta,
    p_destino,
    p_observacoes,
    auth.uid()
  )
  returning id into v_reavaliacao_id;

  update public.emergencia_registros
  set classificacao_risco = coalesce(p_classificacao_risco, classificacao_risco),
      reavaliacao_em = p_proxima_reavaliacao_em,
      destino = coalesce(p_destino, destino),
      updated_at = now(),
      updated_by = auth.uid()
  where id = v_registro.id;

  return v_reavaliacao_id;
end
$$;

revoke all on function public.registrar_reavaliacao_emergencia(uuid,text,text,jsonb,jsonb,integer,text,text,text,timestamptz)
  from public, anon;
grant execute on function public.registrar_reavaliacao_emergencia(uuid,text,text,jsonb,jsonb,integer,text,text,text,timestamptz)
  to authenticated, service_role;

commit;
