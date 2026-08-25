-- Central de TI: permissões, perfil e RLS operacional

insert into public.permissoes (codigo, descricao)
values
  ('ti.visualizar', 'Visualizar módulo de TI'),
  ('ti.admin', 'Administrar módulo de TI'),
  ('ti.chamados.abrir', 'Abrir chamados de TI'),
  ('ti.chamados.atender', 'Atender chamados de TI'),
  ('ti.ativos.gerenciar', 'Gerenciar ativos de TI'),
  ('ti.contratos.gerenciar', 'Gerenciar licenças e contratos de TI'),
  ('ti.mudancas.gerenciar', 'Gerenciar mudanças de TI'),
  ('ti.base.gerenciar', 'Gerenciar base de conhecimento de TI')
on conflict (codigo) do update
set descricao = excluded.descricao,
    ativo = true,
    updated_at = now();

-- Cria o perfil de sistema TI para cada empresa já cadastrada.
insert into public.perfis (empresa_id, nome, sistema, ativo)
select distinct p.empresa_id, 'TI', true, true
from public.perfis p
where not exists (
  select 1
  from public.perfis existente
  where existente.empresa_id = p.empresa_id
    and lower(existente.nome) = 'ti'
);

insert into public.perfil_permissoes (perfil_id, permissao_id)
select perfil.id, permissao.id
from public.perfis perfil
join public.permissoes permissao
  on permissao.codigo in (
    'ti.visualizar',
    'ti.admin',
    'ti.chamados.abrir',
    'ti.chamados.atender',
    'ti.ativos.gerenciar',
    'ti.contratos.gerenciar',
    'ti.mudancas.gerenciar',
    'ti.base.gerenciar'
  )
where lower(perfil.nome) = 'ti'
  and perfil.ativo = true
  and not exists (
    select 1
    from public.perfil_permissoes pp
    where pp.perfil_id = perfil.id
      and pp.permissao_id = permissao.id
  );

alter table public.ti_ativos enable row level security;
alter table public.ti_chamados enable row level security;
alter table public.ti_chamado_interacoes enable row level security;
alter table public.ti_licencas_contratos enable row level security;
alter table public.ti_mudancas enable row level security;
alter table public.ti_base_conhecimento enable row level security;
alter table public.ti_monitoramentos enable row level security;

-- Remove políticas anteriores para evitar regras permissivas acumuladas.
drop policy if exists ti_ativos_all on public.ti_ativos;
drop policy if exists ti_ativos_select on public.ti_ativos;
drop policy if exists ti_ativos_insert on public.ti_ativos;
drop policy if exists ti_ativos_update on public.ti_ativos;
drop policy if exists ti_ativos_delete on public.ti_ativos;

create policy ti_ativos_select on public.ti_ativos
for select using (
  public.tem_unidade(empresa_id, unidade_id)
  and (
    public.tem_permissao(empresa_id, unidade_id, 'ti.visualizar')
    or public.tem_permissao(empresa_id, unidade_id, 'ti.chamados.abrir')
  )
);
create policy ti_ativos_insert on public.ti_ativos
for insert with check (
  public.tem_unidade(empresa_id, unidade_id)
  and public.tem_permissao(empresa_id, unidade_id, 'ti.ativos.gerenciar')
);
create policy ti_ativos_update on public.ti_ativos
for update using (
  public.tem_unidade(empresa_id, unidade_id)
  and public.tem_permissao(empresa_id, unidade_id, 'ti.ativos.gerenciar')
) with check (
  public.tem_unidade(empresa_id, unidade_id)
  and public.tem_permissao(empresa_id, unidade_id, 'ti.ativos.gerenciar')
);
create policy ti_ativos_delete on public.ti_ativos
for delete using (
  public.tem_unidade(empresa_id, unidade_id)
  and public.tem_permissao(empresa_id, unidade_id, 'ti.admin')
);

drop policy if exists ti_chamados_all on public.ti_chamados;
drop policy if exists ti_chamados_select on public.ti_chamados;
drop policy if exists ti_chamados_insert on public.ti_chamados;
drop policy if exists ti_chamados_update on public.ti_chamados;

create policy ti_chamados_select on public.ti_chamados
for select using (
  public.tem_unidade(empresa_id, unidade_id)
  and (
    public.tem_permissao(empresa_id, unidade_id, 'ti.visualizar')
    or public.tem_permissao(empresa_id, unidade_id, 'ti.chamados.abrir')
    or solicitante_usuario_id = auth.uid()
  )
);
create policy ti_chamados_insert on public.ti_chamados
for insert with check (
  public.tem_unidade(empresa_id, unidade_id)
  and public.tem_permissao(empresa_id, unidade_id, 'ti.chamados.abrir')
  and solicitante_usuario_id = auth.uid()
);
create policy ti_chamados_update on public.ti_chamados
for update using (
  public.tem_unidade(empresa_id, unidade_id)
  and public.tem_permissao(empresa_id, unidade_id, 'ti.chamados.atender')
) with check (
  public.tem_unidade(empresa_id, unidade_id)
  and public.tem_permissao(empresa_id, unidade_id, 'ti.chamados.atender')
);

drop policy if exists ti_chamado_interacoes_all on public.ti_chamado_interacoes;
drop policy if exists ti_chamado_interacoes_select on public.ti_chamado_interacoes;
drop policy if exists ti_chamado_interacoes_insert on public.ti_chamado_interacoes;

create policy ti_chamado_interacoes_select on public.ti_chamado_interacoes
for select using (
  exists (
    select 1
    from public.ti_chamados c
    where c.id = chamado_id
      and public.tem_unidade(c.empresa_id, c.unidade_id)
      and (
        public.tem_permissao(c.empresa_id, c.unidade_id, 'ti.visualizar')
        or c.solicitante_usuario_id = auth.uid()
      )
  )
);
create policy ti_chamado_interacoes_insert on public.ti_chamado_interacoes
for insert with check (
  autor_usuario_id = auth.uid()
  and exists (
    select 1
    from public.ti_chamados c
    where c.id = chamado_id
      and public.tem_unidade(c.empresa_id, c.unidade_id)
      and (
        public.tem_permissao(c.empresa_id, c.unidade_id, 'ti.chamados.atender')
        or c.solicitante_usuario_id = auth.uid()
      )
  )
);

drop policy if exists ti_licencas_contratos_all on public.ti_licencas_contratos;
drop policy if exists ti_licencas_contratos_select on public.ti_licencas_contratos;
drop policy if exists ti_licencas_contratos_write on public.ti_licencas_contratos;
create policy ti_licencas_contratos_select on public.ti_licencas_contratos
for select using (
  public.tem_unidade(empresa_id, unidade_id)
  and public.tem_permissao(empresa_id, unidade_id, 'ti.visualizar')
);
create policy ti_licencas_contratos_write on public.ti_licencas_contratos
for all using (
  public.tem_unidade(empresa_id, unidade_id)
  and public.tem_permissao(empresa_id, unidade_id, 'ti.contratos.gerenciar')
) with check (
  public.tem_unidade(empresa_id, unidade_id)
  and public.tem_permissao(empresa_id, unidade_id, 'ti.contratos.gerenciar')
);

drop policy if exists ti_mudancas_all on public.ti_mudancas;
drop policy if exists ti_mudancas_select on public.ti_mudancas;
drop policy if exists ti_mudancas_write on public.ti_mudancas;
create policy ti_mudancas_select on public.ti_mudancas
for select using (
  public.tem_unidade(empresa_id, unidade_id)
  and public.tem_permissao(empresa_id, unidade_id, 'ti.visualizar')
);
create policy ti_mudancas_write on public.ti_mudancas
for all using (
  public.tem_unidade(empresa_id, unidade_id)
  and public.tem_permissao(empresa_id, unidade_id, 'ti.mudancas.gerenciar')
) with check (
  public.tem_unidade(empresa_id, unidade_id)
  and public.tem_permissao(empresa_id, unidade_id, 'ti.mudancas.gerenciar')
);

drop policy if exists ti_base_conhecimento_all on public.ti_base_conhecimento;
drop policy if exists ti_base_conhecimento_select on public.ti_base_conhecimento;
drop policy if exists ti_base_conhecimento_write on public.ti_base_conhecimento;
create policy ti_base_conhecimento_select on public.ti_base_conhecimento
for select using (
  public.tem_unidade(empresa_id, unidade_id)
  and (
    publicado = true
    or public.tem_permissao(empresa_id, unidade_id, 'ti.base.gerenciar')
  )
);
create policy ti_base_conhecimento_write on public.ti_base_conhecimento
for all using (
  public.tem_unidade(empresa_id, unidade_id)
  and public.tem_permissao(empresa_id, unidade_id, 'ti.base.gerenciar')
) with check (
  public.tem_unidade(empresa_id, unidade_id)
  and public.tem_permissao(empresa_id, unidade_id, 'ti.base.gerenciar')
);

drop policy if exists ti_monitoramentos_all on public.ti_monitoramentos;
drop policy if exists ti_monitoramentos_select on public.ti_monitoramentos;
drop policy if exists ti_monitoramentos_write on public.ti_monitoramentos;
create policy ti_monitoramentos_select on public.ti_monitoramentos
for select using (
  public.tem_unidade(empresa_id, unidade_id)
  and public.tem_permissao(empresa_id, unidade_id, 'ti.visualizar')
);
create policy ti_monitoramentos_write on public.ti_monitoramentos
for all using (
  public.tem_unidade(empresa_id, unidade_id)
  and public.tem_permissao(empresa_id, unidade_id, 'ti.admin')
) with check (
  public.tem_unidade(empresa_id, unidade_id)
  and public.tem_permissao(empresa_id, unidade_id, 'ti.admin')
);
