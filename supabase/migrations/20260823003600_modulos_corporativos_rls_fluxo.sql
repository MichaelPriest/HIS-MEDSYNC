begin;

-- Políticas de escrita/leitura completas dos módulos corporativos.
create policy fornecedores_insert on public.fornecedores for insert with check (public.tem_empresa(empresa_id) and created_by=auth.uid());
create policy fornecedores_update on public.fornecedores for update using (public.tem_empresa(empresa_id)) with check (public.tem_empresa(empresa_id) and updated_by=auth.uid());
create policy estoque_produtos_insert on public.estoque_produtos for insert with check (public.tem_empresa(empresa_id) and created_by=auth.uid());
create policy estoque_produtos_update on public.estoque_produtos for update using (public.tem_empresa(empresa_id)) with check (public.tem_empresa(empresa_id) and updated_by=auth.uid());
create policy estoque_locais_write on public.estoque_locais for all using (public.tem_unidade(empresa_id,unidade_id)) with check (public.tem_unidade(empresa_id,unidade_id));
create policy estoque_lotes_write on public.estoque_lotes for all using (public.tem_unidade(empresa_id,unidade_id)) with check (public.tem_unidade(empresa_id,unidade_id));
create policy estoque_movimentos_insert on public.estoque_movimentos for insert with check (public.tem_unidade(empresa_id,unidade_id) and created_by=auth.uid());
create policy compras_solicitacoes_write on public.compras_solicitacoes for all using (public.tem_unidade(empresa_id,unidade_id)) with check (public.tem_unidade(empresa_id,unidade_id));
create policy compras_pedidos_write on public.compras_pedidos for all using (public.tem_unidade(empresa_id,unidade_id)) with check (public.tem_unidade(empresa_id,unidade_id));
create policy auditoria_contas_write on public.auditoria_contas for all using (public.tem_unidade(empresa_id,unidade_id)) with check (public.tem_unidade(empresa_id,unidade_id));
create policy central_guias_write on public.central_guias for all using (public.tem_unidade(empresa_id,unidade_id)) with check (public.tem_unidade(empresa_id,unidade_id));
create policy credenciamento_contratos_write on public.credenciamento_contratos for all using (public.tem_empresa(empresa_id)) with check (public.tem_empresa(empresa_id));

alter table public.compras_solicitacao_itens enable row level security;
alter table public.compras_pedido_itens enable row level security;
create policy compras_solicitacao_itens_select on public.compras_solicitacao_itens for select using (exists(select 1 from public.compras_solicitacoes s where s.id=solicitacao_id and public.tem_unidade(s.empresa_id,s.unidade_id)));
create policy compras_solicitacao_itens_write on public.compras_solicitacao_itens for all using (exists(select 1 from public.compras_solicitacoes s where s.id=solicitacao_id and public.tem_unidade(s.empresa_id,s.unidade_id))) with check (exists(select 1 from public.compras_solicitacoes s where s.id=solicitacao_id and public.tem_unidade(s.empresa_id,s.unidade_id)));
create policy compras_pedido_itens_select on public.compras_pedido_itens for select using (exists(select 1 from public.compras_pedidos p where p.id=pedido_id and public.tem_unidade(p.empresa_id,p.unidade_id)));
create policy compras_pedido_itens_write on public.compras_pedido_itens for all using (exists(select 1 from public.compras_pedidos p where p.id=pedido_id and public.tem_unidade(p.empresa_id,p.unidade_id))) with check (exists(select 1 from public.compras_pedidos p where p.id=pedido_id and public.tem_unidade(p.empresa_id,p.unidade_id)));
create policy auditoria_conta_itens_select on public.auditoria_conta_itens for select using (exists(select 1 from public.auditoria_contas a where a.id=auditoria_id and public.tem_unidade(a.empresa_id,a.unidade_id)));
create policy auditoria_conta_itens_write on public.auditoria_conta_itens for all using (exists(select 1 from public.auditoria_contas a where a.id=auditoria_id and public.tem_unidade(a.empresa_id,a.unidade_id))) with check (exists(select 1 from public.auditoria_contas a where a.id=auditoria_id and public.tem_unidade(a.empresa_id,a.unidade_id)));
create policy credenciamento_tabelas_select on public.credenciamento_tabelas for select using (exists(select 1 from public.credenciamento_contratos c where c.id=contrato_id and public.tem_empresa(c.empresa_id)));
create policy credenciamento_tabelas_write on public.credenciamento_tabelas for all using (exists(select 1 from public.credenciamento_contratos c where c.id=contrato_id and public.tem_empresa(c.empresa_id))) with check (exists(select 1 from public.credenciamento_contratos c where c.id=contrato_id and public.tem_empresa(c.empresa_id)));
create policy credenciamento_tabela_itens_select on public.credenciamento_tabela_itens for select using (exists(select 1 from public.credenciamento_tabelas t join public.credenciamento_contratos c on c.id=t.contrato_id where t.id=tabela_id and public.tem_empresa(c.empresa_id)));
create policy credenciamento_tabela_itens_write on public.credenciamento_tabela_itens for all using (exists(select 1 from public.credenciamento_tabelas t join public.credenciamento_contratos c on c.id=t.contrato_id where t.id=tabela_id and public.tem_empresa(c.empresa_id))) with check (exists(select 1 from public.credenciamento_tabelas t join public.credenciamento_contratos c on c.id=t.contrato_id where t.id=tabela_id and public.tem_empresa(c.empresa_id)));

-- Ao encerrar/alta, a conta entra obrigatoriamente em auditoria antes do faturamento.
create or replace function public.encaminhar_conta_para_auditoria(p_atendimento_id uuid)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_at public.atendimentos%rowtype;
  v_conta_id uuid;
  v_auditoria_id uuid;
begin
  select * into v_at from public.atendimentos where id=p_atendimento_id;
  if v_at.id is null then raise exception 'Atendimento não encontrado'; end if;
  if not public.tem_unidade(v_at.empresa_id,v_at.unidade_id) then raise exception 'Sem acesso à unidade'; end if;
  select id into v_conta_id from public.contas_faturamento where atendimento_id=p_atendimento_id limit 1;
  insert into public.auditoria_contas(empresa_id,unidade_id,atendimento_id,conta_id,status)
  values(v_at.empresa_id,v_at.unidade_id,p_atendimento_id,v_conta_id,'aguardando')
  on conflict(atendimento_id) do update set conta_id=coalesce(excluded.conta_id,public.auditoria_contas.conta_id),updated_at=now()
  returning id into v_auditoria_id;
  if v_conta_id is not null then update public.contas_faturamento set auditoria_liberada=false,auditoria_id=v_auditoria_id where id=v_conta_id; end if;
  return v_auditoria_id;
end $$;

grant execute on function public.encaminhar_conta_para_auditoria(uuid) to authenticated;

create or replace function public.liberar_auditoria_conta(p_auditoria_id uuid,p_observacoes text default null)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare v_a public.auditoria_contas%rowtype;
begin
  select * into v_a from public.auditoria_contas where id=p_auditoria_id;
  if v_a.id is null or not public.tem_unidade(v_a.empresa_id,v_a.unidade_id) then raise exception 'Auditoria não encontrada ou sem acesso'; end if;
  if exists(select 1 from public.auditoria_conta_itens where auditoria_id=p_auditoria_id and not resolvida and severidade in ('erro','bloqueio')) then raise exception 'Existem pendências impeditivas'; end if;
  update public.auditoria_contas set status='liberada',auditor_id=auth.uid(),finalizado_em=now(),observacoes=coalesce(p_observacoes,observacoes),updated_at=now() where id=p_auditoria_id;
  if v_a.conta_id is not null then update public.contas_faturamento set auditoria_liberada=true,auditoria_id=p_auditoria_id,updated_at=now(),updated_by=auth.uid() where id=v_a.conta_id; end if;
end $$;

grant execute on function public.liberar_auditoria_conta(uuid,text) to authenticated;

commit;
