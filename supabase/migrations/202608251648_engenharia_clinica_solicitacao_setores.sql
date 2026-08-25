insert into public.perfil_permissoes (perfil_id,permissao_id)
select pf.id, pm.id
from public.perfis pf
join public.permissoes pm on pm.codigo='engenharia_clinica.solicitar'
where pf.ativo=true
  and not exists (
    select 1 from public.perfil_permissoes pp
    where pp.perfil_id=pf.id and pp.permissao_id=pm.id
  );
