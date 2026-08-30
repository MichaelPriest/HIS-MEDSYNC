-- Lista destinos ativos da mesma empresa sem abrir a RLS global de unidades.
create or replace function public.listar_unidades_destino_transferencia_interunidade(p_unidade_origem_id uuid)
returns table(id uuid,nome text,cnes text)
language plpgsql
security definer
set search_path=public,pg_catalog
as $$
declare
  v_empresa_id uuid;
begin
  if auth.uid() is null then
    raise exception 'TRANSFERENCIA_USUARIO_NAO_AUTENTICADO' using errcode='42501';
  end if;

  select u.empresa_id into v_empresa_id
    from public.unidades u
   where u.id=p_unidade_origem_id and u.ativo=true;
  if v_empresa_id is null then raise exception 'TRANSFERENCIA_UNIDADE_ORIGEM_INVALIDA'; end if;

  if not public.tem_unidade(v_empresa_id,p_unidade_origem_id)
     or not (public.tem_permissao(v_empresa_id,p_unidade_origem_id,'internacao.movimentar')
             or public.tem_permissao(v_empresa_id,p_unidade_origem_id,'internacao.gerenciar')) then
    raise exception 'TRANSFERENCIA_ORIGEM_SEM_PERMISSAO' using errcode='42501';
  end if;

  return query
  select u.id,u.nome,u.cnes
    from public.unidades u
   where u.empresa_id=v_empresa_id
     and u.ativo=true
     and u.id<>p_unidade_origem_id
   order by u.nome,u.id;
end;
$$;

revoke all on function public.listar_unidades_destino_transferencia_interunidade(uuid) from public,anon,authenticated;
grant execute on function public.listar_unidades_destino_transferencia_interunidade(uuid) to authenticated;
