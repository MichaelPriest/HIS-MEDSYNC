create or replace function public.validar_cpf_br(p_cpf text)
returns boolean
language plpgsql immutable set search_path=pg_catalog
as $$
declare v text:=regexp_replace(coalesce(p_cpf,''),'\D','','g'); s integer; d1 integer; d2 integer; i integer;
begin
  if length(v)<>11 then return false; end if;
  if v=repeat(substr(v,1,1),11) then return false; end if;
  s:=0; for i in 1..9 loop s:=s+substr(v,i,1)::int*(11-i); end loop;
  d1:=11-(s%11); if d1>=10 then d1:=0; end if;
  if d1<>substr(v,10,1)::int then return false; end if;
  s:=0; for i in 1..10 loop s:=s+substr(v,i,1)::int*(12-i); end loop;
  d2:=11-(s%11); if d2>=10 then d2:=0; end if;
  return d2=substr(v,11,1)::int;
end $$;

create or replace function public.validar_cns_local(p_cns text)
returns boolean
language plpgsql immutable set search_path=pg_catalog
as $$
declare v text:=regexp_replace(coalesce(p_cns,''),'\D','','g'); s integer:=0; i integer;
begin
  if length(v)<>15 then return false; end if;
  for i in 1..15 loop s:=s+substr(v,i,1)::int*(16-i); end loop;
  return (s%11)=0;
end $$;

grant execute on function public.validar_cpf_br(text) to authenticated;
grant execute on function public.validar_cns_local(text) to authenticated;
revoke execute on function public.validar_cpf_br(text) from anon;
revoke execute on function public.validar_cns_local(text) from anon;

alter table public.convenio_planos add column if not exists carteirinha_mascara text;
alter table public.convenio_planos add column if not exists carteirinha_regex text;
alter table public.convenio_planos add column if not exists exige_validade_carteirinha boolean not null default false;

create table if not exists public.paciente_convenios(
  id uuid primary key default extensions.gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  convenio_id uuid not null references public.convenios(id),
  plano_id uuid not null references public.convenio_planos(id),
  numero_carteirinha text not null check(length(btrim(numero_carteirinha)) between 1 and 80),
  validade_carteirinha date,
  principal boolean not null default false,
  ativo boolean not null default true,
  elegibilidade_status text check(elegibilidade_status is null or elegibilidade_status in ('ativa','inativa','pendente','erro','nao_configurada')),
  elegibilidade_verificada_em timestamptz,
  elegibilidade_protocolo text,
  elegibilidade_mensagem text,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint paciente_convenios_unique unique(paciente_id,convenio_id,plano_id,numero_carteirinha)
);
create index if not exists idx_paciente_convenios_carteira on public.paciente_convenios(empresa_id,numero_carteirinha);
create index if not exists idx_paciente_convenios_principal on public.paciente_convenios(paciente_id,principal,ativo);

create table if not exists public.paciente_responsaveis(
  id uuid primary key default extensions.gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  nome text not null check(length(btrim(nome))>=2),
  cpf text not null check(public.validar_cpf_br(cpf)),
  parentesco text not null,
  responsavel_legal boolean not null default true,
  responsavel_financeiro boolean not null default true,
  telefone text,
  email text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
create index if not exists idx_paciente_responsaveis_paciente on public.paciente_responsaveis(paciente_id,ativo);

create table if not exists public.paciente_comunicacao_consentimentos(
  id uuid primary key default extensions.gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  canal text not null check(canal in ('whatsapp','sms','email','telefone')),
  finalidade text not null default 'lembretes_assistenciais',
  autorizado boolean not null,
  consentido_em timestamptz not null default now(),
  revogado_em timestamptz,
  origem text not null default 'cadastro_recepcao',
  created_at timestamptz not null default now(),
  created_by uuid,
  constraint paciente_comunicacao_unique unique(paciente_id,canal,finalidade)
);

create table if not exists public.paciente_alertas(
  id uuid primary key default extensions.gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  tipo text not null default 'assistencial' check(tipo in ('alergia','comorbidade','gestacao','assistencial','operacional')),
  severidade text not null default 'alta' check(severidade in ('baixa','media','alta','critica')),
  descricao text not null,
  ativo boolean not null default true,
  inicio_em timestamptz not null default now(),
  fim_em timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
create index if not exists idx_paciente_alertas_ativos on public.paciente_alertas(paciente_id,ativo,severidade);

alter table public.paciente_convenios enable row level security;
alter table public.paciente_responsaveis enable row level security;
alter table public.paciente_comunicacao_consentimentos enable row level security;
alter table public.paciente_alertas enable row level security;

drop policy if exists paciente_convenios_escopo on public.paciente_convenios;
create policy paciente_convenios_escopo on public.paciente_convenios for all to authenticated
using(exists(select 1 from public.usuario_empresas ue where ue.usuario_id=auth.uid() and ue.empresa_id=paciente_convenios.empresa_id and ue.ativo))
with check(exists(select 1 from public.usuario_empresas ue where ue.usuario_id=auth.uid() and ue.empresa_id=paciente_convenios.empresa_id and ue.ativo));
drop policy if exists paciente_responsaveis_escopo on public.paciente_responsaveis;
create policy paciente_responsaveis_escopo on public.paciente_responsaveis for all to authenticated
using(exists(select 1 from public.usuario_empresas ue where ue.usuario_id=auth.uid() and ue.empresa_id=paciente_responsaveis.empresa_id and ue.ativo))
with check(exists(select 1 from public.usuario_empresas ue where ue.usuario_id=auth.uid() and ue.empresa_id=paciente_responsaveis.empresa_id and ue.ativo));
drop policy if exists paciente_comunicacao_consentimentos_escopo on public.paciente_comunicacao_consentimentos;
create policy paciente_comunicacao_consentimentos_escopo on public.paciente_comunicacao_consentimentos for all to authenticated
using(exists(select 1 from public.usuario_empresas ue where ue.usuario_id=auth.uid() and ue.empresa_id=paciente_comunicacao_consentimentos.empresa_id and ue.ativo))
with check(exists(select 1 from public.usuario_empresas ue where ue.usuario_id=auth.uid() and ue.empresa_id=paciente_comunicacao_consentimentos.empresa_id and ue.ativo));
drop policy if exists paciente_alertas_escopo on public.paciente_alertas;
create policy paciente_alertas_escopo on public.paciente_alertas for all to authenticated
using(exists(select 1 from public.usuario_empresas ue where ue.usuario_id=auth.uid() and ue.empresa_id=paciente_alertas.empresa_id and ue.ativo))
with check(exists(select 1 from public.usuario_empresas ue where ue.usuario_id=auth.uid() and ue.empresa_id=paciente_alertas.empresa_id and ue.ativo));

create sequence if not exists public.guia_prestador_numero_seq;
alter table public.atendimentos add column if not exists numero_guia_prestador bigint;
alter table public.atendimentos alter column numero_guia_prestador set default nextval('public.guia_prestador_numero_seq');
update public.atendimentos set numero_guia_prestador=nextval('public.guia_prestador_numero_seq') where numero_guia_prestador is null;
alter table public.atendimentos alter column numero_guia_prestador set not null;
alter table public.atendimentos add column if not exists paciente_nome_social text;
alter table public.atendimentos add column if not exists registro_ans_snapshot text;
alter table public.atendimentos add column if not exists cnes_snapshot text;
alter table public.atendimentos add column if not exists profissional_conselho_snapshot text;
alter table public.atendimentos add column if not exists profissional_numero_conselho_snapshot text;
alter table public.atendimentos add column if not exists profissional_uf_conselho_snapshot text;
alter table public.atendimentos add column if not exists profissional_cbo_snapshot text;
alter table public.atendimentos add column if not exists profissional_especialidade_snapshot text;
alter table public.atendimentos add column if not exists regime_atendimento text;
alter table public.atendimentos add column if not exists tipo_atendimento_tiss text;
alter table public.atendimentos add column if not exists codigo_tuss_principal text;
alter table public.atendimentos add column if not exists descricao_tuss_principal text;
alter table public.atendimentos add column if not exists indicacao_clinica text;
alter table public.atendimentos add column if not exists retorno_alerta_30_dias boolean not null default false;
alter table public.atendimentos add column if not exists retorno_atendimento_referencia_id uuid references public.atendimentos(id) on delete set null;
alter table public.atendimentos add column if not exists retorno_dias integer;
create unique index if not exists atendimentos_guia_prestador_empresa_uidx on public.atendimentos(empresa_id,numero_guia_prestador);

create or replace function public.preencher_snapshot_admissao()
returns trigger language plpgsql security definer set search_path=public,pg_catalog
as $$
declare v_p public.pacientes%rowtype; v_prof public.profissionais%rowtype; v_un public.unidades%rowtype; v_conv public.convenios%rowtype;
begin
  select * into v_p from public.pacientes where id=new.paciente_id;
  if new.profissional_id is not null then select * into v_prof from public.profissionais where id=new.profissional_id; end if;
  select * into v_un from public.unidades where id=new.unidade_id;
  if new.convenio_id is not null then select * into v_conv from public.convenios where id=new.convenio_id; end if;
  new.numero_guia_prestador:=coalesce(new.numero_guia_prestador,nextval('public.guia_prestador_numero_seq'));
  new.paciente_nome:=coalesce(nullif(new.paciente_nome,''),v_p.nome_completo);
  new.paciente_nome_social:=coalesce(nullif(new.paciente_nome_social,''),v_p.nome_social);
  new.registro_ans_snapshot:=coalesce(nullif(new.registro_ans_snapshot,''),v_conv.registro_ans);
  new.cnes_snapshot:=coalesce(nullif(new.cnes_snapshot,''),v_un.cnes);
  new.profissional_conselho_snapshot:=coalesce(nullif(new.profissional_conselho_snapshot,''),v_prof.conselho);
  new.profissional_numero_conselho_snapshot:=coalesce(nullif(new.profissional_numero_conselho_snapshot,''),v_prof.numero_conselho);
  new.profissional_uf_conselho_snapshot:=coalesce(nullif(new.profissional_uf_conselho_snapshot,''),v_prof.uf_conselho);
  new.profissional_cbo_snapshot:=coalesce(nullif(new.profissional_cbo_snapshot,''),v_prof.cbo);
  new.profissional_especialidade_snapshot:=coalesce(nullif(new.profissional_especialidade_snapshot,''),v_prof.especialidade);
  new.regime_atendimento:=coalesce(nullif(new.regime_atendimento,''),new.tipo_atendimento);
  return new;
end $$;
revoke execute on function public.preencher_snapshot_admissao() from public,anon,authenticated;
drop trigger if exists trg_preencher_snapshot_admissao on public.atendimentos;
create trigger trg_preencher_snapshot_admissao before insert on public.atendimentos for each row execute function public.preencher_snapshot_admissao();

create or replace function public.proteger_numero_guia_prestador()
returns trigger language plpgsql set search_path=public,pg_catalog
as $$ begin if new.numero_guia_prestador is distinct from old.numero_guia_prestador then raise exception 'NUMERO_GUIA_PRESTADOR_IMUTAVEL' using errcode='23514'; end if; return new; end $$;
drop trigger if exists trg_proteger_numero_guia_prestador on public.atendimentos;
create trigger trg_proteger_numero_guia_prestador before update of numero_guia_prestador on public.atendimentos for each row execute function public.proteger_numero_guia_prestador();

create or replace function public.buscar_tuss_admissao(p_empresa uuid,p_busca text,p_limite integer default 30)
returns table(item_id uuid,tabela text,codigo text,descricao text,categoria text)
language sql security definer set search_path=public,pg_catalog
as $$
  select i.id,i.tabela_tiss_codigo,case when i.tabela_tiss_codigo in ('00','98') then i.codigo_tabela_propria else i.codigo_tuss end,i.descricao,i.categoria
  from public.itens_assistenciais i
  where i.empresa_id=p_empresa and i.ativo and public.tem_empresa(p_empresa) and i.categoria='procedimento'
    and (lower(i.descricao) like '%'||lower(trim(coalesce(p_busca,'')))||'%' or coalesce(i.codigo_tuss,'') like '%'||regexp_replace(coalesce(p_busca,''),'\D','','g')||'%' or lower(coalesce(i.codigo_tabela_propria,'')) like '%'||lower(trim(coalesce(p_busca,'')))||'%')
  order by case when coalesce(i.codigo_tuss,i.codigo_tabela_propria)=trim(coalesce(p_busca,'')) then 0 else 1 end,i.descricao
  limit least(greatest(coalesce(p_limite,30),1),50)
$$;
revoke all on function public.buscar_tuss_admissao(uuid,text,integer) from public,anon;
grant execute on function public.buscar_tuss_admissao(uuid,text,integer) to authenticated;

create or replace function public.verificar_retorno_30_dias(p_paciente_id uuid,p_profissional_id uuid,p_unidade_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_catalog
as $$
declare v_prof public.profissionais%rowtype; v_anterior record;
begin
  if auth.uid() is null then raise exception 'NAO_AUTENTICADO' using errcode='42501'; end if;
  if p_unidade_id is null then return jsonb_build_object('alerta',false); end if;
  select * into v_prof from public.profissionais where id=p_profissional_id and ativo;
  if not found or not public.tem_unidade(v_prof.empresa_id,p_unidade_id) then raise exception 'SEM_ACESSO' using errcode='42501'; end if;
  if nullif(btrim(v_prof.especialidade),'') is null then return jsonb_build_object('alerta',false,'motivo','especialidade_nao_cadastrada'); end if;
  select a.id,a.data_abertura,p.especialidade,extract(day from(now()-a.data_abertura))::int as dias into v_anterior
  from public.atendimentos a join public.profissionais p on p.id=a.profissional_id
  where a.paciente_id=p_paciente_id and a.unidade_id=p_unidade_id and a.status::text not in ('cancelado')
    and a.data_abertura>=now()-interval '30 days' and lower(btrim(coalesce(p.especialidade,'')))=lower(btrim(v_prof.especialidade))
  order by a.data_abertura desc limit 1;
  if not found then return jsonb_build_object('alerta',false,'especialidade',v_prof.especialidade); end if;
  return jsonb_build_object('alerta',true,'atendimento_id',v_anterior.id,'data_atendimento',v_anterior.data_abertura,'dias',v_anterior.dias,'especialidade',v_prof.especialidade);
end $$;
revoke all on function public.verificar_retorno_30_dias(uuid,uuid,uuid) from public,anon;
grant execute on function public.verificar_retorno_30_dias(uuid,uuid,uuid) to authenticated;
