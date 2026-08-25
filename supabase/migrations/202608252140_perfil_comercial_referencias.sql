do $$
declare v_empresa uuid; v_perfil uuid; v_perm uuid;
begin
  for v_empresa in select id from public.empresas loop
    insert into public.perfis(empresa_id,nome,sistema,ativo) values(v_empresa,'Comercial e Credenciamento',true,true)
    on conflict(empresa_id,nome) do update set ativo=true
    returning id into v_perfil;

    for v_perm in select id from public.permissoes where codigo in ('referencias.visualizar','referencias.importar','referencias.configurar') loop
      insert into public.perfil_permissoes(perfil_id,permissao_id) values(v_perfil,v_perm) on conflict do nothing;
    end loop;

    for v_perfil in select id from public.perfis where empresa_id=v_empresa and nome='Administrador' loop
      for v_perm in select id from public.permissoes where codigo in ('referencias.visualizar','referencias.importar','referencias.configurar') loop
        insert into public.perfil_permissoes(perfil_id,permissao_id) values(v_perfil,v_perm) on conflict do nothing;
      end loop;
    end loop;

    for v_perfil in select id from public.perfis where empresa_id=v_empresa and nome in ('Faturamento','Auditoria') loop
      select id into v_perm from public.permissoes where codigo='referencias.visualizar';
      insert into public.perfil_permissoes(perfil_id,permissao_id) values(v_perfil,v_perm) on conflict do nothing;
    end loop;
  end loop;
end $$;
