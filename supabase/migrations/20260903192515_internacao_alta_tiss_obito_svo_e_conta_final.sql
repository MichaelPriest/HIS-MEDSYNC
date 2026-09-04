alter table public.internacoes
  add column if not exists motivo_encerramento_tiss_conceito_id uuid,
  add column if not exists motivo_encerramento_tiss_codigo text,
  add column if not exists motivo_encerramento_tiss_descricao text,
  add column if not exists motivo_encerramento_tiss_versao text,
  add column if not exists motivo_encerramento_tiss_canonical text,
  add column if not exists declaracao_obito_numero text,
  add column if not exists documento_svo_iml_numero text,
  add column if not exists encerramento_observacao text;

do $$ begin
  if not exists(select 1 from pg_constraint where conname='internacoes_motivo_encerramento_tiss_conceito_id_fkey') then
    alter table public.internacoes add constraint internacoes_motivo_encerramento_tiss_conceito_id_fkey
      foreign key(motivo_encerramento_tiss_conceito_id) references public.ans_fhir_conceitos(id) on delete restrict;
  end if;
end $$;

alter table public.tiss_guias
  add column if not exists declaracoes_obito_numeros text[] not null default '{}'::text[],
  add column if not exists documento_svo_iml_numero_snapshot text;

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
    new.motivo_encerramento_tiss_codigo:=coalesce(new.motivo_encerramento_tiss_codigo,v_i.motivo_encerramento_tiss_codigo);
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
    select conceito_id,codigo,display,versao,canonical into v_motivo from public.ans_fhir_dominios_ativos where tabela=39 and codigo=new.motivo_encerramento_tiss_codigo limit 1;
    if v_motivo.codigo is null then raise exception 'FAT_TISS_MOTIVO_ENCERRAMENTO_INVALIDO:%',new.motivo_encerramento_tiss_codigo; end if;
    new.motivo_encerramento_tiss_descricao:=v_motivo.display;
    new.motivo_encerramento_tiss_versao:=v_motivo.versao;
    new.motivo_encerramento_tiss_canonical:=v_motivo.canonical;
  end if;
  return new;
end $$;

create or replace function public.dar_alta_internacao_tiss(
  p_internacao_id uuid,
  p_motivo_tiss_codigo text,
  p_declaracao_obito_numero text default null,
  p_documento_svo_iml_numero text default null,
  p_observacao text default null,
  p_data_alta timestamptz default now()
)
returns jsonb language plpgsql security definer set search_path='public','pg_catalog' as $$
declare
  v_i public.internacoes%rowtype; v_prof uuid; v_abertas integer; v_lista text; v_dom record; v_data timestamptz:=coalesce(p_data_alta,now());
  v_obito boolean; v_conta jsonb;
begin
  if auth.uid() is null then raise exception 'ALTA_NAO_AUTENTICADA' using errcode='42501'; end if;
  select * into v_i from public.internacoes where id=p_internacao_id for update;
  if not found then raise exception 'ALTA_INTERNACAO_NAO_LOCALIZADA'; end if;
  if v_i.status not in ('internado','transferido','aguardando_leito') or v_i.data_alta is not null then raise exception 'ALTA_INTERNACAO_NAO_ATIVA'; end if;
  if not(public.tem_permissao(v_i.empresa_id,v_i.unidade_id,'leitos.gerenciar') or public.tem_permissao(v_i.empresa_id,v_i.unidade_id,'internacao.gerenciar')) then raise exception 'ALTA_SEM_PERMISSAO' using errcode='42501'; end if;
  if v_data<v_i.data_internacao or v_data>now()+interval '5 minutes' then raise exception 'ALTA_DATA_INVALIDA'; end if;
  select conceito_id,codigo,display,versao,canonical into v_dom from public.ans_fhir_dominios_ativos where tabela=39 and codigo=btrim(coalesce(p_motivo_tiss_codigo,'')) limit 1;
  if v_dom.codigo is null then raise exception 'ALTA_MOTIVO_TISS_INVALIDO'; end if;
  if v_dom.codigo in ('21','22','23','24','25','26','27','28') then raise exception 'ALTA_MOTIVO_TISS_E_PERMANENCIA'; end if;
  if v_dom.codigo='41' and nullif(btrim(coalesce(p_declaracao_obito_numero,'')),'') is null then raise exception 'ALTA_OBITO_DO_OBRIGATORIA'; end if;
  if v_dom.codigo in ('42','43') and nullif(btrim(coalesce(p_documento_svo_iml_numero,'')),'') is null then raise exception 'ALTA_SVO_IML_DOCUMENTO_OBRIGATORIO'; end if;
  v_obito:=v_dom.codigo in ('41','42','43','65','66','67');

  v_abertas:=public.sincronizar_pendencias_alta(v_i.id);
  if v_abertas>0 then
    select string_agg(descricao,'; ' order by descricao) into v_lista from public.alta_pendencias where internacao_id=v_i.id and bloqueia_alta and status='pendente';
    raise exception 'ALTA_PENDENCIAS_BLOQUEANTES: %',coalesce(v_lista,'pendências não resolvidas');
  end if;
  v_prof:=public.profissional_logado(v_i.empresa_id);
  if v_i.leito_id is not null then
    update public.leitos set status='higienizacao',updated_at=now(),updated_by=auth.uid() where id=v_i.leito_id;
    insert into public.leito_higienizacoes(empresa_id,unidade_id,leito_id,internacao_id,atendimento_id,status,solicitada_por,created_by,updated_by)
    values(v_i.empresa_id,v_i.unidade_id,v_i.leito_id,v_i.id,v_i.atendimento_id,'pendente',auth.uid(),auth.uid(),auth.uid()) on conflict do nothing;
    insert into public.movimentacoes_leitos(empresa_id,unidade_id,internacao_id,atendimento_id,leito_origem_id,leito_destino_id,tipo,motivo,movimentado_em,profissional_id,created_by)
    values(v_i.empresa_id,v_i.unidade_id,v_i.id,v_i.atendimento_id,v_i.leito_id,null,'alta',v_dom.codigo||' - '||v_dom.display,v_data,v_prof,auth.uid());
  end if;
  update public.internacoes set
    status='alta',data_alta=v_data,motivo_alta=v_dom.display,leito_id=null,
    motivo_encerramento_tiss_conceito_id=v_dom.conceito_id,motivo_encerramento_tiss_codigo=v_dom.codigo,
    motivo_encerramento_tiss_descricao=v_dom.display,motivo_encerramento_tiss_versao=v_dom.versao,motivo_encerramento_tiss_canonical=v_dom.canonical,
    declaracao_obito_numero=nullif(btrim(coalesce(p_declaracao_obito_numero,'')),''),
    documento_svo_iml_numero=nullif(btrim(coalesce(p_documento_svo_iml_numero,'')),''),
    encerramento_observacao=nullif(btrim(coalesce(p_observacao,'')),''),updated_at=now(),updated_by=auth.uid()
  where id=v_i.id;

  update public.obitos set
    do_numero=coalesce(nullif(btrim(coalesce(p_declaracao_obito_numero,'')),''),do_numero),
    notificacao_svo_iml=coalesce(nullif(btrim(coalesce(p_documento_svo_iml_numero,'')),''),notificacao_svo_iml),
    updated_at=now(),updated_by=auth.uid()
  where internacao_id=v_i.id;

  update public.atendimentos set status='alta',data_fechamento=coalesce(data_fechamento,v_data),setor_atual='alta',
    motivo_encerramento_operacional=v_dom.codigo,ultima_movimentacao_em=v_data,updated_at=now(),updated_by=auth.uid()
  where id=v_i.atendimento_id;

  select jsonb_build_object('conta_id',c.id,'modalidade',c.modalidade_conta,'periodo_inicio',c.periodo_inicio,'periodo_fim',c.periodo_fim)
    into v_conta from public.contas_faturamento c where c.internacao_id=v_i.id and c.modalidade_conta='final' and c.status<>'cancelada' order by c.created_at desc limit 1;
  return jsonb_build_object('internacao_id',v_i.id,'atendimento_id',v_i.atendimento_id,'motivo_tiss',v_dom.codigo,
    'motivo_descricao',v_dom.display,'obito',v_obito,'data_alta',v_data,'conta_final',v_conta);
end $$;

create or replace function public.preparar_conta_pos_alta_internal(p_atendimento_id uuid)
returns jsonb language plpgsql security definer set search_path='public','pg_catalog' as $$
declare v_i public.internacoes%rowtype; v_conta record; v_result jsonb;
begin
  select * into v_i from public.internacoes where atendimento_id=p_atendimento_id order by data_internacao desc,id desc limit 1;
  if v_i.id is not null then
    if v_i.data_alta is null then raise exception 'FAT_POS_ALTA_INTERNACAO_SEM_ALTA'; end if;
    select id,status into v_conta from public.contas_faturamento where internacao_id=v_i.id and modalidade_conta='final' and status<>'cancelada' order by created_at desc limit 1;
    if v_conta.id is not null then return jsonb_build_object('conta_id',v_conta.id,'status',v_conta.status,'preservada',true,'motivo','conta_final_internacao_existente'); end if;
    v_result:=public.faturamento_fechar_conta_final_internacao(v_i.id,'Conta final gerada automaticamente no encerramento da internação.');
    return v_result||jsonb_build_object('status','pre_faturamento','origem','internacao_final');
  end if;

  select id,status into v_conta from public.contas_faturamento where atendimento_id=p_atendimento_id and modalidade_conta='unica' and status<>'cancelada' order by created_at desc limit 1;
  if v_conta.id is not null and v_conta.status in ('pronta','faturada','cancelada') then
    return jsonb_build_object('conta_id',v_conta.id,'status',v_conta.status,'preservada',true,'motivo','conta_em_estado_protegido');
  end if;
  perform public.sincronizar_producao_consumos_internal(p_atendimento_id);
  return public.preparar_conta_pos_alta_livro_internal(p_atendimento_id);
end $$;

create or replace function public.tiss_snapshot_internacao_conta_before_internal()
returns trigger language plpgsql security definer set search_path='public','pg_catalog' as $$
declare v_c public.contas_faturamento%rowtype; v_i public.internacoes%rowtype;
begin
  if new.conta_id is null then return new; end if;
  select * into v_c from public.contas_faturamento where id=new.conta_id;
  if not found then return new; end if;
  if v_c.modalidade_conta='corrente' then raise exception 'TISS_CONTA_CORRENTE_INTERNA_NAO_FATURAVEL'; end if;
  if v_c.tipo_atendimento_faturamento<>'internacao' or v_c.internacao_id is null then return new; end if;
  select * into v_i from public.internacoes where id=v_c.internacao_id;
  new.tipo_faturamento_tiss:=coalesce(new.tipo_faturamento_tiss,v_c.tipo_faturamento_tiss_codigo);
  new.motivo_encerramento_tiss:=coalesce(new.motivo_encerramento_tiss,v_c.motivo_encerramento_tiss_codigo,v_i.motivo_encerramento_tiss_codigo);
  if v_c.periodo_inicio_em is not null then
    new.data_inicio_faturamento:=coalesce(new.data_inicio_faturamento,(v_c.periodo_inicio_em at time zone 'America/Sao_Paulo')::date);
    new.hora_inicio_faturamento:=coalesce(new.hora_inicio_faturamento,(v_c.periodo_inicio_em at time zone 'America/Sao_Paulo')::time);
  end if;
  if v_c.periodo_fim_em is not null then
    new.data_fim_faturamento:=coalesce(new.data_fim_faturamento,(v_c.periodo_fim_em at time zone 'America/Sao_Paulo')::date);
    new.hora_fim_faturamento:=coalesce(new.hora_fim_faturamento,(v_c.periodo_fim_em at time zone 'America/Sao_Paulo')::time);
  end if;
  if nullif(btrim(coalesce(v_i.declaracao_obito_numero,'')),'') is not null then
    new.declaracoes_obito_numeros:=array[v_i.declaracao_obito_numero];
  end if;
  new.documento_svo_iml_numero_snapshot:=coalesce(new.documento_svo_iml_numero_snapshot,v_i.documento_svo_iml_numero);
  return new;
end $$;

drop trigger if exists trg_tiss_snapshot_internacao_conta on public.tiss_guias;
create trigger trg_tiss_snapshot_internacao_conta before insert or update of conta_id,tipo_faturamento_tiss,motivo_encerramento_tiss,data_inicio_faturamento,data_fim_faturamento
on public.tiss_guias for each row execute function public.tiss_snapshot_internacao_conta_before_internal();

revoke execute on function public.dar_alta_internacao_tiss(uuid,text,text,text,text,timestamptz) from public,anon;
grant execute on function public.dar_alta_internacao_tiss(uuid,text,text,text,text,timestamptz) to authenticated;
revoke all on function public.faturamento_normalizar_tiss_conta_internacao_internal() from public,anon,authenticated;
revoke all on function public.tiss_snapshot_internacao_conta_before_internal() from public,anon,authenticated;
