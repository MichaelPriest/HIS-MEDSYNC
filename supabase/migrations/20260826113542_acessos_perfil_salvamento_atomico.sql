create or replace function public.salvar_permissoes_perfil(
  p_perfil_id uuid,
  p_codigos text[] default '{}'::text[]
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_perfil public.perfis%rowtype;
  v_codigos text[] := coalesce(p_codigos, '{}'::text[]);
  v_total_solicitado integer := 0;
  v_total_validos integer := 0;
  v_total_final integer := 0;
  v_admin boolean := false;
begin
  if auth.uid() is null then
    raise exception 'ACESSOS_NAO_AUTENTICADO' using errcode = '42501';
  end if;

  select * into v_perfil
    from public.perfis
   where id = p_perfil_id
     and ativo;

  if not found then
    raise exception 'ACESSOS_PERFIL_NAO_LOCALIZADO';
  end if;

  if not public.pode_administrar_acessos(v_perfil.empresa_id) then
    raise exception 'ACESSOS_SEM_PERMISSAO' using errcode = '42501';
  end if;

  v_admin := v_perfil.sistema and lower(v_perfil.nome) in ('administrador','admin');

  if v_admin then
    insert into public.perfil_permissoes (perfil_id, permissao_id, created_by)
    select v_perfil.id, p.id, auth.uid()
      from public.permissoes p
     where p.ativo
    on conflict (perfil_id, permissao_id) do nothing;

    delete from public.perfil_permissoes pp
     using public.permissoes p
     where pp.perfil_id = v_perfil.id
       and p.id = pp.permissao_id
       and not p.ativo;

    select count(*) into v_total_final
      from public.perfil_permissoes pp
      join public.permissoes p on p.id = pp.permissao_id and p.ativo
     where pp.perfil_id = v_perfil.id;

    return jsonb_build_object(
      'perfil_id', v_perfil.id,
      'administrador', true,
      'permissoes', v_total_final,
      'sincronizado', true
    );
  end if;

  select count(*) into v_total_solicitado
    from (
      select distinct trim(codigo) as codigo
      from unnest(v_codigos) codigo
      where trim(coalesce(codigo,'')) <> ''
    ) s;

  select count(*) into v_total_validos
    from public.permissoes p
    join (
      select distinct trim(codigo) as codigo
      from unnest(v_codigos) codigo
      where trim(coalesce(codigo,'')) <> ''
    ) s on s.codigo = p.codigo
   where p.ativo;

  if v_total_validos <> v_total_solicitado then
    raise exception 'ACESSOS_PERMISSAO_INVALIDA';
  end if;

  delete from public.perfil_permissoes pp
   where pp.perfil_id = v_perfil.id
     and not exists (
       select 1
       from public.permissoes p
       join (
         select distinct trim(codigo) as codigo
         from unnest(v_codigos) codigo
         where trim(coalesce(codigo,'')) <> ''
       ) s on s.codigo = p.codigo
       where p.id = pp.permissao_id
         and p.ativo
     );

  insert into public.perfil_permissoes (perfil_id, permissao_id, created_by)
  select v_perfil.id, p.id, auth.uid()
    from public.permissoes p
    join (
      select distinct trim(codigo) as codigo
      from unnest(v_codigos) codigo
      where trim(coalesce(codigo,'')) <> ''
    ) s on s.codigo = p.codigo
   where p.ativo
  on conflict (perfil_id, permissao_id) do nothing;

  select count(*) into v_total_final
    from public.perfil_permissoes pp
    join public.permissoes p on p.id = pp.permissao_id and p.ativo
   where pp.perfil_id = v_perfil.id;

  return jsonb_build_object(
    'perfil_id', v_perfil.id,
    'administrador', false,
    'permissoes', v_total_final,
    'sincronizado', true
  );
end
$$;

grant execute on function public.salvar_permissoes_perfil(uuid,text[]) to authenticated;
revoke execute on function public.salvar_permissoes_perfil(uuid,text[]) from anon, public;
