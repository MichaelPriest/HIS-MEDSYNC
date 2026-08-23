-- Políticas complementares para operação de pré-faturamento/TISS.
create policy conta_criticas_delete on public.conta_faturamento_criticas for delete using (
  exists (select 1 from public.contas_faturamento c where c.id=conta_id and public.tem_unidade(c.empresa_id,c.unidade_id))
);

alter table public.tiss_guia_itens enable row level security;
alter table public.tiss_guia_itens force row level security;
alter table public.tiss_lote_guias enable row level security;
alter table public.tiss_lote_guias force row level security;
alter table public.tiss_xmls enable row level security;
alter table public.tiss_xmls force row level security;
alter table public.tiss_retornos enable row level security;
alter table public.tiss_retornos force row level security;

create policy tiss_guia_itens_select on public.tiss_guia_itens for select using (exists (select 1 from public.tiss_guias g where g.id=guia_id and public.tem_unidade(g.empresa_id,g.unidade_id)));
create policy tiss_guia_itens_insert on public.tiss_guia_itens for insert with check (exists (select 1 from public.tiss_guias g where g.id=guia_id and public.tem_unidade(g.empresa_id,g.unidade_id)));
create policy tiss_lote_guias_select on public.tiss_lote_guias for select using (exists (select 1 from public.tiss_lotes l where l.id=lote_id and public.tem_unidade(l.empresa_id,l.unidade_id)));
create policy tiss_lote_guias_insert on public.tiss_lote_guias for insert with check (exists (select 1 from public.tiss_lotes l where l.id=lote_id and public.tem_unidade(l.empresa_id,l.unidade_id)));
create policy tiss_xmls_select on public.tiss_xmls for select using (
  (lote_id is not null and exists (select 1 from public.tiss_lotes l where l.id=lote_id and public.tem_unidade(l.empresa_id,l.unidade_id))) or
  (guia_id is not null and exists (select 1 from public.tiss_guias g where g.id=guia_id and public.tem_unidade(g.empresa_id,g.unidade_id)))
);
create policy tiss_retornos_select on public.tiss_retornos for select using (
  (lote_id is not null and exists (select 1 from public.tiss_lotes l where l.id=lote_id and public.tem_unidade(l.empresa_id,l.unidade_id))) or
  (guia_id is not null and exists (select 1 from public.tiss_guias g where g.id=guia_id and public.tem_unidade(g.empresa_id,g.unidade_id)))
);
