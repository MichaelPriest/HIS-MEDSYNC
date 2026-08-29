create sequence if not exists public.tiss_guia_numero_seq;

alter table public.integracao_eventos drop constraint if exists integracao_eventos_tipo_check;
alter table public.integracao_eventos add constraint integracao_eventos_tipo_check check (tipo_evento = any (array[
  'exame.liberado','imagem.executada','laudo.liberado','cirurgia.iniciada','cirurgia.concluida','opme.utilizada','producao.registrada',
  'prescricao.assinada','farmacia.validada','medicamento.dispensado','medicamento.administrado','medicamento.devolvido','estoque.consumo_paciente',
  'internacao.admitida','leito.alocado','leito.transferido','internacao.alta','leito.higienizacao_concluida',
  'conta.auditada','tiss.guia_criada','tiss.guia_pronta','tiss.lote_criado','tiss.lote_protocolado','glosa.registrada','glosa.recurso_criado','financeiro.recebivel_criado'
]::text[]));

create table if not exists public.integracao_anomalias_globais (
  id uuid primary key default extensions.gen_random_uuid(),
  regra_chave text not null,
  origem_tabela text not null,
  origem_chave text not null,
  severidade text not null default 'alta' check (severidade in ('baixa','media','alta','critica')),
  titulo text not null,
  detalhes text,
  contexto jsonb not null default '{}'::jsonb,
  status text not null default 'aberta' check (status in ('aberta','resolvida')),
  detectada_em timestamptz not null default now(),
  ultima_deteccao_em timestamptz not null default now(),
  resolvida_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(regra_chave,origem_tabela,origem_chave)
);
alter table public.integracao_anomalias_globais enable row level security;
alter table public.integracao_anomalias_globais force row level security;
revoke all on public.integracao_anomalias_globais from public,anon,authenticated;

create or replace function public.reconciliar_anomalias_globais_tiss_internal()
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_abertas integer:=0; v_resolvidas integer:=0;
begin
  insert into public.integracao_anomalias_globais(regra_chave,origem_tabela,origem_chave,severidade,titulo,detalhes,contexto,status,ultima_deteccao_em,updated_at)
  select 'tiss_lote_guia_orfao','tiss_lote_guias',lg.lote_id::text||':'||lg.guia_id::text,'critica',
    'Vínculo TISS órfão sem lote e/ou guia pai',
    'Existe vínculo histórico em tiss_lote_guias cujo lote ou guia não pode mais ser localizado. O registro é preservado para auditoria e não recebe empresa/unidade artificial.',
    jsonb_build_object('lote_id',lg.lote_id,'guia_id',lg.guia_id,'lote_existe',(l.id is not null),'guia_existe',(g.id is not null)),
    'aberta',now(),now()
  from public.tiss_lote_guias lg
  left join public.tiss_lotes l on l.id=lg.lote_id
  left join public.tiss_guias g on g.id=lg.guia_id
  where l.id is null or g.id is null
  on conflict (regra_chave,origem_tabela,origem_chave) do update set
    severidade=excluded.severidade,titulo=excluded.titulo,detalhes=excluded.detalhes,contexto=excluded.contexto,status='aberta',ultima_deteccao_em=now(),resolvida_em=null,updated_at=now();

  update public.integracao_anomalias_globais a set status='resolvida',resolvida_em=now(),updated_at=now()
  where a.regra_chave='tiss_lote_guia_orfao' and a.origem_tabela='tiss_lote_guias' and a.status='aberta'
    and not exists (
      select 1 from public.tiss_lote_guias lg
      left join public.tiss_lotes l on l.id=lg.lote_id
      left join public.tiss_guias g on g.id=lg.guia_id
      where (l.id is null or g.id is null) and lg.lote_id::text||':'||lg.guia_id::text=a.origem_chave
    );
  get diagnostics v_resolvidas=row_count;
  select count(*) into v_abertas from public.integracao_anomalias_globais where regra_chave='tiss_lote_guia_orfao' and status='aberta';
  return jsonb_build_object('abertas',v_abertas,'resolvidas_nesta_execucao',v_resolvidas);
end $$;
revoke execute on function public.reconciliar_anomalias_globais_tiss_internal() from public,anon,authenticated;

create or replace function public.criar_guia_tiss_conta_transacional(p_conta_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_user uuid:=auth.uid();
  v_conta public.contas_faturamento%rowtype;
  v_at public.atendimentos%rowtype;
  v_conv public.convenios%rowtype;
  v_versao uuid;
  v_guia uuid;
  v_existente uuid;
  v_numero text;
  v_tipo text;
  v_validacao jsonb;
  v_data timestamptz;
begin
  if v_user is null then raise exception 'TISS_GUIA_NAO_AUTENTICADO' using errcode='42501'; end if;
  select * into v_conta from public.contas_faturamento where id=p_conta_id for update;
  if not found then raise exception 'TISS_CONTA_NAO_LOCALIZADA' using errcode='P0002'; end if;
  if not public.tem_unidade(v_conta.empresa_id,v_conta.unidade_id) or not public.tem_permissao(v_conta.empresa_id,v_conta.unidade_id,'tiss.gerar') then
    raise exception 'TISS_GUIA_SEM_PERMISSAO' using errcode='42501';
  end if;
  if v_conta.tipo_cobranca<>'convenio' or v_conta.convenio_id is null then raise exception 'TISS_CONTA_NAO_CONVENIO'; end if;
  if v_conta.status<>'pronta' or not coalesce(v_conta.auditoria_liberada,false) or not coalesce(v_conta.contas_medicas_liberada,false) then
    raise exception 'TISS_CONTA_NAO_LIBERADA';
  end if;
  if exists(select 1 from public.conta_faturamento_criticas c where c.conta_id=v_conta.id and not c.resolvida and c.severidade='erro') then raise exception 'TISS_CONTA_COM_CRITICAS'; end if;

  select id into v_existente from public.tiss_guias where conta_id=v_conta.id and status<>'cancelada' order by created_at desc limit 1 for update;
  if v_existente is not null then
    return jsonb_build_object('guia_id',v_existente,'existente',true,'validacao',public.validar_guia_tiss_internal(v_existente));
  end if;

  select * into v_at from public.atendimentos where id=v_conta.atendimento_id;
  if not found then raise exception 'TISS_ATENDIMENTO_NAO_LOCALIZADO'; end if;
  select * into v_conv from public.convenios where id=v_conta.convenio_id and empresa_id=v_conta.empresa_id;
  if not found then raise exception 'TISS_CONVENIO_INVALIDO'; end if;
  select id into v_versao from public.tiss_versoes where ativo order by vigente_desde desc nulls last,created_at desc,id limit 1;
  if v_versao is null then raise exception 'TISS_VERSAO_INDISPONIVEL'; end if;
  if v_at.tipo_atendimento_tuss50_codigo is null or (v_at.tipo_atendimento_tuss50_codigo='04' and v_at.tipo_consulta_tuss52_codigo is null) then raise exception 'TISS_DOMINIO_ANS_INCOMPLETO'; end if;

  v_tipo:=case when exists(select 1 from public.internacoes i where i.atendimento_id=v_conta.atendimento_id) then 'resumo_internacao'
               when v_at.tipo_atendimento_tuss50_codigo='04' then 'consulta' else 'sp_sadt' end;
  v_numero:='G'||to_char(current_date,'YYYYMMDD')||'-'||lpad(nextval('public.tiss_guia_numero_seq')::text,8,'0');
  v_data:=coalesce(v_at.data_abertura,now());

  insert into public.tiss_guias(
    empresa_id,unidade_id,conta_id,atendimento_id,paciente_id,convenio_id,plano_id,profissional_id,versao_id,tipo_guia,
    numero_guia_prestador,numero_guia_operadora,registro_ans,numero_carteirinha,validade_carteirinha,senha_autorizacao,
    atendimento_rn,tipo_atendimento,tipo_atendimento_tuss50_codigo,tipo_atendimento_tuss50_descricao,tipo_atendimento_tuss50_versao,tipo_atendimento_tuss50_canonical,
    tipo_consulta_tuss52_codigo,tipo_consulta_tuss52_descricao,tipo_consulta_tuss52_versao,tipo_consulta_tuss52_canonical,
    data_atendimento,hora_inicio,status,valor_total,created_by,updated_by
  ) values (
    v_conta.empresa_id,v_conta.unidade_id,v_conta.id,v_conta.atendimento_id,v_conta.paciente_id,v_conta.convenio_id,v_conta.plano_id,v_at.profissional_id,v_versao,v_tipo,
    v_numero,v_at.numero_autorizacao,v_conv.registro_ans,v_at.numero_carteirinha,v_at.validade_carteirinha,v_at.senha_autorizacao,
    coalesce(v_at.atendimento_rn,false),v_at.tipo_atendimento,v_at.tipo_atendimento_tuss50_codigo,v_at.tipo_atendimento_tuss50_descricao,v_at.tipo_atendimento_tuss50_versao,v_at.tipo_atendimento_tuss50_canonical,
    v_at.tipo_consulta_tuss52_codigo,v_at.tipo_consulta_tuss52_descricao,v_at.tipo_consulta_tuss52_versao,v_at.tipo_consulta_tuss52_canonical,
    v_data::date,v_data::time,'rascunho',coalesce(v_conta.valor_liquido,0),v_user,v_user
  ) returning id into v_guia;

  insert into public.tiss_guia_itens(guia_id,sequencial,data_execucao,tabela,codigo_procedimento,descricao,quantidade,valor_unitario,valor_total)
  select v_guia,row_number() over(order by i.data_execucao nulls last,i.created_at,i.id)::integer,
         coalesce(i.data_execucao::date,v_data::date),i.tabela,i.codigo,i.descricao,i.quantidade,i.valor_unitario,i.valor_total
  from public.conta_faturamento_itens i
  where i.conta_id=v_conta.id and coalesce(i.cobravel,true)
  order by i.data_execucao nulls last,i.created_at,i.id;
  if not found then raise exception 'TISS_CONTA_SEM_ITENS_FATURAVEIS'; end if;

  v_validacao:=public.validar_guia_tiss_internal(v_guia);
  perform public.registrar_integracao_evento_internal(v_conta.empresa_id,v_conta.unidade_id,v_conta.atendimento_id,v_conta.paciente_id,'tiss.guia_criada','tiss_guias',v_guia,now(),jsonb_build_object('conta_id',v_conta.id,'tipo_guia',v_tipo,'numero_guia_prestador',v_numero,'status',v_validacao->>'status'));
  if v_validacao->>'status'='pronta' then
    perform public.registrar_integracao_evento_internal(v_conta.empresa_id,v_conta.unidade_id,v_conta.atendimento_id,v_conta.paciente_id,'tiss.guia_pronta','tiss_guias',v_guia,now(),jsonb_build_object('conta_id',v_conta.id,'numero_guia_prestador',v_numero));
  end if;
  return jsonb_build_object('guia_id',v_guia,'existente',false,'validacao',v_validacao);
end $$;
revoke execute on function public.criar_guia_tiss_conta_transacional(uuid) from public,anon;
grant execute on function public.criar_guia_tiss_conta_transacional(uuid) to authenticated;

create or replace function public.capturar_integracao_auditoria_conta()
returns trigger language plpgsql security definer set search_path=''
as $$declare v_cf public.contas_faturamento%rowtype; begin
  if new.status='liberada' and (tg_op='INSERT' or old.status is distinct from new.status) then
    select * into v_cf from public.contas_faturamento where id=new.conta_id;
    if found then perform public.registrar_integracao_evento_internal(v_cf.empresa_id,v_cf.unidade_id,v_cf.atendimento_id,v_cf.paciente_id,'conta.auditada','auditoria_contas',new.id,coalesce(new.liberado_em,now()),jsonb_build_object('conta_id',new.conta_id,'auditoria_id',new.id)); end if;
  end if; return new;
end $$;
revoke execute on function public.capturar_integracao_auditoria_conta() from public,anon,authenticated;
drop trigger if exists trg_capturar_integracao_auditoria_conta on public.auditoria_contas;
create trigger trg_capturar_integracao_auditoria_conta after insert or update of status on public.auditoria_contas for each row execute function public.capturar_integracao_auditoria_conta();

create or replace function public.capturar_integracao_lote_tiss()
returns trigger language plpgsql security definer set search_path=''
as $$begin
  perform public.registrar_integracao_evento_internal(new.empresa_id,new.unidade_id,null,null,'tiss.lote_criado','tiss_lotes',new.id,new.created_at,jsonb_build_object('numero_lote',new.numero_lote,'convenio_id',new.convenio_id,'competencia',new.competencia,'quantidade_guias',new.quantidade_guias,'valor_total',new.valor_total)); return new;
end $$;
revoke execute on function public.capturar_integracao_lote_tiss() from public,anon,authenticated;
drop trigger if exists trg_capturar_integracao_lote_tiss on public.tiss_lotes;
create trigger trg_capturar_integracao_lote_tiss after insert on public.tiss_lotes for each row execute function public.capturar_integracao_lote_tiss();

create or replace function public.capturar_integracao_recebivel_tiss()
returns trigger language plpgsql security definer set search_path=''
as $$begin
  if new.lote_id is not null then perform public.registrar_integracao_evento_internal(new.empresa_id,new.unidade_id,null,null,'financeiro.recebivel_criado','financeiro_recebiveis',new.id,new.created_at,jsonb_build_object('lote_id',new.lote_id,'convenio_id',new.convenio_id,'competencia',new.competencia,'valor_bruto',new.valor_bruto)); end if; return new;
end $$;
revoke execute on function public.capturar_integracao_recebivel_tiss() from public,anon,authenticated;
drop trigger if exists trg_capturar_integracao_recebivel_tiss on public.financeiro_recebiveis;
create trigger trg_capturar_integracao_recebivel_tiss after insert on public.financeiro_recebiveis for each row execute function public.capturar_integracao_recebivel_tiss();

create or replace function public.reconciliar_pendencias_faturamento_internal(p_empresa_id uuid,p_unidade_id uuid,p_atendimento_id uuid default null,p_resolvida_por uuid default null)
returns jsonb language plpgsql security definer set search_path=''
as $$declare v_resolvidas integer:=0; v_abertas integer:=0; begin
  insert into public.integracao_pendencias(empresa_id,unidade_id,atendimento_id,paciente_id,regra_chave,origem_tabela,origem_id,setor_origem,setor_destino,severidade,titulo,detalhes,contexto)
  select c.empresa_id,c.unidade_id,c.atendimento_id,c.paciente_id,'conta_pronta_sem_guia_tiss','contas_faturamento',c.id,'faturamento','faturamento','alta',
    'Conta liberada sem Guia TISS ativa','A conta por convênio está pronta, liberada pela Auditoria/Contas Médicas e ainda não possui guia TISS ativa.',jsonb_build_object('conta_id',c.id,'competencia',c.competencia,'valor_liquido',c.valor_liquido)
  from public.contas_faturamento c where c.empresa_id=p_empresa_id and c.unidade_id=p_unidade_id and c.tipo_cobranca='convenio' and c.status='pronta' and c.auditoria_liberada and c.contas_medicas_liberada
    and (p_atendimento_id is null or c.atendimento_id=p_atendimento_id) and not exists(select 1 from public.tiss_guias g where g.conta_id=c.id and g.status<>'cancelada') on conflict do nothing;

  insert into public.integracao_pendencias(empresa_id,unidade_id,atendimento_id,paciente_id,regra_chave,origem_tabela,origem_id,setor_origem,setor_destino,severidade,titulo,detalhes,contexto)
  select l.empresa_id,l.unidade_id,null,null,'lote_tiss_sem_recebivel','tiss_lotes',l.id,'faturamento','financeiro','critica','Lote TISS sem recebível financeiro','Existe lote TISS ativo sem previsão financeira vinculada.',jsonb_build_object('lote_id',l.id,'numero_lote',l.numero_lote,'valor_total',l.valor_total)
  from public.tiss_lotes l where l.empresa_id=p_empresa_id and l.unidade_id=p_unidade_id and l.status<>'rejeitado' and p_atendimento_id is null and not exists(select 1 from public.financeiro_recebiveis r where r.lote_id=l.id and r.status<>'cancelado') on conflict do nothing;

  insert into public.integracao_pendencias(empresa_id,unidade_id,atendimento_id,paciente_id,regra_chave,origem_tabela,origem_id,setor_origem,setor_destino,severidade,titulo,detalhes,contexto)
  select g.empresa_id,g.unidade_id,g.atendimento_id,g.paciente_id,'guia_em_lote_sem_vinculo','tiss_guias',g.id,'faturamento','faturamento','critica','Guia marcada em lote sem vínculo físico','A guia está com status em_lote, mas não existe vínculo correspondente em tiss_lote_guias.',jsonb_build_object('guia_id',g.id,'conta_id',g.conta_id,'numero_guia_prestador',g.numero_guia_prestador)
  from public.tiss_guias g where g.empresa_id=p_empresa_id and g.unidade_id=p_unidade_id and g.status='em_lote' and (p_atendimento_id is null or g.atendimento_id=p_atendimento_id) and not exists(select 1 from public.tiss_lote_guias lg where lg.guia_id=g.id) on conflict do nothing;

  update public.integracao_pendencias x set status='resolvida',resolvida_em=now(),resolvida_por=p_resolvida_por,updated_at=now()
  where x.empresa_id=p_empresa_id and x.unidade_id=p_unidade_id and x.status='aberta' and (p_atendimento_id is null or x.atendimento_id=p_atendimento_id or x.atendimento_id is null) and (
    (x.regra_chave='conta_pronta_sem_guia_tiss' and not exists(select 1 from public.contas_faturamento c where c.id=x.origem_id and c.tipo_cobranca='convenio' and c.status='pronta' and c.auditoria_liberada and c.contas_medicas_liberada and not exists(select 1 from public.tiss_guias g where g.conta_id=c.id and g.status<>'cancelada'))) or
    (x.regra_chave='lote_tiss_sem_recebivel' and not exists(select 1 from public.tiss_lotes l where l.id=x.origem_id and l.status<>'rejeitado' and not exists(select 1 from public.financeiro_recebiveis r where r.lote_id=l.id and r.status<>'cancelado'))) or
    (x.regra_chave='guia_em_lote_sem_vinculo' and not exists(select 1 from public.tiss_guias g where g.id=x.origem_id and g.status='em_lote' and not exists(select 1 from public.tiss_lote_guias lg where lg.guia_id=g.id)))
  );
  get diagnostics v_resolvidas=row_count;
  select count(*) into v_abertas from public.integracao_pendencias where empresa_id=p_empresa_id and unidade_id=p_unidade_id and status='aberta' and regra_chave in ('conta_pronta_sem_guia_tiss','lote_tiss_sem_recebivel','guia_em_lote_sem_vinculo') and (p_atendimento_id is null or atendimento_id=p_atendimento_id or atendimento_id is null);
  perform public.reconciliar_anomalias_globais_tiss_internal();
  return jsonb_build_object('abertas_faturamento',v_abertas,'resolvidas_nesta_execucao',v_resolvidas);
end $$;
revoke execute on function public.reconciliar_pendencias_faturamento_internal(uuid,uuid,uuid,uuid) from public,anon,authenticated;

create or replace function public.reconciliar_pendencias_integracao(p_empresa_id uuid,p_unidade_id uuid,p_atendimento_id uuid default null)
returns jsonb language plpgsql security definer set search_path='public','pg_catalog'
as $$declare v_cir jsonb; v_med jsonb; v_int jsonb; v_fat jsonb; v_base jsonb; v_resolvidas integer; begin
  if auth.uid() is null then raise exception 'INTEGRACAO_AUTENTICACAO_OBRIGATORIA' using errcode='42501'; end if;
  if not public.tem_unidade(p_empresa_id,p_unidade_id) then raise exception 'INTEGRACAO_UNIDADE_FORA_ESCOPO' using errcode='42501'; end if;
  if not public.tem_permissao(p_empresa_id,p_unidade_id,'integracao.reconciliar') then raise exception 'INTEGRACAO_SEM_PERMISSAO' using errcode='42501'; end if;
  if p_atendimento_id is not null and not exists(select 1 from public.atendimentos a where a.id=p_atendimento_id and a.empresa_id=p_empresa_id and a.unidade_id=p_unidade_id) then raise exception 'INTEGRACAO_ATENDIMENTO_FORA_ESCOPO' using errcode='42501'; end if;
  v_cir:=public.reconciliar_pendencias_cirurgia_estoque_internal(p_empresa_id,p_unidade_id,p_atendimento_id,auth.uid());
  v_med:=public.reconciliar_pendencias_medicamentos_internal(p_empresa_id,p_unidade_id,p_atendimento_id,auth.uid());
  v_int:=public.reconciliar_pendencias_internacao_internal(p_empresa_id,p_unidade_id,p_atendimento_id,auth.uid());
  v_fat:=public.reconciliar_pendencias_faturamento_internal(p_empresa_id,p_unidade_id,p_atendimento_id,auth.uid());
  v_base:=public.reconciliar_pendencias_integracao_internal(p_empresa_id,p_unidade_id,p_atendimento_id,auth.uid());
  v_resolvidas:=coalesce((v_cir->>'resolvidas_nesta_execucao')::integer,0)+coalesce((v_med->>'resolvidas_nesta_execucao')::integer,0)+coalesce((v_int->>'resolvidas_nesta_execucao')::integer,0)+coalesce((v_fat->>'resolvidas_nesta_execucao')::integer,0)+coalesce((v_base->>'resolvidas_nesta_execucao')::integer,0);
  return jsonb_build_object('abertas',coalesce((v_base->>'abertas')::integer,0),'resolvidas_nesta_execucao',v_resolvidas,'abertas_medicamentos',coalesce((v_med->>'abertas_medicamentos')::integer,0),'abertas_cirurgia_estoque',coalesce((v_cir->>'abertas_cirurgia_estoque')::integer,0),'abertas_internacao',coalesce((v_int->>'abertas_internacao')::integer,0),'abertas_faturamento',coalesce((v_fat->>'abertas_faturamento')::integer,0));
end $$;

select public.reconciliar_anomalias_globais_tiss_internal();
