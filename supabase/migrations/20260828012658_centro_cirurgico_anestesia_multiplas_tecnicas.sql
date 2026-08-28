begin;

alter table public.anestesia_registros
  add column if not exists tecnicas text[] not null default '{}'::text[];

update public.anestesia_registros
set tecnicas = array[tecnica]
where tecnica is not null
  and btrim(tecnica) <> ''
  and cardinality(tecnicas) = 0;

drop function if exists public.centro_cirurgico_salvar_anestesia_operacional(uuid,text,text,text,jsonb,jsonb,jsonb,jsonb,boolean,boolean,text);

create or replace function public.centro_cirurgico_salvar_anestesia_operacional(
  p_cirurgia_id uuid,
  p_tecnicas text[] default '{}'::text[],
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
  v_tecnicas text[] := '{}'::text[];
  v_item text;
  v_normalizada text;
begin
  if auth.uid() is null then raise exception 'CC_AUTENTICACAO_OBRIGATORIA' using errcode='42501'; end if;
  if p_iniciar and p_finalizar then raise exception 'CC_ANESTESIA_ACAO_TEMPORAL_INVALIDA'; end if;

  select * into v_c from public.cirurgias where id=p_cirurgia_id for update;
  if not found then raise exception 'CC_CIRURGIA_NAO_LOCALIZADA'; end if;
  if not (public.tem_permissao(v_c.empresa_id,v_c.unidade_id,'centro_cirurgico.operar') or public.tem_permissao(v_c.empresa_id,v_c.unidade_id,'centro_cirurgico.gerenciar')) then
    raise exception 'CC_SEM_PERMISSAO_OPERAR' using errcode='42501';
  end if;
  if v_c.status in ('concluida','cancelada') then raise exception 'CC_CIRURGIA_ENCERRADA'; end if;

  foreach v_item in array coalesce(p_tecnicas,'{}'::text[]) loop
    v_normalizada := case lower(btrim(v_item))
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
    if v_normalizada is null then raise exception 'CC_TECNICA_ANESTESICA_INVALIDA: %', v_item; end if;
    if not v_normalizada = any(v_tecnicas) then v_tecnicas := array_append(v_tecnicas,v_normalizada); end if;
  end loop;

  if (p_iniciar or p_finalizar) and cardinality(v_tecnicas)=0 then raise exception 'CC_TECNICA_ANESTESICA_OBRIGATORIA'; end if;
  v_prof:=public.profissional_logado(v_c.empresa_id);
  if v_prof is null then raise exception 'CC_USUARIO_SEM_PROFISSIONAL'; end if;

  select * into v_a from public.anestesia_registros where cirurgia_id=v_c.id order by created_at desc limit 1 for update;
  if found then
    if v_a.fim_em is not null then raise exception 'CC_ANESTESIA_FINALIZADA_IMUTAVEL'; end if;
    if p_finalizar and v_a.inicio_em is null then raise exception 'CC_ANESTESIA_DEVE_SER_INICIADA'; end if;
    update public.anestesia_registros set
      anestesista_id=coalesce(anestesista_id,v_c.anestesista_id,v_prof),
      tecnica=v_tecnicas[1],tecnicas=v_tecnicas,
      asa=nullif(btrim(p_asa),''),via_aerea=nullif(btrim(p_via_aerea),''),
      monitorizacao=coalesce(p_monitorizacao,'{}'::jsonb),medicamentos=coalesce(p_medicamentos,'[]'::jsonb),
      fluidos=coalesce(p_fluidos,'[]'::jsonb),eventos=coalesce(p_eventos,'[]'::jsonb),
      inicio_em=case when p_iniciar then coalesce(inicio_em,clock_timestamp()) else inicio_em end,
      fim_em=case when p_finalizar then clock_timestamp() else fim_em end,
      observacoes=nullif(btrim(p_observacoes),''),updated_at=now(),updated_by=auth.uid()
    where id=v_a.id returning * into v_a;
  else
    if p_finalizar then raise exception 'CC_ANESTESIA_DEVE_SER_INICIADA'; end if;
    insert into public.anestesia_registros(
      empresa_id,unidade_id,cirurgia_id,atendimento_id,anestesista_id,tecnica,tecnicas,asa,via_aerea,
      monitorizacao,medicamentos,fluidos,eventos,inicio_em,fim_em,observacoes,created_by,updated_by
    ) values (
      v_c.empresa_id,v_c.unidade_id,v_c.id,v_c.atendimento_id,coalesce(v_c.anestesista_id,v_prof),v_tecnicas[1],v_tecnicas,
      nullif(btrim(p_asa),''),nullif(btrim(p_via_aerea),''),coalesce(p_monitorizacao,'{}'::jsonb),
      coalesce(p_medicamentos,'[]'::jsonb),coalesce(p_fluidos,'[]'::jsonb),coalesce(p_eventos,'[]'::jsonb),
      case when p_iniciar then clock_timestamp() else null end,null,nullif(btrim(p_observacoes),''),auth.uid(),auth.uid()
    ) returning * into v_a;
  end if;

  insert into public.cirurgia_eventos(empresa_id,unidade_id,cirurgia_id,atendimento_id,tipo_evento,detalhes,profissional_id,created_by)
  values(v_c.empresa_id,v_c.unidade_id,v_c.id,v_c.atendimento_id,
    case when p_finalizar then 'anestesia_finalizada' when p_iniciar then 'anestesia_iniciada' else 'anestesia_atualizada' end,
    jsonb_build_object('anestesia_id',v_a.id,'tecnicas',v_tecnicas,'asa',p_asa,'inicio_em',v_a.inicio_em,'fim_em',v_a.fim_em),v_prof,auth.uid());
  return v_a.id;
end;
$$;

revoke all on function public.centro_cirurgico_salvar_anestesia_operacional(uuid,text[],text,text,jsonb,jsonb,jsonb,jsonb,boolean,boolean,text) from public,anon;
grant execute on function public.centro_cirurgico_salvar_anestesia_operacional(uuid,text[],text,text,jsonb,jsonb,jsonb,jsonb,boolean,boolean,text) to authenticated;

comment on column public.anestesia_registros.tecnicas is 'Técnicas anestésicas combinadas utilizadas no mesmo ato.';
comment on function public.centro_cirurgico_salvar_anestesia_operacional(uuid,text[],text,text,jsonb,jsonb,jsonb,jsonb,boolean,boolean,text)
is 'Registra uma ou mais técnicas anestésicas e controla início e finalização em etapas distintas.';

commit;
