alter table public.empresas
  add column if not exists nome_curto text,
  add column if not exists inscricao_estadual text,
  add column if not exists inscricao_municipal text,
  add column if not exists cnes text,
  add column if not exists telefone text,
  add column if not exists whatsapp text,
  add column if not exists email text,
  add column if not exists site text,
  add column if not exists cep text,
  add column if not exists logradouro text,
  add column if not exists numero text,
  add column if not exists complemento text,
  add column if not exists bairro text,
  add column if not exists cidade text,
  add column if not exists uf text,
  add column if not exists logo_path text,
  add column if not exists logo_url text,
  add column if not exists rodape_documentos text;

alter table public.empresas drop constraint if exists empresas_uf_check;
alter table public.empresas add constraint empresas_uf_check check (uf is null or char_length(uf)=2);

drop policy if exists empresas_update_admin on public.empresas;
create policy empresas_update_admin on public.empresas
for update
using (public.tem_empresa(id) and public.tem_permissao(id,null,'empresas.administrar'))
with check (public.tem_empresa(id) and public.tem_permissao(id,null,'empresas.administrar') and updated_by=auth.uid());

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('branding','branding',true,2097152,array['image/png','image/jpeg','image/webp','image/svg+xml'])
on conflict (id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists branding_public_read on storage.objects;
create policy branding_public_read on storage.objects for select using (bucket_id='branding');

drop policy if exists branding_company_insert on storage.objects;
create policy branding_company_insert on storage.objects for insert to authenticated
with check (
  bucket_id='branding'
  and public.tem_empresa(((storage.foldername(name))[1])::uuid)
  and public.tem_permissao(((storage.foldername(name))[1])::uuid,null,'empresas.administrar')
);

drop policy if exists branding_company_update on storage.objects;
create policy branding_company_update on storage.objects for update to authenticated
using (
  bucket_id='branding'
  and public.tem_empresa(((storage.foldername(name))[1])::uuid)
  and public.tem_permissao(((storage.foldername(name))[1])::uuid,null,'empresas.administrar')
)
with check (
  bucket_id='branding'
  and public.tem_empresa(((storage.foldername(name))[1])::uuid)
  and public.tem_permissao(((storage.foldername(name))[1])::uuid,null,'empresas.administrar')
);

drop policy if exists branding_company_delete on storage.objects;
create policy branding_company_delete on storage.objects for delete to authenticated
using (
  bucket_id='branding'
  and public.tem_empresa(((storage.foldername(name))[1])::uuid)
  and public.tem_permissao(((storage.foldername(name))[1])::uuid,null,'empresas.administrar')
);