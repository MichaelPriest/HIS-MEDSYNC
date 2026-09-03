-- Um único identificador operacional: número da guia do prestador = número do atendimento.

alter table public.atendimentos
  alter column numero_guia_prestador drop default;

create or replace function public.preencher_snapshot_admissao()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $$
declare
  v_p public.pacientes%rowtype;
  v_prof public.profissionais%rowtype;
  v_un public.unidades%rowtype;
  v_conv public.convenios%rowtype;
begin
  select * into v_p from public.pacientes where id=new.paciente_id;
  if new.profissional_id is not null then select * into v_prof from public.profissionais where id=new.profissional_id; end if;
  select * into v_un from public.unidades where id=new.unidade_id;
  if new.convenio_id is not null then select * into v_conv from public.convenios where id=new.convenio_id; end if;

  new.numero_atendimento := coalesce(new.numero_atendimento,nextval('public.atendimento_numero_seq'));
  new.numero_guia_prestador := new.numero_atendimento;
  new.paciente_nome := coalesce(nullif(new.paciente_nome,''),v_p.nome_completo);
  new.paciente_nome_social := coalesce(nullif(new.paciente_nome_social,''),v_p.nome_social);
  new.registro_ans_snapshot := coalesce(nullif(new.registro_ans_snapshot,''),v_conv.registro_ans);
  new.cnes_snapshot := coalesce(nullif(new.cnes_snapshot,''),v_un.cnes);
  new.profissional_conselho_snapshot := coalesce(nullif(new.profissional_conselho_snapshot,''),v_prof.conselho);
  new.profissional_numero_conselho_snapshot := coalesce(nullif(new.profissional_numero_conselho_snapshot,''),v_prof.numero_conselho);
  new.profissional_uf_conselho_snapshot := coalesce(nullif(new.profissional_uf_conselho_snapshot,''),v_prof.uf_conselho);
  new.profissional_cbo_snapshot := coalesce(nullif(new.profissional_cbo_snapshot,''),v_prof.cbo);
  new.profissional_especialidade_snapshot := coalesce(nullif(new.profissional_especialidade_snapshot,''),v_prof.especialidade);
  new.regime_atendimento := coalesce(nullif(new.regime_atendimento,''),new.tipo_atendimento);
  return new;
end
$$;

alter table public.atendimentos disable trigger trg_proteger_numero_guia_prestador;
update public.atendimentos
   set numero_guia_prestador=numero_atendimento
 where numero_guia_prestador is distinct from numero_atendimento;
alter table public.atendimentos enable trigger trg_proteger_numero_guia_prestador;

alter table public.atendimentos
  drop constraint if exists atendimentos_numero_guia_prestador_igual_atendimento_check;
alter table public.atendimentos
  add constraint atendimentos_numero_guia_prestador_igual_atendimento_check
  check (numero_guia_prestador=numero_atendimento);

create or replace function public.normalizar_numero_guia_prestador_atendimento_internal()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $$
declare
  v_numero bigint;
begin
  if new.atendimento_id is null then
    return new;
  end if;

  select a.numero_atendimento into v_numero
    from public.atendimentos a
   where a.id=new.atendimento_id;
  if not found then
    raise exception 'ATENDIMENTO_NAO_LOCALIZADO_PARA_NUMERO_GUIA' using errcode='23503';
  end if;

  new.numero_guia_prestador := v_numero::text;
  return new;
end
$$;

revoke all on function public.normalizar_numero_guia_prestador_atendimento_internal() from public, anon, authenticated;

drop trigger if exists trg_00_autorizacao_numero_guia_atendimento on public.autorizacoes_atendimento;
create trigger trg_00_autorizacao_numero_guia_atendimento
before insert or update of atendimento_id,numero_guia_prestador on public.autorizacoes_atendimento
for each row execute function public.normalizar_numero_guia_prestador_atendimento_internal();

drop trigger if exists trg_00_central_numero_guia_atendimento on public.central_guias;
create trigger trg_00_central_numero_guia_atendimento
before insert or update of atendimento_id,numero_guia_prestador on public.central_guias
for each row execute function public.normalizar_numero_guia_prestador_atendimento_internal();

-- Contas parciais e final da mesma internação compartilham o número do atendimento.
alter table public.tiss_guias
  drop constraint if exists tiss_guias_empresa_id_convenio_id_numero_guia_prestador_key;
create unique index if not exists tiss_guias_conta_ativa_uidx
  on public.tiss_guias(conta_id)
  where status<>'cancelada';

drop trigger if exists trg_00_tiss_numero_guia_atendimento on public.tiss_guias;
create trigger trg_00_tiss_numero_guia_atendimento
before insert or update of atendimento_id,numero_guia_prestador on public.tiss_guias
for each row execute function public.normalizar_numero_guia_prestador_atendimento_internal();

update public.autorizacoes_atendimento aa
   set numero_guia_prestador=a.numero_atendimento::text,
       updated_at=now()
  from public.atendimentos a
 where a.id=aa.atendimento_id
   and aa.numero_guia_prestador is distinct from a.numero_atendimento::text;

update public.central_guias cg
   set numero_guia_prestador=a.numero_atendimento::text,
       updated_at=now()
  from public.atendimentos a
 where a.id=cg.atendimento_id
   and cg.numero_guia_prestador is distinct from a.numero_atendimento::text;

-- Apenas snapshots ainda editáveis são corrigidos; transmissões históricas permanecem preservadas.
update public.tiss_guias tg
   set numero_guia_prestador=a.numero_atendimento::text,
       updated_at=now()
  from public.atendimentos a
 where a.id=tg.atendimento_id
   and tg.status in ('rascunho','pronta')
   and tg.numero_guia_prestador is distinct from a.numero_atendimento::text;

-- Mantém os eventos de integração com o mesmo identificador efetivamente gravado na guia.
do $$
declare
  v_oid oid;
  v_def text;
  v_novo text;
begin
  select p.oid into v_oid
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public'
     and p.proname='criar_guia_tiss_conta_transacional'
     and pg_get_function_identity_arguments(p.oid)='p_conta_id uuid'
     and p.prokind='f';
  if v_oid is null then
    raise exception 'FUNCAO_CRIAR_GUIA_TISS_NAO_LOCALIZADA';
  end if;

  v_def:=pg_get_functiondef(v_oid);
  v_novo:=regexp_replace(
    v_def,
    $re$v_numero:='G'\|\|to_char\(current_date,'YYYYMMDD'\)\|\|'-'\|\|lpad\(nextval\('public\.tiss_guia_numero_seq'\)::text,8,'0'\);$re$,
    'v_numero:=v_at.numero_atendimento::text;'
  );
  if v_novo=v_def then
    raise exception 'PADRAO_ANTIGO_NUMERO_GUIA_TISS_NAO_ENCONTRADO';
  end if;
  execute v_novo;
end
$$;
