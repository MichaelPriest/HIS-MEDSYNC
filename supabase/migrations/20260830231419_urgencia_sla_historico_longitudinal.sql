drop policy if exists emergencia_sla_aplicacoes_select on public.emergencia_sla_aplicacoes;
create policy emergencia_sla_aplicacoes_select
on public.emergencia_sla_aplicacoes
for select
to authenticated
using (
  public.tem_unidade(empresa_id, unidade_id)
  and (
    public.tem_permissao(empresa_id, unidade_id, 'emergencia.visualizar')
    or public.tem_permissao(empresa_id, unidade_id, 'emergencia.gerenciar')
    or public.tem_permissao(empresa_id, unidade_id, 'emergencia.reavaliar')
    or public.tem_permissao(empresa_id, unidade_id, 'prontuario.visualizar')
  )
);

revoke insert, update, delete on public.emergencia_sla_aplicacoes from authenticated;
grant select on public.emergencia_sla_aplicacoes to authenticated;
