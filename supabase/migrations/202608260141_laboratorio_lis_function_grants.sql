revoke execute on function public.salvar_laudo_laboratorio(uuid,text,text,text,text,text,text) from public, anon;
revoke execute on function public.abrir_retificacao_laudo_laboratorio(uuid,text) from public, anon;
revoke execute on function public.liberar_laudo_laboratorio(uuid) from public, anon;

grant execute on function public.salvar_laudo_laboratorio(uuid,text,text,text,text,text,text) to authenticated;
grant execute on function public.abrir_retificacao_laudo_laboratorio(uuid,text) to authenticated;
grant execute on function public.liberar_laudo_laboratorio(uuid) to authenticated;
