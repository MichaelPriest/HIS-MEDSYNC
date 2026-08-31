create or replace function public.executar_auditoria_conta_automatica_internal(p_auditoria_id uuid)
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
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
  v_auth_pendente integer := 0;
  v_count integer := 0;
  v_soma numeric := 0;
begin
  select * into v_a from public.auditoria_contas where id=p_auditoria_id;
  if v_a.id is null or not public.tem_unidade(v_a.empresa_id,v_a.unidade_id) then
    raise exception 'Auditoria nao encontrada ou sem acesso';
  end if;

  delete from public.auditoria_conta_itens
   where auditoria_id=p_auditoria_id and automatizada and not resolvida;

  if v_a.conta_id is null then
    insert into public.auditoria_conta_itens(auditoria_id,codigo,categoria,severidade,descricao,origem,automatizada,ultima_verificacao_em)
    values(p_auditoria_id,'SEM_CONTA','estrutura','bloqueio','Auditoria sem conta de faturamento vinculada.','motor_auditoria',true,now());
    return 1;
  end if;

  select * into v_c from public.contas_faturamento where id=v_a.conta_id;
  if v_c.id is null then
    insert into public.auditoria_conta_itens(auditoria_id,codigo,categoria,severidade,descricao,origem,automatizada,ultima_verificacao_em)
    values(p_auditoria_id,'CONTA_INEXISTENTE','estrutura','bloqueio','Conta de faturamento vinculada nao foi localizada.','motor_auditoria',true,now());
    return 1;
  end if;

  select count(*)::integer,
         count(*) filter (where coalesce(valor_unitario,0)<=0 or coalesce(valor_total,0)<=0)::integer,
         count(*) filter (where codigo is not null and valor_referencia is null and valor_contratual_calculado is null)::integer,
         coalesce(sum(valor_total),0)
    into v_itens,v_invalidos,v_sem_preco,v_soma
    from public.conta_faturamento_itens where conta_id=v_c.id and cobravel;

  if v_itens=0 then
    insert into public.auditoria_conta_itens(auditoria_id,codigo,categoria,severidade,descricao,origem,automatizada,ultima_verificacao_em)
    values(p_auditoria_id,'SEM_ITENS','faturamento','bloqueio','Conta sem itens cobraveis.','motor_auditoria',true,now());
    v_count:=v_count+1;
  end if;
  if v_invalidos>0 then
    insert into public.auditoria_conta_itens(auditoria_id,codigo,categoria,severidade,descricao,origem,automatizada,ultima_verificacao_em)
    values(p_auditoria_id,'VALOR_INVALIDO','valor','erro',format('%s item(ns) cobravel(is) com valor unitario ou total zerado/negativo.',v_invalidos),'motor_auditoria',true,now());
    v_count:=v_count+1;
  end if;
  if abs(coalesce(v_soma,0)-coalesce(v_c.valor_bruto,0))>0.01 then
    insert into public.auditoria_conta_itens(auditoria_id,codigo,categoria,severidade,descricao,origem,automatizada,ultima_verificacao_em)
    values(p_auditoria_id,'TOTAL_DIVERGENTE','valor','erro',format('Soma dos itens (R$ %s) diverge do valor bruto da conta (R$ %s).',to_char(v_soma,'FM999999990D00'),to_char(v_c.valor_bruto,'FM999999990D00')),'motor_auditoria',true,now());
    v_count:=v_count+1;
  end if;
  if v_sem_preco>0 and v_c.tipo_cobranca='convenio' then
    insert into public.auditoria_conta_itens(auditoria_id,codigo,categoria,severidade,descricao,origem,automatizada,ultima_verificacao_em)
    values(p_auditoria_id,'SEM_REFERENCIA_PRECO','contrato','alerta',format('%s item(ns) ainda sem referencia contratual localizada.',v_sem_preco),'motor_auditoria',true,now());
    v_count:=v_count+1;
  end if;

  select numero_carteirinha,numero_autorizacao,senha_autorizacao into v_atendimento
    from public.atendimentos where id=v_c.atendimento_id;
  if v_c.tipo_cobranca='convenio' then
    if coalesce(v_atendimento.numero_carteirinha,'')='' then
      insert into public.auditoria_conta_itens(auditoria_id,codigo,categoria,severidade,descricao,origem,automatizada,ultima_verificacao_em)
      values(p_auditoria_id,'SEM_CARTEIRINHA','autorizacao','bloqueio','Atendimento de convenio sem numero de carteirinha.','motor_auditoria',true,now());
      v_count:=v_count+1;
    end if;

    select case when
      exists(
        select 1
          from public.central_guias g
         where g.atendimento_id=v_c.atendimento_id
           and g.status='autorizada'
      )
      or exists(
        select 1
          from public.autorizacoes_atendimento a
         where a.atendimento_id=v_c.atendimento_id
           and a.empresa_id=v_c.empresa_id
           and a.unidade_id=v_c.unidade_id
           and a.status='autorizada'
           and (a.validade is null or a.validade >= current_date)
      )
      then 1 else 0 end
      into v_guias;

    if v_guias=0 then
      insert into public.auditoria_conta_itens(auditoria_id,codigo,categoria,severidade,descricao,origem,automatizada,ultima_verificacao_em)
      values(p_auditoria_id,'SEM_GUIA_AUTORIZADA','autorizacao','alerta','Nenhuma guia ou autorizacao valida foi localizada para o atendimento.','motor_auditoria',true,now());
      v_count:=v_count+1;
    end if;
  end if;

  select count(*)::integer into v_auth_pendente
    from public.conta_faturamento_itens i
   where i.conta_id=v_c.id
     and coalesce((i.memoria_calculo->'autorizacao'->>'exigida')::boolean,false)
     and coalesce(i.memoria_calculo->'autorizacao'->>'status','')<>'autorizada';
  if v_auth_pendente>0 then
    insert into public.auditoria_conta_itens(auditoria_id,codigo,categoria,severidade,descricao,origem,automatizada,ultima_verificacao_em)
    values(p_auditoria_id,'AUTORIZACAO_PRODUCAO_INSUFICIENTE','autorizacao','bloqueio',
      format('%s item(ns) de produção exigem autorização e estão sem cobertura integral da guia/senha.',v_auth_pendente),
      'livro_producao',true,now());
    v_count:=v_count+1;
  end if;

  select count(*)::integer into v_docs from public.ged_documentos
   where status='ativo' and (conta_faturamento_id=v_c.id or atendimento_id=v_c.atendimento_id);
  if v_docs=0 then
    insert into public.auditoria_conta_itens(auditoria_id,codigo,categoria,severidade,descricao,origem,automatizada,ultima_verificacao_em)
    values(p_auditoria_id,'SEM_DOCUMENTOS_GED','documentacao','alerta','Nenhum documento ativo no GED foi localizado para a conta/atendimento.','motor_auditoria',true,now());
    v_count:=v_count+1;
  end if;

  update public.auditoria_contas set updated_at=now() where id=p_auditoria_id;
  return v_count;
end
$$;
