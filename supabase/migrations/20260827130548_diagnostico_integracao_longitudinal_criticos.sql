-- Integração longitudinal e segurança operacional do pacote Laboratório + Imagem.
-- Aditiva: preserva assinaturas de RPCs existentes e reforça liberação de achados críticos.

alter table public.laboratorio_amostras
  add column if not exists setor_processamento text,
  add column if not exists bancada_processamento text;

create index if not exists laboratorio_amostras_unidade_setor_status_idx
  on public.laboratorio_amostras (unidade_id, setor_processamento, status)
  where status <> 'rejeitada';

alter table public.imagem_laudos
  add column if not exists achado_critico boolean not null default false,
  add column if not exists comunicacao_critica_em timestamptz,
  add column if not exists comunicada_a text,
  add column if not exists comunicacao_critica_meio text,
  add column if not exists comunicacao_critica_readback boolean not null default false,
  add column if not exists comunicacao_critica_por uuid references public.profissionais(id) on delete set null,
  add column if not exists comunicacao_critica_observacao text;

alter table public.imagem_laudos
  drop constraint if exists imagem_laudos_comunicacao_critica_check;

alter table public.imagem_laudos
  add constraint imagem_laudos_comunicacao_critica_check
  check (
    comunicacao_critica_em is null
    or (achado_critico and nullif(btrim(comunicada_a), '') is not null)
  );

create table if not exists public.imagem_comunicacoes_criticas (
  id uuid primary key default extensions.gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  unidade_id uuid not null references public.unidades(id),
  laudo_id uuid not null references public.imagem_laudos(id) on delete cascade,
  atendimento_id uuid not null references public.atendimentos(id) on delete cascade,
  comunicada_a text not null,
  meio text,
  readback boolean not null default false,
  observacao text,
  comunicada_em timestamptz not null default now(),
  comunicado_por uuid references public.profissionais(id) on delete set null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists imagem_comunicacoes_criticas_laudo_em_idx
  on public.imagem_comunicacoes_criticas (laudo_id, comunicada_em desc);
create index if not exists imagem_comunicacoes_criticas_atendimento_em_idx
  on public.imagem_comunicacoes_criticas (atendimento_id, comunicada_em desc);

alter table public.imagem_comunicacoes_criticas enable row level security;
alter table public.imagem_comunicacoes_criticas force row level security;

drop policy if exists imagem_comunicacoes_criticas_select on public.imagem_comunicacoes_criticas;
create policy imagem_comunicacoes_criticas_select
on public.imagem_comunicacoes_criticas
for select
to authenticated
using (
  public.tem_unidade(empresa_id, unidade_id)
  and (
    public.tem_permissao(empresa_id, unidade_id, 'imagem.visualizar')
    or public.tem_permissao(empresa_id, unidade_id, 'imagem.laudar')
    or (
      public.tem_permissao(empresa_id, unidade_id, 'prontuario.visualizar')
      and exists (
        select 1
        from public.imagem_laudos l
        where l.id = laudo_id and l.status = 'liberado'
      )
    )
  )
);

revoke all on table public.imagem_comunicacoes_criticas from anon;
revoke insert, update, delete on table public.imagem_comunicacoes_criticas from authenticated;
grant select on table public.imagem_comunicacoes_criticas to authenticated;

create or replace function public.encaminhar_amostra_laboratorio_operacional(
  p_amostra_id uuid,
  p_setor text,
  p_bancada text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog, extensions
as $function$
declare
  v_a public.laboratorio_amostras%rowtype;
  v_setor text := nullif(btrim(p_setor), '');
  v_bancada text := nullif(btrim(p_bancada), '');
begin
  if auth.uid() is null then
    raise exception 'LAB_AUTENTICACAO_OBRIGATORIA' using errcode='42501';
  end if;
  if v_setor is null then
    raise exception 'LAB_SETOR_OBRIGATORIO';
  end if;

  select * into v_a
  from public.laboratorio_amostras
  where id = p_amostra_id
  for update;

  if not found then raise exception 'LAB_AMOSTRA_NAO_LOCALIZADA'; end if;
  if not public.tem_permissao(v_a.empresa_id, v_a.unidade_id, 'laboratorio.coletar') then
    raise exception 'LAB_SEM_PERMISSAO_ENCAMINHAR' using errcode='42501';
  end if;
  if v_a.status = 'rejeitada' then raise exception 'LAB_AMOSTRA_REJEITADA'; end if;

  update public.laboratorio_amostras
  set setor_processamento = v_setor,
      bancada_processamento = v_bancada,
      cadeia_custodia = coalesce(cadeia_custodia, '[]'::jsonb) || jsonb_build_array(
        jsonb_build_object(
          'evento', 'encaminhamento_setor',
          'setor', v_setor,
          'bancada', v_bancada,
          'em', now(),
          'usuario_id', auth.uid()
        )
      ),
      updated_at = now(),
      updated_by = auth.uid()
  where id = v_a.id;

  return v_a.id;
end;
$function$;

revoke all on function public.encaminhar_amostra_laboratorio_operacional(uuid,text,text) from public, anon;
grant execute on function public.encaminhar_amostra_laboratorio_operacional(uuid,text,text) to authenticated;

create or replace function public.registrar_criticidade_laudo_imagem(
  p_laudo_id uuid,
  p_achado_critico boolean,
  p_comunicada_a text default null,
  p_meio text default null,
  p_readback boolean default false,
  p_observacao text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog, extensions
as $function$
declare
  v_l public.imagem_laudos%rowtype;
  v_prof uuid;
  v_destinatario text := nullif(btrim(p_comunicada_a), '');
  v_meio text := nullif(btrim(p_meio), '');
  v_observacao text := nullif(btrim(p_observacao), '');
  v_em timestamptz;
begin
  if auth.uid() is null then
    raise exception 'IMAGEM_AUTENTICACAO_OBRIGATORIA' using errcode='42501';
  end if;

  select * into v_l
  from public.imagem_laudos
  where id = p_laudo_id
  for update;

  if not found then raise exception 'IMAGEM_LAUDO_NAO_LOCALIZADO'; end if;
  if not public.tem_permissao(v_l.empresa_id, v_l.unidade_id, 'imagem.laudar') then
    raise exception 'IMAGEM_SEM_PERMISSAO_LAUDAR' using errcode='42501';
  end if;
  if v_l.status = 'liberado' then
    raise exception 'IMAGEM_LAUDO_LIBERADO_REQUER_RETIFICACAO';
  end if;

  if not coalesce(p_achado_critico, false) then
    update public.imagem_laudos
    set achado_critico = false,
        comunicacao_critica_em = null,
        comunicada_a = null,
        comunicacao_critica_meio = null,
        comunicacao_critica_readback = false,
        comunicacao_critica_por = null,
        comunicacao_critica_observacao = null,
        updated_at = now(),
        updated_by = auth.uid()
    where id = v_l.id;
    return v_l.id;
  end if;

  v_prof := public.profissional_logado(v_l.empresa_id);
  if v_destinatario is not null then
    if v_prof is null then raise exception 'IMAGEM_USUARIO_SEM_PROFISSIONAL'; end if;
    v_em := now();
    insert into public.imagem_comunicacoes_criticas(
      empresa_id, unidade_id, laudo_id, atendimento_id,
      comunicada_a, meio, readback, observacao, comunicada_em,
      comunicado_por, created_by
    ) values (
      v_l.empresa_id, v_l.unidade_id, v_l.id, v_l.atendimento_id,
      v_destinatario, v_meio, coalesce(p_readback,false), v_observacao, v_em,
      v_prof, auth.uid()
    );
  end if;

  update public.imagem_laudos
  set achado_critico = true,
      comunicacao_critica_em = v_em,
      comunicada_a = v_destinatario,
      comunicacao_critica_meio = v_meio,
      comunicacao_critica_readback = case when v_destinatario is null then false else coalesce(p_readback,false) end,
      comunicacao_critica_por = case when v_destinatario is null then null else v_prof end,
      comunicacao_critica_observacao = v_observacao,
      updated_at = now(),
      updated_by = auth.uid()
  where id = v_l.id;

  return v_l.id;
end;
$function$;

revoke all on function public.registrar_criticidade_laudo_imagem(uuid,boolean,text,text,boolean,text) from public, anon;
grant execute on function public.registrar_criticidade_laudo_imagem(uuid,boolean,text,text,boolean,text) to authenticated;

create or replace function public.liberar_laudo_imagem(p_laudo_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_catalog, extensions
as $function$
declare
  v_l public.imagem_laudos%rowtype;
  v_prof uuid;
  v_hash text;
  v_exec_status text;
begin
  if auth.uid() is null then
    raise exception 'IMAGEM_AUTENTICACAO_OBRIGATORIA' using errcode='42501';
  end if;

  select * into v_l from public.imagem_laudos where id=p_laudo_id for update;
  if not found then raise exception 'IMAGEM_LAUDO_NAO_LOCALIZADO'; end if;
  if not public.tem_permissao(v_l.empresa_id,v_l.unidade_id,'imagem.liberar_laudo') then raise exception 'IMAGEM_SEM_PERMISSAO' using errcode='42501'; end if;
  if v_l.status='liberado' then return v_l.assinatura_hash; end if;
  if coalesce(btrim(v_l.achados),'')='' and coalesce(btrim(v_l.conclusao),'')='' then raise exception 'IMAGEM_LAUDO_SEM_CONTEUDO'; end if;
  if v_l.achado_critico and (v_l.comunicacao_critica_em is null or nullif(btrim(v_l.comunicada_a),'') is null) then
    raise exception 'IMAGEM_CRITICO_SEM_COMUNICACAO';
  end if;
  if v_l.execucao_id is not null then
    select status into v_exec_status from public.imagem_execucoes where id=v_l.execucao_id;
    if coalesce(v_exec_status,'')<>'concluido' then raise exception 'IMAGEM_EXECUCAO_NAO_CONCLUIDA'; end if;
  end if;
  v_prof := public.profissional_logado(v_l.empresa_id);
  if v_prof is null then raise exception 'IMAGEM_USUARIO_SEM_PROFISSIONAL'; end if;
  insert into public.imagem_laudos_historico(empresa_id,unidade_id,laudo_id,atendimento_id,revisao,conteudo,motivo,criado_por)
  values(v_l.empresa_id,v_l.unidade_id,v_l.id,v_l.atendimento_id,v_l.revisao,to_jsonb(v_l),'liberacao',auth.uid())
  on conflict (laudo_id,revisao) do update set conteudo=excluded.conteudo,motivo=excluded.motivo,criado_em=now(),criado_por=excluded.criado_por;
  v_hash := encode(extensions.digest(convert_to(concat_ws('|',v_l.id,v_l.revisao,v_l.tecnica,v_l.achados,v_l.conclusao,v_l.recomendacoes,v_l.achado_critico,v_l.comunicacao_critica_em,v_l.comunicada_a,now()::text),'UTF8'),'sha256'),'hex');
  update public.imagem_laudos set status='liberado',laudo_por=v_prof,liberado_em=now(),assinatura_hash=v_hash,updated_at=now(),updated_by=auth.uid() where id=v_l.id;
  update public.solicitacoes_exames set status='liberado',resultado_resumo=coalesce(nullif(btrim(v_l.conclusao),''),nullif(btrim(v_l.achados),''),resultado_resumo),resultado_em=now(),updated_at=now(),updated_by=auth.uid() where id=v_l.solicitacao_id;
  return v_hash;
end;
$function$;

create or replace function public.abrir_retificacao_laudo_imagem(p_laudo_id uuid, p_motivo text)
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog, extensions
as $function$
declare v_l public.imagem_laudos%rowtype; v_nova integer;
begin
  if auth.uid() is null then raise exception 'IMAGEM_AUTENTICACAO_OBRIGATORIA' using errcode='42501'; end if;
  select * into v_l from public.imagem_laudos where id=p_laudo_id for update;
  if not found then raise exception 'IMAGEM_LAUDO_NAO_LOCALIZADO'; end if;
  if not public.tem_permissao(v_l.empresa_id,v_l.unidade_id,'imagem.liberar_laudo') then raise exception 'IMAGEM_SEM_PERMISSAO_RETIFICAR' using errcode='42501'; end if;
  if v_l.status<>'liberado' then raise exception 'IMAGEM_LAUDO_NAO_LIBERADO'; end if;
  if coalesce(btrim(p_motivo),'')='' then raise exception 'IMAGEM_MOTIVO_RETIFICACAO_OBRIGATORIO'; end if;
  insert into public.imagem_laudos_historico(empresa_id,unidade_id,laudo_id,atendimento_id,revisao,conteudo,motivo,criado_por)
  values(v_l.empresa_id,v_l.unidade_id,v_l.id,v_l.atendimento_id,v_l.revisao,to_jsonb(v_l),'retificacao: '||btrim(p_motivo),auth.uid())
  on conflict (laudo_id,revisao) do update set conteudo=excluded.conteudo,motivo=excluded.motivo,criado_em=now(),criado_por=excluded.criado_por;
  v_nova:=v_l.revisao+1;
  update public.imagem_laudos set
    revisao=v_nova,retificado=true,motivo_retificacao=btrim(p_motivo),status='rascunho',laudo_por=null,liberado_em=null,assinatura_hash=null,
    achado_critico=false,comunicacao_critica_em=null,comunicada_a=null,comunicacao_critica_meio=null,comunicacao_critica_readback=false,comunicacao_critica_por=null,comunicacao_critica_observacao=null,
    publicado_portal=false,publicado_em=null,updated_at=now(),updated_by=auth.uid()
  where id=v_l.id;
  update public.solicitacoes_exames set status='processamento',updated_at=now(),updated_by=auth.uid() where id=v_l.solicitacao_id;
  return v_nova;
end;
$function$;

-- Leitura longitudinal: somente conteúdo liberado pode ser lido por quem já possui prontuario.visualizar.
drop policy if exists laboratorio_laudos_select on public.laboratorio_laudos;
create policy laboratorio_laudos_select
on public.laboratorio_laudos
for select
to authenticated
using (
  public.tem_unidade(empresa_id, unidade_id)
  and (
    public.tem_permissao(empresa_id, unidade_id, 'laboratorio.visualizar')
    or public.tem_permissao(empresa_id, unidade_id, 'laboratorio.laudar')
    or public.tem_permissao(empresa_id, unidade_id, 'laboratorio.liberar')
    or (status = 'liberado' and public.tem_permissao(empresa_id, unidade_id, 'prontuario.visualizar'))
  )
);

drop policy if exists laboratorio_resultados_select on public.laboratorio_resultados;
create policy laboratorio_resultados_select
on public.laboratorio_resultados
for select
to authenticated
using (
  public.tem_unidade(empresa_id, unidade_id)
  and (
    public.tem_permissao(empresa_id, unidade_id, 'laboratorio.visualizar')
    or public.tem_permissao(empresa_id, unidade_id, 'laboratorio.resultar')
    or (liberado and public.tem_permissao(empresa_id, unidade_id, 'prontuario.visualizar'))
  )
);

drop policy if exists imagem_laudos_select on public.imagem_laudos;
create policy imagem_laudos_select
on public.imagem_laudos
for select
to authenticated
using (
  public.tem_unidade(empresa_id, unidade_id)
  and (
    public.tem_permissao(empresa_id, unidade_id, 'imagem.visualizar')
    or public.tem_permissao(empresa_id, unidade_id, 'imagem.laudar')
    or (status = 'liberado' and public.tem_permissao(empresa_id, unidade_id, 'prontuario.visualizar'))
  )
);
