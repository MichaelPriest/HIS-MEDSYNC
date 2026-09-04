alter table public.cirurgia_equipe
  add column if not exists origem_registro text not null default 'centro_cirurgico',
  add column if not exists confirmado_assistencial boolean not null default true,
  add column if not exists informado_faturamento_por uuid null references auth.users(id) on delete set null,
  add column if not exists informado_faturamento_em timestamptz null;

alter table public.cirurgia_equipe drop constraint if exists cirurgia_equipe_origem_registro_check;
alter table public.cirurgia_equipe add constraint cirurgia_equipe_origem_registro_check
  check (origem_registro in ('centro_cirurgico','faturamento'));

update public.cirurgia_equipe
set origem_registro='centro_cirurgico', confirmado_assistencial=true
where origem_registro is null;

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
language plpgsql security definer
set search_path to 'public','pg_catalog','extensions'
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
  v_origem_anterior text;
begin
  if auth.uid() is null then raise exception 'CC_AUTENTICACAO_OBRIGATORIA' using errcode='42501'; end if;
  select * into v_p from public.cirurgia_procedimentos where id=p_cirurgia_procedimento_id for update;
  if not found then raise exception 'CC_PROCEDIMENTO_NAO_LOCALIZADO'; end if;
  select * into v_c from public.cirurgias where id=v_p.cirurgia_id for update;
  if not (public.tem_permissao(v_c.empresa_id,v_c.unidade_id,'centro_cirurgico.operar') or public.tem_permissao(v_c.empresa_id,v_c.unidade_id,'centro_cirurgico.gerenciar')) then
    raise exception 'CC_SEM_PERMISSAO_OPERAR' using errcode='42501';
  end if;
  if v_c.status in ('concluida','cancelada') then raise exception 'CC_CIRURGIA_ENCERRADA'; end if;
  if v_role not in ('cirurgiao_principal','cirurgiao_auxiliar','anestesista','auxiliar_anestesia','instrumentador','pediatra','neonatologista','perfusionista','enfermeiro','tecnico_enfermagem','circulante_sala','tecnico_radiologia','outro') then raise exception 'CC_PAPEL_EQUIPE_INVALIDO'; end if;
  if v_role='cirurgiao_auxiliar' and coalesce(p_ordem,0) not between 1 and 4 then raise exception 'CC_ORDEM_AUXILIAR_INVALIDA'; end if;
  if v_role<>'cirurgiao_auxiliar' and p_ordem is not null then raise exception 'CC_ORDEM_RESTRITA_AUXILIAR'; end if;
  if not exists(select 1 from public.profissionais x where x.id=p_profissional_id and x.empresa_id=v_c.empresa_id and x.ativo) then raise exception 'CC_PROFISSIONAL_INVALIDO'; end if;

  v_req := coalesce(v_p.requisitos_equipe,'{}'::jsonb);
  v_aux := case when coalesce(v_req->>'quantidade_auxiliares','') ~ '^[0-9]+$' then (v_req->>'quantidade_auxiliares')::integer else 0 end;
  v_faturavel := case
    when v_role='cirurgiao_principal' then true
    when v_role='cirurgiao_auxiliar' then p_ordem <= v_aux
    when v_role='anestesista' then coalesce((v_req->>'anestesista')::boolean,false)
    when v_role='instrumentador' then coalesce((v_req->>'instrumentador')::boolean,true)
    when v_role='pediatra' then coalesce((v_req->>'pediatra')::boolean,false)
    when v_role='neonatologista' then coalesce((v_req->>'neonatologista')::boolean,false)
    else false end;

  select origem_registro into v_origem_anterior
  from public.cirurgia_equipe
  where cirurgia_procedimento_id=v_p.id and profissional_id=p_profissional_id and papel=v_role;

  insert into public.cirurgia_equipe(
    empresa_id,unidade_id,cirurgia_id,atendimento_id,cirurgia_procedimento_id,profissional_id,papel,principal,
    ordem_participacao,faturavel,entrada_em,saida_em,observacoes,created_by,origem_registro,confirmado_assistencial
  ) values (
    v_c.empresa_id,v_c.unidade_id,v_c.id,v_c.atendimento_id,v_p.id,p_profissional_id,v_role,coalesce(p_principal,false),
    p_ordem,v_faturavel,case when p_registrar_entrada then now() else null end,case when p_registrar_saida then now() else null end,
    nullif(btrim(p_observacoes),''),auth.uid(),'centro_cirurgico',true
  ) on conflict(cirurgia_procedimento_id,profissional_id,papel) where cirurgia_procedimento_id is not null and profissional_id is not null
  do update set principal=excluded.principal,ordem_participacao=excluded.ordem_participacao,faturavel=excluded.faturavel,
    entrada_em=case when p_registrar_entrada then coalesce(public.cirurgia_equipe.entrada_em,now()) else public.cirurgia_equipe.entrada_em end,
    saida_em=case when p_registrar_saida then coalesce(public.cirurgia_equipe.saida_em,now()) else public.cirurgia_equipe.saida_em end,
    observacoes=coalesce(excluded.observacoes,public.cirurgia_equipe.observacoes),
    origem_registro='centro_cirurgico',confirmado_assistencial=true
  returning id into v_id;

  v_prof_log := public.profissional_logado(v_c.empresa_id);
  insert into public.cirurgia_eventos(empresa_id,unidade_id,cirurgia_id,atendimento_id,tipo_evento,detalhes,profissional_id,created_by)
  values(v_c.empresa_id,v_c.unidade_id,v_c.id,v_c.atendimento_id,'equipe_procedimento_atualizada',
    jsonb_build_object('cirurgia_procedimento_id',v_p.id,'membro_id',v_id,'profissional_id',p_profissional_id,'papel',v_role,'ordem',p_ordem,'faturavel',v_faturavel,'entrada',p_registrar_entrada,'saida',p_registrar_saida,'origem_anterior',v_origem_anterior,'confirmado_assistencial',true),
    v_prof_log,auth.uid());
  return v_id;
end;
$$;

create or replace function public.faturamento_complementar_membro_equipe_cirurgica(
  p_conta_id uuid,
  p_cirurgia_procedimento_id uuid,
  p_profissional_id uuid,
  p_papel text,
  p_ordem integer default null,
  p_justificativa text default null
) returns jsonb
language plpgsql security definer
set search_path to 'public','pg_catalog','extensions'
as $$
declare
  v_user uuid:=auth.uid();
  v_conta public.contas_faturamento%rowtype;
  v_proc public.cirurgia_procedimentos%rowtype;
  v_cir public.cirurgias%rowtype;
  v_role text:=lower(coalesce(btrim(p_papel),''));
  v_req jsonb;
  v_aux integer:=0;
  v_faturavel boolean:=false;
  v_id uuid;
  v_sync jsonb;
begin
  if v_user is null then raise exception 'FAT_EQUIPE_AUTENTICACAO_OBRIGATORIA' using errcode='42501'; end if;
  select * into v_conta from public.contas_faturamento where id=p_conta_id for update;
  if not found then raise exception 'FAT_EQUIPE_CONTA_NAO_LOCALIZADA'; end if;
  if not public.tem_unidade(v_conta.empresa_id,v_conta.unidade_id) or not public.tem_permissao(v_conta.empresa_id,v_conta.unidade_id,'faturamento.criar') then raise exception 'FAT_EQUIPE_SEM_PERMISSAO' using errcode='42501'; end if;
  if v_conta.status in ('faturada','cancelada') then raise exception 'FAT_EQUIPE_CONTA_NAO_EDITAVEL'; end if;
  if exists(select 1 from public.tiss_guias g where g.conta_id=v_conta.id and g.status<>'cancelada') then raise exception 'FAT_EQUIPE_GUIA_TISS_ATIVA'; end if;
  if nullif(btrim(coalesce(p_justificativa,'')),'') is null then raise exception 'FAT_EQUIPE_JUSTIFICATIVA_OBRIGATORIA'; end if;

  select * into v_proc from public.cirurgia_procedimentos where id=p_cirurgia_procedimento_id;
  if not found or v_proc.atendimento_id<>v_conta.atendimento_id then raise exception 'FAT_EQUIPE_PROCEDIMENTO_INCOMPATIVEL'; end if;
  select * into v_cir from public.cirurgias where id=v_proc.cirurgia_id;
  if not found then raise exception 'FAT_EQUIPE_CIRURGIA_NAO_LOCALIZADA'; end if;

  if v_role not in ('cirurgiao_principal','cirurgiao_auxiliar','anestesista','auxiliar_anestesia','instrumentador','pediatra','neonatologista','perfusionista','enfermeiro','tecnico_enfermagem','circulante_sala','tecnico_radiologia','outro') then raise exception 'FAT_EQUIPE_PAPEL_INVALIDO'; end if;
  if v_role='cirurgiao_auxiliar' and coalesce(p_ordem,0) not between 1 and 4 then raise exception 'FAT_EQUIPE_ORDEM_AUXILIAR_INVALIDA'; end if;
  if v_role<>'cirurgiao_auxiliar' and p_ordem is not null then raise exception 'FAT_EQUIPE_ORDEM_RESTRITA_AUXILIAR'; end if;
  if not exists(select 1 from public.profissionais p where p.id=p_profissional_id and p.empresa_id=v_conta.empresa_id and p.ativo) then raise exception 'FAT_EQUIPE_PROFISSIONAL_INVALIDO'; end if;

  v_req:=coalesce(v_proc.requisitos_equipe,'{}'::jsonb);
  v_aux:=case when coalesce(v_req->>'quantidade_auxiliares','')~'^[0-9]+$' then (v_req->>'quantidade_auxiliares')::integer else 0 end;
  v_faturavel:=case
    when v_role='cirurgiao_principal' then true
    when v_role='cirurgiao_auxiliar' then p_ordem<=v_aux
    when v_role='anestesista' then coalesce((v_req->>'anestesista')::boolean,false)
    when v_role='instrumentador' then coalesce((v_req->>'instrumentador')::boolean,true)
    when v_role='pediatra' then coalesce((v_req->>'pediatra')::boolean,false)
    when v_role='neonatologista' then coalesce((v_req->>'neonatologista')::boolean,false)
    else false end;

  insert into public.cirurgia_equipe(
    empresa_id,unidade_id,cirurgia_id,atendimento_id,cirurgia_procedimento_id,profissional_id,papel,principal,
    ordem_participacao,faturavel,observacoes,created_by,origem_registro,confirmado_assistencial,informado_faturamento_por,informado_faturamento_em
  ) values (
    v_conta.empresa_id,v_conta.unidade_id,v_proc.cirurgia_id,v_conta.atendimento_id,v_proc.id,p_profissional_id,v_role,v_role='cirurgiao_principal',
    p_ordem,v_faturavel,concat('Complemento do faturamento: ',btrim(p_justificativa)),v_user,'faturamento',false,v_user,now()
  ) on conflict(cirurgia_procedimento_id,profissional_id,papel) where cirurgia_procedimento_id is not null and profissional_id is not null
  do update set
    ordem_participacao=coalesce(excluded.ordem_participacao,public.cirurgia_equipe.ordem_participacao),
    faturavel=excluded.faturavel,
    observacoes=case when public.cirurgia_equipe.confirmado_assistencial then public.cirurgia_equipe.observacoes else excluded.observacoes end,
    origem_registro=case when public.cirurgia_equipe.confirmado_assistencial then public.cirurgia_equipe.origem_registro else 'faturamento' end,
    confirmado_assistencial=public.cirurgia_equipe.confirmado_assistencial,
    informado_faturamento_por=coalesce(public.cirurgia_equipe.informado_faturamento_por,v_user),
    informado_faturamento_em=coalesce(public.cirurgia_equipe.informado_faturamento_em,now())
  returning id into v_id;

  insert into public.cirurgia_eventos(empresa_id,unidade_id,cirurgia_id,atendimento_id,tipo_evento,detalhes,created_by)
  values(v_conta.empresa_id,v_conta.unidade_id,v_proc.cirurgia_id,v_conta.atendimento_id,'equipe_complementada_faturamento',
    jsonb_build_object('conta_id',v_conta.id,'cirurgia_procedimento_id',v_proc.id,'membro_id',v_id,'profissional_id',p_profissional_id,'papel',v_role,'ordem',p_ordem,'faturavel',v_faturavel,'confirmado_assistencial',false,'justificativa',btrim(p_justificativa)),v_user);

  v_sync:=public.faturamento_sincronizar_equipe_cirurgica(v_conta.id,v_proc.id);
  return jsonb_build_object('status','ok','membro_id',v_id,'origem','faturamento','confirmado_assistencial',false,'sincronizacao',v_sync);
end;
$$;

revoke all on function public.faturamento_complementar_membro_equipe_cirurgica(uuid,uuid,uuid,text,integer,text) from public,anon;
grant execute on function public.faturamento_complementar_membro_equipe_cirurgica(uuid,uuid,uuid,text,integer,text) to authenticated;
