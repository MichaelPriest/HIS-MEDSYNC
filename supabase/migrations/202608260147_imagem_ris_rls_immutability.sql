drop policy if exists imagem_laudos_insert on public.imagem_laudos;
create policy imagem_laudos_insert on public.imagem_laudos
for insert to authenticated
with check (
  public.tem_unidade(empresa_id,unidade_id)
  and public.tem_permissao(empresa_id,unidade_id,'imagem.laudar')
  and status='rascunho'
  and laudo_por is null
  and liberado_em is null
  and assinatura_hash is null
);

drop policy if exists imagem_laudos_update on public.imagem_laudos;
create policy imagem_laudos_update on public.imagem_laudos
for update to authenticated
using (
  public.tem_unidade(empresa_id,unidade_id)
  and public.tem_permissao(empresa_id,unidade_id,'imagem.laudar')
  and status<>'liberado'
)
with check (
  public.tem_unidade(empresa_id,unidade_id)
  and public.tem_permissao(empresa_id,unidade_id,'imagem.laudar')
  and status<>'liberado'
  and laudo_por is null
  and liberado_em is null
  and assinatura_hash is null
);

drop policy if exists imagem_laudos_delete on public.imagem_laudos;
create policy imagem_laudos_delete on public.imagem_laudos
for delete to authenticated
using (
  public.tem_unidade(empresa_id,unidade_id)
  and public.tem_permissao(empresa_id,unidade_id,'imagem.laudar')
  and status='rascunho'
);
