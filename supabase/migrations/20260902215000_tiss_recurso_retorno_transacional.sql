begin;

create table if not exists public.tiss_recurso_retornos (
  id uuid primary key default extensions.gen_random_uuid(),
  recurso_id uuid not null references public.tiss_recursos_glosa(id),
  empresa_id uuid not null references public.empresas(id),
  unidade_id uuid not null references public.unidades(id),
  protocolo_operadora text null,
  recebido_em timestamptz not null default now(),
  observacao text null,
  origem text not null default 'manual' check (origem in ('manual','integracao')),
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id)
);

create table if not exists public.tiss_recurso_retorno_itens (
  id uuid primary key default extensions.gen_random_uuid(),
  retorno_id uuid not null references public.tiss_recurso_retornos(id),
  recurso_item_id uuid not null references public.tiss_recurso_itens(id),
  valor_deferido numeric not null default 0 check (valor_deferido >= 0),
  valor_indeferido numeric not null default 0 check (valor_indeferido >= 0),
  created_at timestamptz not null default now(),
  unique (retorno_id,recurso_item_id),
  check (valor_deferido + valor_indeferido > 0)
);

create index if not exists idx_tiss_recurso_retornos_recurso
  on public.tiss_recurso_retornos(recurso_id,recebido_em desc);
create index if not exists idx_tiss_recurso_retorno_itens_retorno
  on public.tiss_recurso_retorno_itens(retorno_id);
create index if not exists idx_tiss_recurso_retorno_itens_item
  on public.tiss_recurso_retorno_itens(recurso_item_id);

alter table public.tiss_recurso_retornos enable row level security;
alter table public.tiss_recurso_retorno_itens enable row level security;

drop policy if exists tiss_recurso_retornos_select on public.tiss_recurso_retornos;
create policy tiss_recurso_retornos_select on public.tiss_recurso_retornos
for select to authenticated
using (
  exists (
    select 1 from public.tiss_recursos_glosa r
    where r.id=recurso_id and public.tem_unidade(r.empresa_id,r.unidade_id)
  )
);

drop policy if exists tiss_recurso_retorno_itens_select on public.tiss_recurso_retorno_itens;
create policy tiss_recurso_retorno_itens_select on public.tiss_recurso_retorno_itens
for select to authenticated
using (
  exists (
    select 1
    from public.tiss_recurso_retornos rt
    join public.tiss_recursos_glosa r on r.id=rt.recurso_id
    where rt.id=retorno_id and public.tem_unidade(r.empresa_id,r.unidade_id)
  )
);

revoke all on public.tiss_recurso_retornos from anon,authenticated;
revoke all on public.tiss_recurso_retorno_itens from anon,authenticated;
grant select on public.tiss_recurso_retornos to authenticated;
grant select on public.tiss_recurso_retorno_itens to authenticated;
grant all on public.tiss_recurso_retornos to service_role;
grant all on public.tiss_recurso_retorno_itens to service_role;

alter table public.tiss_glosas drop constraint if exists tiss_glosas_status_check;
alter table public.tiss_glosas add constraint tiss_glosas_status_check
check (status = any (array['aberta','em_recurso','aceita','deferida','indeferida','parcial','cancelada']::text[]));

create or replace function public.calcular_glosa_residual_lote_tiss_internal(p_lote_id uuid)
returns numeric
language sql
stable
security definer
set search_path to ''
as $function$
  select coalesce(sum(g.valor_glosado - least(g.valor_glosado,coalesce(rec.valor_deferido,0))),0)
  from public.tiss_glosas g
  left join lateral (
    select coalesce(sum(ri.valor_deferido),0) valor_deferido
    from public.tiss_recurso_itens ri
    where ri.glosa_id=g.id
  ) rec on true
  where g.lote_id=p_lote_id and g.status<>'cancelada'
$function$;

revoke all on function public.calcular_glosa_residual_lote_tiss_internal(uuid) from public,anon,authenticated;

create or replace function public.recalcular_recebivel_glosa_tiss_internal(p_lote_id uuid,p_user uuid default null)
returns numeric
language plpgsql
security definer
set search_path to ''
as $function$
declare v_total numeric;
begin
  v_total:=public.calcular_glosa_residual_lote_tiss_internal(p_lote_id);
  update public.financeiro_recebiveis
  set valor_glosa=v_total,
      valor_liquido_previsto=greatest(valor_bruto-v_total,0),
      updated_at=now(),
      updated_by=coalesce(p_user,updated_by)
  where lote_id=p_lote_id and status<>'cancelado';
  return v_total;
end
$function$;

revoke all on function public.recalcular_recebivel_glosa_tiss_internal(uuid,uuid) from public,anon,authenticated;

create or replace function public.registrar_glosa_tiss_transacional(
  p_lote_id uuid,
  p_protocolo_id uuid,
  p_guia_id uuid,
  p_guia_item_id uuid,
  p_codigo_glosa text,
  p_descricao_glosa text,
  p_valor_glosado numeric
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare v_user uuid:=auth.uid(); v_lote public.tiss_lotes%rowtype; v_id uuid;
begin
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
  perform public.recalcular_recebivel_glosa_tiss_internal(v_lote.id,v_user);
  return v_id;
end
$function$;

revoke all on function public.registrar_glosa_tiss_transacional(uuid,uuid,uuid,uuid,text,text,numeric) from public,anon;
grant execute on function public.registrar_glosa_tiss_transacional(uuid,uuid,uuid,uuid,text,text,numeric) to authenticated;

create or replace function public.registrar_retorno_recurso_glosa_transacional(
  p_recurso_id uuid,
  p_protocolo_operadora text,
  p_retorno_em timestamptz,
  p_itens jsonb,
  p_observacao text default null,
  p_origem text default 'manual'
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user uuid:=auth.uid();
  v_recurso public.tiss_recursos_glosa%rowtype;
  v_retorno uuid;
  v_json jsonb;
  v_item_id_text text;
  v_item_id uuid;
  v_deferido numeric;
  v_indeferido numeric;
  v_item public.tiss_recurso_itens%rowtype;
  v_glosa public.tiss_glosas%rowtype;
  v_total_deferido_glosa numeric;
  v_total_recursado numeric;
  v_total_deferido numeric;
  v_total_indeferido numeric;
  v_status text;
  v_lote uuid;
  v_recebido_em timestamptz:=coalesce(p_retorno_em,now());
begin
  if v_user is null then raise exception 'TISS_RECURSO_RETORNO_NAO_AUTENTICADO' using errcode='42501'; end if;
  if p_origem not in ('manual','integracao') then raise exception 'TISS_RECURSO_RETORNO_ORIGEM_INVALIDA'; end if;
  if p_itens is null or jsonb_typeof(p_itens)<>'array' or jsonb_array_length(p_itens)=0 then raise exception 'TISS_RECURSO_RETORNO_SEM_ITENS'; end if;

  select * into v_recurso from public.tiss_recursos_glosa where id=p_recurso_id for update;
  if not found then raise exception 'TISS_RECURSO_RETORNO_NAO_LOCALIZADO'; end if;
  if not public.tem_unidade(v_recurso.empresa_id,v_recurso.unidade_id) or not public.tem_permissao(v_recurso.empresa_id,v_recurso.unidade_id,'tiss.retorno') then raise exception 'TISS_RECURSO_RETORNO_SEM_PERMISSAO' using errcode='42501'; end if;

  insert into public.tiss_recurso_retornos(recurso_id,empresa_id,unidade_id,protocolo_operadora,recebido_em,observacao,origem,created_by)
  values(v_recurso.id,v_recurso.empresa_id,v_recurso.unidade_id,nullif(btrim(coalesce(p_protocolo_operadora,'')),''),v_recebido_em,nullif(btrim(coalesce(p_observacao,'')),''),p_origem,v_user)
  returning id into v_retorno;

  for v_json in select value from jsonb_array_elements(p_itens)
  loop
    v_item_id_text:=coalesce(v_json->>'item_id','');
    if v_item_id_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then raise exception 'TISS_RECURSO_RETORNO_ITEM_INVALIDO'; end if;
    v_item_id:=v_item_id_text::uuid;
    if coalesce(v_json->>'valor_deferido','') !~ '^[0-9]+([.][0-9]+)?$' or coalesce(v_json->>'valor_indeferido','') !~ '^[0-9]+([.][0-9]+)?$' then raise exception 'TISS_RECURSO_RETORNO_VALOR_INVALIDO'; end if;
    v_deferido:=(v_json->>'valor_deferido')::numeric;
    v_indeferido:=(v_json->>'valor_indeferido')::numeric;
    if v_deferido<0 or v_indeferido<0 or v_deferido+v_indeferido<=0 then raise exception 'TISS_RECURSO_RETORNO_VALOR_INVALIDO'; end if;

    select * into v_item from public.tiss_recurso_itens where id=v_item_id and recurso_id=v_recurso.id for update;
    if not found then raise exception 'TISS_RECURSO_RETORNO_ITEM_FORA_RECURSO'; end if;
    if v_item.valor_deferido+v_item.valor_indeferido+v_deferido+v_indeferido>v_item.valor_recursado then raise exception 'TISS_RECURSO_RETORNO_EXCEDE_RECURSADO'; end if;

    select * into v_glosa from public.tiss_glosas where id=v_item.glosa_id for update;
    if not found then raise exception 'TISS_RECURSO_RETORNO_GLOSA_NAO_LOCALIZADA'; end if;
    select coalesce(sum(ri.valor_deferido),0) into v_total_deferido_glosa from public.tiss_recurso_itens ri where ri.glosa_id=v_glosa.id;
    if v_total_deferido_glosa+v_deferido>v_glosa.valor_glosado then raise exception 'TISS_RECURSO_RETORNO_DEFERIDO_EXCEDE_GLOSA'; end if;

    insert into public.tiss_recurso_retorno_itens(retorno_id,recurso_item_id,valor_deferido,valor_indeferido)
    values(v_retorno,v_item.id,v_deferido,v_indeferido);

    update public.tiss_recurso_itens
    set valor_deferido=valor_deferido+v_deferido,
        valor_indeferido=valor_indeferido+v_indeferido
    where id=v_item.id
    returning * into v_item;

    select coalesce(sum(ri.valor_deferido),0) into v_total_deferido_glosa from public.tiss_recurso_itens ri where ri.glosa_id=v_glosa.id;
    if v_item.valor_deferido+v_item.valor_indeferido<v_item.valor_recursado then
      v_status:='em_recurso';
    elsif v_total_deferido_glosa>=v_glosa.valor_glosado then
      v_status:='deferida';
    elsif v_total_deferido_glosa>0 then
      v_status:='parcial';
    else
      v_status:='indeferida';
    end if;
    update public.tiss_glosas set status=v_status where id=v_glosa.id;
  end loop;

  select coalesce(sum(valor_recursado),0),coalesce(sum(valor_deferido),0),coalesce(sum(valor_indeferido),0)
  into v_total_recursado,v_total_deferido,v_total_indeferido
  from public.tiss_recurso_itens where recurso_id=v_recurso.id;

  if v_total_deferido+v_total_indeferido<v_total_recursado then
    v_status:='parcial';
  elsif v_total_deferido=v_total_recursado then
    v_status:='deferido';
  elsif v_total_indeferido=v_total_recursado then
    v_status:='indeferido';
  else
    v_status:='parcial';
  end if;

  update public.tiss_recursos_glosa
  set status=v_status,
      protocolo_operadora=coalesce(nullif(btrim(coalesce(p_protocolo_operadora,'')),''),protocolo_operadora),
      retorno_em=greatest(coalesce(retorno_em,v_recebido_em),v_recebido_em),
      updated_at=now(),
      updated_by=v_user
  where id=v_recurso.id;

  for v_lote in
    select distinct g.lote_id
    from public.tiss_recurso_itens ri
    join public.tiss_glosas g on g.id=ri.glosa_id
    where ri.recurso_id=v_recurso.id and g.lote_id is not null
  loop
    perform public.recalcular_recebivel_glosa_tiss_internal(v_lote,v_user);
  end loop;

  return v_retorno;
end
$function$;

revoke all on function public.registrar_retorno_recurso_glosa_transacional(uuid,text,timestamptz,jsonb,text,text) from public,anon;
grant execute on function public.registrar_retorno_recurso_glosa_transacional(uuid,text,timestamptz,jsonb,text,text) to authenticated;

create or replace function public.capturar_integracao_recurso_retorno_item()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare v_rt public.tiss_recurso_retornos%rowtype; v_ri public.tiss_recurso_itens%rowtype; v_r public.tiss_recursos_glosa%rowtype; v_g public.tiss_glosas%rowtype; v_at uuid; v_pac uuid;
begin
  select * into v_rt from public.tiss_recurso_retornos where id=new.retorno_id;
  select * into v_ri from public.tiss_recurso_itens where id=new.recurso_item_id;
  select * into v_r from public.tiss_recursos_glosa where id=v_rt.recurso_id;
  select * into v_g from public.tiss_glosas where id=v_ri.glosa_id;
  if v_g.guia_id is not null then select atendimento_id,paciente_id into v_at,v_pac from public.tiss_guias where id=v_g.guia_id; end if;
  if v_r.id is not null then
    perform public.registrar_integracao_evento_internal(v_r.empresa_id,v_r.unidade_id,v_at,v_pac,'glosa.recurso_retorno','tiss_recurso_retorno_itens',new.id,v_rt.recebido_em,jsonb_build_object('recurso_id',v_r.id,'retorno_id',v_rt.id,'glosa_id',v_g.id,'valor_deferido',new.valor_deferido,'valor_indeferido',new.valor_indeferido,'protocolo_operadora',v_rt.protocolo_operadora));
  end if;
  return new;
end
$function$;

revoke all on function public.capturar_integracao_recurso_retorno_item() from public,anon,authenticated;
drop trigger if exists trg_capturar_integracao_recurso_retorno_item on public.tiss_recurso_retorno_itens;
create trigger trg_capturar_integracao_recurso_retorno_item
after insert on public.tiss_recurso_retorno_itens
for each row execute function public.capturar_integracao_recurso_retorno_item();

create or replace function public.reconciliar_pendencias_faturamento_internal(p_empresa_id uuid, p_unidade_id uuid, p_atendimento_id uuid default null, p_resolvida_por uuid default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare v_resolvidas integer:=0; v_abertas integer:=0;
begin
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
  select l.empresa_id,l.unidade_id,null,null,'recebivel_glosa_divergente','tiss_lotes',l.id,'faturamento','financeiro','alta','Glosa TISS divergente do recebível','O saldo financeiro de glosas do lote diverge do valor registrado no recebível.',jsonb_build_object('lote_id',l.id,'glosa_tiss',public.calcular_glosa_residual_lote_tiss_internal(l.id),'glosa_recebivel',coalesce(r.valor_glosa,0))
  from public.tiss_lotes l join public.financeiro_recebiveis r on r.lote_id=l.id and r.status<>'cancelado'
  where l.empresa_id=p_empresa_id and l.unidade_id=p_unidade_id and p_atendimento_id is null and abs(public.calcular_glosa_residual_lote_tiss_internal(l.id)-coalesce(r.valor_glosa,0))>0.01 on conflict do nothing;

  insert into public.integracao_pendencias(empresa_id,unidade_id,atendimento_id,paciente_id,regra_chave,origem_tabela,origem_id,setor_origem,setor_destino,severidade,titulo,detalhes,contexto)
  select g.empresa_id,g.unidade_id,tg.atendimento_id,tg.paciente_id,'glosa_em_recurso_sem_item','tiss_glosas',g.id,'faturamento','faturamento','critica','Glosa em recurso sem item de recurso','A glosa está marcada em recurso, mas não existe vínculo com tiss_recurso_itens.',jsonb_build_object('glosa_id',g.id,'guia_id',g.guia_id,'valor_glosado',g.valor_glosado)
  from public.tiss_glosas g left join public.tiss_guias tg on tg.id=g.guia_id where g.empresa_id=p_empresa_id and g.unidade_id=p_unidade_id and g.status='em_recurso' and (p_atendimento_id is null or tg.atendimento_id=p_atendimento_id) and not exists(select 1 from public.tiss_recurso_itens ri where ri.glosa_id=g.id) on conflict do nothing;

  update public.integracao_pendencias x set status='resolvida',resolvida_em=now(),resolvida_por=p_resolvida_por,updated_at=now()
  where x.empresa_id=p_empresa_id and x.unidade_id=p_unidade_id and x.status='aberta' and (p_atendimento_id is null or x.atendimento_id=p_atendimento_id or x.atendimento_id is null) and (
    (x.regra_chave='conta_pronta_sem_guia_tiss' and not exists(select 1 from public.contas_faturamento c where c.id=x.origem_id and c.tipo_cobranca='convenio' and c.status='pronta' and c.auditoria_liberada and c.contas_medicas_liberada and not exists(select 1 from public.tiss_guias g where g.conta_id=c.id and g.status<>'cancelada'))) or
    (x.regra_chave='lote_tiss_sem_recebivel' and not exists(select 1 from public.tiss_lotes l where l.id=x.origem_id and l.status<>'rejeitado' and not exists(select 1 from public.financeiro_recebiveis r where r.lote_id=l.id and r.status<>'cancelado'))) or
    (x.regra_chave='guia_em_lote_sem_vinculo' and not exists(select 1 from public.tiss_guias g where g.id=x.origem_id and g.status='em_lote' and not exists(select 1 from public.tiss_lote_guias lg where lg.guia_id=g.id))) or
    (x.regra_chave='recebivel_glosa_divergente' and not exists(select 1 from public.tiss_lotes l join public.financeiro_recebiveis r on r.lote_id=l.id and r.status<>'cancelado' where l.id=x.origem_id and abs(public.calcular_glosa_residual_lote_tiss_internal(l.id)-coalesce(r.valor_glosa,0))>0.01)) or
    (x.regra_chave='glosa_em_recurso_sem_item' and not exists(select 1 from public.tiss_glosas g where g.id=x.origem_id and g.status='em_recurso' and not exists(select 1 from public.tiss_recurso_itens ri where ri.glosa_id=g.id)))
  );
  get diagnostics v_resolvidas=row_count;
  select count(*) into v_abertas from public.integracao_pendencias where empresa_id=p_empresa_id and unidade_id=p_unidade_id and status='aberta' and regra_chave in ('conta_pronta_sem_guia_tiss','lote_tiss_sem_recebivel','guia_em_lote_sem_vinculo','recebivel_glosa_divergente','glosa_em_recurso_sem_item') and (p_atendimento_id is null or atendimento_id=p_atendimento_id or atendimento_id is null);
  perform public.reconciliar_anomalias_globais_tiss_internal();
  return jsonb_build_object('abertas_faturamento',v_abertas,'resolvidas_nesta_execucao',v_resolvidas);
end
$function$;

commit;
