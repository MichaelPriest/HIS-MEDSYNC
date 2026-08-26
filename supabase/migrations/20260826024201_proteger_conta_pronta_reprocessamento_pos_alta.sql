alter function public.preparar_conta_pos_alta_internal(uuid)
  rename to preparar_conta_pos_alta_internal_impl;

revoke all on function public.preparar_conta_pos_alta_internal_impl(uuid) from public, anon, authenticated;

create function public.preparar_conta_pos_alta_internal(p_atendimento_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
declare
  v_conta record;
begin
  select id, status
    into v_conta
    from public.contas_faturamento
   where atendimento_id = p_atendimento_id
   limit 1;

  if v_conta.id is not null and v_conta.status in ('pronta','faturada','cancelada') then
    return jsonb_build_object(
      'conta_id', v_conta.id,
      'status', v_conta.status,
      'preservada', true,
      'motivo', 'conta_em_estado_protegido'
    );
  end if;

  return public.preparar_conta_pos_alta_internal_impl(p_atendimento_id);
end
$function$;

revoke all on function public.preparar_conta_pos_alta_internal(uuid) from public, anon, authenticated;

comment on function public.preparar_conta_pos_alta_internal(uuid) is
  'Guard idempotente da integracao pos-alta; preserva contas prontas/faturadas/canceladas e delega apenas contas editaveis ao implementador interno.';