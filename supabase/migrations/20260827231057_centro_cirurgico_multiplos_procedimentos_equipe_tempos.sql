begin;

create table if not exists public.cirurgia_procedimentos (
  id uuid primary key default extensions.gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  unidade_id uuid not null references public.unidades(id),
  cirurgia_id uuid not null references public.cirurgias(id) on delete cascade,
  atendimento_id uuid not null references public.atendimentos(id) on delete cascade,
  contrato_id uuid null references public.credenciamento_contratos(id),
  tabela_item_id uuid null references public.tabelas_comerciais_itens(id),
  codigo text null,
  codigo_tuss text null,
  descricao text not null,
  porte text null,
  porte_anestesico text null,
  tabela_referencia text null,
  requisitos_equipe jsonb not null default '{}'::jsonb,
  sequencia integer not null default 1 check (sequencia > 0),
  principal boolean not null default false,
  status text not null default 'previsto' check (status in ('previsto','em_andamento','concluido','cancelado')),
  inicio_em timestamptz null,
  fim_em timestamptz null,
  observacoes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id),
  updated_by uuid null references auth.users(id)
);

create index if not exists idx_cirurgia_procedimentos_cirurgia on public.cirurgia_procedimentos(cirurgia_id,sequencia);
create index if not exists idx_cirurgia_procedimentos_atendimento on public.cirurgia_procedimentos(atendimento_id,created_at desc);
create index if not exists idx_cirurgia_procedimentos_tabela_item on public.cirurgia_procedimentos(tabela_item_id) where tabela_item_id is not null;
create unique index if not exists ux_cirurgia_procedimento_principal on public.cirurgia_procedimentos(cirurgia_id) where principal;

alter table public.cirurgia_equipe add column if not exists cirurgia_procedimento_id uuid null references public.cirurgia_procedimentos(id) on delete cascade;
alter table public.cirurgia_equipe add column if not exists ordem_participacao integer null;
alter table public.cirurgia_equipe add column if not exists faturavel boolean not null default false;
alter table public.cirurgia_equipe add column if not exists observacoes text null;
alter table public.cirurgia_tempos add column if not exists cirurgia_procedimento_id uuid null references public.cirurgia_procedimentos(id) on delete cascade;

create index if not exists idx_cirurgia_equipe_procedimento on public.cirurgia_equipe(cirurgia_procedimento_id,created_at) where cirurgia_procedimento_id is not null;
create index if not exists idx_cirurgia_tempos_procedimento on public.cirurgia_tempos(cirurgia_procedimento_id,ocorrido_em) where cirurgia_procedimento_id is not null;
create unique index if not exists ux_cirurgia_equipe_proc_prof_papel on public.cirurgia_equipe(cirurgia_procedimento_id,profissional_id,papel) where cirurgia_procedimento_id is not null and profissional_id is not null;

create or replace function public.centro_cirurgico_requisitos_equipe_item(p_tabela_item_id uuid, p_descricao text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_item public.tabelas_comerciais_itens%rowtype;
  v_desc text := lower(coalesce(p_descricao,''));
  v_aux integer := 0;
  v_anestesista boolean := false;
  v_instrumentador boolean := true;
  v_pediatra boolean := false;
  v_neonatal boolean := false;
begin
  if p_tabela_item_id is not null then
    select * into v_item from public.tabelas_comerciais_itens where id=p_tabela_item_id;
    if found then
      v_desc := lower(coalesce(v_item.descricao,p_descricao,''));
      if coalesce(v_item.metadata->>'quantidade_aux','') ~ '^[0-9]+$' then
        v_aux := greatest(0, least((v_item.metadata->>'quantidade_aux')::integer, 8));
      end if;
      v_anestesista := coalesce(nullif(btrim(v_item.porte_anestesico),'') is not null,false)
        or (case when coalesce(v_item.metadata->>'ch_anestesista','') ~ '^[0-9]+([.][0-9]+)?$' then (v_item.metadata->>'ch_anestesista')::numeric > 0 else false end);
      if v_item.metadata ? 'instrumentador' then
        v_instrumentador := lower(coalesce(v_item.metadata->>'instrumentador','false')) in ('true','t','1','yes','on');
      end if;
      v_pediatra := lower(coalesce(v_item.metadata->>'pediatra_sala',v_item.metadata->>'pediatra','false')) in ('true','t','1','yes','on');
      v_neonatal := lower(coalesce(v_item.metadata->>'neonatologista',v_item.metadata->>'neonatal','false')) in ('true','t','1','yes','on');
    end if;
  end if;

  if v_desc like '%pediatra%' or v_desc like '%recem-nascid%' or v_desc like '%recém-nascid%' then v_pediatra := true; end if;
  if v_desc like '%neonatal%' or v_desc like '%neonatolog%' then v_neonatal := true; end if;

  return jsonb_build_object(
    'quantidade_auxiliares', v_aux,
    'anestesista', v_anestesista,
    'instrumentador', v_instrumentador,
    'pediatra', v_pediatra,
    'neonatologista', v_neonatal,
    'permite_outros', true
  );
end;
$$;

revoke all on function public.centro_cirurgico_requisitos_equipe_item(uuid,text) from public,anon,authenticated;

create or replace function public.sincronizar_procedimento_principal_cirurgia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_id uuid;
  v_req jsonb;
  v_seq integer;
begin
  v_req := public.centro_cirurgico_requisitos_equipe_item(new.tabela_item_id,new.procedimento);
  select id into v_id from public.cirurgia_procedimentos where cirurgia_id=new.id and principal limit 1 for update;
  if v_id is null then
    select coalesce(max(sequencia),0)+1 into v_seq from public.cirurgia_procedimentos where cirurgia_id=new.id;
    insert into public.cirurgia_procedimentos(
      empresa_id,unidade_id,cirurgia_id,atendimento_id,contrato_id,tabela_item_id,codigo,codigo_tuss,descricao,
      porte,porte_anestesico,tabela_referencia,requisitos_equipe,sequencia,principal,status,inicio_em,fim_em,
      created_by,updated_by
    ) values (
      new.empresa_id,new.unidade_id,new.id,new.atendimento_id,new.contrato_id,new.tabela_item_id,
      coalesce(new.codigo_contratado,new.codigo_tuss),new.codigo_tuss,new.procedimento,new.porte,new.porte_anestesico,
      new.tabela_referencia,v_req,greatest(1,v_seq),true,
      case when new.status='concluida' then 'concluido' when new.status='em_andamento' then 'em_andamento' when new.status='cancelada' then 'cancelado' else 'previsto' end,
      new.inicio_em,new.fim_em,new.created_by,new.updated_by
    );
  else
    update public.cirurgia_procedimentos set
      contrato_id=new.contrato_id,tabela_item_id=new.tabela_item_id,codigo=coalesce(new.codigo_contratado,new.codigo_tuss),
      codigo_tuss=new.codigo_tuss,descricao=new.procedimento,porte=new.porte,porte_anestesico=new.porte_anestesico,
      tabela_referencia=new.tabela_referencia,requisitos_equipe=v_req,
      status=case when new.status='concluida' then 'concluido' when new.status='cancelada' then 'cancelado' else status end,
      inicio_em=coalesce(inicio_em,new.inicio_em),fim_em=case when new.status='concluida' then coalesce(fim_em,new.fim_em) else fim_em end,
      updated_at=now(),updated_by=new.updated_by
    where id=v_id;
  end if;
  return new;
end;
$$;

revoke all on function public.sincronizar_procedimento_principal_cirurgia() from public,anon,authenticated;

drop trigger if exists trg_sincronizar_procedimento_principal_cirurgia on public.cirurgias;
create trigger trg_sincronizar_procedimento_principal_cirurgia
after insert or update of procedimento,codigo_tuss,codigo_contratado,porte,porte_anestesico,contrato_id,tabela_item_id,tabela_referencia,status,inicio_em,fim_em
on public.cirurgias for each row execute function public.sincronizar_procedimento_principal_cirurgia();

insert into public.cirurgia_procedimentos(
  empresa_id,unidade_id,cirurgia_id,atendimento_id,contrato_id,tabela_item_id,codigo,codigo_tuss,descricao,
  porte,porte_anestesico,tabela_referencia,requisitos_equipe,sequencia,principal,status,inicio_em,fim_em,created_by,updated_by
)
select
  c.empresa_id,c.unidade_id,c.id,c.atendimento_id,c.contrato_id,c.tabela_item_id,coalesce(c.codigo_contratado,c.codigo_tuss),c.codigo_tuss,c.procedimento,
  c.porte,c.porte_anestesico,c.tabela_referencia,public.centro_cirurgico_requisitos_equipe_item(c.tabela_item_id,c.procedimento),1,true,
  case when c.status='concluida' then 'concluido' when c.status='em_andamento' then 'em_andamento' when c.status='cancelada' then 'cancelado' else 'previsto' end,
  c.inicio_em,c.fim_em,c.created_by,c.updated_by
from public.cirurgias c
where not exists(select 1 from public.cirurgia_procedimentos p where p.cirurgia_id=c.id and p.principal);

alter table public.cirurgia_procedimentos enable row level security;
alter table public.cirurgia_procedimentos force row level security;
drop policy if exists cirurgia_procedimentos_select_funcional on public.cirurgia_procedimentos;
create policy cirurgia_procedimentos_select_funcional on public.cirurgia_procedimentos
for select to authenticated using (
  public.tem_unidade(empresa_id,unidade_id) and (
    public.tem_permissao(empresa_id,unidade_id,'centro_cirurgico.visualizar') or
    public.tem_permissao(empresa_id,unidade_id,'centro_cirurgico.operar') or
    public.tem_permissao(empresa_id,unidade_id,'centro_cirurgico.gerenciar') or
    public.tem_permissao(empresa_id,unidade_id,'prontuario.visualizar')
  )
);

drop policy if exists cirurgia_equipe_escopo on public.cirurgia_equipe;
drop policy if exists cirurgia_equipe_select_funcional on public.cirurgia_equipe;
create policy cirurgia_equipe_select_funcional on public.cirurgia_equipe
for select to authenticated using (
  public.tem_unidade(empresa_id,unidade_id) and (
    public.tem_permissao(empresa_id,unidade_id,'centro_cirurgico.visualizar') or
    public.tem_permissao(empresa_id,unidade_id,'centro_cirurgico.operar') or
    public.tem_permissao(empresa_id,unidade_id,'centro_cirurgico.gerenciar') or
    public.tem_permissao(empresa_id,unidade_id,'prontuario.visualizar')
  )
);

drop policy if exists cirurgia_tempos_escopo on public.cirurgia_tempos;
drop policy if exists cirurgia_tempos_select_funcional on public.cirurgia_tempos;
create policy cirurgia_tempos_select_funcional on public.cirurgia_tempos
for select to authenticated using (
  public.tem_unidade(empresa_id,unidade_id) and (
    public.tem_permissao(empresa_id,unidade_id,'centro_cirurgico.visualizar') or
    public.tem_permissao(empresa_id,unidade_id,'centro_cirurgico.operar') or
    public.tem_permissao(empresa_id,unidade_id,'centro_cirurgico.gerenciar') or
    public.tem_permissao(empresa_id,unidade_id,'prontuario.visualizar')
  )
);

revoke insert,update,delete on public.cirurgia_procedimentos,public.cirurgia_equipe,public.cirurgia_tempos from authenticated,anon;
grant select on public.cirurgia_procedimentos,public.cirurgia_equipe,public.cirurgia_tempos to authenticated;

create or replace function public.centro_cirurgico_adicionar_procedimento_operacional(
  p_cirurgia_id uuid,
  p_tabela_item_id uuid default null,
  p_codigo text default null,
  p_descricao text default null,
  p_porte text default null,
  p_porte_anestesico text default null,
  p_observacoes text default null
) returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog, extensions
as $$
declare
  v_c public.cirurgias%rowtype;
  v_at public.atendimentos%rowtype;
  v_item record;
  v_tab public.tabelas_comerciais_itens%rowtype;
  v_id uuid;
  v_seq integer;
  v_codigo text := nullif(btrim(p_codigo),'');
  v_desc text := nullif(btrim(p_descricao),'');
  v_porte text := nullif(btrim(p_porte),'');
  v_porte_anest text := nullif(btrim(p_porte_anestesico),'');
  v_contrato uuid;
  v_ref text;
  v_req jsonb;
  v_prof uuid;
begin
  if auth.uid() is null then raise exception 'CC_AUTENTICACAO_OBRIGATORIA' using errcode='42501'; end if;
  select * into v_c from public.cirurgias where id=p_cirurgia_id for update;
  if not found then raise exception 'CC_CIRURGIA_NAO_LOCALIZADA'; end if;
  if not (public.tem_permissao(v_c.empresa_id,v_c.unidade_id,'centro_cirurgico.operar') or public.tem_permissao(v_c.empresa_id,v_c.unidade_id,'centro_cirurgico.gerenciar')) then raise exception 'CC_SEM_PERMISSAO_OPERAR' using errcode='42501'; end if;
  if v_c.status in ('concluida','cancelada','recuperacao') then raise exception 'CC_CIRURGIA_NAO_ACEITA_NOVO_PROCEDIMENTO'; end if;
  select * into v_at from public.atendimentos where id=v_c.atendimento_id;

  if v_at.cobertura::text='convenio' and v_at.convenio_id is not null then
    if p_tabela_item_id is null then raise exception 'CC_PROCEDIMENTO_CONTRATUAL_OBRIGATORIO'; end if;
    select x.* into v_item from public.buscar_procedimentos_cirurgicos_contrato(v_at.id,null,80) x where x.tabela_item_id=p_tabela_item_id limit 1;
    if not found then raise exception 'CC_PROCEDIMENTO_FORA_CONTRATO'; end if;
    select * into v_tab from public.tabelas_comerciais_itens where id=p_tabela_item_id;
    v_codigo := coalesce(v_item.codigo_tuss,v_item.codigo);
    v_desc := v_item.descricao;
    v_porte := v_item.porte;
    v_porte_anest := v_item.porte_anestesico;
    v_contrato := v_item.contrato_id;
    v_ref := concat_ws(' · ',v_item.fonte_codigo,v_item.edicao_nome);
  else
    if v_desc is null then raise exception 'CC_PROCEDIMENTO_DESCRICAO_OBRIGATORIA'; end if;
    if p_tabela_item_id is not null then select * into v_tab from public.tabelas_comerciais_itens where id=p_tabela_item_id; end if;
  end if;

  v_req := public.centro_cirurgico_requisitos_equipe_item(p_tabela_item_id,v_desc);
  select coalesce(max(sequencia),0)+1 into v_seq from public.cirurgia_procedimentos where cirurgia_id=v_c.id;
  insert into public.cirurgia_procedimentos(
    empresa_id,unidade_id,cirurgia_id,atendimento_id,contrato_id,tabela_item_id,codigo,codigo_tuss,descricao,
    porte,porte_anestesico,tabela_referencia,requisitos_equipe,sequencia,principal,status,observacoes,created_by,updated_by
  ) values (
    v_c.empresa_id,v_c.unidade_id,v_c.id,v_c.atendimento_id,v_contrato,p_tabela_item_id,v_codigo,
    coalesce(v_tab.codigo_tuss,case when v_codigo ~ '^[0-9]{8}$' then v_codigo else null end),v_desc,v_porte,v_porte_anest,v_ref,
    v_req,v_seq,false,'previsto',nullif(btrim(p_observacoes),''),auth.uid(),auth.uid()
  ) returning id into v_id;

  v_prof := public.profissional_logado(v_c.empresa_id);
  insert into public.cirurgia_eventos(empresa_id,unidade_id,cirurgia_id,atendimento_id,tipo_evento,detalhes,profissional_id,created_by)
  values(v_c.empresa_id,v_c.unidade_id,v_c.id,v_c.atendimento_id,'procedimento_adicionado',jsonb_build_object('cirurgia_procedimento_id',v_id,'sequencia',v_seq,'codigo',v_codigo,'descricao',v_desc,'porte',v_porte,'porte_anestesico',v_porte_anest,'requisitos_equipe',v_req),v_prof,auth.uid());
  return v_id;
end;
$$;

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
  if v_role not in ('cirurgiao_principal','cirurgiao_auxiliar','instrumentador','anestesista','pediatra','neonatologista','outro') then raise exception 'CC_PAPEL_EQUIPE_INVALIDO'; end if;
  if not exists(select 1 from public.profissionais x where x.id=p_profissional_id and x.empresa_id=v_c.empresa_id and x.ativo) then raise exception 'CC_PROFISSIONAL_INVALIDO'; end if;

  v_req := coalesce(v_p.requisitos_equipe,'{}'::jsonb);
  v_aux := case when coalesce(v_req->>'quantidade_auxiliares','') ~ '^[0-9]+$' then (v_req->>'quantidade_auxiliares')::integer else 0 end;
  v_faturavel := case
    when v_role='cirurgiao_principal' then true
    when v_role='cirurgiao_auxiliar' then coalesce(p_ordem,1) <= v_aux
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

create or replace function public.centro_cirurgico_acionar_procedimento_operacional(
  p_cirurgia_procedimento_id uuid,
  p_acao text,
  p_observacoes text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog, extensions
as $$
declare
  v_p public.cirurgia_procedimentos%rowtype;
  v_c public.cirurgias%rowtype;
  v_acao text := lower(coalesce(btrim(p_acao),''));
  v_prof uuid;
begin
  if auth.uid() is null then raise exception 'CC_AUTENTICACAO_OBRIGATORIA' using errcode='42501'; end if;
  select * into v_p from public.cirurgia_procedimentos where id=p_cirurgia_procedimento_id for update;
  if not found then raise exception 'CC_PROCEDIMENTO_NAO_LOCALIZADO'; end if;
  select * into v_c from public.cirurgias where id=v_p.cirurgia_id for update;
  if not (public.tem_permissao(v_c.empresa_id,v_c.unidade_id,'centro_cirurgico.operar') or public.tem_permissao(v_c.empresa_id,v_c.unidade_id,'centro_cirurgico.gerenciar')) then raise exception 'CC_SEM_PERMISSAO_OPERAR' using errcode='42501'; end if;
  if v_c.status<>'em_andamento' then raise exception 'CC_CIRURGIA_DEVE_ESTAR_EM_ANDAMENTO'; end if;
  if v_acao not in ('iniciar','finalizar') then raise exception 'CC_ACAO_PROCEDIMENTO_INVALIDA'; end if;
  v_prof := public.profissional_logado(v_c.empresa_id);
  if v_prof is null then raise exception 'CC_USUARIO_SEM_PROFISSIONAL'; end if;

  if v_acao='iniciar' then
    if v_p.status='concluido' then raise exception 'CC_PROCEDIMENTO_JA_CONCLUIDO'; end if;
    if v_p.status='em_andamento' then return jsonb_build_object('procedimento_id',v_p.id,'status',v_p.status,'inicio_em',v_p.inicio_em,'idempotente',true); end if;
    update public.cirurgia_procedimentos set status='em_andamento',inicio_em=coalesce(inicio_em,now()),updated_at=now(),updated_by=auth.uid() where id=v_p.id returning * into v_p;
    insert into public.cirurgia_tempos(empresa_id,unidade_id,cirurgia_id,atendimento_id,cirurgia_procedimento_id,evento,ocorrido_em,profissional_id,observacoes,created_by)
    values(v_c.empresa_id,v_c.unidade_id,v_c.id,v_c.atendimento_id,v_p.id,'procedimento_inicio',v_p.inicio_em,v_prof,nullif(btrim(p_observacoes),''),auth.uid());
  else
    if v_p.status='concluido' then return jsonb_build_object('procedimento_id',v_p.id,'status',v_p.status,'inicio_em',v_p.inicio_em,'fim_em',v_p.fim_em,'idempotente',true); end if;
    if v_p.status<>'em_andamento' or v_p.inicio_em is null then raise exception 'CC_PROCEDIMENTO_DEVE_SER_INICIADO'; end if;
    update public.cirurgia_procedimentos set status='concluido',fim_em=coalesce(fim_em,now()),updated_at=now(),updated_by=auth.uid() where id=v_p.id returning * into v_p;
    insert into public.cirurgia_tempos(empresa_id,unidade_id,cirurgia_id,atendimento_id,cirurgia_procedimento_id,evento,ocorrido_em,profissional_id,observacoes,created_by)
    values(v_c.empresa_id,v_c.unidade_id,v_c.id,v_c.atendimento_id,v_p.id,'procedimento_fim',v_p.fim_em,v_prof,nullif(btrim(p_observacoes),''),auth.uid());
  end if;

  insert into public.cirurgia_eventos(empresa_id,unidade_id,cirurgia_id,atendimento_id,tipo_evento,detalhes,profissional_id,created_by)
  values(v_c.empresa_id,v_c.unidade_id,v_c.id,v_c.atendimento_id,case when v_acao='iniciar' then 'procedimento_iniciado' else 'procedimento_finalizado' end,jsonb_build_object('cirurgia_procedimento_id',v_p.id,'sequencia',v_p.sequencia,'codigo',v_p.codigo,'descricao',v_p.descricao,'inicio_em',v_p.inicio_em,'fim_em',v_p.fim_em),v_prof,auth.uid());

  return jsonb_build_object('procedimento_id',v_p.id,'status',v_p.status,'inicio_em',v_p.inicio_em,'fim_em',v_p.fim_em);
end;
$$;

create or replace function public.validar_procedimentos_cirurgicos_antes_recuperacao()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  if new.status='recuperacao' and old.status is distinct from new.status and exists(
    select 1 from public.cirurgia_procedimentos p where p.cirurgia_id=new.id and p.status not in ('concluido','cancelado')
  ) then
    raise exception 'CC_PROCEDIMENTOS_DEVEM_SER_FINALIZADOS';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validar_procedimentos_cirurgicos_antes_recuperacao on public.cirurgias;
create trigger trg_validar_procedimentos_cirurgicos_antes_recuperacao
before update of status on public.cirurgias for each row execute function public.validar_procedimentos_cirurgicos_antes_recuperacao();
revoke all on function public.validar_procedimentos_cirurgicos_antes_recuperacao() from public,anon,authenticated;

create or replace function public.registrar_producao_procedimentos_secundarios_cirurgia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog, extensions
as $$
declare
  r record;
  v_prof uuid;
  v_equipe jsonb;
begin
  if new.status='concluida' and old.status is distinct from new.status then
    for r in select p.* from public.cirurgia_procedimentos p where p.cirurgia_id=new.id and not p.principal and p.status='concluido' loop
      select e.profissional_id into v_prof
      from public.cirurgia_equipe e
      where e.cirurgia_procedimento_id=r.id and e.papel='cirurgiao_principal'
      order by e.principal desc,e.created_at limit 1;
      select coalesce(jsonb_agg(jsonb_build_object('profissional_id',e.profissional_id,'papel',e.papel,'ordem',e.ordem_participacao,'faturavel',e.faturavel) order by e.created_at),'[]'::jsonb)
      into v_equipe from public.cirurgia_equipe e where e.cirurgia_procedimento_id=r.id;
      perform public.registrar_evento_producao_assistencial_internal(
        new.atendimento_id,'procedimento','cirurgia_procedimentos',r.id,coalesce(r.fim_em,new.fim_em,now()),1,'procedimentos',
        coalesce(v_prof,new.cirurgiao_id), 'centro_cirurgico', null, null, coalesce(r.codigo_tuss,r.codigo), true,
        jsonb_build_object('cirurgia_id',new.id,'sequencia',r.sequencia,'descricao',r.descricao,'porte',r.porte,'porte_anestesico',r.porte_anestesico,'inicio_em',r.inicio_em,'fim_em',r.fim_em,'equipe',v_equipe,'tabela_item_id',r.tabela_item_id,'contrato_id',r.contrato_id)
      );
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_registrar_producao_procedimentos_secundarios_cirurgia on public.cirurgias;
create trigger trg_registrar_producao_procedimentos_secundarios_cirurgia
after update of status on public.cirurgias for each row execute function public.registrar_producao_procedimentos_secundarios_cirurgia();
revoke all on function public.registrar_producao_procedimentos_secundarios_cirurgia() from public,anon,authenticated;

revoke all on function public.centro_cirurgico_adicionar_procedimento_operacional(uuid,uuid,text,text,text,text,text) from public,anon;
revoke all on function public.centro_cirurgico_salvar_membro_equipe_operacional(uuid,uuid,text,integer,boolean,boolean,boolean,text) from public,anon;
revoke all on function public.centro_cirurgico_acionar_procedimento_operacional(uuid,text,text) from public,anon;
grant execute on function public.centro_cirurgico_adicionar_procedimento_operacional(uuid,uuid,text,text,text,text,text) to authenticated;
grant execute on function public.centro_cirurgico_salvar_membro_equipe_operacional(uuid,uuid,text,integer,boolean,boolean,boolean,text) to authenticated;
grant execute on function public.centro_cirurgico_acionar_procedimento_operacional(uuid,text,text) to authenticated;

comment on table public.cirurgia_procedimentos is 'Procedimentos individuais executados dentro de um mesmo ato cirurgico, com snapshot contratual, equipe e tempos proprios.';
comment on column public.cirurgia_equipe.cirurgia_procedimento_id is 'Vincula cada membro da equipe ao procedimento individual dentro do ato cirurgico.';
comment on column public.cirurgia_tempos.cirurgia_procedimento_id is 'Vincula o marco temporal ao procedimento individual dentro do ato cirurgico.';

commit;
