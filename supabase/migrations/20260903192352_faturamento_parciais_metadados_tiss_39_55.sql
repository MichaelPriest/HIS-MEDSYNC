alter table public.contas_faturamento
  add column if not exists tipo_faturamento_tiss_codigo text,
  add column if not exists tipo_faturamento_tiss_descricao text,
  add column if not exists motivo_encerramento_tiss_codigo text,
  add column if not exists motivo_encerramento_tiss_descricao text,
  add column if not exists motivo_encerramento_tiss_versao text,
  add column if not exists motivo_encerramento_tiss_canonical text,
  add column if not exists periodo_inicio_em timestamptz,
  add column if not exists periodo_fim_em timestamptz;

create or replace function public.faturamento_normalizar_tiss_conta_internacao_internal()
returns trigger language plpgsql security definer set search_path='public','pg_catalog' as $$
declare v_i public.internacoes%rowtype; v_tipo record; v_motivo record; v_tem_parcial boolean;
begin
  if new.tipo_atendimento_faturamento<>'internacao' or new.internacao_id is null then return new; end if;
  select * into v_i from public.internacoes where id=new.internacao_id;
  if not found then return new; end if;

  if new.modalidade_conta='parcial' then new.tipo_faturamento_tiss_codigo:='1';
  elsif new.modalidade_conta='complementar' then new.tipo_faturamento_tiss_codigo:='3';
  elsif new.modalidade_conta='final' then
    select exists(select 1 from public.contas_faturamento c where c.internacao_id=new.internacao_id and c.id<>new.id and c.modalidade_conta='parcial' and c.status<>'cancelada') into v_tem_parcial;
    new.tipo_faturamento_tiss_codigo:=case when v_tem_parcial then '2' else '4' end;
  end if;
  if new.tipo_faturamento_tiss_codigo is not null then
    select codigo,display into v_tipo from public.ans_fhir_dominios_ativos where tabela=55 and codigo=new.tipo_faturamento_tiss_codigo limit 1;
    if v_tipo.codigo is null then raise exception 'FAT_TISS_TIPO_FATURAMENTO_INVALIDO:%',new.tipo_faturamento_tiss_codigo; end if;
    new.tipo_faturamento_tiss_descricao:=v_tipo.display;
  end if;

  if new.periodo_inicio is not null and new.periodo_inicio_em is null then
    if new.periodo_inicio=(v_i.data_internacao at time zone 'America/Sao_Paulo')::date then new.periodo_inicio_em:=v_i.data_internacao;
    else new.periodo_inicio_em:=(new.periodo_inicio::timestamp at time zone 'America/Sao_Paulo'); end if;
  end if;
  if new.periodo_fim is not null and new.periodo_fim_em is null then
    if v_i.data_alta is not null and new.periodo_fim=(v_i.data_alta at time zone 'America/Sao_Paulo')::date and new.modalidade_conta='final' then new.periodo_fim_em:=v_i.data_alta;
    else new.periodo_fim_em:=((new.periodo_fim+1)::timestamp at time zone 'America/Sao_Paulo')-interval '1 second'; end if;
  end if;

  if new.motivo_encerramento_tiss_codigo is not null then
    select codigo,display,versao,canonical into v_motivo from public.ans_fhir_dominios_ativos where tabela=39 and codigo=new.motivo_encerramento_tiss_codigo limit 1;
    if v_motivo.codigo is null then raise exception 'FAT_TISS_MOTIVO_ENCERRAMENTO_INVALIDO:%',new.motivo_encerramento_tiss_codigo; end if;
    new.motivo_encerramento_tiss_descricao:=v_motivo.display;
    new.motivo_encerramento_tiss_versao:=v_motivo.versao;
    new.motivo_encerramento_tiss_canonical:=v_motivo.canonical;
  end if;
  return new;
end $$;

drop trigger if exists trg_faturamento_normalizar_tiss_conta_internacao on public.contas_faturamento;
create trigger trg_faturamento_normalizar_tiss_conta_internacao
before insert or update of tipo_atendimento_faturamento,internacao_id,modalidade_conta,periodo_inicio,periodo_fim,periodo_inicio_em,periodo_fim_em,tipo_faturamento_tiss_codigo,motivo_encerramento_tiss_codigo
on public.contas_faturamento for each row execute function public.faturamento_normalizar_tiss_conta_internacao_internal();

create or replace function public.faturamento_fechar_parcial_internacao_tiss(
  p_internacao_id uuid,p_periodo_inicio date,p_periodo_fim date,p_motivo_permanencia_tiss text,p_observacao text default null
)
returns jsonb language plpgsql security definer set search_path='public','pg_catalog' as $$
declare v_user uuid:=auth.uid(); v_dom record; v_result jsonb; v_conta uuid;
begin
  if v_user is null then raise exception 'FAT_PARCIAL_NAO_AUTENTICADO' using errcode='42501'; end if;
  select codigo,display,versao,canonical into v_dom from public.ans_fhir_dominios_ativos where tabela=39 and codigo=btrim(coalesce(p_motivo_permanencia_tiss,'')) limit 1;
  if v_dom.codigo is null then raise exception 'FAT_PARCIAL_MOTIVO_TISS_INVALIDO'; end if;
  if v_dom.codigo not in ('21','22','23','24','25','26','27','28') then raise exception 'FAT_PARCIAL_MOTIVO_DEVE_SER_PERMANENCIA'; end if;
  v_result:=public.faturamento_fechar_parcial_internacao(p_internacao_id,p_periodo_inicio,p_periodo_fim,p_observacao);
  v_conta:=nullif(v_result->>'conta_id','')::uuid;
  update public.contas_faturamento set
    tipo_faturamento_tiss_codigo='1',
    motivo_encerramento_tiss_codigo=v_dom.codigo,
    motivo_encerramento_tiss_descricao=v_dom.display,
    motivo_encerramento_tiss_versao=v_dom.versao,
    motivo_encerramento_tiss_canonical=v_dom.canonical,
    updated_at=now(),updated_by=v_user
  where id=v_conta;
  return v_result||jsonb_build_object('tipo_faturamento_tiss','1','motivo_encerramento_tiss',v_dom.codigo,'motivo_encerramento_descricao',v_dom.display);
end $$;

create or replace function public.faturamento_proteger_conta_congelada_internal()
returns trigger language plpgsql security definer set search_path='public','pg_catalog' as $$
begin
  if tg_op='DELETE' then
    if old.congelada_em is not null then raise exception 'FAT_CONTA_CONGELADA'; end if;
    return old;
  end if;
  if old.congelada_em is not null then
    if (to_jsonb(new)-array[
      'status','auditoria_liberada','contas_medicas_liberada','auditoria_id','updated_at','updated_by',
      'tipo_faturamento_tiss_codigo','tipo_faturamento_tiss_descricao','motivo_encerramento_tiss_codigo',
      'motivo_encerramento_tiss_descricao','motivo_encerramento_tiss_versao','motivo_encerramento_tiss_canonical',
      'periodo_inicio_em','periodo_fim_em'
    ]) is distinct from (to_jsonb(old)-array[
      'status','auditoria_liberada','contas_medicas_liberada','auditoria_id','updated_at','updated_by',
      'tipo_faturamento_tiss_codigo','tipo_faturamento_tiss_descricao','motivo_encerramento_tiss_codigo',
      'motivo_encerramento_tiss_descricao','motivo_encerramento_tiss_versao','motivo_encerramento_tiss_canonical',
      'periodo_inicio_em','periodo_fim_em'
    ]) then raise exception 'FAT_CONTA_CONGELADA'; end if;
  end if;
  return new;
end $$;

revoke execute on function public.faturamento_fechar_parcial_internacao(uuid,date,date,text) from authenticated;
revoke execute on function public.faturamento_fechar_parcial_internacao_tiss(uuid,date,date,text,text) from public,anon;
grant execute on function public.faturamento_fechar_parcial_internacao_tiss(uuid,date,date,text,text) to authenticated;
revoke all on function public.faturamento_normalizar_tiss_conta_internacao_internal() from public,anon,authenticated;
revoke all on function public.faturamento_proteger_conta_congelada_internal() from public,anon,authenticated;
