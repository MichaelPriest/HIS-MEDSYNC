-- Corrige o fluxo de administracao medicamentosa: dose unica, RLS e RPC legado.

-- A permissao especifica de checagem a beira-leito precisa enxergar a dispensacao
-- e gravar a administracao/aprazamento que o proprio RPC autoriza.
drop policy if exists prescricao_aprazamentos_select on public.prescricao_aprazamentos;
create policy prescricao_aprazamentos_select on public.prescricao_aprazamentos
for select to authenticated
using (
  public.tem_unidade(empresa_id, unidade_id)
  and (
    public.tem_permissao(empresa_id, unidade_id, 'prescricao.visualizar')
    or public.tem_permissao(empresa_id, unidade_id, 'medicamentos.administrar')
    or public.tem_permissao(empresa_id, unidade_id, 'medicamentos.checar_beira_leito')
  )
);

drop policy if exists prescricao_aprazamentos_insert on public.prescricao_aprazamentos;
create policy prescricao_aprazamentos_insert on public.prescricao_aprazamentos
for insert to authenticated
with check (
  public.tem_unidade(empresa_id, unidade_id)
  and public.tem_permissao(empresa_id, unidade_id, 'medicamentos.aprazar')
);

drop policy if exists prescricao_aprazamentos_update on public.prescricao_aprazamentos;
create policy prescricao_aprazamentos_update on public.prescricao_aprazamentos
for update to authenticated
using (
  public.tem_unidade(empresa_id, unidade_id)
  and (
    public.tem_permissao(empresa_id, unidade_id, 'medicamentos.administrar')
    or public.tem_permissao(empresa_id, unidade_id, 'medicamentos.aprazar')
    or public.tem_permissao(empresa_id, unidade_id, 'medicamentos.checar_beira_leito')
  )
)
with check (
  public.tem_unidade(empresa_id, unidade_id)
  and (
    public.tem_permissao(empresa_id, unidade_id, 'medicamentos.administrar')
    or public.tem_permissao(empresa_id, unidade_id, 'medicamentos.aprazar')
    or public.tem_permissao(empresa_id, unidade_id, 'medicamentos.checar_beira_leito')
  )
);

drop policy if exists dispensacoes_medicamentos_select on public.dispensacoes_medicamentos;
create policy dispensacoes_medicamentos_select on public.dispensacoes_medicamentos
for select to authenticated
using (
  public.tem_unidade(empresa_id, unidade_id)
  and (
    public.tem_permissao(empresa_id, unidade_id, 'farmacia.visualizar')
    or public.tem_permissao(empresa_id, unidade_id, 'farmacia.dispensar')
    or public.tem_permissao(empresa_id, unidade_id, 'medicamentos.administrar')
    or public.tem_permissao(empresa_id, unidade_id, 'medicamentos.checar_beira_leito')
  )
);

drop policy if exists administracoes_medicamentos_select on public.administracoes_medicamentos;
create policy administracoes_medicamentos_select on public.administracoes_medicamentos
for select to authenticated
using (
  public.tem_unidade(empresa_id, unidade_id)
  and (
    public.tem_permissao(empresa_id, unidade_id, 'prescricao.visualizar')
    or public.tem_permissao(empresa_id, unidade_id, 'medicamentos.administrar')
    or public.tem_permissao(empresa_id, unidade_id, 'medicamentos.checar_beira_leito')
  )
);

drop policy if exists administracoes_medicamentos_insert on public.administracoes_medicamentos;
create policy administracoes_medicamentos_insert on public.administracoes_medicamentos
for insert to authenticated
with check (
  public.tem_unidade(empresa_id, unidade_id)
  and (
    public.tem_permissao(empresa_id, unidade_id, 'medicamentos.administrar')
    or public.tem_permissao(empresa_id, unidade_id, 'medicamentos.checar_beira_leito')
  )
);

drop policy if exists administracoes_medicamentos_update on public.administracoes_medicamentos;
create policy administracoes_medicamentos_update on public.administracoes_medicamentos
for update to authenticated
using (
  public.tem_unidade(empresa_id, unidade_id)
  and (
    public.tem_permissao(empresa_id, unidade_id, 'medicamentos.administrar')
    or public.tem_permissao(empresa_id, unidade_id, 'medicamentos.checar_beira_leito')
  )
)
with check (
  public.tem_unidade(empresa_id, unidade_id)
  and (
    public.tem_permissao(empresa_id, unidade_id, 'medicamentos.administrar')
    or public.tem_permissao(empresa_id, unidade_id, 'medicamentos.checar_beira_leito')
  )
);

create or replace function public.gerar_aprazamentos_prescricao(
  p_prescricao_id uuid,
  p_horizonte_dias integer default 2
) returns integer
language plpgsql
security invoker
set search_path=public,pg_catalog
as $$
declare
  v_p public.prescricoes%rowtype;
  v_at public.atendimentos%rowtype;
  v_inicio timestamptz;
  v_fim timestamptz;
  v_dia date;
  v_hora text;
  v_programado timestamptz;
  v_count integer := 0;
  v_json jsonb;
  v_frequencia_normalizada text;
begin
  if p_horizonte_dias < 1 or p_horizonte_dias > 30 then
    raise exception 'HORIZONTE_INVALIDO';
  end if;

  select * into v_p from public.prescricoes where id = p_prescricao_id;
  if not found then raise exception 'PRESCRICAO_NAO_ENCONTRADA'; end if;
  if v_p.assinado_em is null or v_p.status <> 'ativa' then
    raise exception 'PRESCRICAO_NAO_ATIVA_ASSINADA';
  end if;
  if not (
    public.tem_permissao(v_p.empresa_id, v_p.unidade_id, 'medicamentos.aprazar')
    or public.tem_permissao(v_p.empresa_id, v_p.unidade_id, 'prescricao.assinar')
  ) then
    raise exception 'SEM_PERMISSAO';
  end if;

  select * into v_at from public.atendimentos where id = v_p.atendimento_id;
  if not found then raise exception 'ATENDIMENTO_NAO_ENCONTRADO'; end if;

  if coalesce(v_p.se_necessario, false) then
    return 0;
  end if;

  v_frequencia_normalizada := lower(regexp_replace(coalesce(v_p.frequencia, ''), '[^a-zA-Z0-9]+', '', 'g'));

  -- Dose unica/imediata precisa gerar uma unica checagem mesmo sem horarios/intervalo.
  if v_frequencia_normalizada in ('doseunica', 'unica', 'imediata', 'agora', 'stat') then
    if not exists (
      select 1 from public.prescricao_aprazamentos ap
      where ap.prescricao_id = v_p.id and ap.status <> 'cancelado'
    ) and not exists (
      select 1 from public.administracoes_medicamentos am
      where am.prescricao_id = v_p.id and am.status = 'administrado'
    ) then
      v_programado := greatest(coalesce(v_p.inicio_em, v_p.assinado_em), v_p.assinado_em);
      insert into public.prescricao_aprazamentos(
        empresa_id, unidade_id, atendimento_id, paciente_id, prescricao_id, programado_em, created_by
      ) values (
        v_p.empresa_id, v_p.unidade_id, v_p.atendimento_id, v_at.paciente_id, v_p.id, v_programado, auth.uid()
      )
      on conflict(prescricao_id, programado_em) do nothing;
      if found then v_count := 1; end if;
    end if;
    return v_count;
  end if;

  v_inicio := greatest(coalesce(v_p.inicio_em, now()), now());
  v_fim := least(
    coalesce(v_p.fim_em, now() + make_interval(days => p_horizonte_dias)),
    now() + make_interval(days => p_horizonte_dias)
  );
  v_json := case
    when jsonb_array_length(coalesce(v_p.aprazamento, '[]'::jsonb)) > 0 then v_p.aprazamento
    else coalesce(v_p.horarios, '[]'::jsonb)
  end;

  if jsonb_array_length(v_json) > 0 then
    for v_dia in
      select generate_series(
        (v_inicio at time zone 'America/Sao_Paulo')::date,
        (v_fim at time zone 'America/Sao_Paulo')::date,
        '1 day'::interval
      )::date
    loop
      for v_hora in select value from jsonb_array_elements_text(v_json)
      loop
        begin
          v_programado := (v_dia + v_hora::time) at time zone 'America/Sao_Paulo';
        exception when others then
          continue;
        end;
        if v_programado between v_inicio and v_fim then
          insert into public.prescricao_aprazamentos(
            empresa_id, unidade_id, atendimento_id, paciente_id, prescricao_id, programado_em, created_by
          ) values (
            v_p.empresa_id, v_p.unidade_id, v_p.atendimento_id, v_at.paciente_id, v_p.id, v_programado, auth.uid()
          )
          on conflict(prescricao_id, programado_em) do nothing;
          if found then v_count := v_count + 1; end if;
        end if;
      end loop;
    end loop;
  elsif v_p.intervalo_minutos is not null and v_p.intervalo_minutos > 0 then
    for v_programado in
      select generate_series(v_inicio, v_fim, make_interval(mins => v_p.intervalo_minutos))
    loop
      insert into public.prescricao_aprazamentos(
        empresa_id, unidade_id, atendimento_id, paciente_id, prescricao_id, programado_em, created_by
      ) values (
        v_p.empresa_id, v_p.unidade_id, v_p.atendimento_id, v_at.paciente_id, v_p.id, v_programado, auth.uid()
      )
      on conflict(prescricao_id, programado_em) do nothing;
      if found then v_count := v_count + 1; end if;
    end loop;
  end if;

  return v_count;
end;
$$;

revoke all on function public.gerar_aprazamentos_prescricao(uuid,integer) from public,anon;
grant execute on function public.gerar_aprazamentos_prescricao(uuid,integer) to authenticated;

-- RPC legado: elimina o RECORD nao inicializado e o alinha ao fluxo seguro atual.
create or replace function public.registrar_administracao_medicamento(
  p_prescricao_id uuid,
  p_dispensacao_id uuid,
  p_dose text,
  p_via text,
  p_status text,
  p_justificativa text default null,
  p_codigo_barras_paciente text default null,
  p_codigo_barras_medicamento text default null,
  p_paciente_confirmado boolean default false,
  p_medicamento_confirmado boolean default false,
  p_dose_confirmada boolean default false,
  p_via_confirmada boolean default false,
  p_horario_confirmado boolean default false,
  p_dupla_checagem boolean default false,
  p_segundo_profissional_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path=public,pg_catalog
as $$
declare
  v_p record;
  v_d public.dispensacoes_medicamentos%rowtype;
  v_prof uuid;
  v_id uuid;
begin
  if p_status not in ('administrado','recusado','omitido') then
    raise exception 'MEDICAMENTO_STATUS_INVALIDO';
  end if;

  select p.*, a.paciente_id into v_p
  from public.prescricoes p
  join public.atendimentos a on a.id = p.atendimento_id
  where p.id = p_prescricao_id;
  if not found then raise exception 'MEDICAMENTO_PRESCRICAO_NAO_LOCALIZADA'; end if;
  if v_p.assinado_em is null or v_p.status <> 'ativa' then
    raise exception 'MEDICAMENTO_PRESCRICAO_NAO_ATIVA_ASSINADA';
  end if;

  if not (
    public.tem_permissao(v_p.empresa_id, v_p.unidade_id, 'medicamentos.administrar')
    or public.tem_permissao(v_p.empresa_id, v_p.unidade_id, 'medicamentos.checar_beira_leito')
  ) then
    raise exception 'MEDICAMENTO_SEM_PERMISSAO' using errcode='42501';
  end if;

  v_prof := public.profissional_logado(v_p.empresa_id);
  if v_prof is null then raise exception 'MEDICAMENTO_USUARIO_SEM_PROFISSIONAL'; end if;

  if v_p.requer_validacao_farmaceutica and not exists (
    select 1 from public.validacoes_farmaceuticas vf
    where vf.prescricao_id = v_p.id and vf.status in ('validada','validada_com_ressalva')
  ) then
    raise exception 'VALIDACAO_FARMACEUTICA_PENDENTE';
  end if;

  if p_status = 'administrado' then
    if not (p_paciente_confirmado and p_medicamento_confirmado and p_dose_confirmada and p_via_confirmada and p_horario_confirmado) then
      raise exception 'MEDICAMENTO_CHECAGEM_BEIRA_LEITO_INCOMPLETA';
    end if;
    if p_dispensacao_id is null then
      raise exception 'MEDICAMENTO_DISPENSACAO_INVALIDA';
    end if;
    select * into v_d
    from public.dispensacoes_medicamentos
    where id = p_dispensacao_id;
    if not found or v_d.prescricao_id is distinct from p_prescricao_id or v_d.status not in ('dispensado','parcial') then
      raise exception 'MEDICAMENTO_DISPENSACAO_INVALIDA';
    end if;
  elsif coalesce(btrim(p_justificativa),'') = '' then
    raise exception 'JUSTIFICATIVA_OBRIGATORIA';
  elsif p_dispensacao_id is not null then
    select * into v_d
    from public.dispensacoes_medicamentos
    where id = p_dispensacao_id and prescricao_id = p_prescricao_id;
  end if;

  insert into public.administracoes_medicamentos (
    empresa_id,unidade_id,atendimento_id,prescricao_id,paciente_id,profissional_id,
    administrado_em,status,dose_administrada,via,lote,dupla_checagem,segundo_profissional_id,
    justificativa,dispensacao_id,produto_id,estoque_lote_id,codigo_barras_paciente,
    codigo_barras_medicamento,paciente_confirmado,medicamento_confirmado,dose_confirmada,
    via_confirmada,horario_confirmado,created_by,updated_by
  ) values (
    v_p.empresa_id,v_p.unidade_id,v_p.atendimento_id,v_p.id,v_p.paciente_id,v_prof,
    case when p_status='administrado' then now() else null end,p_status,p_dose,p_via,v_d.lote,
    p_dupla_checagem,p_segundo_profissional_id,p_justificativa,
    case when p_dispensacao_id is not null then v_d.id else null end,
    coalesce(v_d.produto_id,v_p.produto_id),v_d.estoque_lote_id,
    p_codigo_barras_paciente,p_codigo_barras_medicamento,p_paciente_confirmado,p_medicamento_confirmado,
    p_dose_confirmada,p_via_confirmada,p_horario_confirmado,auth.uid(),auth.uid()
  ) returning id into v_id;

  insert into public.prescricao_eventos(
    empresa_id,unidade_id,prescricao_id,atendimento_id,evento,detalhe,profissional_id,usuario_id
  ) values (
    v_p.empresa_id,v_p.unidade_id,v_p.id,v_p.atendimento_id,'administracao',
    jsonb_build_object('administracao_id',v_id,'status',p_status,'dose',p_dose,'via',p_via),
    v_prof,auth.uid()
  );

  return v_id;
end;
$$;

revoke all on function public.registrar_administracao_medicamento(uuid,uuid,text,text,text,text,text,text,boolean,boolean,boolean,boolean,boolean,boolean,uuid) from public,anon;
grant execute on function public.registrar_administracao_medicamento(uuid,uuid,text,text,text,text,text,text,boolean,boolean,boolean,boolean,boolean,boolean,uuid) to authenticated;

-- Repara prescricoes ja assinadas que ficaram invisiveis para a Enfermagem.
insert into public.prescricao_aprazamentos(
  empresa_id,unidade_id,atendimento_id,paciente_id,prescricao_id,programado_em,created_by
)
select
  p.empresa_id,
  p.unidade_id,
  p.atendimento_id,
  a.paciente_id,
  p.id,
  greatest(coalesce(p.inicio_em,p.assinado_em),p.assinado_em),
  p.created_by
from public.prescricoes p
join public.atendimentos a on a.id=p.atendimento_id
where p.tipo='medicamento'
  and p.status='ativa'
  and p.assinado_em is not null
  and not coalesce(p.se_necessario,false)
  and lower(regexp_replace(coalesce(p.frequencia,''),'[^a-zA-Z0-9]+','','g')) in ('doseunica','unica','imediata','agora','stat')
  and not exists (
    select 1 from public.prescricao_aprazamentos ap
    where ap.prescricao_id=p.id and ap.status<>'cancelado'
  )
  and not exists (
    select 1 from public.administracoes_medicamentos am
    where am.prescricao_id=p.id and am.status='administrado'
  )
on conflict(prescricao_id,programado_em) do nothing;
