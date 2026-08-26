create or replace function public.validar_complementar_admissao_tiss_internal(
  p_atendimento_id uuid,
  p_payload jsonb,
  p_retorno jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path to 'public','pg_catalog'
as $function$
declare
  v_at public.atendimentos%rowtype;
  v_prof public.profissionais%rowtype;
  v_un public.unidades%rowtype;
  v_plano public.convenio_planos%rowtype;
  v_regime text := nullif(btrim(coalesce(p_payload->>'regime_atendimento','')),'');
  v_tipo_tiss text := nullif(btrim(coalesce(p_payload->>'tipo_atendimento_tiss','')),'');
  v_tuss50_codigo text := nullif(btrim(coalesce(p_payload->>'tipo_atendimento_tuss50_codigo','')),'');
  v_tuss52_codigo text := nullif(btrim(coalesce(p_payload->>'tipo_consulta_tuss52_codigo','')),'');
  v_tuss50_conceito_id uuid;
  v_tuss50_display text;
  v_tuss50_versao text;
  v_tuss50_canonical text;
  v_tuss52_conceito_id uuid;
  v_tuss52_display text;
  v_tuss52_versao text;
  v_tuss52_canonical text;
  v_codigo text := nullif(btrim(coalesce(p_payload->>'codigo_tuss_principal','')),'');
  v_descricao text := nullif(btrim(coalesce(p_payload->>'descricao_tuss_principal','')),'');
  v_indicacao text := nullif(btrim(coalesce(p_payload->>'indicacao_clinica','')),'');
  v_carteirinha text;
  v_validade date;
  v_retorno_id uuid;
  v_retorno_dias integer;
  v_retorno_alerta boolean := coalesce((p_retorno->>'alerta')::boolean,false);
begin
  select * into v_at from public.atendimentos where id=p_atendimento_id for update;
  if not found then raise exception 'ADMISSAO_ATENDIMENTO_NAO_LOCALIZADO'; end if;
  if auth.uid() is null or not public.tem_unidade(v_at.empresa_id,v_at.unidade_id) then
    raise exception 'ADMISSAO_SEM_PERMISSAO' using errcode='42501';
  end if;

  if v_regime is null or v_regime not in ('ambulatorial','pronto_socorro','internacao','telessaude') then
    raise exception 'ADMISSAO_REGIME_TISS_INVALIDO';
  end if;
  if v_tipo_tiss is null or v_tipo_tiss not in ('consulta','sadt_exames','pequena_cirurgia','sessao_terapia','internacao','outro') then
    raise exception 'ADMISSAO_TIPO_TISS_INVALIDO';
  end if;

  if v_at.profissional_id is not null then
    select * into v_prof from public.profissionais where id=v_at.profissional_id and empresa_id=v_at.empresa_id and ativo;
  end if;
  select * into v_un from public.unidades where id=v_at.unidade_id;

  if v_at.cobertura::text='convenio' and v_tuss50_codigo is null then
    raise exception 'ADMISSAO_TUSS50_OBRIGATORIO';
  end if;

  if v_tuss50_codigo is not null then
    select conceito_id,display,versao,canonical
      into v_tuss50_conceito_id,v_tuss50_display,v_tuss50_versao,v_tuss50_canonical
    from public.ans_fhir_dominios_ativos
    where tabela=50 and codigo=v_tuss50_codigo;
    if not found then raise exception 'ADMISSAO_TUSS50_INVALIDO'; end if;
  end if;

  if v_at.cobertura::text='convenio' and v_tuss50_codigo='04' and v_tuss52_codigo is null then
    raise exception 'ADMISSAO_TUSS52_OBRIGATORIO';
  end if;

  if v_tuss52_codigo is not null then
    select conceito_id,display,versao,canonical
      into v_tuss52_conceito_id,v_tuss52_display,v_tuss52_versao,v_tuss52_canonical
    from public.ans_fhir_dominios_ativos
    where tabela=52 and codigo=v_tuss52_codigo;
    if not found then raise exception 'ADMISSAO_TUSS52_INVALIDO'; end if;
  end if;

  if v_at.cobertura::text='convenio' then
    if v_at.profissional_id is null then raise exception 'ADMISSAO_PROFISSIONAL_OBRIGATORIO_CONVENIO'; end if;
    if nullif(btrim(coalesce(v_prof.conselho,'')),'') is null or nullif(btrim(coalesce(v_prof.numero_conselho,'')),'') is null or nullif(btrim(coalesce(v_prof.uf_conselho,'')),'') is null then
      raise exception 'ADMISSAO_CONSELHO_INCOMPLETO';
    end if;
    if nullif(btrim(coalesce(v_prof.cbo,'')),'') is null then raise exception 'ADMISSAO_CBO_AUSENTE'; end if;
    if nullif(btrim(coalesce(v_un.cnes,'')),'') is null then raise exception 'ADMISSAO_CNES_AUSENTE'; end if;
    if nullif(btrim(coalesce(v_at.registro_ans_snapshot,'')),'') is null then raise exception 'ADMISSAO_REGISTRO_ANS_AUSENTE'; end if;

    select * into v_plano from public.convenio_planos where id=v_at.plano_id and convenio_id=v_at.convenio_id and ativo;
    v_carteirinha := coalesce(v_at.numero_carteirinha,'');
    v_validade := v_at.validade_carteirinha;
    if v_plano.exige_validade_carteirinha and v_validade is null then raise exception 'ADMISSAO_VALIDADE_CARTEIRA_OBRIGATORIA'; end if;
    if v_validade is not null and v_validade < current_date then raise exception 'ADMISSAO_CARTEIRA_VENCIDA'; end if;
    if nullif(v_plano.carteirinha_regex,'') is not null then
      begin
        if not (v_carteirinha ~ v_plano.carteirinha_regex) then raise exception 'ADMISSAO_CARTEIRINHA_PADRAO_INVALIDO'; end if;
      exception when invalid_regular_expression then
        raise exception 'ADMISSAO_CONFIG_CARTEIRINHA_REGEX_INVALIDA';
      end;
    end if;
  end if;

  if v_tipo_tiss in ('consulta','sadt_exames','pequena_cirurgia','sessao_terapia') and v_codigo is null then
    raise exception 'ADMISSAO_TUSS_OBRIGATORIO';
  end if;
  if v_tipo_tiss in ('sadt_exames','pequena_cirurgia','sessao_terapia') and v_indicacao is null then
    raise exception 'ADMISSAO_INDICACAO_OBRIGATORIA';
  end if;

  if v_codigo is not null and not exists (
    select 1 from public.itens_assistenciais i
     where i.empresa_id=v_at.empresa_id and i.ativo and i.categoria='procedimento'
       and (i.codigo_tuss=v_codigo or i.codigo_tabela_propria=v_codigo)
  ) and v_codigo not in ('10101012','10101039','10102019') then
    raise exception 'ADMISSAO_TUSS_NAO_CADASTRADO';
  end if;

  begin v_retorno_id := nullif(p_retorno->>'atendimento_id','')::uuid; exception when invalid_text_representation then v_retorno_id:=null; end;
  begin v_retorno_dias := nullif(p_retorno->>'dias','')::integer; exception when invalid_text_representation then v_retorno_dias:=null; end;

  update public.atendimentos set
    regime_atendimento=v_regime,
    tipo_atendimento_tiss=v_tipo_tiss,
    tipo_atendimento_tuss50_conceito_id=v_tuss50_conceito_id,
    tipo_atendimento_tuss50_codigo=v_tuss50_codigo,
    tipo_atendimento_tuss50_descricao=v_tuss50_display,
    tipo_atendimento_tuss50_versao=v_tuss50_versao,
    tipo_atendimento_tuss50_canonical=v_tuss50_canonical,
    tipo_consulta_tuss52_conceito_id=v_tuss52_conceito_id,
    tipo_consulta_tuss52_codigo=v_tuss52_codigo,
    tipo_consulta_tuss52_descricao=v_tuss52_display,
    tipo_consulta_tuss52_versao=v_tuss52_versao,
    tipo_consulta_tuss52_canonical=v_tuss52_canonical,
    codigo_tuss_principal=v_codigo,
    descricao_tuss_principal=v_descricao,
    indicacao_clinica=v_indicacao,
    retorno_alerta_30_dias=v_retorno_alerta,
    retorno_atendimento_referencia_id=v_retorno_id,
    retorno_dias=v_retorno_dias,
    updated_at=now(),updated_by=auth.uid()
  where id=v_at.id;

  return v_at.id;
end
$function$;

revoke all on function public.validar_complementar_admissao_tiss_internal(uuid,jsonb,jsonb) from public,anon,authenticated;
