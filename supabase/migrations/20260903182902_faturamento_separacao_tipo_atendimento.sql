alter table public.contas_faturamento
  add column if not exists tipo_atendimento_faturamento text,
  add column if not exists tipo_atendimento_classificacao_origem text not null default 'automatico',
  add column if not exists tipo_atendimento_classificacao_memoria jsonb not null default '{}'::jsonb;

alter table public.contas_faturamento drop constraint if exists contas_faturamento_tipo_atendimento_faturamento_check;
alter table public.contas_faturamento add constraint contas_faturamento_tipo_atendimento_faturamento_check
  check (tipo_atendimento_faturamento is null or tipo_atendimento_faturamento in ('pronto_atendimento','ambulatorio','internacao','sadt'));
alter table public.contas_faturamento drop constraint if exists contas_faturamento_tipo_atendimento_classificacao_origem_check;
alter table public.contas_faturamento add constraint contas_faturamento_tipo_atendimento_classificacao_origem_check
  check (tipo_atendimento_classificacao_origem in ('automatico','manual'));

create or replace function public.faturamento_classificar_atendimento_internal(p_atendimento_id uuid)
returns jsonb
language plpgsql security definer
set search_path to 'public','pg_catalog'
as $$
declare
  v_at public.atendimentos%rowtype;
  v_tipo text;
  v_tipo_raw text;
  v_origem_raw text;
  v_internacao boolean:=false;
  v_triagem boolean:=false;
  v_exames boolean:=false;
  v_nao_exame boolean:=false;
  v_sinal_ps boolean:=false;
  v_sinal_sadt boolean:=false;
begin
  select * into v_at from public.atendimentos where id=p_atendimento_id;
  if not found then raise exception 'FAT_CLASSIFICACAO_ATENDIMENTO_NAO_LOCALIZADO'; end if;
  v_tipo_raw:=lower(coalesce(v_at.tipo_atendimento,''));
  v_origem_raw:=lower(coalesce(v_at.origem,''));
  select exists(select 1 from public.internacoes i where i.atendimento_id=v_at.id) into v_internacao;
  select exists(select 1 from public.triagens t where t.atendimento_id=v_at.id) into v_triagem;
  select exists(select 1 from public.solicitacoes_exames s where s.atendimento_id=v_at.id and coalesce(s.status,'')<>'cancelado') into v_exames;
  select (
    exists(select 1 from public.procedimentos_assistenciais p where p.atendimento_id=v_at.id and p.status='realizado')
    or exists(select 1 from public.central_guias g where g.atendimento_id=v_at.id and g.tipo='consulta' and g.status='autorizada')
  ) into v_nao_exame;
  v_sinal_ps := v_tipo_raw ~ '(pronto|urg[eê]ncia|emerg[eê]ncia|^ps$|pronto[_ -]?atendimento)'
    or v_origem_raw ~ '(pronto|urg[eê]ncia|emerg[eê]ncia|^ps$)'
    or v_origem_raw='demanda_espontanea';
  v_sinal_sadt := v_tipo_raw ~ '(sadt|laborat[oó]rio|laboratorio|imagem|exame|diagn[oó]stico|diagnostico)'
    or v_origem_raw ~ '(sadt|laborat[oó]rio|laboratorio|imagem|exame|diagn[oó]stico|diagnostico)';
  if v_internacao then v_tipo:='internacao';
  elsif v_sinal_ps or (v_triagem and v_origem_raw='demanda_espontanea') then v_tipo:='pronto_atendimento';
  elsif v_sinal_sadt or (v_exames and not v_nao_exame) then v_tipo:='sadt';
  else v_tipo:='ambulatorio'; end if;
  return jsonb_build_object(
    'tipo',v_tipo,'atendimento_id',v_at.id,'tipo_atendimento_origem',nullif(v_at.tipo_atendimento,''),'origem',nullif(v_at.origem,''),
    'possui_internacao',v_internacao,'possui_triagem',v_triagem,'possui_exames',v_exames,'possui_producao_nao_exame',v_nao_exame,
    'sinal_pronto_atendimento',v_sinal_ps,'sinal_sadt',v_sinal_sadt,'regra','internacao > pronto_atendimento > sadt_eletivo > ambulatorio');
end;
$$;
revoke all on function public.faturamento_classificar_atendimento_internal(uuid) from public,anon,authenticated;

create or replace function public.faturamento_classificar_conta_before()
returns trigger
language plpgsql security definer
set search_path to 'public','pg_catalog'
as $$
declare v_class jsonb;
begin
  if tg_op='INSERT' or new.atendimento_id is distinct from old.atendimento_id or coalesce(new.tipo_atendimento_classificacao_origem,'automatico')<>'manual' then
    if coalesce(new.tipo_atendimento_classificacao_origem,'automatico')<>'manual' then
      v_class:=public.faturamento_classificar_atendimento_internal(new.atendimento_id);
      new.tipo_atendimento_faturamento:=v_class->>'tipo';
      new.tipo_atendimento_classificacao_origem:='automatico';
      new.tipo_atendimento_classificacao_memoria:=v_class;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.faturamento_classificar_conta_before() from public,anon,authenticated;

drop trigger if exists trg_faturamento_classificar_conta on public.contas_faturamento;
create trigger trg_faturamento_classificar_conta
before insert or update of atendimento_id,tipo_atendimento_classificacao_origem
on public.contas_faturamento for each row execute function public.faturamento_classificar_conta_before();

with classificacoes as (
  select c.id,public.faturamento_classificar_atendimento_internal(c.atendimento_id) classificacao
  from public.contas_faturamento c
  where c.tipo_atendimento_classificacao_origem<>'manual' or c.tipo_atendimento_faturamento is null
)
update public.contas_faturamento c
set tipo_atendimento_faturamento=x.classificacao->>'tipo',tipo_atendimento_classificacao_origem='automatico',
    tipo_atendimento_classificacao_memoria=x.classificacao,updated_at=now()
from classificacoes x where c.id=x.id;

alter table public.contas_faturamento alter column tipo_atendimento_faturamento set not null;
create index if not exists contas_faturamento_tipo_idx on public.contas_faturamento(empresa_id,unidade_id,tipo_atendimento_faturamento,competencia,status);

create or replace function public.faturamento_reclassificar_tipo_atendimento(p_conta_id uuid,p_tipo text,p_justificativa text)
returns jsonb
language plpgsql security definer
set search_path to 'public','pg_catalog'
as $$
declare v_user uuid:=auth.uid(); v_conta public.contas_faturamento%rowtype; v_anterior text;
begin
  if v_user is null then raise exception 'FAT_CLASSIFICACAO_NAO_AUTENTICADO' using errcode='42501'; end if;
  select * into v_conta from public.contas_faturamento where id=p_conta_id for update;
  if not found then raise exception 'FAT_CLASSIFICACAO_CONTA_NAO_LOCALIZADA'; end if;
  if not public.tem_unidade(v_conta.empresa_id,v_conta.unidade_id) or not public.tem_permissao(v_conta.empresa_id,v_conta.unidade_id,'faturamento.criar') then raise exception 'FAT_CLASSIFICACAO_SEM_PERMISSAO' using errcode='42501'; end if;
  if p_tipo not in ('pronto_atendimento','ambulatorio','internacao','sadt') then raise exception 'FAT_CLASSIFICACAO_TIPO_INVALIDO'; end if;
  if nullif(btrim(coalesce(p_justificativa,'')),'') is null then raise exception 'FAT_CLASSIFICACAO_JUSTIFICATIVA_OBRIGATORIA'; end if;
  if v_conta.status in ('faturada','cancelada') or exists(select 1 from public.tiss_guias g where g.conta_id=v_conta.id and g.status<>'cancelada') then raise exception 'FAT_CLASSIFICACAO_CONTA_BLOQUEADA'; end if;
  v_anterior:=v_conta.tipo_atendimento_faturamento;
  update public.contas_faturamento set tipo_atendimento_faturamento=p_tipo,tipo_atendimento_classificacao_origem='manual',
    tipo_atendimento_classificacao_memoria=coalesce(tipo_atendimento_classificacao_memoria,'{}'::jsonb)||jsonb_build_object('reclassificado_de',v_anterior,'reclassificado_para',p_tipo,'justificativa',btrim(p_justificativa),'reclassificado_em',now(),'reclassificado_por',v_user),
    updated_at=now(),updated_by=v_user where id=v_conta.id;
  insert into public.auditoria_eventos(empresa_id,unidade_id,usuario_id,operacao,entidade,registro_id,origem,valores_anteriores,valores_novos,motivo)
  values(v_conta.empresa_id,v_conta.unidade_id,v_user,'reclassificar','contas_faturamento',v_conta.id,'faturamento',jsonb_build_object('tipo_atendimento_faturamento',v_anterior),jsonb_build_object('tipo_atendimento_faturamento',p_tipo),btrim(p_justificativa));
  return jsonb_build_object('status','ok','conta_id',v_conta.id,'anterior',v_anterior,'tipo',p_tipo);
end;
$$;
revoke all on function public.faturamento_reclassificar_tipo_atendimento(uuid,text,text) from public,anon;
grant execute on function public.faturamento_reclassificar_tipo_atendimento(uuid,text,text) to authenticated;

alter table public.tiss_lotes add column if not exists tipo_atendimento_faturamento text null;
alter table public.tiss_lotes drop constraint if exists tiss_lotes_tipo_atendimento_faturamento_check;
alter table public.tiss_lotes add constraint tiss_lotes_tipo_atendimento_faturamento_check
  check (tipo_atendimento_faturamento is null or tipo_atendimento_faturamento in ('pronto_atendimento','ambulatorio','internacao','sadt'));
create index if not exists tiss_lotes_tipo_atendimento_idx on public.tiss_lotes(empresa_id,unidade_id,convenio_id,competencia,tipo_atendimento_faturamento,status);

create or replace function public.tiss_guia_tipo_faturamento_before()
returns trigger
language plpgsql security definer
set search_path to 'public','pg_catalog'
as $$
declare v_tipo text;
begin
  select tipo_atendimento_faturamento into v_tipo from public.contas_faturamento where id=new.conta_id;
  if v_tipo='internacao' then new.tipo_guia:='resumo_internacao';
  elsif v_tipo in ('pronto_atendimento','sadt') then new.tipo_guia:='sp_sadt'; end if;
  return new;
end;
$$;
revoke all on function public.tiss_guia_tipo_faturamento_before() from public,anon,authenticated;
drop trigger if exists trg_tiss_guia_tipo_faturamento on public.tiss_guias;
create trigger trg_tiss_guia_tipo_faturamento before insert on public.tiss_guias for each row execute function public.tiss_guia_tipo_faturamento_before();

create or replace function public.validar_tipo_atendimento_lote_tiss_internal()
returns trigger
language plpgsql security definer
set search_path to 'public','pg_catalog'
as $$
declare v_lote_tipo text; v_guia_tipo text;
begin
  select l.tipo_atendimento_faturamento into v_lote_tipo from public.tiss_lotes l where l.id=new.lote_id for update;
  select cf.tipo_atendimento_faturamento into v_guia_tipo from public.tiss_guias g join public.contas_faturamento cf on cf.id=g.conta_id where g.id=new.guia_id;
  if v_guia_tipo is null then raise exception 'TISS_LOTE_GUIA_SEM_TIPO_FATURAMENTO'; end if;
  if v_lote_tipo is null then update public.tiss_lotes set tipo_atendimento_faturamento=v_guia_tipo where id=new.lote_id;
  elsif v_lote_tipo<>v_guia_tipo then raise exception 'TISS_LOTE_TIPO_ATENDIMENTO_MISTO'; end if;
  return new;
end;
$$;
revoke all on function public.validar_tipo_atendimento_lote_tiss_internal() from public,anon,authenticated;
drop trigger if exists trg_tiss_lote_guia_tipo_atendimento on public.tiss_lote_guias;
create trigger trg_tiss_lote_guia_tipo_atendimento before insert on public.tiss_lote_guias for each row execute function public.validar_tipo_atendimento_lote_tiss_internal();

create or replace function public.criar_lote_tiss_por_tipo_transacional(
  p_unidade_id uuid,p_convenio_id uuid,p_competencia text,p_tipo_atendimento_faturamento text,p_previsao_pagamento date default null
) returns jsonb
language plpgsql security definer
set search_path to 'public','pg_catalog','extensions'
as $$
declare
  v_user uuid := auth.uid(); v_empresa_id uuid; v_versao_id uuid; v_lote_id uuid; v_numero_lote text; v_guia_ids uuid[];
  v_tipo_guia text; v_tipo_faturamento text; v_quantidade integer := 0; v_valor_total numeric := 0; v_seq bigint;
begin
  if v_user is null then raise exception 'TISS_NAO_AUTENTICADO' using errcode='42501'; end if;
  if p_unidade_id is null or p_convenio_id is null then raise exception 'TISS_LOTE_ESCOPO_OBRIGATORIO' using errcode='22023'; end if;
  if coalesce(p_competencia,'') !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then raise exception 'TISS_LOTE_COMPETENCIA_INVALIDA' using errcode='22023'; end if;
  if p_tipo_atendimento_faturamento is not null and p_tipo_atendimento_faturamento not in ('pronto_atendimento','ambulatorio','internacao','sadt') then raise exception 'TISS_LOTE_TIPO_ATENDIMENTO_INVALIDO' using errcode='22023'; end if;
  select u.empresa_id into v_empresa_id from public.unidades u where u.id=p_unidade_id and u.ativo;
  if v_empresa_id is null or not public.tem_unidade(v_empresa_id,p_unidade_id) then raise exception 'TISS_LOTE_SEM_ACESSO_UNIDADE' using errcode='42501'; end if;
  if not public.tem_permissao(v_empresa_id,p_unidade_id,'tiss.gerar') then raise exception 'TISS_LOTE_SEM_PERMISSAO' using errcode='42501'; end if;
  if not exists(select 1 from public.convenios c where c.id=p_convenio_id and c.empresa_id=v_empresa_id and c.ativo) then raise exception 'TISS_LOTE_CONVENIO_INVALIDO' using errcode='22023'; end if;
  select tv.id into v_versao_id from public.tiss_versoes tv where tv.ativo order by tv.vigente_desde desc nulls last,tv.created_at desc,tv.id limit 1;
  if v_versao_id is null then raise exception 'TISS_LOTE_VERSAO_INDISPONIVEL' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_unidade_id::text||'|'||p_convenio_id::text||'|'||p_competencia||'|'||coalesce(p_tipo_atendimento_faturamento,'auto'),0));

  select g.tipo_guia,cf.tipo_atendimento_faturamento into v_tipo_guia,v_tipo_faturamento
  from public.tiss_guias g join public.contas_faturamento cf on cf.id=g.conta_id
  where g.empresa_id=v_empresa_id and g.unidade_id=p_unidade_id and g.convenio_id=p_convenio_id and g.versao_id=v_versao_id and g.status='pronta'
    and cf.empresa_id=v_empresa_id and cf.unidade_id=p_unidade_id and cf.convenio_id=p_convenio_id and cf.competencia=p_competencia
    and cf.tipo_cobranca='convenio' and cf.status='pronta' and cf.auditoria_liberada and cf.contas_medicas_liberada
    and (p_tipo_atendimento_faturamento is null or cf.tipo_atendimento_faturamento=p_tipo_atendimento_faturamento)
    and not exists(select 1 from public.tiss_lote_guias lg join public.tiss_lotes l on l.id=lg.lote_id where lg.guia_id=g.id and l.status<>'rejeitado')
  order by g.data_atendimento nulls last,g.created_at,g.id for update of g limit 1;
  if v_tipo_guia is null or v_tipo_faturamento is null then raise exception 'TISS_LOTE_SEM_GUIAS_ELEGIVEIS' using errcode='P0001'; end if;

  with elegiveis as (
    select g.id,g.valor_total from public.tiss_guias g join public.contas_faturamento cf on cf.id=g.conta_id
    where g.empresa_id=v_empresa_id and g.unidade_id=p_unidade_id and g.convenio_id=p_convenio_id and g.versao_id=v_versao_id
      and g.tipo_guia=v_tipo_guia and g.status='pronta' and cf.empresa_id=v_empresa_id and cf.unidade_id=p_unidade_id and cf.convenio_id=p_convenio_id
      and cf.competencia=p_competencia and cf.tipo_cobranca='convenio' and cf.status='pronta' and cf.auditoria_liberada and cf.contas_medicas_liberada
      and cf.tipo_atendimento_faturamento=v_tipo_faturamento
      and not exists(select 1 from public.tiss_lote_guias lg join public.tiss_lotes l on l.id=lg.lote_id where lg.guia_id=g.id and l.status<>'rejeitado')
    order by g.data_atendimento nulls last,g.created_at,g.id for update of g limit 100
  )
  select array_agg(id order by id),count(*)::int,coalesce(sum(valor_total),0) into v_guia_ids,v_quantidade,v_valor_total from elegiveis;
  if coalesce(v_quantidade,0)=0 then raise exception 'TISS_LOTE_SEM_GUIAS_ELEGIVEIS' using errcode='P0001'; end if;
  v_seq:=nextval('public.tiss_lote_numero_seq'); if v_seq>99999999 then raise exception 'TISS_LOTE_SEQUENCIAL_XSD_EXCEDIDO'; end if;
  v_numero_lote:=to_char(current_date,'YYMM')||lpad(v_seq::text,8,'0');
  insert into public.tiss_lotes(empresa_id,unidade_id,convenio_id,versao_id,numero_lote,competencia,status,previsao_pagamento,quantidade_guias,valor_total,created_by,tipo_atendimento_faturamento)
  values(v_empresa_id,p_unidade_id,p_convenio_id,v_versao_id,v_numero_lote,p_competencia,'rascunho',p_previsao_pagamento,v_quantidade,v_valor_total,v_user,v_tipo_faturamento) returning id into v_lote_id;
  insert into public.tiss_lote_guias(lote_id,guia_id) select v_lote_id,unnest(v_guia_ids);
  update public.tiss_guias set status='em_lote',updated_by=v_user,updated_at=now() where id=any(v_guia_ids);
  insert into public.financeiro_recebiveis(empresa_id,unidade_id,lote_id,convenio_id,competencia,previsao_pagamento,valor_bruto,valor_liquido_previsto,status,created_by,updated_by)
  values(v_empresa_id,p_unidade_id,v_lote_id,p_convenio_id,p_competencia,p_previsao_pagamento,v_valor_total,v_valor_total,'previsto',v_user,v_user);
  return jsonb_build_object('lote_id',v_lote_id,'numero_lote',v_numero_lote,'competencia',p_competencia,'tipo_guia',v_tipo_guia,'tipo_atendimento_faturamento',v_tipo_faturamento,'quantidade_guias',v_quantidade,'valor_total',v_valor_total,'versao_id',v_versao_id);
end;
$$;
revoke all on function public.criar_lote_tiss_por_tipo_transacional(uuid,uuid,text,text,date) from public,anon;
grant execute on function public.criar_lote_tiss_por_tipo_transacional(uuid,uuid,text,text,date) to authenticated;

create or replace function public.criar_lote_tiss_transacional(p_unidade_id uuid,p_convenio_id uuid,p_competencia text,p_previsao_pagamento date default null)
returns jsonb language plpgsql security definer set search_path to 'public','pg_catalog','extensions' as $$
begin
  return public.criar_lote_tiss_por_tipo_transacional(p_unidade_id,p_convenio_id,p_competencia,null,p_previsao_pagamento);
end;
$$;
revoke all on function public.criar_lote_tiss_transacional(uuid,uuid,text,date) from public,anon;
grant execute on function public.criar_lote_tiss_transacional(uuid,uuid,text,date) to authenticated;
