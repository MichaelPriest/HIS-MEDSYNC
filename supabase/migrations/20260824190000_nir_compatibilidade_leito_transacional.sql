-- NIR: torna a compatibilidade de leito uma regra transacional, não apenas visual.
-- A função continua sendo a única responsável por ocupar/liberar leitos durante a movimentação.

create or replace function public.movimentar_internacao_leito(
  p_internacao_id uuid,
  p_leito_destino_id uuid,
  p_motivo text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_i public.internacoes%rowtype;
  v_l public.leitos%rowtype;
  v_prof uuid;
  v_mov uuid;
  v_tipo text;
  v_reserva uuid;
  v_sexo text;
  v_restricao_sexo text;
  v_acomodacao_internacao text;
  v_acomodacao_leito text;
begin
  select *
    into v_i
    from public.internacoes
   where id = p_internacao_id
   for update;

  if not found then
    raise exception 'LEITO_INTERNACAO_NAO_LOCALIZADA';
  end if;

  if v_i.status not in ('aguardando_leito', 'internado', 'transferido') then
    raise exception 'LEITO_INTERNACAO_NAO_ATIVA';
  end if;

  if not (
    public.tem_permissao(v_i.empresa_id, v_i.unidade_id, 'leitos.gerenciar')
    or public.tem_permissao(v_i.empresa_id, v_i.unidade_id, 'internacao.movimentar')
    or public.tem_permissao(v_i.empresa_id, v_i.unidade_id, 'internacao.gerenciar')
  ) then
    raise exception 'LEITO_SEM_PERMISSAO' using errcode = '42501';
  end if;

  select *
    into v_l
    from public.leitos
   where id = p_leito_destino_id
   for update;

  if not found then
    raise exception 'LEITO_DESTINO_NAO_LOCALIZADO';
  end if;

  if v_l.empresa_id <> v_i.empresa_id or v_l.unidade_id <> v_i.unidade_id then
    raise exception 'LEITO_DESTINO_FORA_ESCOPO';
  end if;

  if not v_l.ativo or v_l.status in ('ocupado', 'manutencao', 'bloqueado', 'higienizacao') then
    raise exception 'LEITO_DESTINO_INDISPONIVEL';
  end if;

  if exists (
    select 1
      from public.internacoes x
     where x.leito_id = p_leito_destino_id
       and x.status = 'internado'
       and x.id <> p_internacao_id
  ) then
    raise exception 'LEITO_DESTINO_OCUPADO';
  end if;

  -- Compatibilidade clínica/assistencial obrigatória.
  select p.sexo::text
    into v_sexo
    from public.atendimentos a
    join public.pacientes p on p.id = a.paciente_id
   where a.id = v_i.atendimento_id
     and a.empresa_id = v_i.empresa_id
     and a.unidade_id = v_i.unidade_id;

  if coalesce(v_i.isolamento, false) and not coalesce(v_l.isolamento_capaz, false) then
    raise exception 'LEITO_INCOMPATIVEL_ISOLAMENTO';
  end if;

  v_restricao_sexo := case lower(trim(coalesce(v_l.sexo_restricao, '')))
    when 'm' then 'masculino'
    when 'masc' then 'masculino'
    when 'masculino' then 'masculino'
    when 'f' then 'feminino'
    when 'fem' then 'feminino'
    when 'feminino' then 'feminino'
    else nullif(lower(trim(coalesce(v_l.sexo_restricao, ''))), '')
  end;

  if v_restricao_sexo is not null
     and (v_sexo is null or lower(v_sexo) <> v_restricao_sexo) then
    raise exception 'LEITO_INCOMPATIVEL_SEXO';
  end if;

  -- Normaliza nomes equivalentes usados historicamente no HIS.
  v_acomodacao_internacao := case lower(trim(coalesce(v_i.acomodacao, '')))
    when 'enfermaria' then 'coletiva'
    when 'coletiva' then 'coletiva'
    when 'apartamento' then 'apartamento'
    when 'privativo' then 'apartamento'
    when 'privativa' then 'apartamento'
    when 'uti' then 'uti'
    when 'observacao' then 'observacao'
    when 'observação' then 'observacao'
    else nullif(lower(trim(coalesce(v_i.acomodacao, ''))), '')
  end;

  v_acomodacao_leito := case lower(trim(coalesce(v_l.acomodacao, '')))
    when 'enfermaria' then 'coletiva'
    when 'coletiva' then 'coletiva'
    when 'apartamento' then 'apartamento'
    when 'privativo' then 'apartamento'
    when 'privativa' then 'apartamento'
    when 'uti' then 'uti'
    when 'observacao' then 'observacao'
    when 'observação' then 'observacao'
    else nullif(lower(trim(coalesce(v_l.acomodacao, ''))), '')
  end;

  if v_acomodacao_internacao is not null
     and v_acomodacao_leito is not null
     and v_acomodacao_internacao <> v_acomodacao_leito then
    raise exception 'LEITO_INCOMPATIVEL_ACOMODACAO';
  end if;

  if v_l.status = 'reservado' then
    select id
      into v_reserva
      from public.leito_reservas
     where leito_id = v_l.id
       and status = 'ativa'
       and atendimento_id = v_i.atendimento_id
     limit 1
     for update;

    if v_reserva is null then
      raise exception 'LEITO_RESERVADO_PARA_OUTRO_ATENDIMENTO';
    end if;
  end if;

  v_prof := public.profissional_logado(v_i.empresa_id);
  v_tipo := case when v_i.leito_id is null then 'admissao' else 'transferencia' end;

  if v_i.leito_id is not null and v_i.leito_id <> p_leito_destino_id then
    update public.leitos
       set status = 'higienizacao',
           updated_at = now(),
           updated_by = auth.uid()
     where id = v_i.leito_id;

    insert into public.leito_higienizacoes(
      empresa_id, unidade_id, leito_id, internacao_id, atendimento_id,
      status, solicitada_por, created_by, updated_by
    ) values (
      v_i.empresa_id, v_i.unidade_id, v_i.leito_id, v_i.id, v_i.atendimento_id,
      'pendente', auth.uid(), auth.uid(), auth.uid()
    ) on conflict do nothing;
  end if;

  update public.leitos
     set status = 'ocupado',
         updated_at = now(),
         updated_by = auth.uid()
   where id = v_l.id;

  if v_reserva is not null then
    update public.leito_reservas
       set status = 'utilizada',
           updated_at = now(),
           updated_by = auth.uid()
     where id = v_reserva;
  end if;

  update public.internacoes
     set leito_id = v_l.id,
         setor = v_l.setor,
         quarto = v_l.quarto,
         leito = v_l.codigo,
         acomodacao = coalesce(v_l.acomodacao, acomodacao),
         status = 'internado',
         updated_at = now(),
         updated_by = auth.uid()
   where id = v_i.id;

  insert into public.movimentacoes_leitos(
    empresa_id, unidade_id, internacao_id, atendimento_id,
    leito_origem_id, leito_destino_id, tipo, motivo,
    movimentado_em, profissional_id, created_by
  ) values (
    v_i.empresa_id, v_i.unidade_id, v_i.id, v_i.atendimento_id,
    v_i.leito_id, v_l.id, v_tipo, p_motivo,
    now(), v_prof, auth.uid()
  ) returning id into v_mov;

  return v_mov;
end
$$;

revoke all on function public.movimentar_internacao_leito(uuid, uuid, text) from public;
revoke all on function public.movimentar_internacao_leito(uuid, uuid, text) from anon;
grant execute on function public.movimentar_internacao_leito(uuid, uuid, text) to authenticated;
