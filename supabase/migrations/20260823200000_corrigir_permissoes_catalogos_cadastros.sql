begin;

-- ============================================================================
-- MedSync HIS - correção de permissões dos cadastros mestres
-- Motivo:
-- 1) permissões criadas depois de perfis já existentes não eram necessariamente
--    vinculadas ao perfil Administrador;
-- 2) bancos parcialmente migrados podem não ter catalogos.criar ou o valor
--    tipo_profissional no enum tipo_catalogo.
-- ============================================================================

insert into public.permissoes(codigo, descricao)
values
  ('pacientes.visualizar', 'Visualizar pacientes'),
  ('pacientes.criar', 'Criar pacientes'),
  ('pacientes.editar', 'Editar pacientes'),
  ('profissionais.visualizar', 'Visualizar profissionais'),
  ('profissionais.criar', 'Criar profissionais'),
  ('profissionais.editar', 'Editar profissionais'),
  ('convenios.visualizar', 'Visualizar convênios'),
  ('convenios.criar', 'Criar convênios'),
  ('convenios.editar', 'Editar convênios'),
  ('catalogos.visualizar', 'Visualizar catálogos'),
  ('catalogos.criar', 'Criar catálogos'),
  ('catalogos.editar', 'Editar catálogos')
on conflict (codigo) do update
set descricao = excluded.descricao,
    ativo = true;

-- Compatibilidade com a tela atual de Catálogos.
do $$
begin
  if exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'tipo_catalogo'
  ) then
    execute 'alter type public.tipo_catalogo add value if not exists ''tipo_profissional''';
  end if;
end $$;

-- Perfis de sistema com função de administrador devem receber automaticamente
-- as permissões atuais. Isso não altera perfis comuns/customizados.
insert into public.perfil_permissoes(perfil_id, permissao_id, created_by)
select pf.id, pe.id, null
from public.perfis pf
cross join public.permissoes pe
where pf.ativo = true
  and pf.sistema = true
  and (
    lower(pf.nome) = 'admin'
    or lower(pf.nome) like '%administrador%'
  )
  and pe.ativo = true
on conflict (perfil_id, permissao_id) do nothing;

-- Mantém perfis Administrador do sistema sincronizados quando novas permissões
-- forem adicionadas futuramente.
create or replace function public.sincronizar_permissao_administradores_sistema()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.ativo then
    insert into public.perfil_permissoes(perfil_id, permissao_id, created_by)
    select pf.id, new.id, null
    from public.perfis pf
    where pf.ativo = true
      and pf.sistema = true
      and (
        lower(pf.nome) = 'admin'
        or lower(pf.nome) like '%administrador%'
      )
    on conflict (perfil_id, permissao_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sincronizar_permissao_administradores_sistema on public.permissoes;
create trigger trg_sincronizar_permissao_administradores_sistema
after insert or update of ativo on public.permissoes
for each row
execute function public.sincronizar_permissao_administradores_sistema();

commit;
