-- Consolida perfis e permissões do usuário em uma única consulta segura.
-- Objetivo: evitar o custo elevado das relações aninhadas PostgREST executadas
-- em toda renderização do layout autenticado.

create or replace function public.obter_contexto_acesso_usuario(
  p_empresa uuid,
  p_unidade uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := auth.uid();
  v_perfis text[] := '{}'::text[];
  v_permissoes text[] := '{}'::text[];
begin
  if v_usuario is null then
    raise exception 'CONTEXTO_ACESSO_NAO_AUTENTICADO' using errcode = '42501';
  end if;

  if p_empresa is null or p_unidade is null then
    raise exception 'CONTEXTO_ACESSO_ESCOPO_INVALIDO' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.usuarios u
    join public.usuario_unidades uu
      on uu.usuario_id = u.id
     and uu.empresa_id = p_empresa
     and uu.unidade_id = p_unidade
     and uu.ativo
    where u.id = v_usuario
      and u.ativo
      and not u.bloqueado
  ) then
    raise exception 'CONTEXTO_ACESSO_NEGADO' using errcode = '42501';
  end if;

  select
    coalesce(
      array_agg(distinct pf.nome order by pf.nome)
        filter (where pf.nome is not null),
      '{}'::text[]
    ),
    coalesce(
      array_agg(distinct pe.codigo order by pe.codigo)
        filter (where pe.ativo and pe.codigo is not null),
      '{}'::text[]
    )
  into v_perfis, v_permissoes
  from public.usuario_perfis up
  join public.perfis pf
    on pf.id = up.perfil_id
   and pf.empresa_id = p_empresa
   and pf.ativo
  left join public.perfil_permissoes pp
    on pp.perfil_id = pf.id
  left join public.permissoes pe
    on pe.id = pp.permissao_id
  where up.usuario_id = v_usuario
    and up.empresa_id = p_empresa
    and up.ativo
    and (up.unidade_id is null or up.unidade_id = p_unidade);

  return jsonb_build_object(
    'perfis', to_jsonb(v_perfis),
    'permissoes', to_jsonb(v_permissoes)
  );
end;
$$;

revoke all on function public.obter_contexto_acesso_usuario(uuid, uuid) from public;
revoke all on function public.obter_contexto_acesso_usuario(uuid, uuid) from anon;
grant execute on function public.obter_contexto_acesso_usuario(uuid, uuid) to authenticated;
grant execute on function public.obter_contexto_acesso_usuario(uuid, uuid) to service_role;

comment on function public.obter_contexto_acesso_usuario(uuid, uuid) is
  'Retorna perfis e permissões efetivas do usuário autenticado no escopo empresa/unidade, validando vínculo antes de executar a consulta consolidada.';
