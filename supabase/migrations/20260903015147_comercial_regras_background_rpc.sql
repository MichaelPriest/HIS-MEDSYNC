create or replace function public.comercial_salvar_regra_faturamento(
  p_id uuid,
  p_contrato_id uuid,
  p_categoria text,
  p_codigo_regra text,
  p_descricao text,
  p_operacao text,
  p_aplica_sobre text,
  p_percentual numeric,
  p_valor_fixo numeric,
  p_prioridade integer,
  p_condicoes jsonb,
  p_vigencia_inicio date,
  p_vigencia_fim date,
  p_encerra_processamento boolean,
  p_ativo boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contrato public.credenciamento_contratos%rowtype;
  v_id uuid;
  v_condicoes jsonb := coalesce(p_condicoes,'{}'::jsonb);
begin
  select c.* into v_contrato
    from public.credenciamento_contratos c
   where c.id=p_contrato_id;
  if not found then
    raise exception 'Contrato comercial nao encontrado';
  end if;
  if not public.comercial_pode_editar(v_contrato.empresa_id,v_contrato.unidade_id) then
    raise exception 'Sem permissao para editar regras do contrato';
  end if;

  if nullif(trim(p_categoria),'') is null
     or nullif(trim(p_codigo_regra),'') is null
     or nullif(trim(p_descricao),'') is null then
    raise exception 'Categoria, codigo e descricao sao obrigatorios';
  end if;
  if p_operacao not in ('multiplicar_percentual','acrescentar_percentual','descontar_percentual','somar_valor_fixo','substituir_valor') then
    raise exception 'Operacao de cobranca invalida';
  end if;
  if p_aplica_sobre not in ('valor_base','valor_atual') then
    raise exception 'Base de aplicacao invalida';
  end if;
  if jsonb_typeof(v_condicoes) <> 'object' then
    raise exception 'Condicoes devem formar um objeto JSON';
  end if;
  if p_vigencia_inicio is not null and p_vigencia_fim is not null and p_vigencia_fim < p_vigencia_inicio then
    raise exception 'Fim da vigencia nao pode ser anterior ao inicio';
  end if;
  if p_prioridade is null or p_prioridade < 0 then
    raise exception 'Prioridade deve ser maior ou igual a zero';
  end if;
  if p_operacao in ('multiplicar_percentual','acrescentar_percentual','descontar_percentual')
     and p_percentual is null and p_valor_fixo is null then
    raise exception 'Informe percentual ou valor fixo para a regra';
  end if;
  if p_operacao in ('somar_valor_fixo','substituir_valor') and p_valor_fixo is null then
    raise exception 'Valor fixo e obrigatorio para a operacao escolhida';
  end if;

  if p_id is null then
    insert into public.contrato_regras_faturamento(
      contrato_id,categoria,codigo_regra,descricao,percentual,valor_fixo,prioridade,
      condicoes,ativo,vigencia_inicio,vigencia_fim,operacao,aplica_sobre,encerra_processamento
    ) values (
      p_contrato_id,lower(trim(p_categoria)),upper(trim(p_codigo_regra)),trim(p_descricao),
      p_percentual,p_valor_fixo,p_prioridade,v_condicoes,coalesce(p_ativo,true),
      p_vigencia_inicio,p_vigencia_fim,p_operacao,p_aplica_sobre,coalesce(p_encerra_processamento,false)
    ) returning id into v_id;
  else
    update public.contrato_regras_faturamento r
       set categoria=lower(trim(p_categoria)),
           codigo_regra=upper(trim(p_codigo_regra)),
           descricao=trim(p_descricao),
           percentual=p_percentual,
           valor_fixo=p_valor_fixo,
           prioridade=p_prioridade,
           condicoes=v_condicoes,
           ativo=coalesce(p_ativo,true),
           vigencia_inicio=p_vigencia_inicio,
           vigencia_fim=p_vigencia_fim,
           operacao=p_operacao,
           aplica_sobre=p_aplica_sobre,
           encerra_processamento=coalesce(p_encerra_processamento,false)
     where r.id=p_id and r.contrato_id=p_contrato_id
     returning r.id into v_id;
    if v_id is null then
      raise exception 'Regra nao encontrada neste contrato';
    end if;
  end if;

  return v_id;
end;
$$;

revoke all on function public.comercial_salvar_regra_faturamento(uuid,uuid,text,text,text,text,text,numeric,numeric,integer,jsonb,date,date,boolean,boolean) from public, anon;
grant execute on function public.comercial_salvar_regra_faturamento(uuid,uuid,text,text,text,text,text,numeric,numeric,integer,jsonb,date,date,boolean,boolean) to authenticated;

create or replace function public.comercial_salvar_pacote(
  p_id uuid,
  p_contrato_id uuid,
  p_codigo text,
  p_nome text,
  p_valor numeric,
  p_vigencia_inicio date,
  p_vigencia_fim date,
  p_inclusoes jsonb,
  p_exclusoes jsonb,
  p_observacoes text,
  p_ativo boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contrato public.credenciamento_contratos%rowtype;
  v_id uuid;
  v_inclusoes jsonb := coalesce(p_inclusoes,'[]'::jsonb);
  v_exclusoes jsonb := coalesce(p_exclusoes,'[]'::jsonb);
begin
  select c.* into v_contrato
    from public.credenciamento_contratos c
   where c.id=p_contrato_id;
  if not found then
    raise exception 'Contrato comercial nao encontrado';
  end if;
  if not public.comercial_pode_editar(v_contrato.empresa_id,v_contrato.unidade_id) then
    raise exception 'Sem permissao para editar pacotes do contrato';
  end if;

  if nullif(trim(p_codigo),'') is null or nullif(trim(p_nome),'') is null then
    raise exception 'Codigo e nome do pacote sao obrigatorios';
  end if;
  if p_valor is null or p_valor < 0 then
    raise exception 'Valor do pacote deve ser maior ou igual a zero';
  end if;
  if jsonb_typeof(v_inclusoes) <> 'array' or jsonb_typeof(v_exclusoes) <> 'array' then
    raise exception 'Inclusoes e exclusoes devem ser listas';
  end if;
  if p_vigencia_inicio is not null and p_vigencia_fim is not null and p_vigencia_fim < p_vigencia_inicio then
    raise exception 'Fim da vigencia nao pode ser anterior ao inicio';
  end if;

  if p_id is null then
    insert into public.contrato_pacotes(
      contrato_id,codigo,nome,valor,vigencia_inicio,vigencia_fim,inclusoes,exclusoes,observacoes,ativo
    ) values (
      p_contrato_id,upper(trim(p_codigo)),trim(p_nome),p_valor,p_vigencia_inicio,p_vigencia_fim,
      v_inclusoes,v_exclusoes,nullif(trim(p_observacoes),''),coalesce(p_ativo,true)
    ) returning id into v_id;
  else
    update public.contrato_pacotes p
       set codigo=upper(trim(p_codigo)),
           nome=trim(p_nome),
           valor=p_valor,
           vigencia_inicio=p_vigencia_inicio,
           vigencia_fim=p_vigencia_fim,
           inclusoes=v_inclusoes,
           exclusoes=v_exclusoes,
           observacoes=nullif(trim(p_observacoes),''),
           ativo=coalesce(p_ativo,true)
     where p.id=p_id and p.contrato_id=p_contrato_id
     returning p.id into v_id;
    if v_id is null then
      raise exception 'Pacote nao encontrado neste contrato';
    end if;
  end if;

  return v_id;
end;
$$;

revoke all on function public.comercial_salvar_pacote(uuid,uuid,text,text,numeric,date,date,jsonb,jsonb,text,boolean) from public, anon;
grant execute on function public.comercial_salvar_pacote(uuid,uuid,text,text,numeric,date,date,jsonb,jsonb,text,boolean) to authenticated;

create or replace function public.comercial_salvar_item_pacote(
  p_id uuid,
  p_pacote_id uuid,
  p_codigo text,
  p_tabela text,
  p_quantidade_inclusa numeric,
  p_cobranca_excedente boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pacote public.contrato_pacotes%rowtype;
  v_contrato public.credenciamento_contratos%rowtype;
  v_id uuid;
begin
  select p.* into v_pacote
    from public.contrato_pacotes p
   where p.id=p_pacote_id;
  if not found then
    raise exception 'Pacote comercial nao encontrado';
  end if;
  select c.* into v_contrato
    from public.credenciamento_contratos c
   where c.id=v_pacote.contrato_id;
  if not found or not public.comercial_pode_editar(v_contrato.empresa_id,v_contrato.unidade_id) then
    raise exception 'Sem permissao para editar itens do pacote';
  end if;

  if nullif(trim(p_codigo),'') is null then
    raise exception 'Codigo do item e obrigatorio';
  end if;
  if p_quantidade_inclusa is not null and p_quantidade_inclusa <= 0 then
    raise exception 'Quantidade inclusa deve ser maior que zero';
  end if;

  if p_id is null then
    insert into public.contrato_pacote_itens(
      pacote_id,codigo,tabela,quantidade_inclusa,cobranca_excedente
    ) values (
      p_pacote_id,trim(p_codigo),nullif(trim(p_tabela),''),p_quantidade_inclusa,coalesce(p_cobranca_excedente,false)
    ) returning id into v_id;
  else
    update public.contrato_pacote_itens i
       set codigo=trim(p_codigo),
           tabela=nullif(trim(p_tabela),''),
           quantidade_inclusa=p_quantidade_inclusa,
           cobranca_excedente=coalesce(p_cobranca_excedente,false)
     where i.id=p_id and i.pacote_id=p_pacote_id
     returning i.id into v_id;
    if v_id is null then
      raise exception 'Item nao encontrado neste pacote';
    end if;
  end if;

  return v_id;
end;
$$;

revoke all on function public.comercial_salvar_item_pacote(uuid,uuid,text,text,numeric,boolean) from public, anon;
grant execute on function public.comercial_salvar_item_pacote(uuid,uuid,text,text,numeric,boolean) to authenticated;
