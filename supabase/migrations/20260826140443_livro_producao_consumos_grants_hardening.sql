-- Escrita das tabelas derivadas do Livro é exclusiva das funções internas SECURITY DEFINER.
revoke insert,update,delete on public.atendimento_pacote_consumos from anon,authenticated;
revoke insert,update,delete on public.producao_autorizacao_consumos from anon,authenticated;
grant select on public.atendimento_pacote_consumos to authenticated;
grant select on public.producao_autorizacao_consumos to authenticated;
