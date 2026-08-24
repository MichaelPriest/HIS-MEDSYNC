begin;

-- Administradores de usuários precisam enxergar os vínculos do próprio tenant
-- para montar a matriz de acesso. As policies continuam isoladas por empresa.
drop policy if exists usuario_empresas_admin_select on public.usuario_empresas;
create policy usuario_empresas_admin_select on public.usuario_empresas
for select to authenticated
using (
  public.tem_permissao(empresa_id, null, 'usuarios.visualizar')
  or public.tem_permissao(empresa_id, null, 'usuarios.administrar')
);

drop policy if exists usuario_unidades_admin_select on public.usuario_unidades;
create policy usuario_unidades_admin_select on public.usuario_unidades
for select to authenticated
using (
  public.tem_permissao(empresa_id, unidade_id, 'usuarios.visualizar')
  or public.tem_permissao(empresa_id, unidade_id, 'usuarios.administrar')
);

drop policy if exists usuario_perfis_admin_select on public.usuario_perfis;
create policy usuario_perfis_admin_select on public.usuario_perfis
for select to authenticated
using (
  public.tem_permissao(empresa_id, unidade_id, 'usuarios.visualizar')
  or public.tem_permissao(empresa_id, unidade_id, 'usuarios.administrar')
);

drop policy if exists usuarios_admin_select on public.usuarios;
create policy usuarios_admin_select on public.usuarios
for select to authenticated
using (
  exists(
    select 1
    from public.usuario_empresas ue
    where ue.usuario_id = usuarios.id
      and ue.ativo
      and (
        public.tem_permissao(ue.empresa_id, null, 'usuarios.visualizar')
        or public.tem_permissao(ue.empresa_id, null, 'usuarios.administrar')
      )
  )
);

commit;
