create or replace function public.criar_guia_tiss_conta_transacional(p_conta_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user uuid:=auth.uid();
  v_conta public.contas_faturamento%rowtype;
  v_at public.atendimentos%rowtype;
  v_conv public.convenios%rowtype;
  v_versao uuid;
  v_guia uuid;
  v_existente uuid;
  v_numero text;
  v_tipo text;
  v_validacao jsonb;
  v_data timestamptz;
begin
  if v_user is null then raise exception 'TISS_GUIA_NAO_AUTENTICADO' using errcode='42501'; end if;
  select * into v_conta from public.contas_faturamento where id=p_conta_id for update;
  if not found then raise exception 'TISS_CONTA_NAO_LOCALIZADA' using errcode='P0002'; end if;
  if not public.tem_unidade(v_conta.empresa_id,v_conta.unidade_id) or not public.tem_permissao(v_conta.empresa_id,v_conta.unidade_id,'tiss.gerar') then
    raise exception 'TISS_GUIA_SEM_PERMISSAO' using errcode='42501';
  end if;
  if v_conta.tipo_cobranca<>'convenio' or v_conta.convenio_id is null then raise exception 'TISS_CONTA_NAO_CONVENIO'; end if;
  if v_conta.status<>'pronta' or not coalesce(v_conta.auditoria_liberada,false) or not coalesce(v_conta.contas_medicas_liberada,false) then
    raise exception 'TISS_CONTA_NAO_LIBERADA';
  end if;
  if exists(select 1 from public.conta_faturamento_criticas c where c.conta_id=v_conta.id and not c.resolvida and c.severidade='erro') then raise exception 'TISS_CONTA_COM_CRITICAS'; end if;

  select id into v_existente from public.tiss_guias where conta_id=v_conta.id and status<>'cancelada' order by created_at desc limit 1 for update;
  if v_existente is not null then
    return jsonb_build_object('guia_id',v_existente,'existente',true,'validacao',public.validar_guia_tiss_internal(v_existente));
  end if;

  select * into v_at from public.atendimentos where id=v_conta.atendimento_id;
  if not found then raise exception 'TISS_ATENDIMENTO_NAO_LOCALIZADO'; end if;
  select * into v_conv from public.convenios where id=v_conta.convenio_id and empresa_id=v_conta.empresa_id;
  if not found then raise exception 'TISS_CONVENIO_INVALIDO'; end if;
  select id into v_versao from public.tiss_versoes where ativo order by vigente_desde desc nulls last,created_at desc,id limit 1;
  if v_versao is null then raise exception 'TISS_VERSAO_INDISPONIVEL'; end if;
  if v_at.tipo_atendimento_tuss50_codigo is null or (v_at.tipo_atendimento_tuss50_codigo='04' and v_at.tipo_consulta_tuss52_codigo is null) then raise exception 'TISS_DOMINIO_ANS_INCOMPLETO'; end if;

  v_tipo:=case when exists(select 1 from public.internacoes i where i.atendimento_id=v_conta.atendimento_id) then 'resumo_internacao'
               when v_at.tipo_atendimento_tuss50_codigo='04' then 'consulta' else 'sp_sadt' end;
  v_numero:='G'||to_char(current_date,'YYYYMMDD')||'-'||lpad(nextval('public.tiss_guia_numero_seq')::text,8,'0');
  v_data:=coalesce(v_at.data_abertura,now());

  insert into public.tiss_guias(
    empresa_id,unidade_id,conta_id,atendimento_id,paciente_id,convenio_id,plano_id,profissional_id,versao_id,tipo_guia,
    numero_guia_prestador,numero_guia_operadora,registro_ans,numero_carteirinha,validade_carteirinha,senha_autorizacao,
    atendimento_rn,tipo_atendimento,tipo_atendimento_tuss50_codigo,tipo_atendimento_tuss50_descricao,tipo_atendimento_tuss50_versao,tipo_atendimento_tuss50_canonical,
    tipo_consulta_tuss52_codigo,tipo_consulta_tuss52_descricao,tipo_consulta_tuss52_versao,tipo_consulta_tuss52_canonical,
    data_atendimento,hora_inicio,status,valor_total,created_by,updated_by
  ) values (
    v_conta.empresa_id,v_conta.unidade_id,v_conta.id,v_conta.atendimento_id,v_conta.paciente_id,v_conta.convenio_id,v_conta.plano_id,v_at.profissional_id,v_versao,v_tipo,
    v_numero,v_at.numero_autorizacao,v_conv.registro_ans,v_at.numero_carteirinha,v_at.validade_carteirinha,v_at.senha_autorizacao,
    coalesce(v_at.atendimento_rn,false),v_at.tipo_atendimento,v_at.tipo_atendimento_tuss50_codigo,v_at.tipo_atendimento_tuss50_descricao,v_at.tipo_atendimento_tuss50_versao,v_at.tipo_atendimento_tuss50_canonical,
    v_at.tipo_consulta_tuss52_codigo,v_at.tipo_consulta_tuss52_descricao,v_at.tipo_consulta_tuss52_versao,v_at.tipo_consulta_tuss52_canonical,
    v_data::date,v_data::time,'rascunho',coalesce(v_conta.valor_liquido,0),v_user,v_user
  ) returning id into v_guia;

  insert into public.tiss_guia_itens(
    guia_id,sequencial,data_execucao,tabela,codigo_procedimento,descricao,quantidade,reducao_acrescimo,valor_unitario,valor_total
  )
  select v_guia,row_number() over(order by i.data_execucao nulls last,i.created_at,i.id)::integer,
         coalesce(i.data_execucao::date,v_data::date),i.tabela,i.codigo,i.descricao,i.quantidade,
         round((1 + coalesce(i.percentual_reducao_acrescimo,0)/100)::numeric,2),i.valor_unitario,i.valor_total
  from public.conta_faturamento_itens i
  where i.conta_id=v_conta.id and coalesce(i.cobravel,true)
  order by i.data_execucao nulls last,i.created_at,i.id;
  if not found then raise exception 'TISS_CONTA_SEM_ITENS_FATURAVEIS'; end if;

  v_validacao:=public.validar_guia_tiss_internal(v_guia);
  perform public.registrar_integracao_evento_internal(v_conta.empresa_id,v_conta.unidade_id,v_conta.atendimento_id,v_conta.paciente_id,'tiss.guia_criada','tiss_guias',v_guia,now(),jsonb_build_object('conta_id',v_conta.id,'tipo_guia',v_tipo,'numero_guia_prestador',v_numero,'status',v_validacao->>'status'));
  if v_validacao->>'status'='pronta' then
    perform public.registrar_integracao_evento_internal(v_conta.empresa_id,v_conta.unidade_id,v_conta.atendimento_id,v_conta.paciente_id,'tiss.guia_pronta','tiss_guias',v_guia,now(),jsonb_build_object('conta_id',v_conta.id,'numero_guia_prestador',v_numero));
  end if;
  return jsonb_build_object('guia_id',v_guia,'existente',false,'validacao',v_validacao);
end
$function$;

revoke all on function public.criar_guia_tiss_conta_transacional(uuid) from public,anon;
grant execute on function public.criar_guia_tiss_conta_transacional(uuid) to authenticated;
