grant insert on table public.prescricao_eventos to authenticated;

drop policy if exists prescricao_eventos_insert_administracao on public.prescricao_eventos;
create policy prescricao_eventos_insert_administracao
on public.prescricao_eventos
for insert
to authenticated
with check (
  evento = 'administracao'
  and usuario_id = auth.uid()
  and public.tem_unidade(empresa_id, unidade_id)
  and (
    public.tem_permissao(empresa_id, unidade_id, 'medicamentos.checar_beira_leito')
    or public.tem_permissao(empresa_id, unidade_id, 'medicamentos.administrar')
  )
  and exists (
    select 1
    from public.profissionais p
    where p.id = profissional_id
      and p.usuario_id = auth.uid()
      and p.empresa_id = prescricao_eventos.empresa_id
      and p.ativo
  )
  and exists (
    select 1
    from public.prescricoes pr
    where pr.id = prescricao_id
      and pr.empresa_id = prescricao_eventos.empresa_id
      and pr.unidade_id = prescricao_eventos.unidade_id
      and pr.atendimento_id = prescricao_eventos.atendimento_id
  )
);
