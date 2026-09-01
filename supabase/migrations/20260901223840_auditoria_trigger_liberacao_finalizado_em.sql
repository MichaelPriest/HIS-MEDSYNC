create or replace function public.capturar_integracao_auditoria_conta()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_cf public.contas_faturamento%rowtype;
begin
  if new.status = 'liberada' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    select * into v_cf
      from public.contas_faturamento
     where id = new.conta_id;

    if found then
      perform public.registrar_integracao_evento_internal(
        v_cf.empresa_id,
        v_cf.unidade_id,
        v_cf.atendimento_id,
        v_cf.paciente_id,
        'conta.auditada',
        'auditoria_contas',
        new.id,
        coalesce(new.finalizado_em, now()),
        jsonb_build_object('conta_id', new.conta_id, 'auditoria_id', new.id)
      );
    end if;
  end if;

  return new;
end
$function$;
