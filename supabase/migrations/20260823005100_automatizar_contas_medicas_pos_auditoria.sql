begin;

create or replace function public.criar_contas_medicas_pos_auditoria()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if new.auditoria_liberada is true and coalesce(old.auditoria_liberada,false) is false then
    insert into public.contas_medicas_processos(
      empresa_id,unidade_id,conta_id,atendimento_id,paciente_id,convenio_id,status,total_conta
    ) values (
      new.empresa_id,new.unidade_id,new.id,new.atendimento_id,new.paciente_id,new.convenio_id,'aguardando',new.valor_liquido
    ) on conflict (conta_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_contas_medicas_pos_auditoria on public.contas_faturamento;
create trigger trg_contas_medicas_pos_auditoria
after update of auditoria_liberada on public.contas_faturamento
for each row execute function public.criar_contas_medicas_pos_auditoria();

create or replace function public.liberar_conta_medica(p_processo_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare v_processo public.contas_medicas_processos%rowtype;
begin
  select * into v_processo from public.contas_medicas_processos where id=p_processo_id;
  if not found then raise exception 'Processo não encontrado'; end if;
  if exists(select 1 from public.contas_medicas_pendencias where processo_id=p_processo_id and resolvida=false and severidade in ('erro','bloqueio')) then
    raise exception 'Existem pendências impeditivas em Contas Médicas';
  end if;
  update public.contas_medicas_processos set status='liberada_tiss',concluido_em=now(),analisado_por=auth.uid(),updated_at=now() where id=p_processo_id;
  update public.contas_faturamento set contas_medicas_liberada=true,contas_medicas_liberada_em=now(),updated_at=now(),updated_by=auth.uid() where id=v_processo.conta_id;
end;
$$;

grant execute on function public.liberar_conta_medica(uuid) to authenticated;

commit;
