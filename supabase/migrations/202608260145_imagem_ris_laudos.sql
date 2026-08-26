alter table public.imagem_laudos add column if not exists motivo_retificacao text null;
alter table public.imagem_laudos add column if not exists publicado_portal boolean not null default false;
alter table public.imagem_laudos add column if not exists publicado_em timestamptz null;

create unique index if not exists imagem_laudos_execucao_unique
  on public.imagem_laudos(execucao_id)
  where execucao_id is not null;
create index if not exists imagem_laudos_unidade_status_idx
  on public.imagem_laudos(unidade_id,status,updated_at desc);
create index if not exists imagem_laudos_atendimento_idx
  on public.imagem_laudos(atendimento_id,liberado_em desc);

create or replace function public.salvar_laudo_imagem(
  p_execucao_id uuid,
  p_tecnica text default null,
  p_achados text default null,
  p_conclusao text default null,
  p_recomendacoes text default null
) returns uuid
language plpgsql
security definer
set search_path='public','pg_catalog','extensions'
as $$
declare
  v_exec public.imagem_execucoes%rowtype;
  v_laudo public.imagem_laudos%rowtype;
  v_id uuid;
begin
  select * into v_exec from public.imagem_execucoes where id=p_execucao_id;
  if not found then raise exception 'IMAGEM_EXECUCAO_NAO_LOCALIZADA'; end if;
  if not public.tem_permissao(v_exec.empresa_id,v_exec.unidade_id,'imagem.laudar') then
    raise exception 'IMAGEM_SEM_PERMISSAO_LAUDAR' using errcode='42501';
  end if;
  if v_exec.status <> 'concluido' then raise exception 'IMAGEM_EXECUCAO_NAO_CONCLUIDA'; end if;

  select * into v_laudo from public.imagem_laudos where execucao_id=v_exec.id for update;
  if found then
    if v_laudo.status='liberado' then raise exception 'IMAGEM_LAUDO_LIBERADO_REQUER_RETIFICACAO'; end if;
    update public.imagem_laudos set
      tecnica=nullif(btrim(p_tecnica),''),
      achados=nullif(btrim(p_achados),''),
      conclusao=nullif(btrim(p_conclusao),''),
      recomendacoes=nullif(btrim(p_recomendacoes),''),
      updated_at=now(),updated_by=auth.uid()
    where id=v_laudo.id
    returning id into v_id;
  else
    insert into public.imagem_laudos(
      empresa_id,unidade_id,solicitacao_id,execucao_id,atendimento_id,
      tecnica,achados,conclusao,recomendacoes,status,created_by,updated_by
    ) values (
      v_exec.empresa_id,v_exec.unidade_id,v_exec.solicitacao_id,v_exec.id,v_exec.atendimento_id,
      nullif(btrim(p_tecnica),''),nullif(btrim(p_achados),''),nullif(btrim(p_conclusao),''),nullif(btrim(p_recomendacoes),''),
      'rascunho',auth.uid(),auth.uid()
    ) returning id into v_id;
  end if;
  return v_id;
end$$;

create or replace function public.abrir_retificacao_laudo_imagem(p_laudo_id uuid,p_motivo text)
returns integer
language plpgsql
security definer
set search_path='public','pg_catalog','extensions'
as $$
declare
  v_l public.imagem_laudos%rowtype;
  v_nova integer;
begin
  select * into v_l from public.imagem_laudos where id=p_laudo_id for update;
  if not found then raise exception 'IMAGEM_LAUDO_NAO_LOCALIZADO'; end if;
  if not public.tem_permissao(v_l.empresa_id,v_l.unidade_id,'imagem.liberar_laudo') then
    raise exception 'IMAGEM_SEM_PERMISSAO_RETIFICAR' using errcode='42501';
  end if;
  if v_l.status<>'liberado' then raise exception 'IMAGEM_LAUDO_NAO_LIBERADO'; end if;
  if coalesce(btrim(p_motivo),'')='' then raise exception 'IMAGEM_MOTIVO_RETIFICACAO_OBRIGATORIO'; end if;

  insert into public.imagem_laudos_historico(
    empresa_id,unidade_id,laudo_id,atendimento_id,revisao,conteudo,motivo,criado_por
  ) values (
    v_l.empresa_id,v_l.unidade_id,v_l.id,v_l.atendimento_id,v_l.revisao,to_jsonb(v_l),
    'retificacao: '||btrim(p_motivo),auth.uid()
  )
  on conflict (laudo_id,revisao) do update set
    conteudo=excluded.conteudo,motivo=excluded.motivo,criado_em=now(),criado_por=excluded.criado_por;

  v_nova:=v_l.revisao+1;
  update public.imagem_laudos set
    revisao=v_nova,
    retificado=true,
    motivo_retificacao=btrim(p_motivo),
    status='rascunho',
    laudo_por=null,
    liberado_em=null,
    assinatura_hash=null,
    publicado_portal=false,
    publicado_em=null,
    updated_at=now(),
    updated_by=auth.uid()
  where id=v_l.id;

  update public.solicitacoes_exames set
    status='processamento',updated_at=now(),updated_by=auth.uid()
  where id=v_l.solicitacao_id;

  return v_nova;
end$$;

create or replace function public.liberar_laudo_imagem(p_laudo_id uuid)
returns text
language plpgsql
security definer
set search_path='public','pg_catalog','extensions'
as $$
declare
  v_l public.imagem_laudos%rowtype;
  v_prof uuid;
  v_hash text;
  v_exec_status text;
begin
  select * into v_l from public.imagem_laudos where id=p_laudo_id for update;
  if not found then raise exception 'IMAGEM_LAUDO_NAO_LOCALIZADO'; end if;
  if not public.tem_permissao(v_l.empresa_id,v_l.unidade_id,'imagem.liberar_laudo') then
    raise exception 'IMAGEM_SEM_PERMISSAO' using errcode='42501';
  end if;
  if v_l.status='liberado' then return v_l.assinatura_hash; end if;
  if coalesce(btrim(v_l.achados),'')='' and coalesce(btrim(v_l.conclusao),'')='' then
    raise exception 'IMAGEM_LAUDO_SEM_CONTEUDO';
  end if;

  if v_l.execucao_id is not null then
    select status into v_exec_status from public.imagem_execucoes where id=v_l.execucao_id;
    if coalesce(v_exec_status,'')<>'concluido' then raise exception 'IMAGEM_EXECUCAO_NAO_CONCLUIDA'; end if;
  end if;

  v_prof:=public.profissional_logado(v_l.empresa_id);
  if v_prof is null then raise exception 'IMAGEM_USUARIO_SEM_PROFISSIONAL'; end if;

  insert into public.imagem_laudos_historico(
    empresa_id,unidade_id,laudo_id,atendimento_id,revisao,conteudo,motivo,criado_por
  ) values (
    v_l.empresa_id,v_l.unidade_id,v_l.id,v_l.atendimento_id,v_l.revisao,to_jsonb(v_l),'liberacao',auth.uid()
  )
  on conflict (laudo_id,revisao) do update set
    conteudo=excluded.conteudo,motivo=excluded.motivo,criado_em=now(),criado_por=excluded.criado_por;

  v_hash:=encode(
    extensions.digest(
      convert_to(concat_ws('|',v_l.id,v_l.revisao,v_l.tecnica,v_l.achados,v_l.conclusao,v_l.recomendacoes,now()::text),'UTF8'),
      'sha256'
    ),
    'hex'
  );

  update public.imagem_laudos set
    status='liberado',laudo_por=v_prof,liberado_em=now(),assinatura_hash=v_hash,
    updated_at=now(),updated_by=auth.uid()
  where id=v_l.id;

  update public.solicitacoes_exames set
    status='liberado',
    resultado_resumo=coalesce(nullif(btrim(v_l.conclusao),''),nullif(btrim(v_l.achados),''),resultado_resumo),
    resultado_em=now(),updated_at=now(),updated_by=auth.uid()
  where id=v_l.solicitacao_id;

  return v_hash;
end$$;

grant execute on function public.salvar_laudo_imagem(uuid,text,text,text,text) to authenticated;
grant execute on function public.abrir_retificacao_laudo_imagem(uuid,text) to authenticated;
grant execute on function public.liberar_laudo_imagem(uuid) to authenticated;

revoke all on function public.salvar_laudo_imagem(uuid,text,text,text,text) from anon;
revoke all on function public.abrir_retificacao_laudo_imagem(uuid,text) from anon;
revoke all on function public.liberar_laudo_imagem(uuid) from anon;
