begin;

-- Cadastros mestres (pacientes, profissionais, convenios etc.) pertencem a empresa,
-- mas os usuarios normalmente recebem perfis por unidade. A implementacao original
-- de tem_permissao(..., NULL, ...) considerava somente perfis globais
-- (usuario_perfis.unidade_id IS NULL), fazendo um usuario corretamente vinculado a
-- uma unidade falhar no RLS ao criar um paciente da empresa.
--
-- Semantica corrigida:
--  * p_unidade IS NULL: qualquer perfil ativo do usuario dentro da empresa pode
--    conceder a permissao de escopo empresarial;
--  * p_unidade informado: aceita perfil global da empresa OU perfil daquela unidade.
create or replace function public.tem_permissao(
  p_empresa uuid,
  p_unidade uuid,
  p_codigo text
) returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select public.usuario_ativo()
    and exists (
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
        and (
          p_unidade is null
          or up.unidade_id is null
          or up.unidade_id = p_unidade
        )
    )
$$;

comment on function public.tem_permissao(uuid,uuid,text) is
'Valida permissao por empresa/unidade. Quando p_unidade e NULL, perfis ativos de qualquer unidade da empresa podem conceder permissoes de cadastros mestres; quando informado, aceita perfil global ou da unidade.';

-- Garante que a permissao usada pela policy de pacientes exista em bancos
-- parcialmente migrados.
insert into public.permissoes(codigo, descricao)
values
  ('pacientes.visualizar', 'Visualizar pacientes'),
  ('pacientes.criar', 'Criar pacientes'),
  ('pacientes.editar', 'Editar pacientes')
on conflict (codigo) do update
set descricao = excluded.descricao,
    ativo = true;

-- Compatibilidade com o formulario atual. A migration 005 ja inclui este valor,
-- mas o IF NOT EXISTS protege bancos que ficaram parcialmente atualizados.
alter type public.sexo_paciente add value if not exists 'outros';

commit;
