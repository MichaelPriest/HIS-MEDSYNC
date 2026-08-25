-- Hardening dos módulos adicionados em agosto/2026.

alter table public.farmacia_catalogo_local enable row level security;
alter table public.farmacia_rotas_setoriais enable row level security;
alter table public.ti_ativos enable row level security;
alter table public.ti_chamados enable row level security;
alter table public.ti_chamado_interacoes enable row level security;
alter table public.ti_licencas_contratos enable row level security;
alter table public.ti_mudancas enable row level security;
alter table public.ti_base_conhecimento enable row level security;
alter table public.ti_monitoramentos enable row level security;
alter table public.auditorias_in_loco enable row level security;
alter table public.auditoria_in_loco_auditores enable row level security;
alter table public.auditoria_in_loco_amostras enable row level security;
alter table public.auditoria_in_loco_documentos enable row level security;
alter table public.auditoria_in_loco_achados enable row level security;
alter table public.auditoria_in_loco_eventos enable row level security;
alter table public.estoque_requisicoes_setoriais enable row level security;
alter table public.estoque_requisicao_setorial_itens enable row level security;
alter table public.estoque_requisicao_setorial_eventos enable row level security;

-- Entidades com empresa/unidade usam o mesmo escopo multi-tenant do restante do HIS.
do $$
declare t text;
begin
  foreach t in array array['farmacia_catalogo_local','farmacia_rotas_setoriais','ti_ativos','ti_chamados','ti_licencas_contratos','ti_mudancas','ti_base_conhecimento','ti_monitoramentos','auditorias_in_loco'] loop
    execute format('drop policy if exists %I_all on public.%I',t,t);
    execute format('create policy %I_all on public.%I for all to authenticated using (public.tem_unidade(empresa_id,unidade_id)) with check (public.tem_unidade(empresa_id,unidade_id))',t,t);
  end loop;
end $$;

drop policy if exists ti_chamado_interacoes_all on public.ti_chamado_interacoes;
create policy ti_chamado_interacoes_all on public.ti_chamado_interacoes for all to authenticated
using (exists(select 1 from public.ti_chamados c where c.id=chamado_id and public.tem_unidade(c.empresa_id,c.unidade_id)))
with check (exists(select 1 from public.ti_chamados c where c.id=chamado_id and public.tem_unidade(c.empresa_id,c.unidade_id)));

do $$
declare t text;
begin
  foreach t in array array['auditoria_in_loco_auditores','auditoria_in_loco_amostras','auditoria_in_loco_documentos','auditoria_in_loco_achados','auditoria_in_loco_eventos'] loop
    execute format('drop policy if exists %I_all on public.%I',t,t);
    execute format('create policy %I_all on public.%I for all to authenticated using (exists(select 1 from public.auditorias_in_loco a where a.id=auditoria_id and public.tem_unidade(a.empresa_id,a.unidade_id))) with check (exists(select 1 from public.auditorias_in_loco a where a.id=auditoria_id and public.tem_unidade(a.empresa_id,a.unidade_id)))',t,t);
  end loop;
end $$;

-- Requisições: leitura direta é permitida dentro da unidade; escrita somente via RPCs.
drop policy if exists estoque_requisicoes_setoriais_all on public.estoque_requisicoes_setoriais;
drop policy if exists estoque_requisicoes_setoriais_select on public.estoque_requisicoes_setoriais;
create policy estoque_requisicoes_setoriais_select on public.estoque_requisicoes_setoriais for select to authenticated using (public.tem_unidade(empresa_id,unidade_id));

drop policy if exists estoque_requisicao_setorial_itens_all on public.estoque_requisicao_setorial_itens;
drop policy if exists estoque_requisicao_setorial_itens_select on public.estoque_requisicao_setorial_itens;
create policy estoque_requisicao_setorial_itens_select on public.estoque_requisicao_setorial_itens for select to authenticated
using (exists(select 1 from public.estoque_requisicoes_setoriais r where r.id=requisicao_id and public.tem_unidade(r.empresa_id,r.unidade_id)));

drop policy if exists estoque_requisicao_setorial_eventos_all on public.estoque_requisicao_setorial_eventos;
drop policy if exists estoque_requisicao_setorial_eventos_select on public.estoque_requisicao_setorial_eventos;
create policy estoque_requisicao_setorial_eventos_select on public.estoque_requisicao_setorial_eventos for select to authenticated
using (exists(select 1 from public.estoque_requisicoes_setoriais r where r.id=requisicao_id and public.tem_unidade(r.empresa_id,r.unidade_id)));

revoke execute on function public.criar_requisicao_setorial(uuid,uuid,uuid,uuid,text,text,jsonb) from anon,public;
revoke execute on function public.atender_requisicao_setorial_item(uuid,uuid,numeric) from anon,public;
revoke execute on function public.receber_requisicao_setorial(uuid) from anon,public;
grant execute on function public.criar_requisicao_setorial(uuid,uuid,uuid,uuid,text,text,jsonb) to authenticated;
grant execute on function public.atender_requisicao_setorial_item(uuid,uuid,numeric) to authenticated;
grant execute on function public.receber_requisicao_setorial(uuid) to authenticated;
