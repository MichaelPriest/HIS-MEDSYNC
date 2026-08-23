begin;

alter table public.central_guias add column if not exists codigo_procedimento text;
alter table public.central_guias add column if not exists descricao_procedimento text;
alter table public.central_guias add column if not exists categoria_preco text default 'procedimentos';
alter table public.central_guias add column if not exists valor_contratual numeric(14,2);
alter table public.central_guias add column if not exists valor_solicitado numeric(14,2);
alter table public.central_guias add column if not exists valor_autorizado numeric(14,2);
alter table public.central_guias add column if not exists metodologia_preco text;
alter table public.central_guias add column if not exists edicao_preco_id uuid references public.tabelas_procedimentos_edicoes;
alter table public.central_guias add column if not exists memoria_calculo_preco jsonb not null default '{}'::jsonb;

create or replace function public.auditar_precos_conta_medica(p_processo_id uuid)
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  v_proc public.contas_medicas_processos%rowtype;
  v_item record;
  v_preco record;
  v_categoria text;
  v_count integer:=0;
begin
  select * into v_proc from public.contas_medicas_processos where id=p_processo_id;
  if v_proc.id is null then raise exception 'Processo de contas médicas não encontrado'; end if;
  if not public.tem_unidade(v_proc.empresa_id,v_proc.unidade_id) then raise exception 'Sem acesso'; end if;

  delete from public.contas_medicas_pendencias
  where processo_id=p_processo_id and tipo='valor' and resolvida=false;

  for v_item in
    select i.*, cf.convenio_id
    from public.conta_faturamento_itens i
    join public.contas_faturamento cf on cf.id=i.conta_id
    where i.conta_id=v_proc.conta_id and i.cobravel=true and i.codigo is not null
  loop
    v_categoria:=case
      when lower(coalesce(v_item.origem_tipo,'')) in ('exame','laboratorio','imagem') then 'exames'
      when lower(coalesce(v_item.origem_tipo,'')) in ('honorario','honorarios') then 'honorarios'
      when lower(coalesce(v_item.origem_tipo,'')) in ('taxa','taxas') then 'taxas'
      when lower(coalesce(v_item.origem_tipo,'')) in ('diaria','diarias') then 'diarias'
      else 'procedimentos' end;
    if v_item.convenio_id is not null then
      select * into v_preco from public.obter_valor_procedimento_contratual(v_item.convenio_id,v_item.codigo,coalesce(v_item.data_execucao::date,current_date),v_categoria,false,false) limit 1;
      if v_preco.valor is not null then
        update public.conta_faturamento_itens set
          metodologia_preco=v_preco.metodologia,
          tabela_procedimento_edicao_id=v_preco.edicao_id,
          tabela_procedimento_item_id=v_preco.item_id,
          valor_referencia=v_preco.valor,
          memoria_calculo=v_preco.memoria
        where id=v_item.id;
        if abs(coalesce(v_item.valor_unitario,0)-v_preco.valor) > 0.01 then
          insert into public.contas_medicas_pendencias(processo_id,tipo,severidade,descricao)
          values(p_processo_id,'valor','bloqueio',format('Divergência contratual: %s (%s). Lançado R$ %s; contratual R$ %s.',v_item.descricao,v_item.codigo,to_char(v_item.valor_unitario,'FM999999990D00'),to_char(v_preco.valor,'FM999999990D00')));
          v_count:=v_count+1;
        end if;
      else
        insert into public.contas_medicas_pendencias(processo_id,tipo,severidade,descricao)
        values(p_processo_id,'valor','alerta',format('Não foi localizado preço contratual para %s (%s) na data %s.',v_item.descricao,v_item.codigo,coalesce(v_item.data_execucao::date,current_date)));
        v_count:=v_count+1;
      end if;
    end if;
  end loop;
  return v_count;
end;$$;

grant execute on function public.auditar_precos_conta_medica(uuid) to authenticated;

create or replace function public.calcular_preco_central_guia(p_guia_id uuid)
returns numeric
language plpgsql
security definer
set search_path=public
as $$
declare
  v_guia public.central_guias%rowtype;
  v_preco record;
  v_valor numeric;
begin
  select * into v_guia from public.central_guias where id=p_guia_id;
  if v_guia.id is null or v_guia.convenio_id is null or v_guia.codigo_procedimento is null then return null; end if;
  if not public.tem_unidade(v_guia.empresa_id,v_guia.unidade_id) then raise exception 'Sem acesso'; end if;
  select * into v_preco from public.obter_valor_procedimento_contratual(v_guia.convenio_id,v_guia.codigo_procedimento,v_guia.data_solicitacao::date,coalesce(v_guia.categoria_preco,'procedimentos'),false,false) limit 1;
  v_valor:=v_preco.valor;
  if v_valor is not null then
    update public.central_guias set valor_contratual=v_valor,metodologia_preco=v_preco.metodologia,edicao_preco_id=v_preco.edicao_id,memoria_calculo_preco=v_preco.memoria where id=p_guia_id;
  end if;
  return v_valor;
end;$$;

grant execute on function public.calcular_preco_central_guia(uuid) to authenticated;

commit;
