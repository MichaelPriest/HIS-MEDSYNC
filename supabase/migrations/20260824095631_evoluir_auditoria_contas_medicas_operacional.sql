alter table public.auditoria_conta_itens
  add column if not exists codigo text,
  add column if not exists automatizada boolean not null default false,
  add column if not exists resolucao text,
  add column if not exists ultima_verificacao_em timestamptz;

create index if not exists idx_auditoria_conta_itens_abertas
  on public.auditoria_conta_itens(auditoria_id, resolvida, severidade);

create or replace function public.executar_auditoria_conta_automatica(p_auditoria_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_a public.auditoria_contas%rowtype;
  v_c public.contas_faturamento%rowtype;
  v_atendimento record;
  v_itens integer := 0;
  v_invalidos integer := 0;
  v_sem_preco integer := 0;
  v_guias integer := 0;
  v_docs integer := 0;
  v_count integer := 0;
  v_soma numeric := 0;
begin
  select * into v_a
  from public.auditoria_contas
  where id = p_auditoria_id;

  if v_a.id is null or not public.tem_unidade(v_a.empresa_id, v_a.unidade_id) then
    raise exception 'Auditoria nao encontrada ou sem acesso';
  end if;

  delete from public.auditoria_conta_itens
  where auditoria_id = p_auditoria_id
    and automatizada
    and not resolvida;

  if v_a.conta_id is null then
    insert into public.auditoria_conta_itens(auditoria_id,codigo,categoria,severidade,descricao,origem,automatizada,ultima_verificacao_em)
    values(p_auditoria_id,'SEM_CONTA','estrutura','bloqueio','Auditoria sem conta de faturamento vinculada.','motor_auditoria',true,now());
    return 1;
  end if;

  select * into v_c
  from public.contas_faturamento
  where id = v_a.conta_id;

  if v_c.id is null then
    insert into public.auditoria_conta_itens(auditoria_id,codigo,categoria,severidade,descricao,origem,automatizada,ultima_verificacao_em)
    values(p_auditoria_id,'CONTA_INEXISTENTE','estrutura','bloqueio','Conta de faturamento vinculada nao foi localizada.','motor_auditoria',true,now());
    return 1;
  end if;

  select
    count(*)::integer,
    count(*) filter (where coalesce(valor_unitario,0) <= 0 or coalesce(valor_total,0) <= 0)::integer,
    count(*) filter (where codigo is not null and valor_referencia is null and valor_contratual_calculado is null)::integer,
    coalesce(sum(valor_total),0)
  into v_itens, v_invalidos, v_sem_preco, v_soma
  from public.conta_faturamento_itens
  where conta_id = v_c.id
    and cobravel;

  if v_itens = 0 then
    insert into public.auditoria_conta_itens(auditoria_id,codigo,categoria,severidade,descricao,origem,automatizada,ultima_verificacao_em)
    values(p_auditoria_id,'SEM_ITENS','faturamento','bloqueio','Conta sem itens cobraveis.','motor_auditoria',true,now());
    v_count := v_count + 1;
  end if;

  if v_invalidos > 0 then
    insert into public.auditoria_conta_itens(auditoria_id,codigo,categoria,severidade,descricao,origem,automatizada,ultima_verificacao_em)
    values(p_auditoria_id,'VALOR_INVALIDO','valor','erro',format('%s item(ns) cobravel(is) com valor unitario ou total zerado/negativo.',v_invalidos),'motor_auditoria',true,now());
    v_count := v_count + 1;
  end if;

  if abs(coalesce(v_soma,0) - coalesce(v_c.valor_bruto,0)) > 0.01 then
    insert into public.auditoria_conta_itens(auditoria_id,codigo,categoria,severidade,descricao,origem,automatizada,ultima_verificacao_em)
    values(p_auditoria_id,'TOTAL_DIVERGENTE','valor','erro',format('Soma dos itens (R$ %s) diverge do valor bruto da conta (R$ %s).',to_char(v_soma,'FM999999990D00'),to_char(v_c.valor_bruto,'FM999999990D00')),'motor_auditoria',true,now());
    v_count := v_count + 1;
  end if;

  if v_sem_preco > 0 and v_c.tipo_cobranca = 'convenio' then
    insert into public.auditoria_conta_itens(auditoria_id,codigo,categoria,severidade,descricao,origem,automatizada,ultima_verificacao_em)
    values(p_auditoria_id,'SEM_REFERENCIA_PRECO','contrato','alerta',format('%s item(ns) ainda sem referencia contratual localizada.',v_sem_preco),'motor_auditoria',true,now());
    v_count := v_count + 1;
  end if;

  select numero_carteirinha, numero_autorizacao, senha_autorizacao
  into v_atendimento
  from public.atendimentos
  where id = v_c.atendimento_id;

  if v_c.tipo_cobranca = 'convenio' then
    if coalesce(v_atendimento.numero_carteirinha,'') = '' then
      insert into public.auditoria_conta_itens(auditoria_id,codigo,categoria,severidade,descricao,origem,automatizada,ultima_verificacao_em)
      values(p_auditoria_id,'SEM_CARTEIRINHA','autorizacao','bloqueio','Atendimento de convenio sem numero de carteirinha.','motor_auditoria',true,now());
      v_count := v_count + 1;
    end if;

    select count(*)::integer into v_guias
    from public.central_guias
    where atendimento_id = v_c.atendimento_id
      and status = 'autorizada';

    if v_guias = 0 then
      insert into public.auditoria_conta_itens(auditoria_id,codigo,categoria,severidade,descricao,origem,automatizada,ultima_verificacao_em)
      values(p_auditoria_id,'SEM_GUIA_AUTORIZADA','autorizacao','alerta','Nenhuma guia autorizada foi localizada para o atendimento.','motor_auditoria',true,now());
      v_count := v_count + 1;
    end if;
  end if;

  select count(*)::integer into v_docs
  from public.ged_documentos
  where status = 'ativo'
    and (conta_faturamento_id = v_c.id or atendimento_id = v_c.atendimento_id);

  if v_docs = 0 then
    insert into public.auditoria_conta_itens(auditoria_id,codigo,categoria,severidade,descricao,origem,automatizada,ultima_verificacao_em)
    values(p_auditoria_id,'SEM_DOCUMENTOS_GED','documentacao','alerta','Nenhum documento ativo no GED foi localizado para a conta/atendimento.','motor_auditoria',true,now());
    v_count := v_count + 1;
  end if;

  update public.auditoria_contas
  set updated_at = now()
  where id = p_auditoria_id;

  return v_count;
end;
$$;

create or replace function public.resolver_item_auditoria(p_item_id uuid, p_resolucao text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_item public.auditoria_conta_itens%rowtype;
  v_a public.auditoria_contas%rowtype;
begin
  select * into v_item from public.auditoria_conta_itens where id = p_item_id;
  if v_item.id is null then raise exception 'Pendencia nao encontrada'; end if;

  select * into v_a from public.auditoria_contas where id = v_item.auditoria_id;
  if v_a.id is null or not public.tem_unidade(v_a.empresa_id, v_a.unidade_id) then
    raise exception 'Sem acesso';
  end if;

  update public.auditoria_conta_itens
  set resolvida = true,
      resolvida_em = now(),
      resolvida_por = auth.uid(),
      resolucao = nullif(trim(coalesce(p_resolucao,'')), '')
  where id = p_item_id;
end;
$$;

create or replace function public.reabrir_item_auditoria(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_item public.auditoria_conta_itens%rowtype;
  v_a public.auditoria_contas%rowtype;
begin
  select * into v_item from public.auditoria_conta_itens where id = p_item_id;
  if v_item.id is null then raise exception 'Pendencia nao encontrada'; end if;

  select * into v_a from public.auditoria_contas where id = v_item.auditoria_id;
  if v_a.id is null or not public.tem_unidade(v_a.empresa_id, v_a.unidade_id) then
    raise exception 'Sem acesso';
  end if;

  update public.auditoria_conta_itens
  set resolvida = false,
      resolvida_em = null,
      resolvida_por = null,
      resolucao = null
  where id = p_item_id;
end;
$$;

create or replace function public.liberar_auditoria_conta(p_auditoria_id uuid, p_observacoes text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_a public.auditoria_contas%rowtype;
begin
  select * into v_a from public.auditoria_contas where id = p_auditoria_id;
  if v_a.id is null or not public.tem_unidade(v_a.empresa_id, v_a.unidade_id) then
    raise exception 'Auditoria nao encontrada ou sem acesso';
  end if;

  perform public.executar_auditoria_conta_automatica(p_auditoria_id);

  if exists(
    select 1
    from public.auditoria_conta_itens
    where auditoria_id = p_auditoria_id
      and not resolvida
      and severidade in ('erro','bloqueio')
  ) then
    raise exception 'Existem pendencias impeditivas';
  end if;

  update public.auditoria_contas
  set status = 'liberada',
      auditor_id = auth.uid(),
      finalizado_em = now(),
      observacoes = coalesce(p_observacoes, observacoes),
      updated_at = now()
  where id = p_auditoria_id;

  if v_a.conta_id is not null then
    update public.contas_faturamento
    set auditoria_liberada = true,
        auditoria_id = p_auditoria_id,
        updated_at = now(),
        updated_by = auth.uid()
    where id = v_a.conta_id;
  end if;
end;
$$;

revoke all on function public.executar_auditoria_conta_automatica(uuid) from public, anon;
revoke all on function public.resolver_item_auditoria(uuid,text) from public, anon;
revoke all on function public.reabrir_item_auditoria(uuid) from public, anon;
revoke all on function public.liberar_auditoria_conta(uuid,text) from public, anon;

grant execute on function public.executar_auditoria_conta_automatica(uuid) to authenticated;
grant execute on function public.resolver_item_auditoria(uuid,text) to authenticated;
grant execute on function public.reabrir_item_auditoria(uuid) to authenticated;
grant execute on function public.liberar_auditoria_conta(uuid,text) to authenticated;
