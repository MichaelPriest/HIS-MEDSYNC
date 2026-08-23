begin;

create table if not exists public.compras_cotacoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas,
  unidade_id uuid not null references public.unidades,
  solicitacao_id uuid references public.compras_solicitacoes on delete cascade,
  numero text not null,
  status text not null default 'aberta' check (status in ('aberta','em_analise','aprovada','reprovada','convertida_pedido','cancelada')),
  validade date,
  observacoes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users,
  unique(empresa_id,unidade_id,numero)
);

create table if not exists public.compras_cotacao_fornecedores (
  id uuid primary key default gen_random_uuid(),
  cotacao_id uuid not null references public.compras_cotacoes on delete cascade,
  fornecedor_id uuid not null references public.fornecedores,
  valor_total numeric(14,2) not null default 0,
  prazo_entrega_dias integer,
  condicao_pagamento text,
  frete numeric(14,2) not null default 0,
  selecionado boolean not null default false,
  observacoes text,
  unique(cotacao_id,fornecedor_id)
);

alter table public.compras_recebimentos add column if not exists recebimento_parcial boolean not null default false;
alter table public.compras_recebimentos add column if not exists quantidade_itens_recebidos integer not null default 0;
alter table public.compras_recebimentos add column if not exists quantidade_itens_pendentes integer not null default 0;

create table if not exists public.contas_medicas_checklist_modelos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas,
  convenio_id uuid references public.convenios,
  tipo_conta text not null default 'geral',
  codigo text not null,
  descricao text not null,
  obrigatorio boolean not null default true,
  categoria_documento text,
  exige_autorizacao boolean not null default false,
  ativo boolean not null default true,
  ordem integer not null default 0,
  unique(empresa_id,convenio_id,tipo_conta,codigo)
);

create table if not exists public.contas_medicas_checklist_itens (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid not null references public.contas_medicas_processos on delete cascade,
  modelo_id uuid references public.contas_medicas_checklist_modelos,
  codigo text not null,
  descricao text not null,
  obrigatorio boolean not null default true,
  categoria_documento text,
  status text not null default 'pendente' check (status in ('pendente','ok','nao_aplicavel','divergente')),
  ged_documento_id uuid references public.ged_documentos,
  observacoes text,
  conferido_em timestamptz,
  conferido_por uuid references auth.users
);
create index if not exists cm_checklist_processo_idx on public.contas_medicas_checklist_itens(processo_id,status);

create or replace function public.gerar_checklist_conta_medica(p_processo_id uuid)
returns integer language plpgsql security definer set search_path=public as $$
declare v_proc public.contas_medicas_processos%rowtype; v_count integer;
begin
  select * into v_proc from public.contas_medicas_processos where id=p_processo_id;
  if not found then raise exception 'Processo de contas médicas não encontrado'; end if;
  delete from public.contas_medicas_checklist_itens where processo_id=p_processo_id;
  insert into public.contas_medicas_checklist_itens(processo_id,modelo_id,codigo,descricao,obrigatorio,categoria_documento)
  select p_processo_id,m.id,m.codigo,m.descricao,m.obrigatorio,m.categoria_documento
    from public.contas_medicas_checklist_modelos m
   where m.empresa_id=v_proc.empresa_id and m.ativo=true
     and (m.convenio_id is null or m.convenio_id=v_proc.convenio_id)
   order by m.convenio_id nulls first,m.ordem,m.codigo;
  get diagnostics v_count=row_count;
  return v_count;
end $$;

create or replace function public.validar_checklist_conta_medica(p_processo_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_pendentes integer;
begin
  select count(*) into v_pendentes from public.contas_medicas_checklist_itens
   where processo_id=p_processo_id and obrigatorio=true and status not in ('ok','nao_aplicavel');
  if v_pendentes>0 then
    update public.contas_medicas_processos set status='pendente_documentacao',updated_at=now() where id=p_processo_id;
    return false;
  end if;
  return true;
end $$;

grant execute on function public.gerar_checklist_conta_medica(uuid) to authenticated;
grant execute on function public.validar_checklist_conta_medica(uuid) to authenticated;

alter table public.compras_cotacoes enable row level security;
alter table public.compras_cotacao_fornecedores enable row level security;
alter table public.contas_medicas_checklist_modelos enable row level security;
alter table public.contas_medicas_checklist_itens enable row level security;

create policy compras_cotacoes_select on public.compras_cotacoes for select using (public.tem_unidade(empresa_id,unidade_id));
create policy compras_cotacoes_write on public.compras_cotacoes for all using (public.tem_unidade(empresa_id,unidade_id)) with check (public.tem_unidade(empresa_id,unidade_id));
create policy cm_modelos_select on public.contas_medicas_checklist_modelos for select using (public.tem_empresa(empresa_id));
create policy cm_modelos_write on public.contas_medicas_checklist_modelos for all using (public.tem_empresa(empresa_id)) with check (public.tem_empresa(empresa_id));

commit;