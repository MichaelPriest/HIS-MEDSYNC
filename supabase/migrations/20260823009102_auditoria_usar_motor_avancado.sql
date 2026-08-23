begin;

create or replace function public.auditar_precos_conta_medica(p_processo_id uuid)
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  v_proc public.contas_medicas_processos%rowtype;
  v_item record;
  v_memoria jsonb;
  v_valor numeric;
  v_count integer:=0;
begin
  select * into v_proc from public.contas_medicas_processos where id=p_processo_id;
  if v_proc.id is null then raise exception 'Processo de contas médicas não encontrado'; end if;
  if not public.tem_unidade(v_proc.empresa_id,v_proc.unidade_id) then raise exception 'Sem acesso'; end if;

  delete from public.contas_medicas_pendencias where processo_id=p_processo_id and tipo='valor' and resolvida=false;

  for v_item in
    select i.id,i.descricao,i.codigo,i.valor_unitario,i.quantidade,i.data_execucao,cf.convenio_id
    from public.conta_faturamento_itens i
    join public.contas_faturamento cf on cf.id=i.conta_id
    where i.conta_id=v_proc.conta_id and i.cobravel=true and i.codigo is not null
  loop
    if v_item.convenio_id is not null then
      v_memoria:=public.recalcular_item_contratual_avancado(v_item.id);
      select valor_contratual_calculado into v_valor from public.conta_faturamento_itens where id=v_item.id;
      if v_valor is not null then
        if abs(coalesce(v_item.valor_unitario,0)-v_valor)>0.01 then
          insert into public.contas_medicas_pendencias(processo_id,tipo,severidade,descricao)
          values(p_processo_id,'valor','bloqueio',format('Divergência contratual: %s (%s). Lançado R$ %s; contratual final R$ %s.',v_item.descricao,v_item.codigo,to_char(v_item.valor_unitario,'FM999999990D00'),to_char(v_valor,'FM999999990D00')));
          v_count:=v_count+1;
        end if;
      else
        insert into public.contas_medicas_pendencias(processo_id,tipo,severidade,descricao)
        values(p_processo_id,'valor','alerta',format('Não foi localizado cálculo contratual para %s (%s) na data %s.',v_item.descricao,v_item.codigo,coalesce(v_item.data_execucao::date,current_date)));
        v_count:=v_count+1;
      end if;
    end if;
  end loop;
  return v_count;
end;$$;

grant execute on function public.auditar_precos_conta_medica(uuid) to authenticated;
commit;
