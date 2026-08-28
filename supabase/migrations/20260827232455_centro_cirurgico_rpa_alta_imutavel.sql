begin;

create or replace function public.centro_cirurgico_salvar_rpa_operacional(
  p_cirurgia_id uuid,
  p_aldrete_entrada numeric default null,
  p_aldrete_alta numeric default null,
  p_dor numeric default null,
  p_nauseas boolean default false,
  p_sinais_vitais jsonb default '{}'::jsonb,
  p_intercorrencias text default null,
  p_destino text default null,
  p_alta boolean default false
) returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog, extensions
as $$
declare
  v_c public.cirurgias%rowtype;
  v_r public.rpa_registros%rowtype;
  v_prof uuid;
begin
  if auth.uid() is null then raise exception 'CC_AUTENTICACAO_OBRIGATORIA' using errcode='42501'; end if;
  select * into v_c from public.cirurgias where id=p_cirurgia_id for update;
  if not found then raise exception 'CC_CIRURGIA_NAO_LOCALIZADA'; end if;
  if not (public.tem_permissao(v_c.empresa_id,v_c.unidade_id,'centro_cirurgico.operar') or public.tem_permissao(v_c.empresa_id,v_c.unidade_id,'centro_cirurgico.gerenciar')) then raise exception 'CC_SEM_PERMISSAO_OPERAR' using errcode='42501'; end if;
  if v_c.status='cancelada' then raise exception 'CC_CIRURGIA_CANCELADA'; end if;

  v_prof:=public.profissional_logado(v_c.empresa_id);
  if v_prof is null then raise exception 'CC_USUARIO_SEM_PROFISSIONAL'; end if;
  if p_alta and p_aldrete_alta is null then raise exception 'CC_RPA_ALDRETE_ALTA_OBRIGATORIO'; end if;

  select * into v_r from public.rpa_registros where cirurgia_id=v_c.id order by created_at desc limit 1 for update;
  if found and v_r.status='alta' and v_r.alta_em is not null then
    if p_alta then return v_r.id; end if;
    raise exception 'CC_RPA_ALTA_IMUTAVEL';
  end if;

  if found then
    update public.rpa_registros set
      aldrete_entrada=coalesce(p_aldrete_entrada,aldrete_entrada),
      aldrete_alta=p_aldrete_alta,
      dor=p_dor,
      nauseas=coalesce(p_nauseas,false),
      sinais_vitais=coalesce(p_sinais_vitais,'{}'::jsonb),
      intercorrencias=nullif(btrim(p_intercorrencias),''),
      destino=nullif(btrim(p_destino),''),
      profissional_id=v_prof,
      status=case when p_alta then 'alta' else 'em_rpa' end,
      alta_em=case when p_alta then coalesce(alta_em,now()) else alta_em end,
      updated_at=now(),updated_by=auth.uid()
    where id=v_r.id returning * into v_r;
  else
    insert into public.rpa_registros(
      empresa_id,unidade_id,cirurgia_id,atendimento_id,aldrete_entrada,aldrete_alta,dor,nauseas,sinais_vitais,
      intercorrencias,destino,profissional_id,status,alta_em,created_by,updated_by
    ) values (
      v_c.empresa_id,v_c.unidade_id,v_c.id,v_c.atendimento_id,p_aldrete_entrada,p_aldrete_alta,p_dor,coalesce(p_nauseas,false),
      coalesce(p_sinais_vitais,'{}'::jsonb),nullif(btrim(p_intercorrencias),''),nullif(btrim(p_destino),''),v_prof,
      case when p_alta then 'alta' else 'em_rpa' end,case when p_alta then now() else null end,auth.uid(),auth.uid()
    ) returning * into v_r;
  end if;

  insert into public.cirurgia_eventos(empresa_id,unidade_id,cirurgia_id,atendimento_id,tipo_evento,detalhes,profissional_id,created_by)
  values(v_c.empresa_id,v_c.unidade_id,v_c.id,v_c.atendimento_id,case when p_alta then 'rpa_alta' else 'rpa_atualizada' end,
    jsonb_build_object('rpa_id',v_r.id,'aldrete_entrada',p_aldrete_entrada,'aldrete_alta',p_aldrete_alta,'destino',p_destino),v_prof,auth.uid());
  return v_r.id;
end;
$$;

revoke all on function public.centro_cirurgico_salvar_rpa_operacional(uuid,numeric,numeric,numeric,boolean,jsonb,text,text,boolean) from public,anon;
grant execute on function public.centro_cirurgico_salvar_rpa_operacional(uuid,numeric,numeric,numeric,boolean,jsonb,text,text,boolean) to authenticated;

commit;
