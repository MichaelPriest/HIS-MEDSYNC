alter table public.internacoes
  add column if not exists tipo_internacao_ans_codigo text;

comment on column public.internacoes.tipo_internacao_ans_codigo is
  'Domínio TISS/ANS de tipo de internação: 1 Clínica, 2 Cirúrgica, 3 Obstétrica, 4 Pediátrica, 5 Psiquiátrica.';

update public.internacoes
set tipo_internacao_ans_codigo = case
  when lower(extensions.unaccent(coalesce(tipo_internacao, ''))) ~ 'clin' then '1'
  when lower(extensions.unaccent(coalesce(tipo_internacao, ''))) ~ 'cirurg' then '2'
  when lower(extensions.unaccent(coalesce(tipo_internacao, ''))) ~ 'obst|parto|matern' then '3'
  when lower(extensions.unaccent(coalesce(tipo_internacao, ''))) ~ 'pediatr' then '4'
  when lower(extensions.unaccent(coalesce(tipo_internacao, ''))) ~ 'psiquiatr' then '5'
  else tipo_internacao_ans_codigo
end
where tipo_internacao_ans_codigo is null;

alter table public.internacoes
  drop constraint if exists internacoes_tipo_internacao_ans_codigo_check;

alter table public.internacoes
  add constraint internacoes_tipo_internacao_ans_codigo_check
  check (tipo_internacao_ans_codigo is null or tipo_internacao_ans_codigo in ('1','2','3','4','5'));

create or replace function public.centro_cirurgico_classificar_internacao_ans(
  p_atendimento_id uuid,
  p_codigo text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid;
  v_unidade_id uuid;
  v_internacao_id uuid;
  v_tipo text;
begin
  if v_user_id is null then raise exception 'Usuário não autenticado.'; end if;
  if p_codigo not in ('1','2','3','4','5') then raise exception 'Tipo de internação ANS inválido.'; end if;

  select i.id, i.empresa_id, i.unidade_id
    into v_internacao_id, v_empresa_id, v_unidade_id
  from public.internacoes i
  where i.atendimento_id = p_atendimento_id
    and i.status in ('aguardando_leito','internado','transferido')
  order by i.data_internacao desc
  limit 1
  for update;

  if v_internacao_id is null then
    raise exception 'O Centro Cirúrgico aceita somente paciente com internação ativa.';
  end if;
  if not public.tem_unidade(v_empresa_id, v_unidade_id) then raise exception 'Acesso negado à unidade.'; end if;
  if not public.tem_permissao(v_empresa_id, v_unidade_id, 'centro_cirurgico.operar')
     and not public.tem_permissao(v_empresa_id, v_unidade_id, 'centro_cirurgico.gerenciar') then
    raise exception 'Sem permissão para classificar a internação cirúrgica.';
  end if;

  v_tipo := case p_codigo
    when '1' then 'clinica'
    when '2' then 'cirurgica'
    when '3' then 'obstetrica'
    when '4' then 'pediatrica'
    when '5' then 'psiquiatrica'
  end;

  update public.internacoes
  set tipo_internacao_ans_codigo = p_codigo,
      tipo_internacao = v_tipo,
      updated_at = now(),
      updated_by = v_user_id
  where id = v_internacao_id;

  return v_internacao_id;
end;
$$;

revoke all on function public.centro_cirurgico_classificar_internacao_ans(uuid,text) from public, anon;
grant execute on function public.centro_cirurgico_classificar_internacao_ans(uuid,text) to authenticated;

create or replace function public.validar_cirurgia_paciente_internado()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if tg_op='INSERT' or new.atendimento_id is distinct from old.atendimento_id then
    if not exists(
      select 1 from public.internacoes i
      where i.atendimento_id=new.atendimento_id
        and i.empresa_id=new.empresa_id
        and i.unidade_id=new.unidade_id
        and i.status in ('aguardando_leito','internado','transferido')
        and i.tipo_internacao_ans_codigo in ('1','2','3','4','5')
    ) then
      raise exception 'CC_EXIGE_INTERNACAO_ATIVA_CLASSIFICADA_ANS';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.validar_cirurgia_paciente_internado() from public,anon,authenticated;

comment on function public.validar_cirurgia_paciente_internado() is
  'Impede agendamento no Centro Cirúrgico sem internação ativa e tipo de internação informado pelo domínio TISS/ANS.';
