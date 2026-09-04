alter table public.contas_faturamento
  add column if not exists internacao_id uuid,
  add column if not exists modalidade_conta text not null default 'unica',
  add column if not exists periodo_inicio date,
  add column if not exists periodo_fim date,
  add column if not exists parcial_numero integer,
  add column if not exists conta_origem_id uuid,
  add column if not exists congelada_em timestamptz,
  add column if not exists congelada_por uuid,
  add column if not exists observacao_fechamento text;

do $$ begin
  if not exists(select 1 from pg_constraint where conname='contas_faturamento_internacao_id_fkey') then
    alter table public.contas_faturamento add constraint contas_faturamento_internacao_id_fkey
      foreign key(internacao_id) references public.internacoes(id) on delete set null;
  end if;
  if not exists(select 1 from pg_constraint where conname='contas_faturamento_conta_origem_id_fkey') then
    alter table public.contas_faturamento add constraint contas_faturamento_conta_origem_id_fkey
      foreign key(conta_origem_id) references public.contas_faturamento(id) on delete set null;
  end if;
  if not exists(select 1 from pg_constraint where conname='contas_faturamento_congelada_por_fkey') then
    alter table public.contas_faturamento add constraint contas_faturamento_congelada_por_fkey
      foreign key(congelada_por) references auth.users(id) on delete set null;
  end if;
  if not exists(select 1 from pg_constraint where conname='contas_faturamento_modalidade_check') then
    alter table public.contas_faturamento add constraint contas_faturamento_modalidade_check
      check(modalidade_conta in ('unica','corrente','parcial','final','complementar'));
  end if;
  if not exists(select 1 from pg_constraint where conname='contas_faturamento_periodo_check') then
    alter table public.contas_faturamento add constraint contas_faturamento_periodo_check
      check(periodo_fim is null or periodo_inicio is null or periodo_fim>=periodo_inicio);
  end if;
end $$;

update public.contas_faturamento c
   set internacao_id=(select i.id from public.internacoes i where i.atendimento_id=c.atendimento_id order by i.data_internacao desc,i.id desc limit 1)
 where c.internacao_id is null and c.tipo_atendimento_faturamento='internacao';

alter table public.contas_faturamento drop constraint if exists contas_faturamento_atendimento_id_key;
drop index if exists public.contas_faturamento_atendimento_id_key;
create unique index if not exists contas_faturamento_unica_atendimento_uniq
  on public.contas_faturamento(atendimento_id)
  where modalidade_conta='unica' and status<>'cancelada';
create unique index if not exists contas_faturamento_corrente_atendimento_uniq
  on public.contas_faturamento(atendimento_id)
  where modalidade_conta='corrente' and status<>'cancelada';
create unique index if not exists contas_faturamento_parcial_numero_uniq
  on public.contas_faturamento(internacao_id,parcial_numero)
  where modalidade_conta='parcial' and status<>'cancelada';
create unique index if not exists contas_faturamento_final_internacao_uniq
  on public.contas_faturamento(internacao_id)
  where modalidade_conta='final' and status<>'cancelada';
create index if not exists contas_faturamento_internacao_periodo_idx
  on public.contas_faturamento(internacao_id,periodo_inicio,periodo_fim,modalidade_conta,status);

alter table public.auditoria_contas drop constraint if exists auditoria_contas_atendimento_id_key;
drop index if exists public.auditoria_contas_atendimento_id_key;
create unique index if not exists auditoria_contas_conta_id_uniq
  on public.auditoria_contas(conta_id) where conta_id is not null;
create index if not exists auditoria_contas_atendimento_idx on public.auditoria_contas(atendimento_id,created_at desc);

create or replace function public.faturamento_validar_periodo_conta_internal()
returns trigger language plpgsql security definer set search_path='public','pg_catalog' as $$
declare v_i public.internacoes%rowtype;
begin
  if new.modalidade_conta in ('parcial','final') then
    if new.internacao_id is null or new.periodo_inicio is null or new.periodo_fim is null then
      raise exception 'FAT_INTERNACAO_PERIODO_OBRIGATORIO';
    end if;
    select * into v_i from public.internacoes where id=new.internacao_id;
    if not found then raise exception 'FAT_INTERNACAO_NAO_LOCALIZADA'; end if;
    if new.atendimento_id is distinct from v_i.atendimento_id then raise exception 'FAT_INTERNACAO_ATENDIMENTO_DIVERGENTE'; end if;
    if new.periodo_inicio < (v_i.data_internacao at time zone 'America/Sao_Paulo')::date then raise exception 'FAT_INTERNACAO_PERIODO_ANTES_ADMISSAO'; end if;
    if v_i.data_alta is not null and new.periodo_fim > (v_i.data_alta at time zone 'America/Sao_Paulo')::date then raise exception 'FAT_INTERNACAO_PERIODO_APOS_ALTA'; end if;
    if exists(
      select 1 from public.contas_faturamento c
       where c.internacao_id=new.internacao_id and c.id<>new.id and c.status<>'cancelada'
         and c.modalidade_conta in ('parcial','final')
         and daterange(c.periodo_inicio,c.periodo_fim,'[]') && daterange(new.periodo_inicio,new.periodo_fim,'[]')
    ) then raise exception 'FAT_INTERNACAO_PERIODO_SOBREPOSTO'; end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_faturamento_validar_periodo_conta on public.contas_faturamento;
create trigger trg_faturamento_validar_periodo_conta
before insert or update of internacao_id,modalidade_conta,periodo_inicio,periodo_fim,status
on public.contas_faturamento for each row execute function public.faturamento_validar_periodo_conta_internal();

create or replace function public.encaminhar_conta_especifica_para_auditoria_internal(p_conta_id uuid)
returns uuid language plpgsql security definer set search_path='public','pg_catalog' as $$
declare v_c public.contas_faturamento%rowtype; v_auditoria uuid;
begin
  select * into v_c from public.contas_faturamento where id=p_conta_id;
  if not found then raise exception 'FAT_AUDITORIA_CONTA_NAO_LOCALIZADA'; end if;
  insert into public.auditoria_contas(empresa_id,unidade_id,atendimento_id,conta_id,status)
  values(v_c.empresa_id,v_c.unidade_id,v_c.atendimento_id,v_c.id,'aguardando')
  on conflict(conta_id) where conta_id is not null do update
    set status=case when public.auditoria_contas.status='finalizada' then public.auditoria_contas.status else 'aguardando' end,
        updated_at=now()
  returning id into v_auditoria;
  update public.contas_faturamento set auditoria_liberada=false,auditoria_id=v_auditoria,updated_at=now() where id=v_c.id;
  return v_auditoria;
end $$;

create or replace function public.encaminhar_conta_para_auditoria_internal(p_atendimento_id uuid)
returns uuid language plpgsql security definer set search_path='public','pg_catalog' as $$
declare v_conta uuid;
begin
  select c.id into v_conta
    from public.contas_faturamento c
   where c.atendimento_id=p_atendimento_id and c.status<>'cancelada'
   order by case c.modalidade_conta when 'corrente' then 0 when 'unica' then 1 when 'final' then 2 when 'parcial' then 3 else 4 end,
            c.created_at desc,c.id desc
   limit 1;
  if v_conta is null then raise exception 'FAT_AUDITORIA_CONTA_NAO_LOCALIZADA'; end if;
  return public.encaminhar_conta_especifica_para_auditoria_internal(v_conta);
end $$;

create or replace function public.faturamento_sincronizar_conta_internacao_corrente_internal(p_internacao_id uuid)
returns uuid language plpgsql security definer set search_path='public','pg_catalog' as $$
declare
  v_i public.internacoes%rowtype;
  v_at public.atendimentos%rowtype;
  v_conta public.contas_faturamento%rowtype;
  v_total numeric(14,2):=0;
  r record;
begin
  select * into v_i from public.internacoes where id=p_internacao_id for update;
  if not found then raise exception 'FAT_INTERNACAO_NAO_LOCALIZADA'; end if;
  select * into v_at from public.atendimentos where id=v_i.atendimento_id;
  if not found then raise exception 'FAT_INTERNACAO_ATENDIMENTO_NAO_LOCALIZADO'; end if;

  select * into v_conta from public.contas_faturamento
   where atendimento_id=v_i.atendimento_id and status<>'cancelada' and modalidade_conta='corrente'
   order by created_at desc limit 1 for update;

  if v_conta.id is null then
    select * into v_conta from public.contas_faturamento
     where atendimento_id=v_i.atendimento_id and status not in ('faturada','cancelada') and modalidade_conta='unica'
       and not exists(select 1 from public.tiss_guias g where g.conta_id=contas_faturamento.id and g.status<>'cancelada')
     order by created_at desc limit 1 for update;
    if v_conta.id is not null then
      update public.contas_faturamento set modalidade_conta='corrente',internacao_id=v_i.id,
        tipo_atendimento_faturamento='internacao',periodo_inicio=(v_i.data_internacao at time zone 'America/Sao_Paulo')::date,
        periodo_fim=null,congelada_em=null,congelada_por=null,updated_at=now(),updated_by=auth.uid()
      where id=v_conta.id returning * into v_conta;
    end if;
  end if;

  if v_conta.id is null then
    insert into public.contas_faturamento(
      empresa_id,unidade_id,atendimento_id,paciente_id,convenio_id,plano_id,competencia,tipo_cobranca,status,
      auditoria_liberada,contas_medicas_liberada,created_by,updated_by,tipo_atendimento_faturamento,
      tipo_atendimento_classificacao_origem,tipo_atendimento_classificacao_memoria,
      internacao_id,modalidade_conta,periodo_inicio
    ) values(
      v_at.empresa_id,v_at.unidade_id,v_at.id,v_at.paciente_id,v_at.convenio_id,v_at.plano_id,
      to_char(now() at time zone 'America/Sao_Paulo','YYYY-MM'),case when v_at.cobertura::text='convenio' then 'convenio' else 'particular' end,
      'aberta',false,false,auth.uid(),auth.uid(),'internacao','automatico',jsonb_build_object('origem','internacao_conta_corrente'),
      v_i.id,'corrente',(v_i.data_internacao at time zone 'America/Sao_Paulo')::date
    ) returning * into v_conta;
  end if;

  perform public.sincronizar_producao_atendimento_internal(v_at.id);
  perform public.consolidar_producao_conta_internal(v_at.id,v_conta.id);
  for r in select id from public.conta_faturamento_itens where conta_id=v_conta.id and cobravel and codigo is not null loop
    begin perform public.recalcular_item_contratual_avancado_internal(r.id); exception when others then raise warning 'PRECIFICACAO_PARCIAL_PENDENTE item=% sqlstate=%',r.id,sqlstate; end;
  end loop;
  update public.conta_faturamento_itens set
    valor_unitario=coalesce(valor_contratual_calculado,valor_unitario,0),
    valor_total=round(coalesce(valor_contratual_calculado,valor_unitario,0)*quantidade,2)
  where conta_id=v_conta.id and cobravel;
  select coalesce(sum(valor_total) filter(where cobravel),0) into v_total from public.conta_faturamento_itens where conta_id=v_conta.id;
  update public.contas_faturamento set valor_bruto=v_total,valor_liquido=greatest(v_total-coalesce(valor_desconto,0),0),
    competencia=to_char(now() at time zone 'America/Sao_Paulo','YYYY-MM'),updated_at=now(),updated_by=auth.uid()
  where id=v_conta.id;
  return v_conta.id;
end $$;

create or replace function public.faturamento_fechar_parcial_internacao(
  p_internacao_id uuid,p_periodo_inicio date,p_periodo_fim date,p_observacao text default null
)
returns jsonb language plpgsql security definer set search_path='public','pg_catalog','extensions' as $$
declare
  v_user uuid:=auth.uid();
  v_i public.internacoes%rowtype;
  v_at public.atendimentos%rowtype;
  v_corrente uuid;
  v_parcial uuid;
  v_num integer;
  v_inicio_esperado date;
  v_total numeric(14,2):=0;
  v_auditoria uuid;
  v_grupo_novo uuid;
  g record;
begin
  if v_user is null then raise exception 'FAT_PARCIAL_NAO_AUTENTICADO' using errcode='42501'; end if;
  select * into v_i from public.internacoes where id=p_internacao_id for update;
  if not found then raise exception 'FAT_PARCIAL_INTERNACAO_NAO_LOCALIZADA'; end if;
  select * into v_at from public.atendimentos where id=v_i.atendimento_id;
  if not public.tem_unidade(v_at.empresa_id,v_at.unidade_id) or not public.tem_alguma_permissao_funcional(v_at.empresa_id,v_at.unidade_id,array['faturamento.criar','faturamento.fechar','contas_medicas.processar']) then raise exception 'FAT_PARCIAL_SEM_PERMISSAO' using errcode='42501'; end if;
  if v_i.status not in ('aguardando_leito','internado','transferido') or v_i.data_alta is not null then raise exception 'FAT_PARCIAL_INTERNACAO_NAO_ATIVA'; end if;
  if p_periodo_inicio is null or p_periodo_fim is null or p_periodo_fim<p_periodo_inicio then raise exception 'FAT_PARCIAL_PERIODO_INVALIDO'; end if;
  if p_periodo_fim>(now() at time zone 'America/Sao_Paulo')::date then raise exception 'FAT_PARCIAL_PERIODO_FUTURO'; end if;
  select coalesce(max(c.periodo_fim)+1,(v_i.data_internacao at time zone 'America/Sao_Paulo')::date)
    into v_inicio_esperado from public.contas_faturamento c
   where c.internacao_id=v_i.id and c.modalidade_conta='parcial' and c.status<>'cancelada';
  if p_periodo_inicio<>v_inicio_esperado then raise exception 'FAT_PARCIAL_INICIO_ESPERADO:%',v_inicio_esperado; end if;
  if exists(select 1 from public.contas_faturamento c where c.internacao_id=v_i.id and c.status<>'cancelada' and c.modalidade_conta in ('parcial','final') and daterange(c.periodo_inicio,c.periodo_fim,'[]') && daterange(p_periodo_inicio,p_periodo_fim,'[]')) then raise exception 'FAT_PARCIAL_PERIODO_SOBREPOSTO'; end if;

  v_corrente:=public.faturamento_sincronizar_conta_internacao_corrente_internal(v_i.id);
  if exists(select 1 from public.conta_faturamento_itens where conta_id=v_corrente and cobravel and data_execucao is null) then raise exception 'FAT_PARCIAL_ITEM_SEM_DATA'; end if;
  select coalesce(max(parcial_numero),0)+1 into v_num from public.contas_faturamento where internacao_id=v_i.id and modalidade_conta='parcial' and status<>'cancelada';

  insert into public.contas_faturamento(
    empresa_id,unidade_id,atendimento_id,paciente_id,convenio_id,plano_id,competencia,tipo_cobranca,status,
    valor_bruto,valor_desconto,valor_liquido,auditoria_liberada,contas_medicas_liberada,created_by,updated_by,
    tipo_atendimento_faturamento,tipo_atendimento_classificacao_origem,tipo_atendimento_classificacao_memoria,
    internacao_id,modalidade_conta,periodo_inicio,periodo_fim,parcial_numero,conta_origem_id,congelada_em,congelada_por,observacao_fechamento
  ) select
    empresa_id,unidade_id,atendimento_id,paciente_id,convenio_id,plano_id,to_char(p_periodo_fim,'YYYY-MM'),tipo_cobranca,'pre_faturamento',
    0,0,0,false,false,v_user,v_user,'internacao','automatico',
    jsonb_build_object('origem','fechamento_parcial','parcial_numero',v_num,'periodo_inicio',p_periodo_inicio,'periodo_fim',p_periodo_fim),
    v_i.id,'parcial',p_periodo_inicio,p_periodo_fim,v_num,v_corrente,now(),v_user,nullif(btrim(coalesce(p_observacao,'')),'')
  from public.contas_faturamento where id=v_corrente returning id into v_parcial;

  create temporary table if not exists fat_grupo_map(old_id uuid primary key,new_id uuid not null) on commit drop;
  truncate fat_grupo_map;
  for g in
    select ga.* from public.conta_faturamento_grupos_ato ga
     where ga.conta_id=v_corrente and exists(
       select 1 from public.conta_faturamento_itens i where i.conta_id=v_corrente and i.grupo_ato_id=ga.id
         and (i.data_execucao at time zone 'America/Sao_Paulo')::date between p_periodo_inicio and p_periodo_fim
     )
  loop
    insert into public.conta_faturamento_grupos_ato(conta_id,codigo_grupo,mesma_via,data_ato,observacao,percentual_principal,percentual_mesma_via,percentual_via_diferente)
    values(v_parcial,g.codigo_grupo,g.mesma_via,g.data_ato,g.observacao,g.percentual_principal,g.percentual_mesma_via,g.percentual_via_diferente)
    returning id into v_grupo_novo;
    insert into fat_grupo_map(old_id,new_id) values(g.id,v_grupo_novo);
  end loop;

  insert into public.conta_faturamento_itens(
    conta_id,origem_tipo,origem_id,data_execucao,tabela,codigo,descricao,quantidade,valor_unitario,percentual_reducao_acrescimo,valor_total,
    profissional_id,setor,cobravel,observacao,grupo_ato_id,sequencia_ato,via_acesso,urgencia,horario_especial,acomodacao_individual,anestesia,
    numero_auxiliares,quantidade_auxiliares,filme_m2,percentual_aplicado,valor_contratual_calculado,valor_referencia,valor_referencia_contrato,
    origem_valor,metodologia_preco,tabela_comercial_edicao_id,tabela_comercial_item_id,tabela_procedimento_edicao_id,tabela_procedimento_item_id,
    memoria_calculo,memoria_calculo_comercial,valor_cobrado_original,divergencia_valor_contratual,regra_contratual_id,valor_filme,valor_anestesista,
    valor_auxiliares,pacote_id,item_assistencial_id,categoria_item,familia_tuss,producao_evento_id,setor_subgrupo,subgrupo_item,
    parcial_numero,parcial_inicio,parcial_fim,setor_paciente,andar_paciente,origem_operacional,localizacao_memoria
  )
  select
    v_parcial,i.origem_tipo,i.origem_id,i.data_execucao,i.tabela,i.codigo,i.descricao,i.quantidade,i.valor_unitario,i.percentual_reducao_acrescimo,i.valor_total,
    i.profissional_id,i.setor,i.cobravel,i.observacao,gm.new_id,i.sequencia_ato,i.via_acesso,i.urgencia,i.horario_especial,i.acomodacao_individual,i.anestesia,
    i.numero_auxiliares,i.quantidade_auxiliares,i.filme_m2,i.percentual_aplicado,i.valor_contratual_calculado,i.valor_referencia,i.valor_referencia_contrato,
    i.origem_valor,i.metodologia_preco,i.tabela_comercial_edicao_id,i.tabela_comercial_item_id,i.tabela_procedimento_edicao_id,i.tabela_procedimento_item_id,
    i.memoria_calculo,i.memoria_calculo_comercial,i.valor_cobrado_original,i.divergencia_valor_contratual,i.regra_contratual_id,i.valor_filme,i.valor_anestesista,
    i.valor_auxiliares,i.pacote_id,i.item_assistencial_id,i.categoria_item,i.familia_tuss,i.producao_evento_id,i.setor_subgrupo,i.subgrupo_item,
    v_num,p_periodo_inicio,p_periodo_fim,i.setor_paciente,i.andar_paciente,i.origem_operacional,
    coalesce(i.localizacao_memoria,'{}'::jsonb)||jsonb_build_object('snapshot_parcial',v_num)
  from public.conta_faturamento_itens i
  left join fat_grupo_map gm on gm.old_id=i.grupo_ato_id
  where i.conta_id=v_corrente and (i.data_execucao at time zone 'America/Sao_Paulo')::date between p_periodo_inicio and p_periodo_fim;

  if not found then raise exception 'FAT_PARCIAL_SEM_ITENS_NO_PERIODO'; end if;
  select coalesce(sum(valor_total) filter(where cobravel),0) into v_total from public.conta_faturamento_itens where conta_id=v_parcial;
  update public.contas_faturamento set valor_bruto=v_total,valor_liquido=v_total,fechada_em=now(),updated_at=now(),updated_by=v_user where id=v_parcial;
  v_auditoria:=public.encaminhar_conta_especifica_para_auditoria_internal(v_parcial);
  begin perform public.executar_auditoria_conta_automatica_internal(v_auditoria); exception when others then raise warning 'AUDITORIA_PARCIAL_PENDENTE auditoria=% sqlstate=%',v_auditoria,sqlstate; end;

  return jsonb_build_object('conta_id',v_parcial,'conta_corrente_id',v_corrente,'internacao_id',v_i.id,'parcial_numero',v_num,
    'periodo_inicio',p_periodo_inicio,'periodo_fim',p_periodo_fim,'valor_total',v_total,'auditoria_id',v_auditoria);
end $$;

create or replace function public.faturamento_fechar_conta_final_internacao(p_internacao_id uuid,p_observacao text default null)
returns jsonb language plpgsql security definer set search_path='public','pg_catalog','extensions' as $$
declare
  v_user uuid:=auth.uid(); v_i public.internacoes%rowtype; v_at public.atendimentos%rowtype;
  v_inicio date; v_fim date; v_corrente uuid; v_final uuid; v_total numeric(14,2):=0; v_auditoria uuid; v_grupo_novo uuid; g record;
begin
  if v_user is null then raise exception 'FAT_FINAL_NAO_AUTENTICADO' using errcode='42501'; end if;
  select * into v_i from public.internacoes where id=p_internacao_id for update;
  if not found then raise exception 'FAT_FINAL_INTERNACAO_NAO_LOCALIZADA'; end if;
  select * into v_at from public.atendimentos where id=v_i.atendimento_id;
  if not public.tem_unidade(v_at.empresa_id,v_at.unidade_id) or not public.tem_alguma_permissao_funcional(v_at.empresa_id,v_at.unidade_id,array['faturamento.criar','faturamento.fechar','contas_medicas.processar']) then raise exception 'FAT_FINAL_SEM_PERMISSAO' using errcode='42501'; end if;
  if v_i.data_alta is null then raise exception 'FAT_FINAL_INTERNACAO_SEM_ALTA'; end if;
  v_fim:=(v_i.data_alta at time zone 'America/Sao_Paulo')::date;
  select coalesce(max(c.periodo_fim)+1,(v_i.data_internacao at time zone 'America/Sao_Paulo')::date) into v_inicio
    from public.contas_faturamento c where c.internacao_id=v_i.id and c.modalidade_conta='parcial' and c.status<>'cancelada';
  if v_inicio>v_fim then raise exception 'FAT_FINAL_SEM_PERIODO_PENDENTE'; end if;
  if exists(select 1 from public.contas_faturamento c where c.internacao_id=v_i.id and c.modalidade_conta='final' and c.status<>'cancelada') then raise exception 'FAT_FINAL_JA_EXISTE'; end if;
  v_corrente:=public.faturamento_sincronizar_conta_internacao_corrente_internal(v_i.id);
  if exists(select 1 from public.conta_faturamento_itens where conta_id=v_corrente and cobravel and data_execucao is null) then raise exception 'FAT_FINAL_ITEM_SEM_DATA'; end if;

  insert into public.contas_faturamento(
    empresa_id,unidade_id,atendimento_id,paciente_id,convenio_id,plano_id,competencia,tipo_cobranca,status,valor_bruto,valor_desconto,valor_liquido,
    auditoria_liberada,contas_medicas_liberada,created_by,updated_by,tipo_atendimento_faturamento,tipo_atendimento_classificacao_origem,
    tipo_atendimento_classificacao_memoria,internacao_id,modalidade_conta,periodo_inicio,periodo_fim,conta_origem_id,congelada_em,congelada_por,observacao_fechamento
  ) select empresa_id,unidade_id,atendimento_id,paciente_id,convenio_id,plano_id,to_char(v_fim,'YYYY-MM'),tipo_cobranca,'pre_faturamento',0,0,0,
    false,false,v_user,v_user,'internacao','automatico',jsonb_build_object('origem','fechamento_final','periodo_inicio',v_inicio,'periodo_fim',v_fim),
    v_i.id,'final',v_inicio,v_fim,v_corrente,now(),v_user,nullif(btrim(coalesce(p_observacao,'')),'')
  from public.contas_faturamento where id=v_corrente returning id into v_final;

  create temporary table if not exists fat_grupo_map(old_id uuid primary key,new_id uuid not null) on commit drop;
  truncate fat_grupo_map;
  for g in select ga.* from public.conta_faturamento_grupos_ato ga where ga.conta_id=v_corrente and exists(
    select 1 from public.conta_faturamento_itens i where i.conta_id=v_corrente and i.grupo_ato_id=ga.id and (i.data_execucao at time zone 'America/Sao_Paulo')::date between v_inicio and v_fim
  ) loop
    insert into public.conta_faturamento_grupos_ato(conta_id,codigo_grupo,mesma_via,data_ato,observacao,percentual_principal,percentual_mesma_via,percentual_via_diferente)
    values(v_final,g.codigo_grupo,g.mesma_via,g.data_ato,g.observacao,g.percentual_principal,g.percentual_mesma_via,g.percentual_via_diferente) returning id into v_grupo_novo;
    insert into fat_grupo_map values(g.id,v_grupo_novo);
  end loop;

  insert into public.conta_faturamento_itens(
    conta_id,origem_tipo,origem_id,data_execucao,tabela,codigo,descricao,quantidade,valor_unitario,percentual_reducao_acrescimo,valor_total,
    profissional_id,setor,cobravel,observacao,grupo_ato_id,sequencia_ato,via_acesso,urgencia,horario_especial,acomodacao_individual,anestesia,
    numero_auxiliares,quantidade_auxiliares,filme_m2,percentual_aplicado,valor_contratual_calculado,valor_referencia,valor_referencia_contrato,
    origem_valor,metodologia_preco,tabela_comercial_edicao_id,tabela_comercial_item_id,tabela_procedimento_edicao_id,tabela_procedimento_item_id,
    memoria_calculo,memoria_calculo_comercial,valor_cobrado_original,divergencia_valor_contratual,regra_contratual_id,valor_filme,valor_anestesista,
    valor_auxiliares,pacote_id,item_assistencial_id,categoria_item,familia_tuss,producao_evento_id,setor_subgrupo,subgrupo_item,
    parcial_numero,parcial_inicio,parcial_fim,setor_paciente,andar_paciente,origem_operacional,localizacao_memoria
  ) select v_final,i.origem_tipo,i.origem_id,i.data_execucao,i.tabela,i.codigo,i.descricao,i.quantidade,i.valor_unitario,i.percentual_reducao_acrescimo,i.valor_total,
    i.profissional_id,i.setor,i.cobravel,i.observacao,gm.new_id,i.sequencia_ato,i.via_acesso,i.urgencia,i.horario_especial,i.acomodacao_individual,i.anestesia,
    i.numero_auxiliares,i.quantidade_auxiliares,i.filme_m2,i.percentual_aplicado,i.valor_contratual_calculado,i.valor_referencia,i.valor_referencia_contrato,
    i.origem_valor,i.metodologia_preco,i.tabela_comercial_edicao_id,i.tabela_comercial_item_id,i.tabela_procedimento_edicao_id,i.tabela_procedimento_item_id,
    i.memoria_calculo,i.memoria_calculo_comercial,i.valor_cobrado_original,i.divergencia_valor_contratual,i.regra_contratual_id,i.valor_filme,i.valor_anestesista,
    i.valor_auxiliares,i.pacote_id,i.item_assistencial_id,i.categoria_item,i.familia_tuss,i.producao_evento_id,i.setor_subgrupo,i.subgrupo_item,
    null,v_inicio,v_fim,i.setor_paciente,i.andar_paciente,i.origem_operacional,coalesce(i.localizacao_memoria,'{}'::jsonb)||jsonb_build_object('snapshot_final',true)
  from public.conta_faturamento_itens i left join fat_grupo_map gm on gm.old_id=i.grupo_ato_id
  where i.conta_id=v_corrente and (i.data_execucao at time zone 'America/Sao_Paulo')::date between v_inicio and v_fim;
  if not found then raise exception 'FAT_FINAL_SEM_ITENS_NO_PERIODO'; end if;
  select coalesce(sum(valor_total) filter(where cobravel),0) into v_total from public.conta_faturamento_itens where conta_id=v_final;
  update public.contas_faturamento set valor_bruto=v_total,valor_liquido=v_total,fechada_em=now(),updated_at=now(),updated_by=v_user where id=v_final;
  v_auditoria:=public.encaminhar_conta_especifica_para_auditoria_internal(v_final);
  begin perform public.executar_auditoria_conta_automatica_internal(v_auditoria); exception when others then raise warning 'AUDITORIA_FINAL_PENDENTE auditoria=% sqlstate=%',v_auditoria,sqlstate; end;
  return jsonb_build_object('conta_id',v_final,'conta_corrente_id',v_corrente,'internacao_id',v_i.id,'periodo_inicio',v_inicio,'periodo_fim',v_fim,'valor_total',v_total,'auditoria_id',v_auditoria);
end $$;

create or replace function public.faturamento_proteger_conta_congelada_internal()
returns trigger language plpgsql security definer set search_path='public','pg_catalog' as $$
begin
  if tg_op='DELETE' and old.congelada_em is not null then raise exception 'FAT_CONTA_CONGELADA'; end if;
  if tg_op='UPDATE' and old.congelada_em is not null then
    if new.status is distinct from old.status or new.auditoria_liberada is distinct from old.auditoria_liberada or new.contas_medicas_liberada is distinct from old.contas_medicas_liberada or new.auditoria_id is distinct from old.auditoria_id or new.updated_at is distinct from old.updated_at or new.updated_by is distinct from old.updated_by then
      return new;
    end if;
    if to_jsonb(new)-array['status','auditoria_liberada','contas_medicas_liberada','auditoria_id','updated_at','updated_by'] is distinct from to_jsonb(old)-array['status','auditoria_liberada','contas_medicas_liberada','auditoria_id','updated_at','updated_by'] then raise exception 'FAT_CONTA_CONGELADA'; end if;
  end if;
  return coalesce(new,old);
end $$;

drop trigger if exists trg_faturamento_proteger_conta_congelada on public.contas_faturamento;
create trigger trg_faturamento_proteger_conta_congelada before update or delete on public.contas_faturamento
for each row execute function public.faturamento_proteger_conta_congelada_internal();

create or replace function public.faturamento_proteger_item_conta_congelada_internal()
returns trigger language plpgsql security definer set search_path='public','pg_catalog' as $$
declare v_conta uuid:=coalesce(new.conta_id,old.conta_id);
begin
  if exists(select 1 from public.contas_faturamento c where c.id=v_conta and c.congelada_em is not null) then raise exception 'FAT_ITEM_CONTA_CONGELADA'; end if;
  return coalesce(new,old);
end $$;
drop trigger if exists trg_faturamento_proteger_item_conta_congelada on public.conta_faturamento_itens;
create trigger trg_faturamento_proteger_item_conta_congelada before insert or update or delete on public.conta_faturamento_itens
for each row execute function public.faturamento_proteger_item_conta_congelada_internal();

revoke all on function public.faturamento_validar_periodo_conta_internal() from public,anon,authenticated;
revoke all on function public.encaminhar_conta_especifica_para_auditoria_internal(uuid) from public,anon,authenticated;
revoke all on function public.faturamento_sincronizar_conta_internacao_corrente_internal(uuid) from public,anon,authenticated;
revoke all on function public.faturamento_proteger_conta_congelada_internal() from public,anon,authenticated;
revoke all on function public.faturamento_proteger_item_conta_congelada_internal() from public,anon,authenticated;
revoke execute on function public.faturamento_fechar_parcial_internacao(uuid,date,date,text) from public,anon;
grant execute on function public.faturamento_fechar_parcial_internacao(uuid,date,date,text) to authenticated;
revoke execute on function public.faturamento_fechar_conta_final_internacao(uuid,text) from public,anon;
grant execute on function public.faturamento_fechar_conta_final_internacao(uuid,text) to authenticated;
