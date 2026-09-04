create or replace function public.admissao_prontidao(p_unidade_id uuid, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
declare
  v_empresa_id uuid;
begin
  if auth.uid() is null then
    raise exception 'ADMISSAO_NAO_AUTENTICADA' using errcode='42501';
  end if;

  select empresa_id into v_empresa_id
  from public.unidades
  where id=p_unidade_id and ativo;

  if v_empresa_id is null
     or not public.tem_unidade(v_empresa_id,p_unidade_id)
     or not public.tem_permissao(v_empresa_id,p_unidade_id,'atendimentos.abrir') then
    raise exception 'ADMISSAO_SEM_PERMISSAO' using errcode='42501';
  end if;

  return public.admissao_prontidao_internal(v_empresa_id,p_unidade_id,coalesce(p_payload,'{}'::jsonb));
end
$function$;

revoke all on function public.admissao_prontidao(uuid,jsonb) from public;
revoke execute on function public.admissao_prontidao(uuid,jsonb) from anon;
grant execute on function public.admissao_prontidao(uuid,jsonb) to authenticated;
