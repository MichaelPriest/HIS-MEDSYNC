begin;

-- Catálogos globais expostos pela Data API: leitura autenticada e escrita somente por administradores.
alter table public.tiss_versoes enable row level security;
alter table public.tipos_profissional enable row level security;

revoke all on public.tiss_versoes from anon;
revoke all on public.tipos_profissional from anon;
revoke insert, update, delete on public.tiss_versoes from authenticated;
revoke insert, update, delete on public.tipos_profissional from authenticated;
grant select on public.tiss_versoes to authenticated;
grant select on public.tipos_profissional to authenticated;

drop policy if exists tiss_versoes_select on public.tiss_versoes;
create policy tiss_versoes_select on public.tiss_versoes
for select to authenticated using (true);

drop policy if exists tipos_profissional_select on public.tipos_profissional;
create policy tipos_profissional_select on public.tipos_profissional
for select to authenticated using (true);

-- RPCs SECURITY DEFINER internas não podem herdar EXECUTE de PUBLIC/anon.
revoke execute on function public.auditar_precos_conta_medica(uuid) from public, anon;
revoke execute on function public.calcular_preco_central_guia(uuid) from public, anon;
revoke execute on function public.encaminhar_conta_para_auditoria(uuid) from public, anon;
revoke execute on function public.gerar_checklist_conta_medica(uuid) from public, anon;
revoke execute on function public.liberar_auditoria_conta(uuid,text) from public, anon;
revoke execute on function public.liberar_conta_medica(uuid) from public, anon;
revoke execute on function public.obter_valor_procedimento_contratual(uuid,text,date,text,boolean,boolean) from public, anon;
revoke execute on function public.recalcular_conta_contratual_avancada(uuid) from public, anon;
revoke execute on function public.recalcular_item_contratual_avancado(uuid) from public, anon;
revoke execute on function public.validar_checklist_conta_medica(uuid) from public, anon;

grant execute on function public.auditar_precos_conta_medica(uuid) to authenticated;
grant execute on function public.calcular_preco_central_guia(uuid) to authenticated;
grant execute on function public.encaminhar_conta_para_auditoria(uuid) to authenticated;
grant execute on function public.gerar_checklist_conta_medica(uuid) to authenticated;
grant execute on function public.liberar_auditoria_conta(uuid,text) to authenticated;
grant execute on function public.liberar_conta_medica(uuid) to authenticated;
grant execute on function public.obter_valor_procedimento_contratual(uuid,text,date,text,boolean,boolean) to authenticated;
grant execute on function public.recalcular_conta_contratual_avancada(uuid) to authenticated;
grant execute on function public.recalcular_item_contratual_avancado(uuid) to authenticated;
grant execute on function public.validar_checklist_conta_medica(uuid) to authenticated;

-- Funções de trigger não devem ser endpoints RPC chamáveis.
revoke all on function public.criar_contas_medicas_pos_auditoria() from public, anon, authenticated;
revoke all on function public.sincronizar_permissao_administradores_sistema() from public, anon, authenticated;

-- Totem e painel são APIs públicas intencionais, mas sem herança implícita de PUBLIC.
revoke execute on function public.consultar_paciente_totem(uuid,text) from public;
revoke execute on function public.emitir_senha_totem(uuid,text,public.prioridade_senha) from public;
revoke execute on function public.emitir_senha_totem_v2(uuid,text,text,text) from public;
revoke execute on function public.listar_painel_chamadas(uuid) from public;
grant execute on function public.consultar_paciente_totem(uuid,text) to anon, authenticated;
grant execute on function public.emitir_senha_totem(uuid,text,public.prioridade_senha) to anon, authenticated;
grant execute on function public.emitir_senha_totem_v2(uuid,text,text,text) to anon, authenticated;
grant execute on function public.listar_painel_chamadas(uuid) to anon, authenticated;

-- search_path explícito nas funções apontadas pelo advisor.
alter function public.nome_painel_chamada(text) set search_path = public, pg_catalog;
alter function public.obter_valor_comercial(uuid,text,date,text) set search_path = public, pg_catalog;
alter function public.obter_valor_procedimento_comercial(uuid,text,date,text,boolean,text) set search_path = public, pg_catalog;
alter function public.aplicar_precificacao_item_conta() set search_path = public, pg_catalog;
alter function public.aplicar_precificacao_item_guia() set search_path = public, pg_catalog;

commit;
