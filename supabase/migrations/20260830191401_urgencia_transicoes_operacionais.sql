alter table public.emergencia_registros
  add column if not exists encerrado_em timestamptz,
  add column if not exists encerrado_por uuid references auth.users(id);

create unique index if not exists emergencia_registros_um_ativo_por_atendimento
  on public.emergencia_registros (atendimento_id)
  where status <> 'encerrado';

create index if not exists emergencia_registros_reavaliacao_ativa_idx
  on public.emergencia_registros (empresa_id, unidade_id, reavaliacao_em)
  where status <> 'encerrado' and reavaliacao_em is not null;

create or replace function public.abrir_registro_emergencia_operacional(
  p_atendimento_id uuid,
  p_origem text default null,
  p_mecanismo text default null,
  p_classificacao_risco text default null,
  p_protocolo text default null,
  p_sala text default null,
  p_estado_geral text default null,
  p_via_aerea text default null,
  p_respiracao text default null,
  p_circulacao text default null,
  p_neurologico text default null,
  p_exposicao text default null,
  p_procedimentos_imediatos jsonb default '[]'::jsonb,
  p_reavaliacao_em timestamptz default null,
  p_destino text default null,
  p_observacoes text default null
) returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_atendimento public.atendimentos%rowtype;
  v_profissional_id uuid;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'EMERGENCIA_NAO_AUTENTICADO' using errcode='42501';
  end if;

  select * into v_atendimento
  from public.atendimentos
  where id = p_atendimento_id
  for update;

  if v_atendimento.id is null then
    raise exception 'EMERGENCIA_ATENDIMENTO_NAO_LOCALIZADO' using errcode='P0002';
  end if;

  if not public.tem_unidade(v_atendimento.empresa_id, v_atendimento.unidade_id)
     or not public.tem_permissao(v_atendimento.empresa_id, v_atendimento.unidade_id, 'emergencia.gerenciar') then
    raise exception 'EMERGENCIA_SEM_PERMISSAO_GERENCIAR' using errcode='42501';
  end if;

  if coalesce(v_atendimento.status,'') not in ('aberto','em_espera','em_atendimento') then
    raise exception 'EMERGENCIA_ATENDIMENTO_INDISPONIVEL' using errcode='22023';
  end if;

  if p_classificacao_risco is not null and lower(p_classificacao_risco) not in ('vermelho','laranja','amarelo','verde','azul') then
    raise exception 'EMERGENCIA_CLASSIFICACAO_INVALIDA' using errcode='22023';
  end if;

  if p_destino is not null and p_destino not in ('observacao','internacao','uti','centro_cirurgico','alta','transferencia') then
    raise exception 'EMERGENCIA_DESTINO_INVALIDO' using errcode='22023';
  end if;

  if exists(select 1 from public.emergencia_registros where atendimento_id=p_atendimento_id and status <> 'encerrado') then
    raise exception 'EMERGENCIA_REGISTRO_ATIVO' using errcode='23505';
  end if;

  v_profissional_id := public.profissional_logado(v_atendimento.empresa_id);

  insert into public.emergencia_registros(
    empresa_id, unidade_id, atendimento_id, paciente_id, profissional_id,
    origem, mecanismo, classificacao_risco, protocolo, sala, estado_geral,
    via_aerea, respiracao, circulacao, neurologico, exposicao,
    procedimentos_imediatos, reavaliacao_em, destino, observacoes,
    status, created_by, updated_by
  ) values (
    v_atendimento.empresa_id, v_atendimento.unidade_id, v_atendimento.id, v_atendimento.paciente_id, v_profissional_id,
    nullif(trim(p_origem),''), nullif(trim(p_mecanismo),''), lower(nullif(trim(p_classificacao_risco),'')),
    nullif(trim(p_protocolo),''), nullif(trim(p_sala),''), nullif(trim(p_estado_geral),''),
    nullif(trim(p_via_aerea),''), nullif(trim(p_respiracao),''), nullif(trim(p_circulacao),''),
    nullif(trim(p_neurologico),''), nullif(trim(p_exposicao),''), coalesce(p_procedimentos_imediatos,'[]'::jsonb),
    p_reavaliacao_em, p_destino, nullif(trim(p_observacoes),''), 'em_atendimento', auth.uid(), auth.uid()
  ) returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.encerrar_registro_emergencia_operacional(
  p_emergencia_id uuid,
  p_destino text,
  p_observacoes text default null
) returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_registro public.emergencia_registros%rowtype;
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

  if p_destino is null or p_destino not in ('observacao','internacao','uti','centro_cirurgico','alta','transferencia') then
    raise exception 'EMERGENCIA_DESTINO_INVALIDO' using errcode='22023';
  end if;

  update public.emergencia_registros
  set destino = p_destino,
      status = 'encerrado',
      observacoes = coalesce(nullif(trim(p_observacoes),''), observacoes),
      reavaliacao_em = null,
      encerrado_em = now(),
      encerrado_por = auth.uid(),
      updated_at = now(),
      updated_by = auth.uid()
  where id = v_registro.id;
end;
$$;

revoke all on function public.abrir_registro_emergencia_operacional(uuid,text,text,text,text,text,text,text,text,text,text,text,jsonb,timestamptz,text,text) from public, anon;
revoke all on function public.encerrar_registro_emergencia_operacional(uuid,text,text) from public, anon;
grant execute on function public.abrir_registro_emergencia_operacional(uuid,text,text,text,text,text,text,text,text,text,text,text,jsonb,timestamptz,text,text) to authenticated;
grant execute on function public.encerrar_registro_emergencia_operacional(uuid,text,text) to authenticated;
