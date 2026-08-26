create or replace function public.validar_conta_tiss(p_conta_id uuid)
returns integer
language plpgsql
security definer
set search_path to 'public','pg_catalog'
as $function$
declare
  v_user uuid := auth.uid();
  v_conta public.contas_faturamento%rowtype;
begin
  if v_user is null then
    raise exception 'FAT_VALIDACAO_NAO_AUTENTICADA' using errcode='42501';
  end if;
  select * into v_conta from public.contas_faturamento where id=p_conta_id;
  if not found then raise exception 'FAT_CONTA_NAO_LOCALIZADA' using errcode='P0002'; end if;
  if not public.tem_unidade(v_conta.empresa_id,v_conta.unidade_id)
     or not (
       public.tem_permissao(v_conta.empresa_id,v_conta.unidade_id,'faturamento.criar')
       or public.tem_permissao(v_conta.empresa_id,v_conta.unidade_id,'tiss.gerar')
     ) then
    raise exception 'FAT_VALIDACAO_SEM_PERMISSAO' using errcode='42501';
  end if;
  return public.validar_conta_tiss_internal(p_conta_id);
end
$function$;

revoke all on function public.validar_conta_tiss(uuid) from public,anon,authenticated;
grant execute on function public.validar_conta_tiss(uuid) to authenticated;
