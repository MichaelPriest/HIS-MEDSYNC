create or replace function public.centro_cirurgico_salvar_membro_equipe_operacional(
  p_cirurgia_procedimento_id uuid,
  p_profissional_id uuid,
  p_papel text,
  p_ordem integer default null,
  p_principal boolean default false,
  p_registrar_entrada boolean default false,
  p_registrar_saida boolean default false,
  p_observacoes text default null
) returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog, extensions
as $$
declare
  v_p public.cirurgia_procedimentos%rowtype;
  v_c public.cirurgias%rowtype;
  v_role text := lower(coalesce(btrim(p_papel),''));
  v_id uuid;
  v_req jsonb;
  v_aux integer;
  v_faturavel boolean := false;
  v_prof_log uuid;
begin
  if auth.uid() is null then raise exception 'CC_AUTENTICACAO_OBRIGATORIA' using errcode='42501'; end if;
  select * into v_p from public.cirurgia_procedimentos where id=p_cirurgia_procedimento_id for update;
  if not found then raise exception 'CC_PROCEDIMENTO_NAO_LOCALIZADO'; end if;
  select * into v_c from public.cirurgias where id=v_p.cirurgia_id for update;
  if not (public.tem_permissao(v_c.empresa_id,v_c.unidade_id,'centro_cirurgico.operar') or public.tem_permissao(v_c.empresa_id,v_c.unidade_id,'centro_cirurgico.gerenciar')) then raise exception 'CC_SEM_PERMISSAO_OPERAR' using errcode='42501'; end if;
  if v_c.status in ('concluida','cancelada') then raise exception 'CC_CIRURGIA_ENCERRADA'; end if;
  if v_role not in (
    'cirurgiao_principal','cirurgiao_auxiliar','anestesista','auxiliar_anestesia',
    'instrumentador','pediatra','neonatologista','perfusionista','enfermeiro',
    'tecnico_enfermagem','circulante_sala','tecnico_radiologia','outro'
  ) then raise exception 'CC_PAPEL_EQUIPE_INVALIDO'; end if;
  if v_role='cirurgiao_auxiliar' and coalesce(p_ordem,0) not between 1 and 4 then raise exception 'CC_ORDEM_AUXILIAR_INVALIDA'; end if;
  if v_role<>'cirurgiao_auxiliar' and p_ordem is not null then raise exception 'CC_ORDEM_RESTRITA_AUXILIAR'; end if;
  if not exists(select 1 from public.profissionais x where x.id=p_profissional_id and x.empresa_id=v_c.empresa_id and x.ativo) then raise exception 'CC_PROFISSIONAL_INVALIDO'; end if;

  v_req := coalesce(v_p.requisitos_equipe,'{}'::jsonb);
  v_aux := case when coalesce(v_req->>'quantidade_auxiliares','') ~ '^[0-9]+$' then (v_req->>'quantidade_auxiliares')::integer else 0 end;
  v_faturavel := case
    when v_role='cirurgiao_principal' then true
    when v_role='cirurgiao_auxiliar' then p_ordem <= v_aux
    when v_role='anestesista' then coalesce((v_req->>'anestesista')::boolean,false)
    when v_role='pediatra' then coalesce((v_req->>'pediatra')::boolean,false)
    when v_role='neonatologista' then coalesce((v_req->>'neonatologista')::boolean,false)
    else false end;

  insert into public.cirurgia_equipe(
    empresa_id,unidade_id,cirurgia_id,atendimento_id,cirurgia_procedimento_id,profissional_id,papel,principal,
    ordem_participacao,faturavel,entrada_em,saida_em,observacoes,created_by
  ) values (
    v_c.empresa_id,v_c.unidade_id,v_c.id,v_c.atendimento_id,v_p.id,p_profissional_id,v_role,coalesce(p_principal,false),
    p_ordem,v_faturavel,case when p_registrar_entrada then now() else null end,case when p_registrar_saida then now() else null end,
    nullif(btrim(p_observacoes),''),auth.uid()
  ) on conflict(cirurgia_procedimento_id,profissional_id,papel) where cirurgia_procedimento_id is not null and profissional_id is not null
  do update set principal=excluded.principal,ordem_participacao=excluded.ordem_participacao,faturavel=excluded.faturavel,
    entrada_em=case when p_registrar_entrada then coalesce(public.cirurgia_equipe.entrada_em,now()) else public.cirurgia_equipe.entrada_em end,
    saida_em=case when p_registrar_saida then coalesce(public.cirurgia_equipe.saida_em,now()) else public.cirurgia_equipe.saida_em end,
    observacoes=coalesce(excluded.observacoes,public.cirurgia_equipe.observacoes)
  returning id into v_id;

  v_prof_log := public.profissional_logado(v_c.empresa_id);
  insert into public.cirurgia_eventos(empresa_id,unidade_id,cirurgia_id,atendimento_id,tipo_evento,detalhes,profissional_id,created_by)
  values(v_c.empresa_id,v_c.unidade_id,v_c.id,v_c.atendimento_id,'equipe_procedimento_atualizada',jsonb_build_object('cirurgia_procedimento_id',v_p.id,'membro_id',v_id,'profissional_id',p_profissional_id,'papel',v_role,'ordem',p_ordem,'faturavel',v_faturavel,'entrada',p_registrar_entrada,'saida',p_registrar_saida),v_prof_log,auth.uid());
  return v_id;
end;
$$;

revoke all on function public.centro_cirurgico_salvar_membro_equipe_operacional(uuid,uuid,text,integer,boolean,boolean,boolean,text) from public,anon;
grant execute on function public.centro_cirurgico_salvar_membro_equipe_operacional(uuid,uuid,text,integer,boolean,boolean,boolean,text) to authenticated;

comment on function public.centro_cirurgico_salvar_membro_equipe_operacional(uuid,uuid,text,integer,boolean,boolean,boolean,text) is
  'Registra equipe por procedimento, incluindo quatro auxiliares e participantes clínicos/técnicos da sala; faturabilidade continua derivada da tabela contratada.';

create or replace function public.centro_cirurgico_movimentar_para_ala_operacional(
  p_cirurgia_id uuid,
  p_leito_destino_id uuid,
  p_motivo text default null
) returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog, extensions
as $$
declare
  v_c public.cirurgias%rowtype;
  v_i public.internacoes%rowtype;
  v_l public.leitos%rowtype;
  v_mov uuid;
  v_prof uuid;
begin
  if auth.uid() is null then raise exception 'CC_AUTENTICACAO_OBRIGATORIA' using errcode='42501'; end if;
  select * into v_c from public.cirurgias where id=p_cirurgia_id for update;
  if not found then raise exception 'CC_CIRURGIA_NAO_LOCALIZADA'; end if;
  if not public.tem_permissao(v_c.empresa_id,v_c.unidade_id,'internacao.movimentar') then
    raise exception 'CC_SEM_PERMISSAO_MOVIMENTAR_ALA' using errcode='42501';
  end if;
  if not exists(select 1 from public.rpa_registros r where r.cirurgia_id=v_c.id and r.status='alta' and r.alta_em is not null) then
    raise exception 'CC_RPA_DEVE_TER_ALTA';
  end if;
  select * into v_i from public.internacoes i
   where i.atendimento_id=v_c.atendimento_id and i.status in ('aguardando_leito','internado','transferido')
   order by i.created_at desc limit 1 for update;
  if not found then raise exception 'CC_INTERNACAO_ATIVA_NAO_LOCALIZADA'; end if;
  select * into v_l from public.leitos where id=p_leito_destino_id;
  if not found or v_l.empresa_id<>v_c.empresa_id or v_l.unidade_id<>v_c.unidade_id then raise exception 'CC_LEITO_DESTINO_INVALIDO'; end if;

  v_mov := public.movimentar_internacao_leito(v_i.id,v_l.id,coalesce(nullif(btrim(p_motivo),''),'Transferência pós-operatória do Centro Cirúrgico para a ala'));
  update public.rpa_registros set destino=concat_ws(' · ',v_l.setor,v_l.quarto,v_l.codigo),updated_at=now(),updated_by=auth.uid()
   where cirurgia_id=v_c.id;
  update public.atendimentos set setor_atual=coalesce(nullif(v_l.setor,''),'internacao'),ultima_movimentacao_em=now(),updated_at=now(),updated_by=auth.uid()
   where id=v_c.atendimento_id;
  v_prof:=public.profissional_logado(v_c.empresa_id);
  insert into public.cirurgia_eventos(empresa_id,unidade_id,cirurgia_id,atendimento_id,tipo_evento,detalhes,profissional_id,created_by)
  values(v_c.empresa_id,v_c.unidade_id,v_c.id,v_c.atendimento_id,'movimentacao_para_ala',
    jsonb_build_object('movimentacao_id',v_mov,'internacao_id',v_i.id,'leito_destino_id',v_l.id,'setor',v_l.setor,'quarto',v_l.quarto,'leito',v_l.codigo),
    v_prof,auth.uid());
  return v_mov;
end;
$$;

revoke all on function public.centro_cirurgico_movimentar_para_ala_operacional(uuid,uuid,text) from public,anon;
grant execute on function public.centro_cirurgico_movimentar_para_ala_operacional(uuid,uuid,text) to authenticated;

comment on function public.centro_cirurgico_movimentar_para_ala_operacional(uuid,uuid,text) is
  'Movimenta o mesmo atendimento/RA da alta da RPA para leito da ala usando a rotina transacional da internação.';

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
    ) then raise exception 'CC_PACIENTE_DEVE_ESTAR_INTERNADO'; end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validar_cirurgia_paciente_internado on public.cirurgias;
create trigger trg_validar_cirurgia_paciente_internado
before insert or update of atendimento_id on public.cirurgias
for each row execute function public.validar_cirurgia_paciente_internado();

revoke all on function public.validar_cirurgia_paciente_internado() from public,anon,authenticated;

comment on function public.validar_cirurgia_paciente_internado() is
  'Impede agendamento no Centro Cirúrgico para atendimento sem internação ativa na mesma empresa e unidade.';
