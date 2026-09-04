create or replace function public.admissao_prontidao_internal(
  p_empresa_id uuid,
  p_unidade_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
declare
  v_bloqueios jsonb := '[]'::jsonb;
  v_alertas jsonb := '[]'::jsonb;
  v_paciente_id uuid;
  v_profissional_id uuid;
  v_convenio_id uuid;
  v_plano_id uuid;
  v_prof public.profissionais%rowtype;
  v_unidade public.unidades%rowtype;
  v_convenio public.convenios%rowtype;
  v_plano public.convenio_planos%rowtype;
  v_ident public.convenio_identificacao_config%rowtype;
  v_cobertura text := lower(btrim(coalesce(p_payload->>'cobertura','particular')));
  v_tipo_interno text := nullif(btrim(coalesce(p_payload->>'tipo_atendimento','')),'');
  v_regime text := nullif(btrim(coalesce(p_payload->>'regime_atendimento','')),'');
  v_finalidade text := nullif(btrim(coalesce(p_payload->>'tipo_atendimento_tiss','')),'');
  v_tipo50 text := nullif(btrim(coalesce(p_payload->>'tipo_atendimento_tuss50_codigo','')),'');
  v_tipo52 text := nullif(btrim(coalesce(p_payload->>'tipo_consulta_tuss52_codigo','')),'');
  v_codigo text := nullif(btrim(coalesce(p_payload->>'codigo_tuss_principal','')),'');
  v_indicacao text := nullif(btrim(coalesce(p_payload->>'indicacao_clinica','')),'');
  v_carteira text := nullif(btrim(coalesce(p_payload->>'numero_carteirinha','')),'');
  v_validade date;
  v_ident_metodo text := nullif(btrim(coalesce(p_payload->>'identificacao_metodo','')),'');
  v_ident_informada boolean := false;
  v_nascimento date;
  v_estado text := upper(btrim(coalesce(p_payload->>'paciente_estado','')));
  v_regex_ok boolean;
  v_metodo_ok boolean;
begin
  begin v_paciente_id := nullif(p_payload->>'paciente_id','')::uuid; exception when others then v_paciente_id := null; end;
  begin v_profissional_id := nullif(p_payload->>'profissional_id','')::uuid; exception when others then v_profissional_id := null; end;
  begin v_convenio_id := nullif(p_payload->>'convenio_id','')::uuid; exception when others then v_convenio_id := null; end;
  begin v_plano_id := nullif(p_payload->>'plano_id','')::uuid; exception when others then v_plano_id := null; end;
  begin v_validade := nullif(p_payload->>'validade_carteirinha','')::date; exception when others then v_validade := null; end;
  begin v_nascimento := nullif(p_payload->>'paciente_data_nascimento','')::date; exception when others then v_nascimento := null; end;
  begin v_ident_informada := coalesce((p_payload->>'identificacao_informada')::boolean,false); exception when others then v_ident_informada := false; end;

  select * into v_unidade
  from public.unidades
  where id=p_unidade_id and empresa_id=p_empresa_id and ativo;

  if not found then
    v_bloqueios := v_bloqueios || jsonb_build_array(jsonb_build_object(
      'codigo','ADMISSAO_UNIDADE_INVALIDA','grupo','estrutura',
      'mensagem','A unidade atual não está disponível para abertura de atendimento.'
    ));
  elsif nullif(btrim(coalesce(v_unidade.cnes,'')),'') is null and v_cobertura='convenio' then
    v_bloqueios := v_bloqueios || jsonb_build_array(jsonb_build_object(
      'codigo','ADMISSAO_CNES_AUSENTE','grupo','estrutura',
      'mensagem','O cadastro da unidade está incompleto para atendimento por convênio.'
    ));
  end if;

  if v_paciente_id is null then
    v_bloqueios := v_bloqueios || jsonb_build_array(jsonb_build_object(
      'codigo','ADMISSAO_PACIENTE_INVALIDO','grupo','paciente',
      'mensagem','Selecione o paciente do atendimento.'
    ));
  elsif not exists (
    select 1 from public.pacientes p
    where p.id=v_paciente_id and p.empresa_id=p_empresa_id and p.ativo
  ) then
    v_bloqueios := v_bloqueios || jsonb_build_array(jsonb_build_object(
      'codigo','ADMISSAO_PACIENTE_INVALIDO','grupo','paciente',
      'mensagem','O paciente selecionado não está disponível para esta admissão.'
    ));
  end if;

  if nullif(btrim(coalesce(p_payload->>'paciente_nome','')),'') is null
     or v_nascimento is null
     or nullif(btrim(coalesce(p_payload->>'paciente_telefone','')),'') is null
     or nullif(btrim(coalesce(p_payload->>'paciente_endereco','')),'') is null
     or nullif(btrim(coalesce(p_payload->>'paciente_numero','')),'') is null
     or nullif(btrim(coalesce(p_payload->>'paciente_bairro','')),'') is null
     or nullif(btrim(coalesce(p_payload->>'paciente_cidade','')),'') is null
     or length(v_estado) <> 2 then
    v_bloqueios := v_bloqueios || jsonb_build_array(jsonb_build_object(
      'codigo','ADMISSAO_CAMPOS_OBRIGATORIOS','grupo','paciente',
      'mensagem','Complete identificação, contato e endereço do paciente antes de abrir o atendimento.'
    ));
  end if;

  if v_tipo_interno is null then
    v_bloqueios := v_bloqueios || jsonb_build_array(jsonb_build_object(
      'codigo','ADMISSAO_TIPO_INTERNO_AUSENTE','grupo','atendimento',
      'mensagem','Selecione o fluxo assistencial deste atendimento.'
    ));
  end if;

  if v_cobertura not in ('particular','convenio') then
    v_bloqueios := v_bloqueios || jsonb_build_array(jsonb_build_object(
      'codigo','ADMISSAO_COBERTURA_INVALIDA','grupo','cobertura',
      'mensagem','Selecione Particular ou Convênio.'
    ));
  elsif v_cobertura='convenio' then
    if v_convenio_id is null or v_plano_id is null or v_carteira is null then
      v_bloqueios := v_bloqueios || jsonb_build_array(jsonb_build_object(
        'codigo','ADMISSAO_COBERTURA_INCOMPLETA','grupo','cobertura',
        'mensagem','Informe operadora, plano e carteirinha.'
      ));
    end if;

    if v_convenio_id is not null then
      select * into v_convenio
      from public.convenios
      where id=v_convenio_id and empresa_id=p_empresa_id and ativo;

      if not found then
        v_bloqueios := v_bloqueios || jsonb_build_array(jsonb_build_object(
          'codigo','ADMISSAO_COBERTURA_INVALIDA','grupo','cobertura',
          'mensagem','A operadora selecionada não está disponível.'
        ));
      elsif nullif(btrim(coalesce(v_convenio.registro_ans,'')),'') is null then
        v_bloqueios := v_bloqueios || jsonb_build_array(jsonb_build_object(
          'codigo','ADMISSAO_REGISTRO_ANS_AUSENTE','grupo','cobertura',
          'mensagem','A operadora selecionada está com o cadastro regulatório incompleto.'
        ));
      end if;
    end if;

    if v_plano_id is not null then
      select * into v_plano
      from public.convenio_planos
      where id=v_plano_id and empresa_id=p_empresa_id and convenio_id=v_convenio_id and ativo;

      if not found then
        v_bloqueios := v_bloqueios || jsonb_build_array(jsonb_build_object(
          'codigo','ADMISSAO_PLANO_INVALIDO','grupo','cobertura',
          'mensagem','O plano selecionado não pertence à operadora ou está inativo.'
        ));
      else
        if v_plano.exige_validade_carteirinha and v_validade is null then
          v_bloqueios := v_bloqueios || jsonb_build_array(jsonb_build_object(
            'codigo','ADMISSAO_VALIDADE_CARTEIRA_OBRIGATORIA','grupo','cobertura',
            'mensagem','Informe a validade da carteirinha para este plano.'
          ));
        end if;

        if v_validade is not null and v_validade < current_date then
          v_bloqueios := v_bloqueios || jsonb_build_array(jsonb_build_object(
            'codigo','ADMISSAO_CARTEIRA_VENCIDA','grupo','cobertura',
            'mensagem','A carteirinha informada está vencida.'
          ));
        end if;

        if v_carteira is not null and nullif(v_plano.carteirinha_regex,'') is not null then
          begin
            v_regex_ok := v_carteira ~ v_plano.carteirinha_regex;
            if not v_regex_ok then
              v_bloqueios := v_bloqueios || jsonb_build_array(jsonb_build_object(
                'codigo','ADMISSAO_CARTEIRINHA_PADRAO_INVALIDO','grupo','cobertura',
                'mensagem','A carteirinha não corresponde ao padrão configurado para este plano.'
              ));
            end if;
          exception when invalid_regular_expression then
            v_bloqueios := v_bloqueios || jsonb_build_array(jsonb_build_object(
              'codigo','ADMISSAO_CONFIG_CARTEIRINHA_REGEX_INVALIDA','grupo','cobertura',
              'mensagem','O padrão da carteirinha deste plano precisa ser corrigido no cadastro.'
            ));
          end;
        end if;
      end if;
    end if;

    if v_profissional_id is null then
      v_bloqueios := v_bloqueios || jsonb_build_array(jsonb_build_object(
        'codigo','ADMISSAO_PROFISSIONAL_OBRIGATORIO_CONVENIO','grupo','profissional',
        'mensagem','Selecione o profissional responsável pelo atendimento.'
      ));
    else
      select * into v_prof
      from public.profissionais
      where id=v_profissional_id and empresa_id=p_empresa_id and ativo;

      if not found then
        v_bloqueios := v_bloqueios || jsonb_build_array(jsonb_build_object(
          'codigo','ADMISSAO_PROFISSIONAL_INVALIDO','grupo','profissional',
          'mensagem','O profissional selecionado não está disponível.'
        ));
      else
        if nullif(btrim(coalesce(v_prof.conselho,'')),'') is null
           or nullif(btrim(coalesce(v_prof.numero_conselho,'')),'') is null
           or nullif(btrim(coalesce(v_prof.uf_conselho,'')),'') is null then
          v_bloqueios := v_bloqueios || jsonb_build_array(jsonb_build_object(
            'codigo','ADMISSAO_CONSELHO_INCOMPLETO','grupo','profissional',
            'mensagem','Complete conselho, número e UF no cadastro do profissional.'
          ));
        end if;

        if nullif(btrim(coalesce(v_prof.cbo,'')),'') is null then
          v_bloqueios := v_bloqueios || jsonb_build_array(jsonb_build_object(
            'codigo','ADMISSAO_CBO_AUSENTE','grupo','profissional',
            'mensagem','Complete a ocupação do profissional antes de abrir por convênio.'
          ));
        end if;

        if coalesce(v_prof.habilitado_tiss,false)=false then
          v_alertas := v_alertas || jsonb_build_array(jsonb_build_object(
            'codigo','ADMISSAO_PROFISSIONAL_REVISAR_HABILITACAO','grupo','profissional',
            'mensagem','O cadastro do profissional está marcado para revisão de habilitação.'
          ));
        end if;
      end if;
    end if;

    if v_convenio_id is not null then
      select * into v_ident
      from public.convenio_identificacao_config
      where empresa_id=p_empresa_id and convenio_id=v_convenio_id and ativo
      limit 1;

      if found and coalesce(v_ident.exige_no_atendimento,false)
         and coalesce(v_ident.metodo,'nenhum') <> 'nenhum' then
        v_metodo_ok := case
          when v_ident.metodo='biometria_ou_token' then v_ident_metodo in ('biometria_digital','token')
          else v_ident_metodo=v_ident.metodo
        end;

        if not v_ident_informada or not coalesce(v_metodo_ok,false) then
          v_bloqueios := v_bloqueios || jsonb_build_array(jsonb_build_object(
            'codigo','ADMISSAO_IDENTIFICACAO_OBRIGATORIA','grupo','cobertura',
            'mensagem','Esta operadora exige identificação do beneficiário antes da abertura.'
          ));
        end if;
      end if;
    end if;

    if nullif(btrim(coalesce(p_payload->>'numero_autorizacao','')),'') is null
       and nullif(btrim(coalesce(p_payload->>'senha_autorizacao','')),'') is null then
      v_alertas := v_alertas || jsonb_build_array(jsonb_build_object(
        'codigo','ADMISSAO_AUTORIZACAO_NAO_INFORMADA','grupo','cobertura',
        'mensagem','Nenhuma autorização foi informada na abertura. Confirme se este atendimento dispensa autorização prévia.'
      ));
    end if;
  end if;

  if v_regime is null or v_regime not in ('ambulatorial','pronto_socorro','internacao','telessaude') then
    v_bloqueios := v_bloqueios || jsonb_build_array(jsonb_build_object(
      'codigo','ADMISSAO_REGIME_INVALIDO','grupo','atendimento',
      'mensagem','Selecione onde o paciente será atendido.'
    ));
  end if;

  if v_finalidade is null or v_finalidade not in ('consulta','sadt_exames','pequena_cirurgia','sessao_terapia','internacao','outro') then
    v_bloqueios := v_bloqueios || jsonb_build_array(jsonb_build_object(
      'codigo','ADMISSAO_FINALIDADE_INVALIDA','grupo','atendimento',
      'mensagem','Selecione a finalidade do atendimento.'
    ));
  end if;

  if v_cobertura='convenio' and v_tipo50 is null then
    v_bloqueios := v_bloqueios || jsonb_build_array(jsonb_build_object(
      'codigo','ADMISSAO_TUSS50_OBRIGATORIO','grupo','atendimento',
      'mensagem','Selecione a modalidade de atendimento.'
    ));
  elsif v_tipo50 is not null and not exists (
    select 1 from public.ans_fhir_dominios_ativos where tabela=50 and codigo=v_tipo50
  ) then
    v_bloqueios := v_bloqueios || jsonb_build_array(jsonb_build_object(
      'codigo','ADMISSAO_TUSS50_INVALIDO','grupo','atendimento',
      'mensagem','A modalidade de atendimento selecionada não está disponível.'
    ));
  end if;

  if v_cobertura='convenio' and v_tipo50='04' and v_tipo52 is null then
    v_bloqueios := v_bloqueios || jsonb_build_array(jsonb_build_object(
      'codigo','ADMISSAO_TUSS52_OBRIGATORIO','grupo','atendimento',
      'mensagem','Selecione a modalidade da consulta.'
    ));
  elsif v_tipo52 is not null and not exists (
    select 1 from public.ans_fhir_dominios_ativos where tabela=52 and codigo=v_tipo52
  ) then
    v_bloqueios := v_bloqueios || jsonb_build_array(jsonb_build_object(
      'codigo','ADMISSAO_TUSS52_INVALIDO','grupo','atendimento',
      'mensagem','A modalidade de consulta selecionada não está disponível.'
    ));
  end if;

  if v_finalidade in ('consulta','sadt_exames','pequena_cirurgia','sessao_terapia') and v_codigo is null then
    v_bloqueios := v_bloqueios || jsonb_build_array(jsonb_build_object(
      'codigo','ADMISSAO_TUSS_OBRIGATORIO','grupo','atendimento',
      'mensagem','Selecione o procedimento principal do atendimento.'
    ));
  elsif v_codigo is not null and not exists (
    select 1
    from public.itens_assistenciais i
    where i.empresa_id=p_empresa_id
      and i.ativo
      and i.categoria='procedimento'
      and (i.codigo_tuss=v_codigo or i.codigo_tabela_propria=v_codigo)
  ) and v_codigo not in ('10101012','10101039','10102019') then
    v_bloqueios := v_bloqueios || jsonb_build_array(jsonb_build_object(
      'codigo','ADMISSAO_TUSS_NAO_CADASTRADO','grupo','atendimento',
      'mensagem','O procedimento principal não está disponível no cadastro atual.'
    ));
  end if;

  if v_finalidade in ('sadt_exames','pequena_cirurgia','sessao_terapia') and v_indicacao is null then
    v_bloqueios := v_bloqueios || jsonb_build_array(jsonb_build_object(
      'codigo','ADMISSAO_INDICACAO_OBRIGATORIA','grupo','atendimento',
      'mensagem','Informe a indicação clínica para este tipo de atendimento.'
    ));
  end if;

  return jsonb_build_object(
    'pronto', jsonb_array_length(v_bloqueios)=0,
    'bloqueios', v_bloqueios,
    'alertas', v_alertas,
    'total_bloqueios', jsonb_array_length(v_bloqueios),
    'total_alertas', jsonb_array_length(v_alertas),
    'checado_em', now()
  );
end
$function$;

revoke all on function public.admissao_prontidao_internal(uuid,uuid,jsonb) from public;
revoke execute on function public.admissao_prontidao_internal(uuid,uuid,jsonb) from anon;
revoke execute on function public.admissao_prontidao_internal(uuid,uuid,jsonb) from authenticated;

create or replace function public.admissao_prontidao(p_unidade_id uuid, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
declare
  v_empresa_id uuid;
begin
  if auth.uid() is null then
    raise exception 'ADMISSAO_NAO_AUTENTICADA' using errcode='42501';
  end if;

  select empresa_id into v_empresa_id
  from public.unidades
  where id=p_unidade_id and ativo;

  if v_empresa_id is null or not public.tem_unidade(v_empresa_id,p_unidade_id) then
    raise exception 'ADMISSAO_SEM_PERMISSAO' using errcode='42501';
  end if;

  return public.admissao_prontidao_internal(v_empresa_id,p_unidade_id,coalesce(p_payload,'{}'::jsonb));
end
$function$;

revoke all on function public.admissao_prontidao(uuid,jsonb) from public;
revoke execute on function public.admissao_prontidao(uuid,jsonb) from anon;
grant execute on function public.admissao_prontidao(uuid,jsonb) to authenticated;
