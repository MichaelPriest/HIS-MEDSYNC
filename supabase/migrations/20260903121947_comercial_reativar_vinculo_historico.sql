create or replace function public.comercial_reativar_vinculo_tabela(p_vinculo_id uuid)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_v public.contrato_tabelas_comerciais%rowtype;
  v_c public.credenciamento_contratos%rowtype;
begin
  if auth.uid() is null then
    raise exception 'COMERCIAL_AUTENTICACAO_OBRIGATORIA' using errcode='42501';
  end if;

  select * into v_v
  from public.contrato_tabelas_comerciais
  where id=p_vinculo_id
  for update;
  if not found then
    raise exception 'COMERCIAL_VINCULO_NAO_LOCALIZADO';
  end if;

  select * into v_c
  from public.credenciamento_contratos
  where id=v_v.contrato_id;

  if not (
    public.comercial_pode_editar(v_c.empresa_id,v_c.unidade_id)
    or public.tabelas_comerciais_pode_editar(v_c.empresa_id,v_c.unidade_id)
  ) then
    raise exception 'COMERCIAL_SEM_PERMISSAO_EDITAR' using errcode='42501';
  end if;

  update public.contrato_tabelas_comerciais
  set ativo=true
  where id=p_vinculo_id;

  return p_vinculo_id;
end;
$$;

revoke all on function public.comercial_reativar_vinculo_tabela(uuid)
from public,anon;
grant execute on function public.comercial_reativar_vinculo_tabela(uuid)
to authenticated;
