alter table public.ged_documentos
  add column if not exists storage_bucket text,
  add column if not exists substitui_documento_id uuid,
  add column if not exists solicitacao_exame_id uuid,
  add column if not exists laboratorio_laudo_id uuid,
  add column if not exists imagem_laudo_id uuid,
  add column if not exists assinado_em timestamptz,
  add column if not exists assinado_por uuid,
  add column if not exists assinatura_hash text,
  add column if not exists assinatura_observacao text;

update public.ged_documentos d
set storage_bucket = coalesce(
  (
    select so.bucket_id
    from storage.objects so
    where so.name = d.storage_path
    order by so.created_at desc
    limit 1
  ),
  'ged-documentos'
)
where d.storage_bucket is null;

alter table public.ged_documentos
  alter column storage_bucket set default 'ged-documentos',
  alter column storage_bucket set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ged_documentos_substitui_documento_id_fkey') then
    alter table public.ged_documentos add constraint ged_documentos_substitui_documento_id_fkey
      foreign key (substitui_documento_id) references public.ged_documentos(id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ged_documentos_solicitacao_exame_id_fkey') then
    alter table public.ged_documentos add constraint ged_documentos_solicitacao_exame_id_fkey
      foreign key (solicitacao_exame_id) references public.solicitacoes_exames(id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ged_documentos_laboratorio_laudo_id_fkey') then
    alter table public.ged_documentos add constraint ged_documentos_laboratorio_laudo_id_fkey
      foreign key (laboratorio_laudo_id) references public.laboratorio_laudos(id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ged_documentos_imagem_laudo_id_fkey') then
    alter table public.ged_documentos add constraint ged_documentos_imagem_laudo_id_fkey
      foreign key (imagem_laudo_id) references public.imagem_laudos(id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ged_documentos_assinado_por_fkey') then
    alter table public.ged_documentos add constraint ged_documentos_assinado_por_fkey
      foreign key (assinado_por) references auth.users(id) on delete restrict;
  end if;
end $$;

create index if not exists ged_documentos_scope_created_idx
  on public.ged_documentos (empresa_id, unidade_id, created_at desc);
create index if not exists ged_documentos_atendimento_idx
  on public.ged_documentos (atendimento_id) where atendimento_id is not null;
create index if not exists ged_documentos_paciente_idx
  on public.ged_documentos (paciente_id) where paciente_id is not null;
create index if not exists ged_documentos_substitui_idx
  on public.ged_documentos (substitui_documento_id) where substitui_documento_id is not null;
create index if not exists ged_documentos_laboratorio_laudo_idx
  on public.ged_documentos (laboratorio_laudo_id) where laboratorio_laudo_id is not null;
create index if not exists ged_documentos_imagem_laudo_idx
  on public.ged_documentos (imagem_laudo_id) where imagem_laudo_id is not null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ged-documentos',
  'ged-documentos',
  false,
  10485760,
  array['application/pdf','image/jpeg','image/png','text/xml','application/xml']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.ged_storage_scope_authorized(p_name text, p_permission text)
returns boolean
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_parts text[];
  v_empresa uuid;
  v_unidade uuid;
begin
  if auth.uid() is null or p_name is null or p_permission is null then
    return false;
  end if;

  v_parts := storage.foldername(p_name);
  if coalesce(array_length(v_parts, 1), 0) < 2 then
    return false;
  end if;

  begin
    v_empresa := v_parts[1]::uuid;
  exception when invalid_text_representation then
    return false;
  end;

  if v_parts[2] = 'corporativo' then
    return public.tem_empresa(v_empresa)
      and public.tem_permissao(v_empresa, null::uuid, p_permission);
  end if;

  begin
    v_unidade := v_parts[2]::uuid;
  exception when invalid_text_representation then
    return false;
  end;

  return public.tem_unidade(v_empresa, v_unidade)
    and public.tem_permissao(v_empresa, v_unidade, p_permission);
end;
$$;

revoke all on function public.ged_storage_scope_authorized(text,text) from public, anon;
grant execute on function public.ged_storage_scope_authorized(text,text) to authenticated;

alter table public.ged_documentos enable row level security;
alter table public.ged_documentos force row level security;

drop policy if exists ged_documentos_all on public.ged_documentos;
drop policy if exists ged_documentos_select on public.ged_documentos;
drop policy if exists ged_documentos_insert on public.ged_documentos;
drop policy if exists ged_documentos_update on public.ged_documentos;
drop policy if exists ged_documentos_delete on public.ged_documentos;

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
  )
);

create policy ged_documentos_insert
on public.ged_documentos
for insert
to authenticated
with check (
  public.tem_empresa(empresa_id)
  and (unidade_id is null or public.tem_unidade(empresa_id, unidade_id))
  and created_by = auth.uid()
  and (
    public.tem_permissao(empresa_id, unidade_id, 'ged.enviar')
    or public.tem_permissao(empresa_id, unidade_id, 'ged.gerenciar')
    or public.tem_permissao(empresa_id, unidade_id, 'ged.administrar')
  )
);

create policy ged_documentos_update
on public.ged_documentos
for update
to authenticated
using (
  public.tem_empresa(empresa_id)
  and (unidade_id is null or public.tem_unidade(empresa_id, unidade_id))
  and (
    public.tem_permissao(empresa_id, unidade_id, 'ged.gerenciar')
    or public.tem_permissao(empresa_id, unidade_id, 'ged.administrar')
  )
)
with check (
  public.tem_empresa(empresa_id)
  and (unidade_id is null or public.tem_unidade(empresa_id, unidade_id))
  and (
    public.tem_permissao(empresa_id, unidade_id, 'ged.gerenciar')
    or public.tem_permissao(empresa_id, unidade_id, 'ged.administrar')
  )
);

-- GED Storage: bucket privado, escopo empresa/unidade e permissão funcional.
drop policy if exists ged_storage_select on storage.objects;
drop policy if exists ged_storage_insert on storage.objects;
drop policy if exists ged_storage_delete on storage.objects;

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
  )
);

create policy ged_storage_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'ged-documentos'
  and (
    public.ged_storage_scope_authorized(name, 'ged.enviar')
    or public.ged_storage_scope_authorized(name, 'ged.gerenciar')
    or public.ged_storage_scope_authorized(name, 'ged.administrar')
  )
);

create policy ged_storage_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'ged-documentos'
  and (
    public.ged_storage_scope_authorized(name, 'ged.gerenciar')
    or public.ged_storage_scope_authorized(name, 'ged.administrar')
    or (
      owner = auth.uid()
      and public.ged_storage_scope_authorized(name, 'ged.enviar')
    )
  )
);

create or replace function public.validar_ged_documento_escopo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parts text[];
  v_obj record;
  v_empresa uuid;
  v_unidade uuid;
  v_atendimento uuid;
  v_paciente uuid;
  v_solicitacao uuid;
begin
  if nullif(btrim(new.categoria), '') is null
     or nullif(btrim(new.titulo), '') is null
     or nullif(btrim(new.nome_arquivo), '') is null
     or nullif(btrim(new.storage_bucket), '') is null
     or nullif(btrim(new.storage_path), '') is null then
    raise exception 'Documento GED com metadados obrigatórios ausentes';
  end if;

  if new.hash_sha256 is not null and new.hash_sha256 !~ '^[0-9a-fA-F]{64}$' then
    raise exception 'Hash SHA-256 inválido';
  end if;

  if new.unidade_id is not null and not exists (
    select 1 from public.unidades u
    where u.id = new.unidade_id and u.empresa_id = new.empresa_id
  ) then
    raise exception 'Unidade do GED não pertence à empresa informada';
  end if;

  if new.laboratorio_laudo_id is not null then
    select l.empresa_id, l.unidade_id, l.atendimento_id, l.paciente_id, l.solicitacao_id
      into v_empresa, v_unidade, v_atendimento, v_paciente, v_solicitacao
    from public.laboratorio_laudos l
    where l.id = new.laboratorio_laudo_id;
    if not found or v_empresa is distinct from new.empresa_id then
      raise exception 'Laudo laboratorial fora do escopo do GED';
    end if;
    if new.unidade_id is null then new.unidade_id := v_unidade;
    elsif new.unidade_id is distinct from v_unidade then raise exception 'Unidade divergente do laudo laboratorial'; end if;
    if new.atendimento_id is null then new.atendimento_id := v_atendimento;
    elsif new.atendimento_id is distinct from v_atendimento then raise exception 'Atendimento divergente do laudo laboratorial'; end if;
    if new.paciente_id is null then new.paciente_id := v_paciente;
    elsif new.paciente_id is distinct from v_paciente then raise exception 'Paciente divergente do laudo laboratorial'; end if;
    if new.solicitacao_exame_id is null then new.solicitacao_exame_id := v_solicitacao;
    elsif new.solicitacao_exame_id is distinct from v_solicitacao then raise exception 'Solicitação divergente do laudo laboratorial'; end if;
  end if;

  if new.imagem_laudo_id is not null then
    select l.empresa_id, l.unidade_id, l.atendimento_id, l.solicitacao_id
      into v_empresa, v_unidade, v_atendimento, v_solicitacao
    from public.imagem_laudos l
    where l.id = new.imagem_laudo_id;
    if not found or v_empresa is distinct from new.empresa_id then
      raise exception 'Laudo de imagem fora do escopo do GED';
    end if;
    if new.unidade_id is null then new.unidade_id := v_unidade;
    elsif new.unidade_id is distinct from v_unidade then raise exception 'Unidade divergente do laudo de imagem'; end if;
    if new.atendimento_id is null then new.atendimento_id := v_atendimento;
    elsif new.atendimento_id is distinct from v_atendimento then raise exception 'Atendimento divergente do laudo de imagem'; end if;
    if new.solicitacao_exame_id is null then new.solicitacao_exame_id := v_solicitacao;
    elsif new.solicitacao_exame_id is distinct from v_solicitacao then raise exception 'Solicitação divergente do laudo de imagem'; end if;
  end if;

  if new.solicitacao_exame_id is not null then
    select s.empresa_id, s.unidade_id, s.atendimento_id
      into v_empresa, v_unidade, v_atendimento
    from public.solicitacoes_exames s
    where s.id = new.solicitacao_exame_id;
    if not found or v_empresa is distinct from new.empresa_id then
      raise exception 'Solicitação de exame fora do escopo do GED';
    end if;
    if new.unidade_id is null then new.unidade_id := v_unidade;
    elsif new.unidade_id is distinct from v_unidade then raise exception 'Unidade divergente da solicitação de exame'; end if;
    if new.atendimento_id is null then new.atendimento_id := v_atendimento;
    elsif new.atendimento_id is distinct from v_atendimento then raise exception 'Atendimento divergente da solicitação de exame'; end if;
  end if;

  if new.atendimento_id is not null then
    select a.empresa_id, a.unidade_id, a.paciente_id
      into v_empresa, v_unidade, v_paciente
    from public.atendimentos a
    where a.id = new.atendimento_id;
    if not found or v_empresa is distinct from new.empresa_id then
      raise exception 'Atendimento fora do escopo do GED';
    end if;
    if new.unidade_id is null then new.unidade_id := v_unidade;
    elsif new.unidade_id is distinct from v_unidade then raise exception 'Unidade divergente do atendimento'; end if;
    if new.paciente_id is null then new.paciente_id := v_paciente;
    elsif new.paciente_id is distinct from v_paciente then raise exception 'Paciente divergente do atendimento'; end if;
  end if;

  if new.paciente_id is not null and not exists (
    select 1 from public.pacientes p where p.id = new.paciente_id and p.empresa_id = new.empresa_id
  ) then
    raise exception 'Paciente fora do escopo do GED';
  end if;

  if new.profissional_id is not null and not exists (
    select 1 from public.profissionais p where p.id = new.profissional_id and p.empresa_id = new.empresa_id
  ) then
    raise exception 'Profissional fora do escopo do GED';
  end if;

  if new.convenio_id is not null and not exists (
    select 1 from public.convenios c where c.id = new.convenio_id and c.empresa_id = new.empresa_id
  ) then
    raise exception 'Convênio fora do escopo do GED';
  end if;

  if new.lote_tiss_id is not null then
    select l.empresa_id, l.unidade_id into v_empresa, v_unidade
    from public.tiss_lotes l where l.id = new.lote_tiss_id;
    if not found or v_empresa is distinct from new.empresa_id
       or (new.unidade_id is not null and v_unidade is distinct from new.unidade_id) then
      raise exception 'Lote TISS fora do escopo do GED';
    end if;
    if new.unidade_id is null then new.unidade_id := v_unidade; end if;
  end if;

  if new.conta_faturamento_id is not null then
    select c.empresa_id, c.unidade_id, c.paciente_id into v_empresa, v_unidade, v_paciente
    from public.contas_faturamento c where c.id = new.conta_faturamento_id;
    if not found or v_empresa is distinct from new.empresa_id
       or (new.unidade_id is not null and v_unidade is distinct from new.unidade_id) then
      raise exception 'Conta de faturamento fora do escopo do GED';
    end if;
    if new.unidade_id is null then new.unidade_id := v_unidade; end if;
    if new.paciente_id is null then new.paciente_id := v_paciente;
    elsif v_paciente is not null and new.paciente_id is distinct from v_paciente then raise exception 'Paciente divergente da conta de faturamento'; end if;
  end if;

  v_parts := storage.foldername(new.storage_path);
  if coalesce(array_length(v_parts, 1), 0) < 2 or v_parts[1] is distinct from new.empresa_id::text then
    raise exception 'Caminho de Storage fora da empresa do GED';
  end if;
  if new.unidade_id is null then
    if v_parts[2] is distinct from 'corporativo' then
      raise exception 'Documento corporativo com caminho de Storage inválido';
    end if;
  elsif v_parts[2] is distinct from new.unidade_id::text then
    raise exception 'Caminho de Storage fora da unidade do GED';
  end if;

  select so.metadata into v_obj
  from storage.objects so
  where so.bucket_id = new.storage_bucket and so.name = new.storage_path
  limit 1;
  if not found then
    raise exception 'Arquivo do GED não encontrado no Storage';
  end if;

  if new.tamanho_bytes is not null
     and nullif(v_obj.metadata->>'size','') is not null
     and (v_obj.metadata->>'size')::bigint is distinct from new.tamanho_bytes then
    raise exception 'Tamanho do arquivo diverge do Storage';
  end if;
  if new.mime_type is not null
     and nullif(v_obj.metadata->>'mimetype','') is not null
     and lower(v_obj.metadata->>'mimetype') is distinct from lower(new.mime_type) then
    raise exception 'MIME type do arquivo diverge do Storage';
  end if;

  if tg_op = 'INSERT' then
    if auth.uid() is null then raise exception 'Usuário autenticado obrigatório'; end if;
    new.created_by := auth.uid();
    if new.substitui_documento_id is null and new.versao <> 1 then
      raise exception 'Primeira versão do GED deve ser v1';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.validar_ged_documento_escopo() from public, anon, authenticated;

drop trigger if exists trg_validar_ged_documento_escopo on public.ged_documentos;
create trigger trg_validar_ged_documento_escopo
before insert or update on public.ged_documentos
for each row execute function public.validar_ged_documento_escopo();

create or replace function public.proteger_ged_assinado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.assinado_em is not null and (
    new.empresa_id is distinct from old.empresa_id
    or new.unidade_id is distinct from old.unidade_id
    or new.atendimento_id is distinct from old.atendimento_id
    or new.paciente_id is distinct from old.paciente_id
    or new.profissional_id is distinct from old.profissional_id
    or new.convenio_id is distinct from old.convenio_id
    or new.lote_tiss_id is distinct from old.lote_tiss_id
    or new.conta_faturamento_id is distinct from old.conta_faturamento_id
    or new.solicitacao_exame_id is distinct from old.solicitacao_exame_id
    or new.laboratorio_laudo_id is distinct from old.laboratorio_laudo_id
    or new.imagem_laudo_id is distinct from old.imagem_laudo_id
    or new.categoria is distinct from old.categoria
    or new.subcategoria is distinct from old.subcategoria
    or new.titulo is distinct from old.titulo
    or new.nome_arquivo is distinct from old.nome_arquivo
    or new.storage_bucket is distinct from old.storage_bucket
    or new.storage_path is distinct from old.storage_path
    or new.mime_type is distinct from old.mime_type
    or new.tamanho_bytes is distinct from old.tamanho_bytes
    or new.hash_sha256 is distinct from old.hash_sha256
    or new.versao is distinct from old.versao
    or new.confidencial is distinct from old.confidencial
    or new.observacoes is distinct from old.observacoes
    or new.substitui_documento_id is distinct from old.substitui_documento_id
    or new.assinado_em is distinct from old.assinado_em
    or new.assinado_por is distinct from old.assinado_por
    or new.assinatura_hash is distinct from old.assinatura_hash
    or new.assinatura_observacao is distinct from old.assinatura_observacao
  ) then
    raise exception 'Documento GED assinado é imutável; crie nova versão';
  end if;
  return new;
end;
$$;

revoke all on function public.proteger_ged_assinado() from public, anon, authenticated;

drop trigger if exists trg_proteger_ged_assinado on public.ged_documentos;
create trigger trg_proteger_ged_assinado
before update on public.ged_documentos
for each row execute function public.proteger_ged_assinado();

create or replace function public.registrar_documento_ged(p_payload jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_empresa uuid := nullif(p_payload->>'empresa_id','')::uuid;
  v_unidade uuid := nullif(p_payload->>'unidade_id','')::uuid;
  v_substitui uuid := nullif(p_payload->>'substitui_documento_id','')::uuid;
  v_base public.ged_documentos%rowtype;
  v_id uuid;
  v_versao integer := 1;
  v_atendimento uuid := nullif(p_payload->>'atendimento_id','')::uuid;
  v_paciente uuid := nullif(p_payload->>'paciente_id','')::uuid;
  v_profissional uuid := nullif(p_payload->>'profissional_id','')::uuid;
  v_convenio uuid := nullif(p_payload->>'convenio_id','')::uuid;
  v_lote uuid := nullif(p_payload->>'lote_tiss_id','')::uuid;
  v_conta uuid := nullif(p_payload->>'conta_faturamento_id','')::uuid;
  v_solicitacao uuid := nullif(p_payload->>'solicitacao_exame_id','')::uuid;
  v_lab uuid := nullif(p_payload->>'laboratorio_laudo_id','')::uuid;
  v_img uuid := nullif(p_payload->>'imagem_laudo_id','')::uuid;
  v_categoria text := nullif(btrim(p_payload->>'categoria'), '');
  v_subcategoria text := nullif(btrim(p_payload->>'subcategoria'), '');
  v_confidencial boolean := coalesce((p_payload->>'confidencial')::boolean, false);
begin
  if v_empresa is null then raise exception 'Empresa obrigatória'; end if;
  if not public.tem_empresa(v_empresa) then raise exception 'Empresa fora do escopo'; end if;
  if v_unidade is not null and not public.tem_unidade(v_empresa, v_unidade) then
    raise exception 'Unidade fora do escopo';
  end if;
  if not (
    public.tem_permissao(v_empresa, v_unidade, 'ged.enviar')
    or public.tem_permissao(v_empresa, v_unidade, 'ged.gerenciar')
    or public.tem_permissao(v_empresa, v_unidade, 'ged.administrar')
  ) then
    raise exception 'Sem permissão para enviar documento ao GED';
  end if;

  if v_substitui is not null then
    if not (
      public.tem_permissao(v_empresa, v_unidade, 'ged.gerenciar')
      or public.tem_permissao(v_empresa, v_unidade, 'ged.administrar')
    ) then
      raise exception 'Sem permissão para versionar documento do GED';
    end if;
    select * into v_base from public.ged_documentos where id = v_substitui for update;
    if not found or v_base.empresa_id is distinct from v_empresa or v_base.status <> 'ativo' then
      raise exception 'Documento base inválido para versionamento';
    end if;
    if v_base.unidade_id is distinct from v_unidade then
      raise exception 'Documento base pertence a outro escopo de unidade';
    end if;
    v_versao := v_base.versao + 1;
    v_atendimento := v_base.atendimento_id;
    v_paciente := v_base.paciente_id;
    v_profissional := v_base.profissional_id;
    v_convenio := v_base.convenio_id;
    v_lote := v_base.lote_tiss_id;
    v_conta := v_base.conta_faturamento_id;
    v_solicitacao := v_base.solicitacao_exame_id;
    v_lab := v_base.laboratorio_laudo_id;
    v_img := v_base.imagem_laudo_id;
    v_categoria := v_base.categoria;
    v_subcategoria := v_base.subcategoria;
    v_confidencial := v_base.confidencial;
    update public.ged_documentos set status = 'substituido' where id = v_base.id;
  end if;

  insert into public.ged_documentos (
    empresa_id, unidade_id, atendimento_id, paciente_id, profissional_id, convenio_id,
    lote_tiss_id, conta_faturamento_id, solicitacao_exame_id, laboratorio_laudo_id,
    imagem_laudo_id, categoria, subcategoria, titulo, nome_arquivo, storage_bucket,
    storage_path, mime_type, tamanho_bytes, hash_sha256, versao, status,
    confidencial, observacoes, substitui_documento_id, created_by
  ) values (
    v_empresa, v_unidade, v_atendimento, v_paciente, v_profissional, v_convenio,
    v_lote, v_conta, v_solicitacao, v_lab, v_img, v_categoria, v_subcategoria,
    nullif(btrim(p_payload->>'titulo'), ''), nullif(btrim(p_payload->>'nome_arquivo'), ''),
    coalesce(nullif(btrim(p_payload->>'storage_bucket'), ''), 'ged-documentos'),
    nullif(btrim(p_payload->>'storage_path'), ''), nullif(btrim(p_payload->>'mime_type'), ''),
    nullif(p_payload->>'tamanho_bytes','')::bigint,
    lower(nullif(btrim(p_payload->>'hash_sha256'), '')),
    v_versao, 'ativo', v_confidencial, nullif(btrim(p_payload->>'observacoes'), ''),
    v_substitui, auth.uid()
  ) returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.registrar_documento_ged(jsonb) from public, anon;
grant execute on function public.registrar_documento_ged(jsonb) to authenticated;

create or replace function public.atualizar_status_documento_ged(p_documento uuid, p_status text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_doc public.ged_documentos%rowtype;
begin
  if p_status not in ('ativo','arquivado','cancelado') then
    raise exception 'Status inválido para gestão manual do GED';
  end if;
  select * into v_doc from public.ged_documentos where id = p_documento for update;
  if not found then raise exception 'Documento não encontrado'; end if;
  if not (
    public.tem_permissao(v_doc.empresa_id, v_doc.unidade_id, 'ged.gerenciar')
    or public.tem_permissao(v_doc.empresa_id, v_doc.unidade_id, 'ged.administrar')
  ) then
    raise exception 'Sem permissão para gerenciar documento do GED';
  end if;
  if v_doc.status = 'substituido' then
    raise exception 'Versão substituída não pode ser reativada';
  end if;
  update public.ged_documentos set status = p_status where id = p_documento;
end;
$$;

revoke all on function public.atualizar_status_documento_ged(uuid,text) from public, anon;
grant execute on function public.atualizar_status_documento_ged(uuid,text) to authenticated;

create or replace function public.assinar_documento_ged(p_documento uuid, p_hash_sha256 text, p_observacao text default null)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_doc public.ged_documentos%rowtype;
begin
  select * into v_doc from public.ged_documentos where id = p_documento for update;
  if not found then raise exception 'Documento não encontrado'; end if;
  if not (
    public.tem_permissao(v_doc.empresa_id, v_doc.unidade_id, 'ged.gerenciar')
    or public.tem_permissao(v_doc.empresa_id, v_doc.unidade_id, 'ged.administrar')
  ) then
    raise exception 'Sem permissão para assinar documento do GED';
  end if;
  if v_doc.status <> 'ativo' then raise exception 'Somente documento ativo pode ser assinado'; end if;
  if v_doc.assinado_em is not null then raise exception 'Documento já assinado'; end if;
  if v_doc.hash_sha256 is null or lower(v_doc.hash_sha256) is distinct from lower(p_hash_sha256) then
    raise exception 'Hash de integridade divergente';
  end if;
  update public.ged_documentos
  set assinado_em = clock_timestamp(),
      assinado_por = auth.uid(),
      assinatura_hash = lower(p_hash_sha256),
      assinatura_observacao = nullif(btrim(p_observacao), '')
  where id = p_documento;
end;
$$;

revoke all on function public.assinar_documento_ged(uuid,text,text) from public, anon;
grant execute on function public.assinar_documento_ged(uuid,text,text) to authenticated;

-- Hardening cirúrgico: remover execução anônima de rotinas não públicas confirmadas no catálogo atual.
revoke execute on function public.finalizar_prescricao_dia(uuid) from public, anon;
grant execute on function public.finalizar_prescricao_dia(uuid) to authenticated;

revoke execute on function public.preencher_snapshot_admissao() from public, anon, authenticated;

revoke execute on function public.tmp_core_referencias_importar(text,text,text,text,jsonb) from anon;
grant execute on function public.tmp_core_referencias_importar(text,text,text,text,jsonb) to authenticated;

revoke execute on function public.tmp_importar_tabela_referencia(text,text,text,text,jsonb) from anon;
