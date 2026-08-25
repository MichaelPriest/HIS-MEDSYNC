create sequence if not exists public.engenharia_os_numero_seq;

create table if not exists public.engenharia_equipamentos (
  id uuid primary key default extensions.gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  unidade_id uuid not null references public.unidades(id),
  setor_id uuid null references public.setores(id),
  patrimonio text not null,
  nome text not null,
  categoria text not null,
  fabricante text null,
  modelo text null,
  numero_serie text null,
  registro_anvisa text null,
  criticidade text not null default 'media' check (criticidade in ('baixa','media','alta','critica')),
  status text not null default 'operacional' check (status in ('operacional','em_manutencao','indisponivel','reserva','baixado')),
  localizacao text null,
  responsavel_setor text null,
  fornecedor text null,
  data_aquisicao date null,
  garantia_ate date null,
  proxima_preventiva date null,
  proxima_calibracao date null,
  intervalo_preventiva_dias integer null,
  intervalo_calibracao_dias integer null,
  valor_aquisicao numeric(14,2) null,
  observacoes text null,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id),
  unique (empresa_id, patrimonio)
);

create table if not exists public.engenharia_ordens_servico (
  id uuid primary key default extensions.gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  unidade_id uuid not null references public.unidades(id),
  numero bigint not null default nextval('public.engenharia_os_numero_seq'),
  equipamento_id uuid not null references public.engenharia_equipamentos(id),
  setor_id uuid null references public.setores(id),
  tipo text not null default 'corretiva' check (tipo in ('corretiva','preventiva','calibracao','inspecao','instalacao')),
  prioridade text not null default 'media' check (prioridade in ('baixa','media','alta','critica')),
  status text not null default 'aberta' check (status in ('aberta','triagem','em_execucao','aguardando_peca','aguardando_fornecedor','concluida','cancelada')),
  solicitante_usuario_id uuid null references auth.users(id),
  solicitante_nome text null,
  responsavel text null,
  fornecedor text null,
  problema_relatado text not null,
  diagnostico text null,
  servico_executado text null,
  pecas_materiais text null,
  custo numeric(14,2) null,
  parada_inicio timestamptz null,
  parada_fim timestamptz null,
  prazo timestamptz null,
  iniciado_em timestamptz null,
  concluido_em timestamptz null,
  proxima_preventiva date null,
  proxima_calibracao date null,
  observacoes text null,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id),
  unique (empresa_id, numero)
);

create table if not exists public.engenharia_os_eventos (
  id uuid primary key default extensions.gen_random_uuid(),
  ordem_servico_id uuid not null references public.engenharia_ordens_servico(id) on delete cascade,
  tipo text not null,
  descricao text not null,
  autor_usuario_id uuid null references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_eng_equip_unidade_status on public.engenharia_equipamentos(unidade_id,status);
create index if not exists idx_eng_equip_preventiva on public.engenharia_equipamentos(unidade_id,proxima_preventiva);
create index if not exists idx_eng_equip_calibracao on public.engenharia_equipamentos(unidade_id,proxima_calibracao);
create index if not exists idx_eng_os_unidade_status on public.engenharia_ordens_servico(unidade_id,status,prioridade);
create index if not exists idx_eng_os_equipamento on public.engenharia_ordens_servico(equipamento_id,created_at desc);

insert into public.permissoes (codigo,descricao)
values
 ('engenharia_clinica.visualizar','Visualizar Engenharia Clínica'),
 ('engenharia_clinica.solicitar','Abrir ordem de serviço de Engenharia Clínica'),
 ('engenharia_clinica.gerenciar','Gerenciar equipamentos e ordens de serviço')
on conflict (codigo) do update set descricao=excluded.descricao, ativo=true, updated_at=now();

insert into public.perfis (empresa_id,nome,sistema,ativo)
select distinct p.empresa_id,'Engenharia Clínica',true,true
from public.perfis p
where not exists (select 1 from public.perfis x where x.empresa_id=p.empresa_id and lower(x.nome)=lower('Engenharia Clínica'));

insert into public.perfil_permissoes (perfil_id,permissao_id)
select pf.id,pm.id from public.perfis pf cross join public.permissoes pm
where lower(pf.nome)=lower('Engenharia Clínica')
  and pm.codigo in ('engenharia_clinica.visualizar','engenharia_clinica.solicitar','engenharia_clinica.gerenciar')
  and not exists (select 1 from public.perfil_permissoes pp where pp.perfil_id=pf.id and pp.permissao_id=pm.id);

alter table public.engenharia_equipamentos enable row level security;
alter table public.engenharia_ordens_servico enable row level security;
alter table public.engenharia_os_eventos enable row level security;

create policy engenharia_equipamentos_select on public.engenharia_equipamentos for select using (
  public.tem_unidade(empresa_id,unidade_id) and (
    public.tem_permissao(empresa_id,unidade_id,'engenharia_clinica.visualizar') or
    public.tem_permissao(empresa_id,unidade_id,'engenharia_clinica.solicitar')
  )
);
create policy engenharia_equipamentos_write on public.engenharia_equipamentos for all using (
  public.tem_unidade(empresa_id,unidade_id) and public.tem_permissao(empresa_id,unidade_id,'engenharia_clinica.gerenciar')
) with check (
  public.tem_unidade(empresa_id,unidade_id) and public.tem_permissao(empresa_id,unidade_id,'engenharia_clinica.gerenciar')
);

create policy engenharia_os_select on public.engenharia_ordens_servico for select using (
  public.tem_unidade(empresa_id,unidade_id) and (
    public.tem_permissao(empresa_id,unidade_id,'engenharia_clinica.visualizar') or
    public.tem_permissao(empresa_id,unidade_id,'engenharia_clinica.solicitar') or
    solicitante_usuario_id=auth.uid()
  )
);
create policy engenharia_os_insert on public.engenharia_ordens_servico for insert with check (
  public.tem_unidade(empresa_id,unidade_id) and
  public.tem_permissao(empresa_id,unidade_id,'engenharia_clinica.solicitar') and
  solicitante_usuario_id=auth.uid()
);
create policy engenharia_os_update on public.engenharia_ordens_servico for update using (
  public.tem_unidade(empresa_id,unidade_id) and public.tem_permissao(empresa_id,unidade_id,'engenharia_clinica.gerenciar')
) with check (
  public.tem_unidade(empresa_id,unidade_id) and public.tem_permissao(empresa_id,unidade_id,'engenharia_clinica.gerenciar')
);

create policy engenharia_eventos_select on public.engenharia_os_eventos for select using (
  exists (select 1 from public.engenharia_ordens_servico os where os.id=ordem_servico_id and public.tem_unidade(os.empresa_id,os.unidade_id) and (public.tem_permissao(os.empresa_id,os.unidade_id,'engenharia_clinica.visualizar') or os.solicitante_usuario_id=auth.uid()))
);
create policy engenharia_eventos_insert on public.engenharia_os_eventos for insert with check (
  autor_usuario_id=auth.uid() and exists (select 1 from public.engenharia_ordens_servico os where os.id=ordem_servico_id and public.tem_unidade(os.empresa_id,os.unidade_id) and public.tem_permissao(os.empresa_id,os.unidade_id,'engenharia_clinica.gerenciar'))
);
