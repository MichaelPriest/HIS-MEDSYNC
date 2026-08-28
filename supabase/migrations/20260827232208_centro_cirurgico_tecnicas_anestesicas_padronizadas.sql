begin;

create or replace function public.centro_cirurgico_salvar_anestesia_operacional(
  p_cirurgia_id uuid,
  p_tecnica text default null,
  p_asa text default null,
  p_via_aerea text default null,
  p_monitorizacao jsonb default '{}'::jsonb,
  p_medicamentos jsonb default '[]'::jsonb,
  p_fluidos jsonb default '[]'::jsonb,
  p_eventos jsonb default '[]'::jsonb,
  p_iniciar boolean default false,
  p_finalizar boolean default false,
  p_observacoes text default null
) returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog, extensions
as $$
declare
  v_c public.cirurgias%rowtype;
  v_a public.anestesia_registros%rowtype;
  v_prof uuid;
  v_tecnica text;
  v_norm text := lower(btrim(coalesce(p_tecnica,'')));
begin
  if auth.uid() is null then raise exception 'CC_AUTENTICACAO_OBRIGATORIA' using errcode='42501'; end if;
  select * into v_c from public.cirurgias where id=p_cirurgia_id for update;
  if not found then raise exception 'CC_CIRURGIA_NAO_LOCALIZADA'; end if;
  if not (public.tem_permissao(v_c.empresa_id,v_c.unidade_id,'centro_cirurgico.operar') or public.tem_permissao(v_c.empresa_id,v_c.unidade_id,'centro_cirurgico.gerenciar')) then raise exception 'CC_SEM_PERMISSAO_OPERAR' using errcode='42501'; end if;
  if v_c.status in ('concluida','cancelada') then raise exception 'CC_CIRURGIA_ENCERRADA'; end if;

  v_tecnica := case v_norm
    when '' then null
    when 'anestesia local' then 'Anestesia Local'
    when 'local' then 'Anestesia Local'
    when 'bloqueio de nervos periféricos' then 'Bloqueio de Nervos Periféricos'
    when 'bloqueio de nervos perifericos' then 'Bloqueio de Nervos Periféricos'
    when 'bloqueio periférico' then 'Bloqueio de Nervos Periféricos'
    when 'bloqueio periferico' then 'Bloqueio de Nervos Periféricos'
    when 'raquianestesia' then 'Raquianestesia'
    when 'raqui' then 'Raquianestesia'
    when 'anestesia peridural' then 'Anestesia Peridural'
    when 'peridural' then 'Anestesia Peridural'
    when 'anestesia geral' then 'Anestesia Geral'
    when 'geral' then 'Anestesia Geral'
    else null end;

  if v_norm <> '' and v_tecnica is null then
    raise exception 'CC_TECNICA_ANESTESICA_INVALIDA';
  end if;

  v_prof:=public.profissional_logado(v_c.empresa_id);
  if v_prof is null then raise exception 'CC_USUARIO_SEM_PROFISSIONAL'; end if;

  select * into v_a from public.anestesia_registros where cirurgia_id=v_c.id order by created_at desc limit 1 for update;
  if found then
    update public.anestesia_registros set
      anestesista_id=coalesce(anestesista_id,v_c.anestesista_id,v_prof),
      tecnica=v_tecnica,
      asa=nullif(btrim(p_asa),''),
      via_aerea=nullif(btrim(p_via_aerea),''),
      monitorizacao=coalesce(p_monitorizacao,'{}'::jsonb),
      medicamentos=coalesce(p_medicamentos,'[]'::jsonb),
      fluidos=coalesce(p_fluidos,'[]'::jsonb),
      eventos=coalesce(p_eventos,'[]'::jsonb),
      inicio_em=case when p_iniciar then coalesce(inicio_em,now()) else inicio_em end,
      fim_em=case when p_finalizar then coalesce(fim_em,now()) else fim_em end,
      observacoes=nullif(btrim(p_observacoes),''),
      updated_at=now(),updated_by=auth.uid()
    where id=v_a.id returning * into v_a;
  else
    insert into public.anestesia_registros(
      empresa_id,unidade_id,cirurgia_id,atendimento_id,anestesista_id,tecnica,asa,via_aerea,monitorizacao,medicamentos,fluidos,eventos,inicio_em,fim_em,observacoes,created_by,updated_by
    ) values (
      v_c.empresa_id,v_c.unidade_id,v_c.id,v_c.atendimento_id,coalesce(v_c.anestesista_id,v_prof),v_tecnica,nullif(btrim(p_asa),''),nullif(btrim(p_via_aerea),''),
      coalesce(p_monitorizacao,'{}'::jsonb),coalesce(p_medicamentos,'[]'::jsonb),coalesce(p_fluidos,'[]'::jsonb),coalesce(p_eventos,'[]'::jsonb),
      case when p_iniciar then now() else null end,case when p_finalizar then now() else null end,nullif(btrim(p_observacoes),''),auth.uid(),auth.uid()
    ) returning * into v_a;
  end if;

  insert into public.cirurgia_eventos(empresa_id,unidade_id,cirurgia_id,atendimento_id,tipo_evento,detalhes,profissional_id,created_by)
  values(v_c.empresa_id,v_c.unidade_id,v_c.id,v_c.atendimento_id,
    case when p_finalizar then 'anestesia_finalizada' when p_iniciar then 'anestesia_iniciada' else 'anestesia_atualizada' end,
    jsonb_build_object('anestesia_id',v_a.id,'tecnica',v_tecnica,'asa',p_asa),v_prof,auth.uid());
  return v_a.id;
end;
$$;

revoke all on function public.centro_cirurgico_salvar_anestesia_operacional(uuid,text,text,text,jsonb,jsonb,jsonb,jsonb,boolean,boolean,text) from public,anon;
grant execute on function public.centro_cirurgico_salvar_anestesia_operacional(uuid,text,text,text,jsonb,jsonb,jsonb,jsonb,boolean,boolean,text) to authenticated;

comment on function public.centro_cirurgico_salvar_anestesia_operacional(uuid,text,text,text,jsonb,jsonb,jsonb,jsonb,boolean,boolean,text)
is 'Registra anestesia do centro cirurgico; tecnica padronizada em Local, Bloqueio de Nervos Perifericos, Raquianestesia, Peridural ou Geral.';

commit;
