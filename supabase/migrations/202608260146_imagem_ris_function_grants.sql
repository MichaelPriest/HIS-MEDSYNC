revoke execute on function public.salvar_laudo_imagem(uuid,text,text,text,text) from public, anon;
revoke execute on function public.abrir_retificacao_laudo_imagem(uuid,text) from public, anon;
revoke execute on function public.liberar_laudo_imagem(uuid) from public, anon;

grant execute on function public.salvar_laudo_imagem(uuid,text,text,text,text) to authenticated;
grant execute on function public.abrir_retificacao_laudo_imagem(uuid,text) to authenticated;
grant execute on function public.liberar_laudo_imagem(uuid) to authenticated;
