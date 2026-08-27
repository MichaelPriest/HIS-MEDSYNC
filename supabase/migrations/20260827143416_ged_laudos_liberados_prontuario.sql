drop policy if exists ged_documentos_select on public.ged_documentos;

create policy ged_documentos_select
on public.ged_documentos
for select
to authenticated
using (
  public.tem_empresa(empresa_id)
  and (unidade_id is null or public.tem_unidade(empresa_id, unidade_id))
  and (
    public.tem_permissao(empresa_id, unidade_id, 'ged.visualizar')
    or public.tem_permissao(empresa_id, unidade_id, 'ged.gerenciar')
    or public.tem_permissao(empresa_id, unidade_id, 'ged.administrar')
    or (
      public.tem_permissao(empresa_id, unidade_id, 'prontuario.visualizar')
      and (
        (
          laboratorio_laudo_id is not null
          and exists (
            select 1
            from public.laboratorio_laudos l
            where l.id = laboratorio_laudo_id
              and l.empresa_id = empresa_id
              and l.unidade_id = unidade_id
              and l.status = 'liberado'
          )
        )
        or (
          imagem_laudo_id is not null
          and exists (
            select 1
            from public.imagem_laudos i
            where i.id = imagem_laudo_id
              and i.empresa_id = empresa_id
              and i.unidade_id = unidade_id
              and i.status = 'liberado'
          )
        )
      )
    )
  )
);

drop policy if exists ged_storage_select on storage.objects;

create policy ged_storage_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'ged-documentos'
  and (
    public.ged_storage_scope_authorized(name, 'ged.visualizar')
    or public.ged_storage_scope_authorized(name, 'ged.gerenciar')
    or public.ged_storage_scope_authorized(name, 'ged.administrar')
    or exists (
      select 1
      from public.ged_documentos d
      where d.storage_bucket = objects.bucket_id
        and d.storage_path = objects.name
        and d.status = 'ativo'
        and public.tem_empresa(d.empresa_id)
        and (d.unidade_id is null or public.tem_unidade(d.empresa_id, d.unidade_id))
        and public.tem_permissao(d.empresa_id, d.unidade_id, 'prontuario.visualizar')
        and (
          (
            d.laboratorio_laudo_id is not null
            and exists (
              select 1
              from public.laboratorio_laudos l
              where l.id = d.laboratorio_laudo_id
                and l.empresa_id = d.empresa_id
                and l.unidade_id = d.unidade_id
                and l.status = 'liberado'
            )
          )
          or (
            d.imagem_laudo_id is not null
            and exists (
              select 1
              from public.imagem_laudos i
              where i.id = d.imagem_laudo_id
                and i.empresa_id = d.empresa_id
                and i.unidade_id = d.unidade_id
                and i.status = 'liberado'
            )
          )
        )
    )
  )
);
