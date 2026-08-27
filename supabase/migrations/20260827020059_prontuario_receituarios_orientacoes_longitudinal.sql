create table if not exists public.documentos_clinicos_medicos (
  id uuid primary key default extensions.gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  unidade_id uuid not null references public.unidades(id),
  atendimento_id uuid not null references public.atendimentos(id),
  paciente_id uuid not null references public.pacientes(id),
  profissional_id uuid not null references public.profissionais(id),
  tipo_documento text not null,
  titulo text not null,
  itens jsonb not null default '[]'::jsonb,
  orientacoes text null,
  observacoes text null,
  numero_notificacao text null,
  status text not null default 'rascunho',
  emitido_em timestamptz not null default now(),
  assinado_em timestamptz null,
  assinatura_hash text null,
  paciente_snapshot jsonb not null default '{}'::jsonb,
  profissional_snapshot jsonb not null default '{}'::jsonb,
  estabelecimento_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id),
  constraint documentos_clinicos_medicos_tipo_check check (tipo_documento in ('receituario_comum','controle_especial','b1_azul','orientacao_nao_medicamentosa')),
  constraint documentos_clinicos_medicos_status_check check (status in ('rascunho','assinado')),
  constraint documentos_clinicos_medicos_itens_array check (jsonb_typeof(itens) = 'array'),
  constraint documentos_clinicos_medicos_b1_numero_check check (tipo_documento <> 'b1_azul' or status <> 'assinado' or nullif(btrim(numero_notificacao),'') is not null),
  constraint documentos_clinicos_medicos_conteudo_check check (
    (tipo_documento = 'orientacao_nao_medicamentosa' and nullif(btrim(orientacoes),'') is not null)
    or
    (tipo_documento <> 'orientacao_nao_medicamentosa' and jsonb_array_length(itens) > 0)
  )
);

create index if not exists idx_documentos_clinicos_medicos_atendimento on public.documentos_clinicos_medicos (atendimento_id, emitido_em desc);
create index if not exists idx_documentos_clinicos_medicos_paciente on public.documentos_clinicos_medicos (paciente_id, emitido_em desc);
create index if not exists idx_documentos_clinicos_medicos_profissional on public.documentos_clinicos_medicos (profissional_id, emitido_em desc);

alter table public.documentos_clinicos_medicos enable row level security;

drop policy if exists documentos_clinicos_medicos_select on public.documentos_clinicos_medicos;
create policy documentos_clinicos_medicos_select on public.documentos_clinicos_medicos
for select to authenticated
using (
  public.tem_unidade(empresa_id, unidade_id)
  and (
    public.tem_permissao(empresa_id, unidade_id, 'prontuario.visualizar')
    or public.tem_permissao(empresa_id, unidade_id, 'prescricao.visualizar')
  )
);

drop policy if exists documentos_clinicos_medicos_insert on public.documentos_clinicos_medicos;
create policy documentos_clinicos_medicos_insert on public.documentos_clinicos_medicos
for insert to authenticated
with check (
  public.tem_unidade(empresa_id, unidade_id)
  and (
    (
      tipo_documento in ('receituario_comum','controle_especial','b1_azul')
      and public.tem_permissao(empresa_id, unidade_id, 'prescricao.criar')
      and (status <> 'assinado' or public.tem_permissao(empresa_id, unidade_id, 'prescricao.assinar'))
    )
    or
    (
      tipo_documento = 'orientacao_nao_medicamentosa'
      and public.tem_permissao(empresa_id, unidade_id, 'prontuario.evoluir')
      and (status <> 'assinado' or public.tem_permissao(empresa_id, unidade_id, 'prontuario.assinar'))
    )
  )
);

drop policy if exists documentos_clinicos_medicos_update on public.documentos_clinicos_medicos;
create policy documentos_clinicos_medicos_update on public.documentos_clinicos_medicos
for update to authenticated
using (
  public.tem_unidade(empresa_id, unidade_id)
  and (
    (tipo_documento in ('receituario_comum','controle_especial','b1_azul') and public.tem_permissao(empresa_id, unidade_id, 'prescricao.criar'))
    or (tipo_documento = 'orientacao_nao_medicamentosa' and public.tem_permissao(empresa_id, unidade_id, 'prontuario.evoluir'))
  )
)
with check (
  public.tem_unidade(empresa_id, unidade_id)
  and (
    (
      tipo_documento in ('receituario_comum','controle_especial','b1_azul')
      and public.tem_permissao(empresa_id, unidade_id, 'prescricao.criar')
      and (status <> 'assinado' or public.tem_permissao(empresa_id, unidade_id, 'prescricao.assinar'))
    )
    or
    (
      tipo_documento = 'orientacao_nao_medicamentosa'
      and public.tem_permissao(empresa_id, unidade_id, 'prontuario.evoluir')
      and (status <> 'assinado' or public.tem_permissao(empresa_id, unidade_id, 'prontuario.assinar'))
    )
  )
);

drop policy if exists documentos_clinicos_medicos_delete on public.documentos_clinicos_medicos;
create policy documentos_clinicos_medicos_delete on public.documentos_clinicos_medicos
for delete to authenticated
using (
  status = 'rascunho'
  and public.tem_unidade(empresa_id, unidade_id)
  and (
    (tipo_documento in ('receituario_comum','controle_especial','b1_azul') and public.tem_permissao(empresa_id, unidade_id, 'prescricao.criar'))
    or (tipo_documento = 'orientacao_nao_medicamentosa' and public.tem_permissao(empresa_id, unidade_id, 'prontuario.evoluir'))
  )
);

create or replace function public.proteger_documento_clinico_medico_assinado()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'assinado' or old.assinado_em is not null then
      raise exception 'Documento clínico assinado é imutável';
    end if;
    return old;
  end if;

  if old.status = 'assinado' or old.assinado_em is not null then
    raise exception 'Documento clínico assinado é imutável';
  end if;

  if new.status = 'assinado' then
    if new.assinado_em is null or nullif(btrim(new.assinatura_hash),'') is null then
      raise exception 'Assinatura clínica incompleta';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.proteger_documento_clinico_medico_assinado() from public, anon, authenticated;

drop trigger if exists trg_documentos_clinicos_medicos_proteger_assinado on public.documentos_clinicos_medicos;
create trigger trg_documentos_clinicos_medicos_proteger_assinado
before update or delete on public.documentos_clinicos_medicos
for each row execute function public.proteger_documento_clinico_medico_assinado();

grant select, insert, update, delete on public.documentos_clinicos_medicos to authenticated;

comment on table public.documentos_clinicos_medicos is 'Documentos médicos emitidos no episódio: receituário comum, controle especial/B1 e orientações não medicamentosas. A prescrição assistencial diária permanece separada.';
comment on column public.documentos_clinicos_medicos.numero_notificacao is 'Identificador informado da notificação controlada quando aplicável; não substitui validação regulatória externa.';