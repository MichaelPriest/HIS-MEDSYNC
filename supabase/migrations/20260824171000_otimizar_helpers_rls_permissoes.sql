-- Otimiza os helpers usados intensivamente pelas policies RLS.
--
-- Antes, estas funções eram SECURITY INVOKER. Ao consultarem usuarios,
-- usuario_empresas, usuario_unidades e a matriz RBAC, cada chamada voltava a
-- atravessar as policies dessas próprias tabelas, multiplicando o custo por linha.
--
-- A regra funcional permanece a mesma: a identidade continua sendo sempre
-- auth.uid() e nenhuma função retorna dados internos, apenas booleanos.
-- Como o owner é postgres e o search_path é vazio, as consultas internas podem
-- verificar os vínculos diretamente sem recursão de RLS.

create or replace function public.usuario_ativo()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1
    from public.usuarios u
    where u.id = auth.uid()
      and u.ativo
      and not u.bloqueado
  )
$$;

create or replace function public.tem_empresa(p_empresa uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.usuario_ativo()
     and exists(
       select 1
       from public.usuario_empresas ue
       where ue.usuario_id = auth.uid()
         and ue.empresa_id = p_empresa
         and ue.ativo
     )
$$;

create or replace function public.tem_unidade(p_empresa uuid, p_unidade uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.tem_empresa(p_empresa)
     and exists(
       select 1
       from public.usuario_unidades uu
       where uu.usuario_id = auth.uid()
         and uu.empresa_id = p_empresa
         and uu.unidade_id = p_unidade
         and uu.ativo
     )
$$;

create or replace function public.tem_permissao(
  p_empresa uuid,
  p_unidade uuid,
  p_codigo text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.usuario_ativo()
    and exists(
      select 1
      from public.usuario_perfis up
      join public.perfis pf
        on pf.id = up.perfil_id
       and pf.ativo
      join public.perfil_permissoes pp
        on pp.perfil_id = pf.id
      join public.permissoes pe
        on pe.id = pp.permissao_id
       and pe.ativo
      where up.usuario_id = auth.uid()
        and up.empresa_id = p_empresa
        and up.ativo
        and pe.codigo = p_codigo
        and (p_unidade is null or up.unidade_id is null or up.unidade_id = p_unidade)
    )
$$;

comment on function public.usuario_ativo() is
  'Helper RLS performático: valida o usuário autenticado diretamente, sem recursão nas policies de usuarios.';

comment on function public.tem_empresa(uuid) is
  'Helper RLS performático: valida vínculo ativo do auth.uid() com a empresa sem recursão de policies.';

comment on function public.tem_unidade(uuid, uuid) is
  'Helper RLS performático: valida vínculo ativo do auth.uid() com empresa/unidade sem recursão de policies.';

comment on function public.tem_permissao(uuid, uuid, text) is
  'Helper RLS performático: valida permissão efetiva do auth.uid() no escopo empresa/unidade sem recursão na própria matriz RBAC.';
