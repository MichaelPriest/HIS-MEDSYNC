begin;

-- O cadastro de Tipo de profissional é feito em public.catalogos (escopo da empresa),
-- mas a tela de Profissionais historicamente lia public.tipos_profissional (global).
-- Mantemos a coluna legada e adicionamos a referência empresarial correta.
alter table public.profissionais
  add column if not exists tipo_profissional_catalogo_id uuid references public.catalogos(id) on delete restrict;

create index if not exists profissionais_tipo_profissional_catalogo_idx
  on public.profissionais(empresa_id, tipo_profissional_catalogo_id)
  where tipo_profissional_catalogo_id is not null and ativo;

-- Permite que usuários autorizados a trabalhar com Profissionais consultem somente
-- os catálogos necessários ao seletor de Tipo de profissional. As demais categorias
-- continuam protegidas pela policy catalogos_select já existente.
drop policy if exists catalogos_tipo_profissional_profissionais_select on public.catalogos;
create policy catalogos_tipo_profissional_profissionais_select
on public.catalogos
for select
to authenticated
using (
  tipo = 'tipo_profissional'::public.tipo_catalogo
  and ativo
  and public.tem_empresa(empresa_id)
  and (
    public.tem_permissao(empresa_id, null, 'profissionais.visualizar')
    or public.tem_permissao(empresa_id, null, 'profissionais.criar')
    or public.tem_permissao(empresa_id, null, 'profissionais.editar')
  )
);

-- Quando existir um catálogo empresarial com o mesmo código do tipo legado,
-- liga automaticamente os profissionais antigos ao catálogo da própria empresa.
update public.profissionais p
set tipo_profissional_catalogo_id = c.id,
    updated_at = now()
from public.tipos_profissional tp,
     public.catalogos c
where p.tipo_profissional_catalogo_id is null
  and p.tipo_profissional_id = tp.id
  and c.empresa_id = p.empresa_id
  and c.tipo = 'tipo_profissional'::public.tipo_catalogo
  and c.ativo
  and lower(trim(c.codigo)) = lower(trim(tp.codigo));

comment on column public.profissionais.tipo_profissional_catalogo_id is
'Tipo profissional configurável por empresa em catalogos(tipo_profissional). tipo_profissional_id permanece somente para compatibilidade legada.';

commit;
