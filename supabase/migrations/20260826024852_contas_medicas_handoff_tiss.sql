create or replace function public.validar_conta_tiss_internal(p_conta_id uuid)
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
declare
  v_conta record;
  v_item record;
  v_total_itens integer := 0;
  v_impeditivas integer := 0;
begin
  select
    cf.id,
    cf.status,
    cf.tipo_cobranca,
    cf.auditoria_liberada,
    cf.contas_medicas_liberada,
    a.numero_carteirinha,
    c.registro_ans,
    p.cns
  into v_conta
  from public.contas_faturamento cf
  join public.atendimentos a on a.id = cf.atendimento_id
  join public.pacientes p on p.id = cf.paciente_id
  left join public.convenios c on c.id = cf.convenio_id
  where cf.id = p_conta_id;

  if not found then
    raise exception 'VALIDACAO_TISS_CONTA_NAO_LOCALIZADA';
  end if;

  if v_conta.status in ('faturada','cancelada') then
    return 0;
  end if;

  delete from public.conta_faturamento_criticas
   where conta_id = p_conta_id
     and not resolvida
     and codigo in (
       'AUD-001','CM-001','TISS-CONV-001','TISS-BEN-001','TISS-BEN-002',
       'FAT-ITEM-001','TISS-ITEM-001','TISS-ITEM-002','TISS-ITEM-003',
       'TISS-PAC-001','TISS-PAC-002'
     );

  if not v_conta.auditoria_liberada then
    insert into public.conta_faturamento_criticas(conta_id,codigo,severidade,campo,mensagem)
    values(p_conta_id,'AUD-001','erro','auditoria_liberada','Conta ainda não liberada pela Auditoria pós-alta.');
    v_impeditivas := v_impeditivas + 1;
  end if;

  if not v_conta.contas_medicas_liberada then
    insert into public.conta_faturamento_criticas(conta_id,codigo,severidade,campo,mensagem)
    values(p_conta_id,'CM-001','erro','contas_medicas_liberada','Conta ainda não liberada por Contas Médicas.');
    v_impeditivas := v_impeditivas + 1;
  end if;

  if v_conta.tipo_cobranca = 'convenio' and nullif(btrim(coalesce(v_conta.registro_ans,'')),'') is null then
    insert into public.conta_faturamento_criticas(conta_id,codigo,severidade,campo,mensagem)
    values(p_conta_id,'TISS-CONV-001','erro','registro_ans','Convênio sem Registro ANS válido.');
    v_impeditivas := v_impeditivas + 1;
  end if;

  if v_conta.tipo_cobranca = 'convenio' and nullif(btrim(coalesce(v_conta.numero_carteirinha,'')),'') is null then
    insert into public.conta_faturamento_criticas(conta_id,codigo,severidade,campo,mensagem)
    values(p_conta_id,'TISS-BEN-001','erro','numero_carteirinha','Número da carteirinha não informado no atendimento.');
    v_impeditivas := v_impeditivas + 1;
  end if;

  if nullif(btrim(coalesce(v_conta.cns,'')),'') is null then
    insert into public.conta_faturamento_criticas(conta_id,codigo,severidade,campo,mensagem)
    values(p_conta_id,'TISS-BEN-002','alerta','cns','CNS do beneficiário não informado; confirme exigência da guia aplicável.');
  end if;

  select count(*) into v_total_itens
    from public.conta_faturamento_itens
   where conta_id = p_conta_id;

  if v_total_itens = 0 then
    insert into public.conta_faturamento_criticas(conta_id,codigo,severidade,mensagem)
    values(p_conta_id,'FAT-ITEM-001','erro','Conta sem itens faturáveis.');
    v_impeditivas := v_impeditivas + 1;
  end if;

  for v_item in
    select id, origem_tipo, tabela, codigo, descricao
      from public.conta_faturamento_itens
     where conta_id = p_conta_id
  loop
    if nullif(btrim(coalesce(v_item.codigo,'')),'') is null then
      insert into public.conta_faturamento_criticas(conta_id,item_id,codigo,severidade,campo,mensagem)
      values(p_conta_id,v_item.id,'TISS-ITEM-001','erro','codigo',format('Item %s sem código de procedimento/material/medicamento.',v_item.descricao));
      v_impeditivas := v_impeditivas + 1;
    end if;

    if nullif(btrim(coalesce(v_item.tabela,'')),'') is null then
      insert into public.conta_faturamento_criticas(conta_id,item_id,codigo,severidade,campo,mensagem)
      values(p_conta_id,v_item.id,'TISS-ITEM-002','erro','tabela',format('Item %s sem código de tabela TISS/TUSS.',v_item.descricao));
      v_impeditivas := v_impeditivas + 1;
    end if;

    if v_item.tabela = '00' and v_item.codigo is not null and length(v_item.codigo) > 10 then
      insert into public.conta_faturamento_criticas(conta_id,item_id,codigo,severidade,campo,mensagem)
      values(p_conta_id,v_item.id,'TISS-ITEM-003','erro','codigo',format('Código próprio do item %s excede 10 caracteres.',v_item.descricao));
      v_impeditivas := v_impeditivas + 1;
    end if;

    if v_item.origem_tipo = 'pacote' and v_item.tabela is distinct from '98' then
      insert into public.conta_faturamento_criticas(conta_id,item_id,codigo,severidade,campo,mensagem)
      values(p_conta_id,v_item.id,'TISS-PAC-001','erro','tabela',format('Pacote %s deve utilizar tabela 98.',v_item.descricao));
      v_impeditivas := v_impeditivas + 1;
    end if;

    if v_item.tabela = '98' and v_item.origem_tipo <> 'pacote' then
      insert into public.conta_faturamento_criticas(conta_id,item_id,codigo,severidade,campo,mensagem)
      values(p_conta_id,v_item.id,'TISS-PAC-002','erro','tabela','Tabela 98 é reservada aos pacotes.');
      v_impeditivas := v_impeditivas + 1;
    end if;
  end loop;

  update public.contas_faturamento
     set status = case when v_impeditivas > 0 then 'com_criticas' else 'pronta' end,
         updated_at = now(),
         updated_by = coalesce(auth.uid(), updated_by)
   where id = p_conta_id
     and status not in ('faturada','cancelada');

  return v_impeditivas;
end
$function$;

revoke all on function public.validar_conta_tiss_internal(uuid) from public, anon, authenticated;

create or replace function public.validar_conta_apos_liberacao_medica()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
begin
  if new.contas_medicas_liberada is true
     and coalesce(old.contas_medicas_liberada,false) is false
     and new.status not in ('faturada','cancelada') then
    perform public.validar_conta_tiss_internal(new.id);
  end if;
  return new;
end
$function$;

revoke all on function public.validar_conta_apos_liberacao_medica() from public, anon, authenticated;

drop trigger if exists trg_validar_conta_apos_liberacao_medica on public.contas_faturamento;
create trigger trg_validar_conta_apos_liberacao_medica
after update of contas_medicas_liberada on public.contas_faturamento
for each row
when (new.contas_medicas_liberada is true and old.contas_medicas_liberada is distinct from true)
execute function public.validar_conta_apos_liberacao_medica();

comment on function public.validar_conta_tiss_internal(uuid) is
  'Valida requisitos estruturais TISS da conta e promove para pronta ou com_criticas. Uso interno.';
comment on function public.validar_conta_apos_liberacao_medica() is
  'Handoff automático Contas Médicas -> validação TISS ao liberar a conta.';