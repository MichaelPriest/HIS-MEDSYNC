create or replace function public.buscar_pacientes_admissao(p_empresa uuid, p_busca text, p_limite integer default 30)
returns table(id uuid, nome_completo text, cpf text, ra text, numero_registro bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_busca text := trim(coalesce(p_busca, ''));
  v_busca_lower text := lower(trim(coalesce(p_busca, '')));
  v_digitos text := regexp_replace(coalesce(p_busca, ''), '\D', '', 'g');
  v_limite integer := greatest(1, least(coalesce(p_limite, 30), 50));
begin
  if auth.uid() is null
     or not public.tem_empresa(p_empresa)
     or not public.tem_permissao(p_empresa, null, 'pacientes.visualizar') then
    raise exception 'BUSCA_PACIENTE_SEM_PERMISSAO' using errcode = '42501';
  end if;
  if char_length(v_busca) < 2 then return; end if;

  return query
  select p.id,p.nome_completo,p.cpf,p.ra,p.numero_registro
    from public.pacientes p
   where p.empresa_id=p_empresa and p.ativo
     and (
       lower(p.nome_completo) like '%'||v_busca_lower||'%'
       or lower(coalesce(p.nome_social,'')) like '%'||v_busca_lower||'%'
       or lower(p.ra) like '%'||v_busca_lower||'%'
       or p.numero_registro::text=v_busca
       or (char_length(v_digitos)>=3 and regexp_replace(coalesce(p.cpf,''),'\D','','g') like '%'||v_digitos||'%')
       or exists (
         select 1 from public.paciente_convenios pc
          where pc.paciente_id=p.id and pc.empresa_id=p_empresa and pc.ativo
            and lower(pc.numero_carteirinha) like '%'||v_busca_lower||'%'
       )
     )
   order by case
     when char_length(v_digitos)=11 and regexp_replace(coalesce(p.cpf,''),'\D','','g')=v_digitos then 0
     when lower(p.ra)=v_busca_lower then 1
     when p.numero_registro::text=v_busca then 2
     when lower(coalesce(p.nome_social,''))=v_busca_lower then 3
     when lower(p.nome_completo)=v_busca_lower then 4
     else 5 end,
     coalesce(nullif(p.nome_social,''),p.nome_completo),p.nome_completo
   limit v_limite;
end
$$;
revoke all on function public.buscar_pacientes_admissao(uuid,text,integer) from public,anon;
grant execute on function public.buscar_pacientes_admissao(uuid,text,integer) to authenticated;
