create table if not exists public.contrato_homologacoes_comerciais (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.credenciamento_contratos(id) on delete cascade,
  data_referencia date not null,
  status text not null default 'homologado' check (status in ('homologado','revogado','substituido')),
  prontidao_snapshot jsonb not null default '[]'::jsonb,
  avisos_aceitos boolean not null default false,
  observacoes text,
  evento_corte_em timestamptz,
  homologado_em timestamptz not null default now(),
  homologado_por uuid references auth.users(id),
  revogado_em timestamptz,
  revogado_por uuid references auth.users(id),
  motivo_revogacao text,
  created_at timestamptz not null default now()
);

create unique index if not exists uq_contrato_homologacao_ativa
  on public.contrato_homologacoes_comerciais(contrato_id)
  where status='homologado';
create index if not exists idx_contrato_homologacoes_historico
  on public.contrato_homologacoes_comerciais(contrato_id,homologado_em desc);

alter table public.contrato_homologacoes_comerciais enable row level security;
alter table public.contrato_homologacoes_comerciais force row level security;

revoke all on table public.contrato_homologacoes_comerciais from public, anon, authenticated;
grant select on table public.contrato_homologacoes_comerciais to authenticated;

drop policy if exists contrato_homologacoes_select on public.contrato_homologacoes_comerciais;
create policy contrato_homologacoes_select
on public.contrato_homologacoes_comerciais
for select
to authenticated
using (
  exists (
    select 1
      from public.credenciamento_contratos c
     where c.id=contrato_homologacoes_comerciais.contrato_id
       and public.comercial_pode_visualizar(c.empresa_id,c.unidade_id)
  )
);

create or replace function public.comercial_ultima_mutacao_relevante_internal(p_contrato_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path=''
as $$
  with fontes as (
    select distinct t.fonte_id
      from public.contrato_tabelas_comerciais t
     where t.contrato_id=p_contrato_id
  ),
  edicoes as (
    select distinct e.id
      from public.tabelas_comerciais_edicoes e
      join fontes f on f.fonte_id=e.fonte_id
  )
  select max(ce.created_at)
    from public.comercial_eventos ce
   where ce.entidade_tipo <> 'contrato_homologacoes_comerciais'
     and (
       ce.contexto_contrato_id=p_contrato_id
       or (ce.entidade_tipo='tabelas_comerciais_fontes' and ce.entidade_id in (select fonte_id from fontes))
       or (ce.contexto_edicao_id is not null and ce.contexto_edicao_id in (select id from edicoes))
       or (ce.entidade_tipo='tabelas_comerciais_edicoes' and (
         ce.entidade_id in (select id from edicoes)
         or nullif(coalesce(ce.depois,ce.antes)->>'fonte_id','')::uuid in (select fonte_id from fontes)
       ))
     );
$$;

revoke all on function public.comercial_ultima_mutacao_relevante_internal(uuid) from public, anon, authenticated;
grant execute on function public.comercial_ultima_mutacao_relevante_internal(uuid) to postgres;

create or replace function public.comercial_status_homologacao(p_contrato_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_contrato public.credenciamento_contratos%rowtype;
  v_hom public.contrato_homologacoes_comerciais%rowtype;
  v_mutacao timestamptz;
  v_estado text;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode='42501';
  end if;

  select c.* into v_contrato
    from public.credenciamento_contratos c
   where c.id=p_contrato_id;
  if not found then raise exception 'CONTRATO_NAO_ENCONTRADO'; end if;
  if not public.comercial_pode_visualizar(v_contrato.empresa_id,v_contrato.unidade_id) then
    raise exception 'SEM_PERMISSAO_COMERCIAL' using errcode='42501';
  end if;

  select h.* into v_hom
    from public.contrato_homologacoes_comerciais h
   where h.contrato_id=p_contrato_id
   order by h.homologado_em desc,h.id desc
   limit 1;

  if not found then
    return jsonb_build_object('status','nao_homologado','contrato_id',p_contrato_id);
  end if;

  v_mutacao:=public.comercial_ultima_mutacao_relevante_internal(p_contrato_id);
  if v_hom.status='homologado' and v_mutacao is not null and v_mutacao>v_hom.homologado_em then
    v_estado:='desatualizado';
  else
    v_estado:=v_hom.status;
  end if;

  return jsonb_build_object(
    'status',v_estado,
    'homologacao_id',v_hom.id,
    'contrato_id',v_hom.contrato_id,
    'data_referencia',v_hom.data_referencia,
    'homologado_em',v_hom.homologado_em,
    'homologado_por',v_hom.homologado_por,
    'avisos_aceitos',v_hom.avisos_aceitos,
    'observacoes',v_hom.observacoes,
    'evento_corte_em',v_hom.evento_corte_em,
    'ultima_mutacao_relevante_em',v_mutacao,
    'revogado_em',v_hom.revogado_em,
    'motivo_revogacao',v_hom.motivo_revogacao,
    'prontidao_snapshot',v_hom.prontidao_snapshot
  );
end;
$$;

revoke all on function public.comercial_status_homologacao(uuid) from public, anon;
grant execute on function public.comercial_status_homologacao(uuid) to authenticated;

create or replace function public.comercial_homologar_contrato(
  p_contrato_id uuid,
  p_data date default null,
  p_aceitar_avisos boolean default false,
  p_observacoes text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_contrato public.credenciamento_contratos%rowtype;
  v_data date:=coalesce(p_data,current_date);
  v_snapshot jsonb;
  v_bloqueios integer:=0;
  v_avisos integer:=0;
  v_corte timestamptz;
  v_hom public.contrato_homologacoes_comerciais%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;

  select c.* into v_contrato from public.credenciamento_contratos c where c.id=p_contrato_id;
  if not found then raise exception 'CONTRATO_NAO_ENCONTRADO'; end if;
  if not public.comercial_pode_editar(v_contrato.empresa_id,v_contrato.unidade_id) then
    raise exception 'SEM_PERMISSAO_COMERCIAL' using errcode='42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'severidade',d.severidade,'codigo',d.codigo,'categoria',d.categoria,
    'mensagem',d.mensagem,'contexto',d.contexto
  ) order by case d.severidade when 'bloqueio' then 0 when 'aviso' then 1 else 2 end,d.codigo),'[]'::jsonb)
    into v_snapshot
    from public.comercial_prontidao_contrato(p_contrato_id,v_data) d;

  select count(*) filter(where x->>'severidade'='bloqueio'),
         count(*) filter(where x->>'severidade'='aviso')
    into v_bloqueios,v_avisos
    from jsonb_array_elements(v_snapshot) x;

  if v_bloqueios>0 then
    raise exception 'PRONTIDAO_COM_BLOQUEIOS: %',v_bloqueios;
  end if;
  if v_avisos>0 and not coalesce(p_aceitar_avisos,false) then
    raise exception 'AVISOS_PENDENTES_REQUEREM_ACEITE: %',v_avisos;
  end if;

  v_corte:=public.comercial_ultima_mutacao_relevante_internal(p_contrato_id);

  update public.contrato_homologacoes_comerciais
     set status='substituido'
   where contrato_id=p_contrato_id and status='homologado';

  insert into public.contrato_homologacoes_comerciais(
    contrato_id,data_referencia,status,prontidao_snapshot,avisos_aceitos,observacoes,
    evento_corte_em,homologado_em,homologado_por
  ) values (
    p_contrato_id,v_data,'homologado',v_snapshot,coalesce(p_aceitar_avisos,false),nullif(btrim(p_observacoes),''),
    v_corte,now(),auth.uid()
  ) returning * into v_hom;

  insert into public.comercial_eventos(
    empresa_id,unidade_id,entidade_tipo,entidade_id,acao,antes,depois,usuario_id,contexto_contrato_id,contexto_edicao_id
  ) values (
    v_contrato.empresa_id,v_contrato.unidade_id,'contrato_homologacoes_comerciais',v_hom.id,'homologar',null,to_jsonb(v_hom),auth.uid(),p_contrato_id,null
  );

  return jsonb_build_object(
    'status','homologado','homologacao_id',v_hom.id,'contrato_id',p_contrato_id,
    'data_referencia',v_data,'bloqueios',v_bloqueios,'avisos',v_avisos,
    'avisos_aceitos',v_hom.avisos_aceitos,'homologado_em',v_hom.homologado_em,
    'evento_corte_em',v_hom.evento_corte_em
  );
end;
$$;

revoke all on function public.comercial_homologar_contrato(uuid,date,boolean,text) from public, anon;
grant execute on function public.comercial_homologar_contrato(uuid,date,boolean,text) to authenticated;

create or replace function public.comercial_revogar_homologacao(
  p_homologacao_id uuid,
  p_motivo text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_hom public.contrato_homologacoes_comerciais%rowtype;
  v_contrato public.credenciamento_contratos%rowtype;
  v_antes jsonb;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if nullif(btrim(p_motivo),'') is null then raise exception 'MOTIVO_REVOGACAO_OBRIGATORIO'; end if;

  select h.* into v_hom
    from public.contrato_homologacoes_comerciais h
   where h.id=p_homologacao_id
   for update;
  if not found then raise exception 'HOMOLOGACAO_NAO_ENCONTRADA'; end if;

  select c.* into v_contrato from public.credenciamento_contratos c where c.id=v_hom.contrato_id;
  if not public.comercial_pode_editar(v_contrato.empresa_id,v_contrato.unidade_id) then
    raise exception 'SEM_PERMISSAO_COMERCIAL' using errcode='42501';
  end if;
  if v_hom.status<>'homologado' then raise exception 'HOMOLOGACAO_NAO_ATIVA'; end if;

  v_antes:=to_jsonb(v_hom);
  update public.contrato_homologacoes_comerciais
     set status='revogado',revogado_em=now(),revogado_por=auth.uid(),motivo_revogacao=btrim(p_motivo)
   where id=v_hom.id
   returning * into v_hom;

  insert into public.comercial_eventos(
    empresa_id,unidade_id,entidade_tipo,entidade_id,acao,antes,depois,usuario_id,contexto_contrato_id,contexto_edicao_id
  ) values (
    v_contrato.empresa_id,v_contrato.unidade_id,'contrato_homologacoes_comerciais',v_hom.id,'revogar',v_antes,to_jsonb(v_hom),auth.uid(),v_hom.contrato_id,null
  );

  return jsonb_build_object('status','revogado','homologacao_id',v_hom.id,'contrato_id',v_hom.contrato_id,'revogado_em',v_hom.revogado_em);
end;
$$;

revoke all on function public.comercial_revogar_homologacao(uuid,text) from public, anon;
grant execute on function public.comercial_revogar_homologacao(uuid,text) to authenticated;

comment on table public.contrato_homologacoes_comerciais is 'Histórico formal de homologação da configuração comercial. Uma homologação fica desatualizada quando há mutação relevante posterior no contrato ou em sua cadeia comercial.';
comment on function public.comercial_homologar_contrato(uuid,date,boolean,text) is 'Homologa criticamente um contrato somente após prontidão sem bloqueios; avisos exigem aceite explícito e ficam fotografados.';
comment on function public.comercial_status_homologacao(uuid) is 'Retorna homologação vigente, revogada, substituída, ausente ou desatualizada conforme mutações comerciais posteriores.';
