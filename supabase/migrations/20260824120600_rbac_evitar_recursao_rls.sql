begin;

-- Helpers estreitos para policies das próprias tabelas de RBAC.
-- SECURITY DEFINER é necessário aqui para que a verificação não recursione em
-- usuario_perfis/perfis/perfil_permissoes. As funções só retornam booleano,
-- sempre verificam auth.uid() e não expõem linhas nem aceitam outro usuário.
create or replace function public.pode_visualizar_acessos(p_empresa uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1
    from public.usuarios u
    join public.usuario_empresas ue
      on ue.usuario_id = u.id
     and ue.empresa_id = p_empresa
     and ue.ativo
    join public.usuario_perfis up
      on up.usuario_id = u.id
     and up.empresa_id = p_empresa
     and up.ativo
    join public.perfis pf
      on pf.id = up.perfil_id
     and pf.empresa_id = p_empresa
     and pf.ativo
    join public.perfil_permissoes pp on pp.perfil_id = pf.id
    join public.permissoes pe
      on pe.id = pp.permissao_id
     and pe.ativo
    where u.id = auth.uid()
      and u.ativo
      and not u.bloqueado
      and pe.codigo in ('usuarios.visualizar','usuarios.administrar')
  )
$$;

create or replace function public.pode_administrar_acessos(p_empresa uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1
    from public.usuarios u
    join public.usuario_empresas ue
      on ue.usuario_id = u.id
     and ue.empresa_id = p_empresa
     and ue.ativo
    join public.usuario_perfis up
      on up.usuario_id = u.id
     and up.empresa_id = p_empresa
     and up.ativo
    join public.perfis pf
      on pf.id = up.perfil_id
     and pf.empresa_id = p_empresa
     and pf.ativo
    join public.perfil_permissoes pp on pp.perfil_id = pf.id
    join public.permissoes pe
      on pe.id = pp.permissao_id
     and pe.ativo
    where u.id = auth.uid()
      and u.ativo
      and not u.bloqueado
      and pe.codigo = 'usuarios.administrar'
  )
$$;

revoke all on function public.pode_visualizar_acessos(uuid) from public, anon;
revoke all on function public.pode_administrar_acessos(uuid) from public, anon;
grant execute on function public.pode_visualizar_acessos(uuid) to authenticated;
grant execute on function public.pode_administrar_acessos(uuid) to authenticated;

-- Perfis.
drop policy if exists perfis_admin_insert on public.perfis;
create policy perfis_admin_insert on public.perfis
for insert to authenticated
with check (public.pode_administrar_acessos(empresa_id));

drop policy if exists perfis_admin_update on public.perfis;
create policy perfis_admin_update on public.perfis
for update to authenticated
using (public.pode_administrar_acessos(empresa_id))
with check (public.pode_administrar_acessos(empresa_id));

-- Permissões do perfil.
drop policy if exists perfil_permissoes_admin_insert on public.perfil_permissoes;
create policy perfil_permissoes_admin_insert on public.perfil_permissoes
for insert to authenticated
with check (
  exists(
    select 1 from public.perfis pf
    where pf.id = perfil_id
      and public.pode_administrar_acessos(pf.empresa_id)
  )
);

drop policy if exists perfil_permissoes_admin_delete on public.perfil_permissoes;
create policy perfil_permissoes_admin_delete on public.perfil_permissoes
for delete to authenticated
using (
  exists(
    select 1 from public.perfis pf
    where pf.id = perfil_id
      and public.pode_administrar_acessos(pf.empresa_id)
  )
);

-- Vínculos usuário/perfil.
drop policy if exists usuario_perfis_admin_select on public.usuario_perfis;
create policy usuario_perfis_admin_select on public.usuario_perfis
for select to authenticated
using (public.pode_visualizar_acessos(empresa_id));

drop policy if exists usuario_perfis_admin_insert on public.usuario_perfis;
create policy usuario_perfis_admin_insert on public.usuario_perfis
for insert to authenticated
with check (
  public.pode_administrar_acessos(empresa_id)
  and exists(
    select 1 from public.usuario_empresas ue
    where ue.usuario_id = usuario_perfis.usuario_id
      and ue.empresa_id = usuario_perfis.empresa_id
      and ue.ativo
  )
);

drop policy if exists usuario_perfis_admin_update on public.usuario_perfis;
create policy usuario_perfis_admin_update on public.usuario_perfis
for update to authenticated
using (public.pode_administrar_acessos(empresa_id))
with check (public.pode_administrar_acessos(empresa_id));

drop policy if exists usuario_perfis_admin_delete on public.usuario_perfis;
create policy usuario_perfis_admin_delete on public.usuario_perfis
for delete to authenticated
using (public.pode_administrar_acessos(empresa_id));

-- Visibilidade administrativa dos vínculos e usuários do mesmo tenant.
drop policy if exists usuario_empresas_admin_select on public.usuario_empresas;
create policy usuario_empresas_admin_select on public.usuario_empresas
for select to authenticated
using (public.pode_visualizar_acessos(empresa_id));

drop policy if exists usuario_unidades_admin_select on public.usuario_unidades;
create policy usuario_unidades_admin_select on public.usuario_unidades
for select to authenticated
using (public.pode_visualizar_acessos(empresa_id));

drop policy if exists usuarios_admin_select on public.usuarios;
create policy usuarios_admin_select on public.usuarios
for select to authenticated
using (
  exists(
    select 1
    from public.usuario_empresas ue
    where ue.usuario_id = usuarios.id
      and ue.ativo
      and public.pode_visualizar_acessos(ue.empresa_id)
  )
);

commit;
