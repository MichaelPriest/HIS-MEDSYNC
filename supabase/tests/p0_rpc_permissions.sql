begin;

select plan(10);

select ok(
  not has_function_privilege('authenticated', 'public.tem_alguma_permissao_funcional(uuid,uuid,text[])', 'EXECUTE'),
  'helper funcional nao e endpoint RPC autenticado'
);

select ok(
  not has_function_privilege('authenticated', 'public.executar_auditoria_conta_automatica_internal(uuid)', 'EXECUTE'),
  'motor interno de auditoria nao e executavel diretamente'
);
select ok(
  has_function_privilege('authenticated', 'public.executar_auditoria_conta_automatica(uuid)', 'EXECUTE'),
  'wrapper autorizado de auditoria permanece chamavel'
);

select ok(
  not has_function_privilege('authenticated', 'public.liberar_conta_medica_internal(uuid)', 'EXECUTE'),
  'liberacao interna de contas medicas nao e executavel diretamente'
);
select ok(
  has_function_privilege('authenticated', 'public.liberar_conta_medica(uuid)', 'EXECUTE'),
  'wrapper autorizado de contas medicas permanece chamavel'
);

select ok(
  not has_function_privilege('authenticated', 'public.recalcular_item_contratual_avancado_internal(uuid)', 'EXECUTE'),
  'motor contratual interno nao e executavel diretamente'
);
select ok(
  has_function_privilege('authenticated', 'public.recalcular_item_contratual_avancado(uuid)', 'EXECUTE'),
  'wrapper autorizado do motor contratual permanece chamavel'
);

select ok(
  not has_function_privilege('authenticated', 'public.calcular_preco_central_guia_internal(uuid)', 'EXECUTE'),
  'calculo interno da central de guias nao e executavel diretamente'
);

select ok(
  not has_function_privilege('authenticated', 'public.validar_schema_his()', 'EXECUTE'),
  'diagnostico de schema nao e endpoint de usuario autenticado'
);
select ok(
  has_function_privilege('service_role', 'public.validar_schema_his()', 'EXECUTE'),
  'service role preserva diagnostico interno do schema'
);

select * from finish();
rollback;
