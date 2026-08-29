create sequence if not exists public.tiss_recurso_numero_seq;

create or replace function public.registrar_protocolo_tiss_transacional(
  p_lote_id uuid,
  p_numero_protocolo text,
  p_data_protocolo date default null,
  p_status text default 'recebido',
  p_valor_apresentado numeric default 0,
  p_valor_processado numeric default 0,
  p_valor_liberado numeric default 0,
  p_valor_glosa numeric default 0,
  p_observacoes text default null
) returns uuid language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_lote public.tiss_lotes%rowtype; v_id uuid; begin
  if v_user is null then raise exception 'TISS_PROTOCOLO_NAO_AUTENTICADO' using errcode='42501'; end if;
  if coalesce(btrim(p_numero_protocolo),'')='' then raise exception 'TISS_PROTOCOLO_NUMERO_OBRIGATORIO'; end if;
  if coalesce(p_valor_apresentado,0)<0 or coalesce(p_valor_processado,0)<0 or coalesce(p_valor_liberado,0)<0 or coalesce(p_valor_glosa,0)<0 then raise exception 'TISS_PROTOCOLO_VALOR_INVALIDO'; end if;
  select * into v_lote from public.tiss_lotes where id=p_lote_id for update;
  if not found then raise exception 'TISS_LOTE_NAO_LOCALIZADO'; end if;
  if not public.tem_unidade(v_lote.empresa_id,v_lote.unidade_id) or not (public.tem_permissao(v_lote.empresa_id,v_lote.unidade_id,'tiss.retorno') or public.tem_permissao(v_lote.empresa_id,v_lote.unidade_id,'tiss.enviar')) then raise exception 'TISS_PROTOCOLO_SEM_PERMISSAO' using errcode='42501'; end if;
  select id into v_id from public.tiss_protocolos where lote_id=v_lote.id and numero_protocolo=btrim(p_numero_protocolo) limit 1;
  if v_id is null then
    insert into public.tiss_protocolos(empresa_id,unidade_id,lote_id,numero_protocolo,data_protocolo,status,valor_apresentado,valor_processado,valor_liberado,valor_glosa,observacoes,created_by)
    values(v_lote.empresa_id,v_lote.unidade_id,v_lote.id,btrim(p_numero_protocolo),p_data_protocolo,coalesce(nullif(btrim(p_status),''),'recebido'),coalesce(p_valor_apresentado,0),coalesce(p_valor_processado,0),coalesce(p_valor_liberado,0),coalesce(p_valor_glosa,0),nullif(btrim(p_observacoes),''),v_user)
    returning id into v_id;
  end if;
  update public.tiss_lotes set status='protocolado',protocolo_operadora=btrim(p_numero_protocolo),retorno_em=now() where id=v_lote.id;
  update public.financeiro_recebiveis set status=case when status in ('recebido','cancelado') then status else 'aguardando_pagamento' end,
    valor_glosa=coalesce(p_valor_glosa,0),valor_liquido_previsto=greatest(valor_bruto-coalesce(p_valor_glosa,0),0),updated_at=now(),updated_by=v_user
  where lote_id=v_lote.id and status<>'cancelado';
  return v_id;
end $$;
revoke execute on function public.registrar_protocolo_tiss_transacional(uuid,text,date,text,numeric,numeric,numeric,numeric,text) from public,anon;
grant execute on function public.registrar_protocolo_tiss_transacional(uuid,text,date,text,numeric,numeric,numeric,numeric,text) to authenticated;

create or replace function public.registrar_glosa_tiss_transacional(
  p_lote_id uuid,p_protocolo_id uuid,p_guia_id uuid,p_guia_item_id uuid,p_codigo_glosa text,p_descricao_glosa text,p_valor_glosado numeric
) returns uuid language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_lote public.tiss_lotes%rowtype; v_id uuid; v_glosa_total numeric; begin
  if v_user is null then raise exception 'TISS_GLOSA_NAO_AUTENTICADO' using errcode='42501'; end if;
  if coalesce(btrim(p_codigo_glosa),'')='' or coalesce(p_valor_glosado,0)<=0 then raise exception 'TISS_GLOSA_DADOS_INVALIDOS'; end if;
  select * into v_lote from public.tiss_lotes where id=p_lote_id for update;
  if not found then raise exception 'TISS_LOTE_NAO_LOCALIZADO'; end if;
  if not public.tem_unidade(v_lote.empresa_id,v_lote.unidade_id) or not public.tem_permissao(v_lote.empresa_id,v_lote.unidade_id,'tiss.retorno') then raise exception 'TISS_GLOSA_SEM_PERMISSAO' using errcode='42501'; end if;
  if p_protocolo_id is not null and not exists(select 1 from public.tiss_protocolos p where p.id=p_protocolo_id and p.lote_id=v_lote.id and p.empresa_id=v_lote.empresa_id and p.unidade_id=v_lote.unidade_id) then raise exception 'TISS_GLOSA_PROTOCOLO_FORA_LOTE'; end if;
  if p_guia_id is not null and not exists(select 1 from public.tiss_lote_guias lg join public.tiss_guias g on g.id=lg.guia_id where lg.lote_id=v_lote.id and g.id=p_guia_id and g.empresa_id=v_lote.empresa_id and g.unidade_id=v_lote.unidade_id) then raise exception 'TISS_GLOSA_GUIA_FORA_LOTE'; end if;
  if p_guia_item_id is not null and (p_guia_id is null or not exists(select 1 from public.tiss_guia_itens i where i.id=p_guia_item_id and i.guia_id=p_guia_id)) then raise exception 'TISS_GLOSA_ITEM_FORA_GUIA'; end if;
  insert into public.tiss_glosas(empresa_id,unidade_id,protocolo_id,lote_id,guia_id,guia_item_id,codigo_glosa,descricao_glosa,valor_glosado,status,origem)
  values(v_lote.empresa_id,v_lote.unidade_id,p_protocolo_id,v_lote.id,p_guia_id,p_guia_item_id,btrim(p_codigo_glosa),nullif(btrim(p_descricao_glosa),''),p_valor_glosado,'aberta','demonstrativo') returning id into v_id;
  select coalesce(sum(g.valor_glosado),0) into v_glosa_total from public.tiss_glosas g where g.lote_id=v_lote.id and g.status in ('aberta','em_recurso','aceita','indeferida');
  update public.financeiro_recebiveis set valor_glosa=v_glosa_total,valor_liquido_previsto=greatest(valor_bruto-v_glosa_total,0),updated_at=now(),updated_by=v_user where lote_id=v_lote.id and status<>'cancelado';
  return v_id;
end $$;
revoke execute on function public.registrar_glosa_tiss_transacional(uuid,uuid,uuid,uuid,text,text,numeric) from public,anon;
grant execute on function public.registrar_glosa_tiss_transacional(uuid,uuid,uuid,uuid,text,text,numeric) to authenticated;

create or replace function public.criar_recurso_glosa_tiss_transacional(p_glosa_id uuid,p_justificativa text,p_valor_recursado numeric)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_g public.tiss_glosas%rowtype; v_l public.tiss_lotes%rowtype; v_existente uuid; v_recurso uuid; v_numero text; begin
  if v_user is null then raise exception 'TISS_RECURSO_NAO_AUTENTICADO' using errcode='42501'; end if;
  if coalesce(btrim(p_justificativa),'')='' or coalesce(p_valor_recursado,0)<=0 then raise exception 'TISS_RECURSO_DADOS_INVALIDOS'; end if;
  select * into v_g from public.tiss_glosas where id=p_glosa_id for update;
  if not found then raise exception 'TISS_GLOSA_NAO_LOCALIZADA'; end if;
  if v_g.lote_id is null then raise exception 'TISS_RECURSO_GLOSA_SEM_LOTE'; end if;
  select * into v_l from public.tiss_lotes where id=v_g.lote_id;
  if not found then raise exception 'TISS_RECURSO_LOTE_NAO_LOCALIZADO'; end if;
  if not public.tem_unidade(v_g.empresa_id,v_g.unidade_id) or not (public.tem_permissao(v_g.empresa_id,v_g.unidade_id,'tiss.gerar') or public.tem_permissao(v_g.empresa_id,v_g.unidade_id,'tiss.retorno')) then raise exception 'TISS_RECURSO_SEM_PERMISSAO' using errcode='42501'; end if;
  if v_g.status not in ('aberta','em_recurso') then raise exception 'TISS_RECURSO_GLOSA_NAO_ELEGIVEL'; end if;
  if p_valor_recursado>v_g.valor_glosado then raise exception 'TISS_RECURSO_VALOR_EXCEDE_GLOSA'; end if;
  select ri.recurso_id into v_existente from public.tiss_recurso_itens ri join public.tiss_recursos_glosa r on r.id=ri.recurso_id where ri.glosa_id=v_g.id and r.status not in ('deferido','indeferido') order by r.created_at desc limit 1;
  if v_existente is not null then return v_existente; end if;
  v_numero:='R'||to_char(current_date,'YYYYMMDD')||'-'||lpad(nextval('public.tiss_recurso_numero_seq')::text,8,'0');
  insert into public.tiss_recursos_glosa(empresa_id,unidade_id,convenio_id,protocolo_id,numero_recurso,status,valor_total_recursado,created_by,updated_by)
  values(v_g.empresa_id,v_g.unidade_id,v_l.convenio_id,v_g.protocolo_id,v_numero,'rascunho',p_valor_recursado,v_user,v_user) returning id into v_recurso;
  insert into public.tiss_recurso_itens(recurso_id,glosa_id,valor_recursado,justificativa) values(v_recurso,v_g.id,p_valor_recursado,btrim(p_justificativa));
  update public.tiss_glosas set status='em_recurso' where id=v_g.id;
  return v_recurso;
end $$;
revoke execute on function public.criar_recurso_glosa_tiss_transacional(uuid,text,numeric) from public,anon;
grant execute on function public.criar_recurso_glosa_tiss_transacional(uuid,text,numeric) to authenticated;

create or replace function public.capturar_integracao_protocolo_tiss()
returns trigger language plpgsql security definer set search_path=''
as $$declare v_l public.tiss_lotes%rowtype; begin
  select * into v_l from public.tiss_lotes where id=new.lote_id;
  if found then perform public.registrar_integracao_evento_internal(new.empresa_id,new.unidade_id,null,null,'tiss.lote_protocolado','tiss_protocolos',new.id,new.created_at,jsonb_build_object('lote_id',new.lote_id,'numero_protocolo',new.numero_protocolo,'valor_apresentado',new.valor_apresentado,'valor_liberado',new.valor_liberado,'valor_glosa',new.valor_glosa)); end if; return new;
end $$;
revoke execute on function public.capturar_integracao_protocolo_tiss() from public,anon,authenticated;
drop trigger if exists trg_capturar_integracao_protocolo_tiss on public.tiss_protocolos;
create trigger trg_capturar_integracao_protocolo_tiss after insert on public.tiss_protocolos for each row execute function public.capturar_integracao_protocolo_tiss();

create or replace function public.capturar_integracao_glosa_tiss()
returns trigger language plpgsql security definer set search_path=''
as $$declare v_at uuid; v_pac uuid; begin
  if new.guia_id is not null then select atendimento_id,paciente_id into v_at,v_pac from public.tiss_guias where id=new.guia_id; end if;
  perform public.registrar_integracao_evento_internal(new.empresa_id,new.unidade_id,v_at,v_pac,'glosa.registrada','tiss_glosas',new.id,new.created_at,jsonb_build_object('lote_id',new.lote_id,'guia_id',new.guia_id,'codigo_glosa',new.codigo_glosa,'valor_glosado',new.valor_glosado)); return new;
end $$;
revoke execute on function public.capturar_integracao_glosa_tiss() from public,anon,authenticated;
drop trigger if exists trg_capturar_integracao_glosa_tiss on public.tiss_glosas;
create trigger trg_capturar_integracao_glosa_tiss after insert on public.tiss_glosas for each row execute function public.capturar_integracao_glosa_tiss();

create or replace function public.capturar_integracao_recurso_glosa_item()
returns trigger language plpgsql security definer set search_path=''
as $$declare v_r public.tiss_recursos_glosa%rowtype; v_g public.tiss_glosas%rowtype; v_at uuid; v_pac uuid; begin
  select * into v_r from public.tiss_recursos_glosa where id=new.recurso_id; select * into v_g from public.tiss_glosas where id=new.glosa_id;
  if v_g.guia_id is not null then select atendimento_id,paciente_id into v_at,v_pac from public.tiss_guias where id=v_g.guia_id; end if;
  if v_r.id is not null then perform public.registrar_integracao_evento_internal(v_r.empresa_id,v_r.unidade_id,v_at,v_pac,'glosa.recurso_criado','tiss_recursos_glosa',v_r.id,v_r.created_at,jsonb_build_object('glosa_id',new.glosa_id,'valor_recursado',new.valor_recursado,'numero_recurso',v_r.numero_recurso)); end if; return new;
end $$;
revoke execute on function public.capturar_integracao_recurso_glosa_item() from public,anon,authenticated;
drop trigger if exists trg_capturar_integracao_recurso_glosa_item on public.tiss_recurso_itens;
create trigger trg_capturar_integracao_recurso_glosa_item after insert on public.tiss_recurso_itens for each row execute function public.capturar_integracao_recurso_glosa_item();

create or replace function public.reconciliar_pendencias_faturamento_internal(p_empresa_id uuid,p_unidade_id uuid,p_atendimento_id uuid default null,p_resolvida_por uuid default null)
returns jsonb language plpgsql security definer set search_path=''
as $$declare v_resolvidas integer:=0; v_abertas integer:=0; begin
  insert into public.integracao_pendencias(empresa_id,unidade_id,atendimento_id,paciente_id,regra_chave,origem_tabela,origem_id,setor_origem,setor_destino,severidade,titulo,detalhes,contexto)
  select c.empresa_id,c.unidade_id,c.atendimento_id,c.paciente_id,'conta_pronta_sem_guia_tiss','contas_faturamento',c.id,'faturamento','faturamento','alta','Conta liberada sem Guia TISS ativa','A conta por convênio está pronta, liberada pela Auditoria/Contas Médicas e ainda não possui guia TISS ativa.',jsonb_build_object('conta_id',c.id,'competencia',c.competencia,'valor_liquido',c.valor_liquido)
  from public.contas_faturamento c where c.empresa_id=p_empresa_id and c.unidade_id=p_unidade_id and c.tipo_cobranca='convenio' and c.status='pronta' and c.auditoria_liberada and c.contas_medicas_liberada and (p_atendimento_id is null or c.atendimento_id=p_atendimento_id) and not exists(select 1 from public.tiss_guias g where g.conta_id=c.id and g.status<>'cancelada') on conflict do nothing;
  insert into public.integracao_pendencias(empresa_id,unidade_id,atendimento_id,paciente_id,regra_chave,origem_tabela,origem_id,setor_origem,setor_destino,severidade,titulo,detalhes,contexto)
  select l.empresa_id,l.unidade_id,null,null,'lote_tiss_sem_recebivel','tiss_lotes',l.id,'faturamento','financeiro','critica','Lote TISS sem recebível financeiro','Existe lote TISS ativo sem previsão financeira vinculada.',jsonb_build_object('lote_id',l.id,'numero_lote',l.numero_lote,'valor_total',l.valor_total)
  from public.tiss_lotes l where l.empresa_id=p_empresa_id and l.unidade_id=p_unidade_id and l.status<>'rejeitado' and p_atendimento_id is null and not exists(select 1 from public.financeiro_recebiveis r where r.lote_id=l.id and r.status<>'cancelado') on conflict do nothing;
  insert into public.integracao_pendencias(empresa_id,unidade_id,atendimento_id,paciente_id,regra_chave,origem_tabela,origem_id,setor_origem,setor_destino,severidade,titulo,detalhes,contexto)
  select g.empresa_id,g.unidade_id,g.atendimento_id,g.paciente_id,'guia_em_lote_sem_vinculo','tiss_guias',g.id,'faturamento','faturamento','critica','Guia marcada em lote sem vínculo físico','A guia está com status em_lote, mas não existe vínculo correspondente em tiss_lote_guias.',jsonb_build_object('guia_id',g.id,'conta_id',g.conta_id,'numero_guia_prestador',g.numero_guia_prestador)
  from public.tiss_guias g where g.empresa_id=p_empresa_id and g.unidade_id=p_unidade_id and g.status='em_lote' and (p_atendimento_id is null or g.atendimento_id=p_atendimento_id) and not exists(select 1 from public.tiss_lote_guias lg where lg.guia_id=g.id) on conflict do nothing;
  insert into public.integracao_pendencias(empresa_id,unidade_id,atendimento_id,paciente_id,regra_chave,origem_tabela,origem_id,setor_origem,setor_destino,severidade,titulo,detalhes,contexto)
  select l.empresa_id,l.unidade_id,null,null,'recebivel_glosa_divergente','tiss_lotes',l.id,'faturamento','financeiro','alta','Glosa TISS divergente do recebível','O total financeiro de glosas do lote diverge do valor registrado no recebível.',jsonb_build_object('lote_id',l.id,'glosa_tiss',coalesce(g.total,0),'glosa_recebivel',coalesce(r.valor_glosa,0))
  from public.tiss_lotes l join public.financeiro_recebiveis r on r.lote_id=l.id and r.status<>'cancelado' left join lateral (select sum(x.valor_glosado) total from public.tiss_glosas x where x.lote_id=l.id and x.status in ('aberta','em_recurso','aceita','indeferida')) g on true
  where l.empresa_id=p_empresa_id and l.unidade_id=p_unidade_id and p_atendimento_id is null and abs(coalesce(g.total,0)-coalesce(r.valor_glosa,0))>0.01 on conflict do nothing;
  insert into public.integracao_pendencias(empresa_id,unidade_id,atendimento_id,paciente_id,regra_chave,origem_tabela,origem_id,setor_origem,setor_destino,severidade,titulo,detalhes,contexto)
  select g.empresa_id,g.unidade_id,tg.atendimento_id,tg.paciente_id,'glosa_em_recurso_sem_item','tiss_glosas',g.id,'faturamento','faturamento','critica','Glosa em recurso sem item de recurso','A glosa está marcada em recurso, mas não existe vínculo com tiss_recurso_itens.',jsonb_build_object('glosa_id',g.id,'guia_id',g.guia_id,'valor_glosado',g.valor_glosado)
  from public.tiss_glosas g left join public.tiss_guias tg on tg.id=g.guia_id where g.empresa_id=p_empresa_id and g.unidade_id=p_unidade_id and g.status='em_recurso' and (p_atendimento_id is null or tg.atendimento_id=p_atendimento_id) and not exists(select 1 from public.tiss_recurso_itens ri where ri.glosa_id=g.id) on conflict do nothing;

  update public.integracao_pendencias x set status='resolvida',resolvida_em=now(),resolvida_por=p_resolvida_por,updated_at=now()
  where x.empresa_id=p_empresa_id and x.unidade_id=p_unidade_id and x.status='aberta' and (p_atendimento_id is null or x.atendimento_id=p_atendimento_id or x.atendimento_id is null) and (
    (x.regra_chave='conta_pronta_sem_guia_tiss' and not exists(select 1 from public.contas_faturamento c where c.id=x.origem_id and c.tipo_cobranca='convenio' and c.status='pronta' and c.auditoria_liberada and c.contas_medicas_liberada and not exists(select 1 from public.tiss_guias g where g.conta_id=c.id and g.status<>'cancelada'))) or
    (x.regra_chave='lote_tiss_sem_recebivel' and not exists(select 1 from public.tiss_lotes l where l.id=x.origem_id and l.status<>'rejeitado' and not exists(select 1 from public.financeiro_recebiveis r where r.lote_id=l.id and r.status<>'cancelado'))) or
    (x.regra_chave='guia_em_lote_sem_vinculo' and not exists(select 1 from public.tiss_guias g where g.id=x.origem_id and g.status='em_lote' and not exists(select 1 from public.tiss_lote_guias lg where lg.guia_id=g.id))) or
    (x.regra_chave='recebivel_glosa_divergente' and not exists(select 1 from public.tiss_lotes l join public.financeiro_recebiveis r on r.lote_id=l.id and r.status<>'cancelado' left join lateral (select sum(z.valor_glosado) total from public.tiss_glosas z where z.lote_id=l.id and z.status in ('aberta','em_recurso','aceita','indeferida')) q on true where l.id=x.origem_id and abs(coalesce(q.total,0)-coalesce(r.valor_glosa,0))>0.01)) or
    (x.regra_chave='glosa_em_recurso_sem_item' and not exists(select 1 from public.tiss_glosas g where g.id=x.origem_id and g.status='em_recurso' and not exists(select 1 from public.tiss_recurso_itens ri where ri.glosa_id=g.id)))
  );
  get diagnostics v_resolvidas=row_count;
  select count(*) into v_abertas from public.integracao_pendencias where empresa_id=p_empresa_id and unidade_id=p_unidade_id and status='aberta' and regra_chave in ('conta_pronta_sem_guia_tiss','lote_tiss_sem_recebivel','guia_em_lote_sem_vinculo','recebivel_glosa_divergente','glosa_em_recurso_sem_item') and (p_atendimento_id is null or atendimento_id=p_atendimento_id or atendimento_id is null);
  perform public.reconciliar_anomalias_globais_tiss_internal();
  return jsonb_build_object('abertas_faturamento',v_abertas,'resolvidas_nesta_execucao',v_resolvidas);
end $$;
revoke execute on function public.reconciliar_pendencias_faturamento_internal(uuid,uuid,uuid,uuid) from public,anon,authenticated;
