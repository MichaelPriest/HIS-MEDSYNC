create table if not exists public.laboratorio_laudos (
  id uuid primary key default extensions.gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  unidade_id uuid not null references public.unidades(id),
  solicitacao_id uuid not null references public.solicitacoes_exames(id) on delete cascade,
  amostra_id uuid null references public.laboratorio_amostras(id) on delete set null,
  atendimento_id uuid not null references public.atendimentos(id),
  paciente_id uuid not null references public.pacientes(id),
  titulo text not null default 'Laudo laboratorial',
  material text null,
  metodo text null,
  corpo text null,
  conclusao text null,
  observacoes text null,
  status text not null default 'rascunho' check (status in ('rascunho','em_validacao','liberado','cancelado')),
  versao integer not null default 1 check (versao > 0),
  responsavel_tecnico_id uuid null references public.profissionais(id),
  digitado_por uuid null references auth.users(id),
  validado_por uuid null references public.profissionais(id),
  validado_em timestamptz null,
  liberado_por uuid null references public.profissionais(id),
  liberado_em timestamptz null,
  assinatura_hash text null,
  motivo_retificacao text null,
  publicado_portal boolean not null default false,
  publicado_em timestamptz null,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id),
  unique (solicitacao_id)
);

create table if not exists public.laboratorio_laudos_historico (
  id uuid primary key default extensions.gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  unidade_id uuid not null references public.unidades(id),
  laudo_id uuid not null references public.laboratorio_laudos(id) on delete cascade,
  atendimento_id uuid not null references public.atendimentos(id),
  versao integer not null,
  conteudo jsonb not null,
  motivo text null,
  criado_em timestamptz not null default now(),
  criado_por uuid null references auth.users(id)
);

create index if not exists laboratorio_laudos_unidade_status_idx on public.laboratorio_laudos(unidade_id,status,updated_at desc);
create index if not exists laboratorio_laudos_atendimento_idx on public.laboratorio_laudos(atendimento_id,liberado_em desc);
create index if not exists laboratorio_laudos_paciente_idx on public.laboratorio_laudos(paciente_id,liberado_em desc);
create index if not exists laboratorio_laudos_historico_laudo_idx on public.laboratorio_laudos_historico(laudo_id,versao desc);

insert into public.permissoes(codigo,descricao,ativo)
values ('laboratorio.laudar','Digitar e editar laudos laboratoriais',true)
on conflict(codigo) do update set descricao=excluded.descricao,ativo=true;

insert into public.perfil_permissoes(perfil_id,permissao_id,created_by)
select distinct pp.perfil_id,p_new.id,null::uuid
from public.perfil_permissoes pp
join public.permissoes p_old on p_old.id=pp.permissao_id and p_old.codigo='laboratorio.resultar'
join public.permissoes p_new on p_new.codigo='laboratorio.laudar'
on conflict(perfil_id,permissao_id) do nothing;

alter table public.laboratorio_laudos enable row level security;
alter table public.laboratorio_laudos_historico enable row level security;

drop policy if exists laboratorio_laudos_select on public.laboratorio_laudos;
create policy laboratorio_laudos_select on public.laboratorio_laudos for select to authenticated
using (
  public.tem_unidade(empresa_id,unidade_id)
  and (
    public.tem_permissao(empresa_id,unidade_id,'laboratorio.visualizar')
    or public.tem_permissao(empresa_id,unidade_id,'laboratorio.laudar')
    or public.tem_permissao(empresa_id,unidade_id,'laboratorio.liberar')
  )
);

drop policy if exists laboratorio_laudos_historico_select on public.laboratorio_laudos_historico;
create policy laboratorio_laudos_historico_select on public.laboratorio_laudos_historico for select to authenticated
using (
  public.tem_unidade(empresa_id,unidade_id)
  and (
    public.tem_permissao(empresa_id,unidade_id,'laboratorio.visualizar')
    or public.tem_permissao(empresa_id,unidade_id,'laboratorio.liberar')
  )
);

create or replace function public.salvar_laudo_laboratorio(
  p_solicitacao_id uuid,
  p_titulo text default null,
  p_material text default null,
  p_metodo text default null,
  p_corpo text default null,
  p_conclusao text default null,
  p_observacoes text default null
) returns uuid
language plpgsql
security definer
set search_path='public','pg_catalog','extensions'
as $$
declare
  v_sol record;
  v_paciente_id uuid;
  v_amostra uuid;
  v_laudo public.laboratorio_laudos%rowtype;
  v_id uuid;
begin
  select * into v_sol from public.solicitacoes_exames where id=p_solicitacao_id;
  if not found then raise exception 'LAB_SOLICITACAO_NAO_LOCALIZADA'; end if;
  if not public.tem_permissao(v_sol.empresa_id,v_sol.unidade_id,'laboratorio.laudar') then
    raise exception 'LAB_SEM_PERMISSAO_LAUDAR' using errcode='42501';
  end if;

  select paciente_id into v_paciente_id from public.atendimentos where id=v_sol.atendimento_id;
  if v_paciente_id is null then raise exception 'LAB_ATENDIMENTO_NAO_LOCALIZADO'; end if;

  select id into v_amostra
  from public.laboratorio_amostras
  where solicitacao_id=v_sol.id and status<>'rejeitada'
  order by created_at desc
  limit 1;

  select * into v_laudo from public.laboratorio_laudos where solicitacao_id=v_sol.id for update;
  if found then
    if v_laudo.status='liberado' then raise exception 'LAB_LAUDO_LIBERADO_REQUER_RETIFICACAO'; end if;
    update public.laboratorio_laudos set
      amostra_id=coalesce(v_amostra,amostra_id),
      titulo=coalesce(nullif(btrim(p_titulo),''),titulo),
      material=nullif(btrim(p_material),''),
      metodo=nullif(btrim(p_metodo),''),
      corpo=nullif(btrim(p_corpo),''),
      conclusao=nullif(btrim(p_conclusao),''),
      observacoes=nullif(btrim(p_observacoes),''),
      digitado_por=coalesce(digitado_por,auth.uid()),
      updated_at=now(),
      updated_by=auth.uid()
    where id=v_laudo.id
    returning id into v_id;
  else
    insert into public.laboratorio_laudos(
      empresa_id,unidade_id,solicitacao_id,amostra_id,atendimento_id,paciente_id,
      titulo,material,metodo,corpo,conclusao,observacoes,digitado_por,created_by,updated_by
    ) values (
      v_sol.empresa_id,v_sol.unidade_id,v_sol.id,v_amostra,v_sol.atendimento_id,v_paciente_id,
      coalesce(nullif(btrim(p_titulo),''),v_sol.exame),nullif(btrim(p_material),''),nullif(btrim(p_metodo),''),
      nullif(btrim(p_corpo),''),nullif(btrim(p_conclusao),''),nullif(btrim(p_observacoes),''),
      auth.uid(),auth.uid(),auth.uid()
    ) returning id into v_id;
  end if;
  return v_id;
end$$;

create or replace function public.abrir_retificacao_laudo_laboratorio(p_laudo_id uuid,p_motivo text)
returns integer
language plpgsql
security definer
set search_path='public','pg_catalog','extensions'
as $$
declare
  v_l public.laboratorio_laudos%rowtype;
  v_nova integer;
begin
  select * into v_l from public.laboratorio_laudos where id=p_laudo_id for update;
  if not found then raise exception 'LAB_LAUDO_NAO_LOCALIZADO'; end if;
  if not public.tem_permissao(v_l.empresa_id,v_l.unidade_id,'laboratorio.liberar') then
    raise exception 'LAB_SEM_PERMISSAO_RETIFICAR' using errcode='42501';
  end if;
  if v_l.status<>'liberado' then raise exception 'LAB_LAUDO_NAO_LIBERADO'; end if;
  if coalesce(btrim(p_motivo),'')='' then raise exception 'LAB_MOTIVO_RETIFICACAO_OBRIGATORIO'; end if;

  insert into public.laboratorio_laudos_historico(
    empresa_id,unidade_id,laudo_id,atendimento_id,versao,conteudo,motivo,criado_por
  ) values (
    v_l.empresa_id,v_l.unidade_id,v_l.id,v_l.atendimento_id,v_l.versao,to_jsonb(v_l),
    'retificacao: '||btrim(p_motivo),auth.uid()
  );

  v_nova:=v_l.versao+1;
  update public.laboratorio_laudos set
    status='rascunho',versao=v_nova,motivo_retificacao=btrim(p_motivo),
    validado_por=null,validado_em=null,liberado_por=null,liberado_em=null,assinatura_hash=null,
    publicado_portal=false,publicado_em=null,updated_at=now(),updated_by=auth.uid()
  where id=v_l.id;

  update public.solicitacoes_exames set
    status='processamento',updated_at=now(),updated_by=auth.uid()
  where id=v_l.solicitacao_id;

  return v_nova;
end$$;

create or replace function public.liberar_laudo_laboratorio(p_laudo_id uuid)
returns text
language plpgsql
security definer
set search_path='public','pg_catalog','extensions'
as $$
declare
  v_l public.laboratorio_laudos%rowtype;
  v_prof uuid;
  v_hash text;
  v_r public.laboratorio_resultados%rowtype;
  v_rversao integer;
begin
  select * into v_l from public.laboratorio_laudos where id=p_laudo_id for update;
  if not found then raise exception 'LAB_LAUDO_NAO_LOCALIZADO'; end if;
  if not public.tem_permissao(v_l.empresa_id,v_l.unidade_id,'laboratorio.liberar') then
    raise exception 'LAB_SEM_PERMISSAO_LIBERAR' using errcode='42501';
  end if;
  if v_l.status='liberado' then return v_l.assinatura_hash; end if;

  if coalesce(btrim(v_l.corpo),'')='' and coalesce(btrim(v_l.conclusao),'')=''
     and not exists(
       select 1 from public.laboratorio_resultados
       where solicitacao_id=v_l.solicitacao_id and coalesce(btrim(resultado),'')<>''
     ) then
    raise exception 'LAB_LAUDO_SEM_CONTEUDO';
  end if;

  if exists(
    select 1 from public.laboratorio_resultados
    where solicitacao_id=v_l.solicitacao_id and valor_critico and notificado_em is null
  ) then
    raise exception 'LAB_CRITICO_SEM_COMUNICACAO';
  end if;

  v_prof:=public.profissional_logado(v_l.empresa_id);
  if v_prof is null then raise exception 'LAB_USUARIO_SEM_PROFISSIONAL'; end if;

  v_hash:=encode(
    extensions.digest(
      convert_to(concat_ws('|',v_l.id,v_l.solicitacao_id,v_l.versao,v_l.titulo,v_l.material,v_l.metodo,v_l.corpo,v_l.conclusao,v_l.observacoes,now()::text),'UTF8'),
      'sha256'
    ),
    'hex'
  );

  insert into public.laboratorio_laudos_historico(
    empresa_id,unidade_id,laudo_id,atendimento_id,versao,conteudo,motivo,criado_por
  ) values (
    v_l.empresa_id,v_l.unidade_id,v_l.id,v_l.atendimento_id,v_l.versao,to_jsonb(v_l),'liberacao',auth.uid()
  );

  update public.laboratorio_laudos set
    status='liberado',responsavel_tecnico_id=v_prof,validado_por=v_prof,validado_em=now(),
    liberado_por=v_prof,liberado_em=now(),assinatura_hash=v_hash,updated_at=now(),updated_by=auth.uid()
  where id=v_l.id;

  for v_r in
    select * from public.laboratorio_resultados
    where solicitacao_id=v_l.solicitacao_id and not liberado
    for update
  loop
    select coalesce(max(versao),0)+1 into v_rversao
    from public.laboratorio_resultados_historico
    where resultado_id=v_r.id;

    insert into public.laboratorio_resultados_historico(
      empresa_id,unidade_id,resultado_id,atendimento_id,versao,conteudo,motivo,criado_por
    ) values (
      v_r.empresa_id,v_r.unidade_id,v_r.id,v_r.atendimento_id,v_rversao,to_jsonb(v_r),'liberacao_por_laudo',auth.uid()
    );

    update public.laboratorio_resultados set
      liberado=true,liberado_em=now(),liberado_por=v_prof,
      assinatura_hash=encode(extensions.digest(convert_to(v_hash||'|'||v_r.id::text,'UTF8'),'sha256'),'hex'),
      updated_at=now(),updated_by=auth.uid()
    where id=v_r.id;
  end loop;

  update public.solicitacoes_exames set
    status='liberado',
    resultado_resumo=coalesce(nullif(btrim(v_l.conclusao),''),nullif(btrim(v_l.corpo),''),resultado_resumo),
    resultado_em=now(),updated_at=now(),updated_by=auth.uid()
  where id=v_l.solicitacao_id;

  return v_hash;
end$$;

grant execute on function public.salvar_laudo_laboratorio(uuid,text,text,text,text,text,text) to authenticated;
grant execute on function public.abrir_retificacao_laudo_laboratorio(uuid,text) to authenticated;
grant execute on function public.liberar_laudo_laboratorio(uuid) to authenticated;
