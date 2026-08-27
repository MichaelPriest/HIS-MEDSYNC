alter view public.vw_salas_cirurgicas_prontidao set (security_invoker = true);

alter function public.nome_painel_chamada(text) set search_path = '';

revoke execute on function public.tem_empresa(uuid) from public, anon;
revoke execute on function public.tem_unidade(uuid, uuid) from public, anon;
revoke execute on function public.tem_permissao(uuid, uuid, text) from public, anon;
revoke execute on function public.usuario_ativo() from public, anon;

grant execute on function public.tem_empresa(uuid) to authenticated;
grant execute on function public.tem_unidade(uuid, uuid) to authenticated;
grant execute on function public.tem_permissao(uuid, uuid, text) to authenticated;
grant execute on function public.usuario_ativo() to authenticated;

revoke execute on function public.tmp_core_referencias_importar(text,text,text,text,jsonb) from public, anon, authenticated;
