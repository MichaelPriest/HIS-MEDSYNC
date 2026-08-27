revoke all on function public.dispensar_medicamento_prescricao(uuid,uuid,numeric) from public, anon;
revoke all on function public.dispensar_componente_prescricao(uuid,uuid,numeric) from public, anon;
revoke all on function public.devolver_medicamento_dispensacao(uuid,numeric,text) from public, anon;
revoke all on function public.dispensar_medicamento_prescricao_fefo(uuid,numeric,uuid) from public, anon;
revoke all on function public.dispensar_componente_prescricao_fefo(uuid,numeric,uuid) from public, anon;
revoke all on function public.registrar_conciliacao_medicamentosa(uuid,text,text,text,text,text,text,text,uuid,text,boolean,text,text) from public, anon;
revoke all on function public.registrar_administracao_beira_leito(uuid,uuid,text,text,text,text,text,text,boolean,uuid) from public, anon;

grant execute on function public.dispensar_medicamento_prescricao(uuid,uuid,numeric) to authenticated;
grant execute on function public.dispensar_componente_prescricao(uuid,uuid,numeric) to authenticated;
grant execute on function public.devolver_medicamento_dispensacao(uuid,numeric,text) to authenticated;
grant execute on function public.dispensar_medicamento_prescricao_fefo(uuid,numeric,uuid) to authenticated;
grant execute on function public.dispensar_componente_prescricao_fefo(uuid,numeric,uuid) to authenticated;
grant execute on function public.registrar_conciliacao_medicamentosa(uuid,text,text,text,text,text,text,text,uuid,text,boolean,text,text) to authenticated;
grant execute on function public.registrar_administracao_beira_leito(uuid,uuid,text,text,text,text,text,text,boolean,uuid) to authenticated;
