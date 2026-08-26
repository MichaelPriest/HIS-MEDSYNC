create or replace function public.validar_guia_tiss_internal(p_guia_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_catalog','extensions'
as $function$
declare
  v_user uuid := auth.uid();
  v_guia public.tiss_guias%rowtype;
  v_paciente public.pacientes%rowtype;
  v_prof public.profissionais%rowtype;
  v_unidade public.unidades%rowtype;
  v_internacao public.internacoes%rowtype;
  v_plano public.convenio_planos%rowtype;
  v_autorizacao public.autorizacoes_atendimento%rowtype;
  v_tem_plano boolean := false;
  v_tem_autorizacao boolean := false;
  v_erros integer := 0;
  v_alertas integer := 0;
  v_itens integer := 0;
  v_soma numeric := 0;
  v_versao_existe boolean := false;
begin
  if v_user is null then
    raise exception 'TISS_GUIA_NAO_AUTENTICADO' using errcode='42501';
  end if;

  select * into v_guia
    from public.tiss_guias
   where id=p_guia_id
   for update;
  if not found then
    raise exception 'TISS_GUIA_NAO_LOCALIZADA' using errcode='P0002';
  end if;

  if not public.tem_unidade(v_guia.empresa_id,v_guia.unidade_id)
     or not public.tem_permissao(v_guia.empresa_id,v_guia.unidade_id,'tiss.gerar') then
    raise exception 'TISS_GUIA_SEM_PERMISSAO' using errcode='42501';
  end if;

  if v_guia.status not in ('rascunho','pronta') then
    return jsonb_build_object(
      'guia_id',v_guia.id,
      'status',v_guia.status,
      'preservada',true,
      'erros',0,
      'alertas',0
    );
  end if;

  if v_guia.paciente_id is not null then
    select * into v_paciente from public.pacientes where id=v_guia.paciente_id;
  end if;
  if v_guia.profissional_id is not null then
    select * into v_prof from public.profissionais where id=v_guia.profissional_id;
  end if;
  select * into v_unidade from public.unidades where id=v_guia.unidade_id;
  if v_guia.plano_id is not null then
    select * into v_plano from public.convenio_planos where id=v_guia.plano_id;
    v_tem_plano := found;
  end if;
  if v_guia.atendimento_id is not null then
    select * into v_internacao
      from public.internacoes
     where atendimento_id=v_guia.atendimento_id
     order by data_internacao desc,id desc
     limit 1;

    select * into v_autorizacao
      from public.autorizacoes_atendimento
     where atendimento_id=v_guia.atendimento_id
     limit 1;
    v_tem_autorizacao := found;
  end if;

  update public.tiss_guias set
    beneficiario_nome_snapshot=coalesce(beneficiario_nome_snapshot,nullif(btrim(coalesce(v_paciente.nome_completo,'')),'')),
    beneficiario_cns_snapshot=coalesce(beneficiario_cns_snapshot,nullif(btrim(coalesce(v_paciente.cns,'')),'')),
    profissional_nome_snapshot=coalesce(profissional_nome_snapshot,nullif(btrim(coalesce(v_prof.nome_completo,'')),'')),
    profissional_conselho_snapshot=coalesce(profissional_conselho_snapshot,nullif(btrim(coalesce(v_prof.conselho,'')),'')),
    profissional_numero_conselho_snapshot=coalesce(profissional_numero_conselho_snapshot,nullif(btrim(coalesce(v_prof.numero_conselho,'')),'')),
    profissional_uf_conselho_snapshot=coalesce(profissional_uf_conselho_snapshot,nullif(btrim(coalesce(v_prof.uf_conselho,'')),'')),
    profissional_cbo_snapshot=coalesce(profissional_cbo_snapshot,nullif(btrim(coalesce(v_prof.cbo,'')),'')),
    profissional_especialidade_snapshot=coalesce(profissional_especialidade_snapshot,nullif(btrim(coalesce(v_prof.especialidade,'')),'')),
    cnes_snapshot=coalesce(cnes_snapshot,nullif(btrim(coalesce(v_unidade.cnes,'')),'')),
    acomodacao_tuss49_codigo=coalesce(acomodacao_tuss49_codigo,nullif(btrim(coalesce(v_internacao.acomodacao_tuss49_codigo,'')),'')),
    acomodacao_tuss49_descricao=coalesce(acomodacao_tuss49_descricao,nullif(btrim(coalesce(v_internacao.acomodacao_tuss49_descricao,'')),'')),
    acomodacao_tuss49_versao=coalesce(acomodacao_tuss49_versao,nullif(btrim(coalesce(v_internacao.acomodacao_tuss49_versao,'')),'')),
    acomodacao_tuss49_canonical=coalesce(acomodacao_tuss49_canonical,nullif(btrim(coalesce(v_internacao.acomodacao_tuss49_canonical,'')),'')),
    updated_at=now(),updated_by=v_user
  where id=v_guia.id
  returning * into v_guia;

  update public.tiss_guia_criticas
     set resolvida=true,resolvida_em=now()
   where guia_id=v_guia.id and not resolvida;

  update public.tiss_guia_itens gi set
    via_acesso_tuss61_conceito_id=d.conceito_id,
    via_acesso_tuss61_descricao=d.display,
    via_acesso_tuss61_versao=d.versao,
    via_acesso_tuss61_canonical=d.canonical
  from public.ans_fhir_dominios_ativos d
  where gi.guia_id=v_guia.id
    and nullif(btrim(coalesce(gi.via_acesso,'')),'') is not null
    and d.tabela=61 and d.codigo=gi.via_acesso;

  update public.tiss_guia_itens gi set
    tecnica_utilizada_tuss48_conceito_id=d.conceito_id,
    tecnica_utilizada_tuss48_descricao=d.display,
    tecnica_utilizada_tuss48_versao=d.versao,
    tecnica_utilizada_tuss48_canonical=d.canonical
  from public.ans_fhir_dominios_ativos d
  where gi.guia_id=v_guia.id
    and nullif(btrim(coalesce(gi.tecnica_utilizada,'')),'') is not null
    and d.tabela=48 and d.codigo=gi.tecnica_utilizada;

  select count(*)::int,coalesce(sum(valor_total),0)
    into v_itens,v_soma
    from public.tiss_guia_itens
   where guia_id=v_guia.id;

  select exists(select 1 from public.tiss_versoes where id=v_guia.versao_id)
    into v_versao_existe;

  if not v_versao_existe then
    insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by)
    values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'TISS-GUIA-VERSAO-001','erro','versao_id','Versão TISS da guia não foi localizada.',v_user);
    v_erros:=v_erros+1;
  end if;
  if nullif(btrim(coalesce(v_guia.numero_guia_prestador,'')),'') is null then
    insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by)
    values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'TISS-GUIA-NUM-001','erro','numero_guia_prestador','Número da guia do prestador não informado.',v_user);
    v_erros:=v_erros+1;
  end if;
  if nullif(btrim(coalesce(v_guia.registro_ans,'')),'') is null or v_guia.registro_ans !~ '^[0-9]{6}$' then
    insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by)
    values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'TISS-GUIA-ANS-001','erro','registro_ans','Registro ANS ausente ou inválido na guia.',v_user);
    v_erros:=v_erros+1;
  end if;

  if v_guia.plano_id is null or not v_tem_plano
     or v_plano.empresa_id is distinct from v_guia.empresa_id
     or v_plano.convenio_id is distinct from v_guia.convenio_id
     or not coalesce(v_plano.ativo,false) then
    insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by)
    values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'TISS-GUIA-PLANO-001','erro','plano_id','Plano da guia ausente, inativo ou incompatível com o convênio informado.',v_user);
    v_erros:=v_erros+1;
  end if;

  if nullif(btrim(coalesce(v_guia.numero_carteirinha,'')),'') is null then
    insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by)
    values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'TISS-GUIA-BEN-001','erro','numero_carteirinha','Número da carteirinha do beneficiário não informado.',v_user);
    v_erros:=v_erros+1;
  end if;
  if v_tem_plano and v_plano.exige_validade_carteirinha and v_guia.validade_carteirinha is null then
    insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by)
    values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'TISS-GUIA-BEN-004','erro','validade_carteirinha','O plano exige a validade da carteirinha, mas ela não foi informada.',v_user);
    v_erros:=v_erros+1;
  end if;
  if v_guia.validade_carteirinha is not null and v_guia.data_atendimento is not null
     and v_guia.validade_carteirinha < v_guia.data_atendimento then
    insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by)
    values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'TISS-GUIA-BEN-005','erro','validade_carteirinha','Carteirinha vencida na data do atendimento.',v_user);
    v_erros:=v_erros+1;
  end if;
  if nullif(btrim(coalesce(v_guia.beneficiario_nome_snapshot,'')),'') is null then
    insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by)
    values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'TISS-GUIA-BEN-002','erro','beneficiario_nome_snapshot','Nome do beneficiário não pôde ser fotografado na guia.',v_user);
    v_erros:=v_erros+1;
  end if;
  if nullif(btrim(coalesce(v_guia.beneficiario_cns_snapshot,'')),'') is null then
    insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by)
    values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'TISS-GUIA-BEN-003','alerta','beneficiario_cns_snapshot','CNS do beneficiário não informado; confirme a obrigatoriedade para a guia aplicável.',v_user);
    v_alertas:=v_alertas+1;
  end if;
  if v_guia.data_atendimento is null then
    insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by)
    values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'TISS-GUIA-DATA-001','erro','data_atendimento','Data do atendimento não informada.',v_user);
    v_erros:=v_erros+1;
  end if;
  if nullif(btrim(coalesce(v_guia.cnes_snapshot,'')),'') is null or v_guia.cnes_snapshot !~ '^[0-9]{7}$' then
    insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by)
    values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'TISS-GUIA-CNES-001','erro','cnes_snapshot','CNES da unidade ausente ou inválido no snapshot da guia.',v_user);
    v_erros:=v_erros+1;
  end if;

  if v_guia.tipo_guia in ('consulta','sp_sadt','resumo_internacao','honorario_individual') then
    if nullif(btrim(coalesce(v_guia.profissional_nome_snapshot,'')),'') is null then
      insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by)
      values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'TISS-GUIA-PROF-001','erro','profissional_nome_snapshot','Profissional executante não informado.',v_user);
      v_erros:=v_erros+1;
    end if;
    if nullif(btrim(coalesce(v_guia.profissional_conselho_snapshot,'')),'') is null
       or nullif(btrim(coalesce(v_guia.profissional_numero_conselho_snapshot,'')),'') is null
       or nullif(btrim(coalesce(v_guia.profissional_uf_conselho_snapshot,'')),'') is null then
      insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by)
      values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'TISS-GUIA-PROF-002','erro','conselho_profissional','Conselho, número e UF do profissional precisam estar completos.',v_user);
      v_erros:=v_erros+1;
    end if;
    if nullif(btrim(coalesce(v_guia.profissional_cbo_snapshot,'')),'') is null or v_guia.profissional_cbo_snapshot !~ '^[0-9]{6}$' then
      insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by)
      values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'TISS-GUIA-CBO-001','erro','profissional_cbo_snapshot','CBO do profissional ausente ou inválido.',v_user);
      v_erros:=v_erros+1;
    end if;
  end if;

  if v_guia.tipo_guia in ('consulta','sp_sadt','resumo_internacao') and nullif(btrim(coalesce(v_guia.tipo_atendimento_tuss50_codigo,'')),'') is null then
    insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by)
    values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'TISS-GUIA-DOM-050','erro','tipo_atendimento_tuss50_codigo','Tipo de atendimento ANS/TUSS 50 não informado na guia.',v_user);
    v_erros:=v_erros+1;
  elsif nullif(btrim(coalesce(v_guia.tipo_atendimento_tuss50_codigo,'')),'') is not null and not exists(
    select 1 from public.ans_fhir_dominios_ativos d where d.tabela=50 and d.codigo=v_guia.tipo_atendimento_tuss50_codigo
  ) then
    insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by)
    values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'TISS-GUIA-DOM-050-INV','erro','tipo_atendimento_tuss50_codigo','Tipo de atendimento não existe no domínio ANS/TUSS 50 ativo carregado.',v_user);
    v_erros:=v_erros+1;
  end if;
  if v_guia.tipo_guia='consulta' and v_guia.tipo_atendimento_tuss50_codigo is distinct from '04' then
    insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by)
    values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'TISS-GUIA-CONS-050','erro','tipo_atendimento_tuss50_codigo','Guia de consulta deve estar classificada como Consulta (Tabela 50 código 04).',v_user);
    v_erros:=v_erros+1;
  end if;
  if v_guia.tipo_guia='consulta' and nullif(btrim(coalesce(v_guia.tipo_consulta_tuss52_codigo,'')),'') is null then
    insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by)
    values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'TISS-GUIA-DOM-052','erro','tipo_consulta_tuss52_codigo','Tipo de consulta ANS/TUSS 52 não informado.',v_user);
    v_erros:=v_erros+1;
  elsif nullif(btrim(coalesce(v_guia.tipo_consulta_tuss52_codigo,'')),'') is not null and not exists(
    select 1 from public.ans_fhir_dominios_ativos d where d.tabela=52 and d.codigo=v_guia.tipo_consulta_tuss52_codigo
  ) then
    insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by)
    values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'TISS-GUIA-DOM-052-INV','erro','tipo_consulta_tuss52_codigo','Tipo de consulta não existe no domínio ANS/TUSS 52 ativo carregado.',v_user);
    v_erros:=v_erros+1;
  end if;
  if v_guia.tipo_guia='resumo_internacao' and nullif(btrim(coalesce(v_guia.acomodacao_tuss49_codigo,'')),'') is null then
    insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by)
    values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'TISS-GUIA-DOM-049','erro','acomodacao_tuss49_codigo','Acomodação ANS/TUSS 49 não foi fotografada para o resumo de internação.',v_user);
    v_erros:=v_erros+1;
  elsif nullif(btrim(coalesce(v_guia.acomodacao_tuss49_codigo,'')),'') is not null and not exists(
    select 1 from public.ans_fhir_dominios_ativos d where d.tabela=49 and d.codigo=v_guia.acomodacao_tuss49_codigo
  ) then
    insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by)
    values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'TISS-GUIA-DOM-049-INV','erro','acomodacao_tuss49_codigo','Acomodação não existe no domínio ANS/TUSS 49 ativo carregado.',v_user);
    v_erros:=v_erros+1;
  end if;

  if v_itens=0 then
    insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,mensagem,created_by)
    values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'TISS-GUIA-ITEM-000','erro','Guia sem itens faturáveis.',v_user);
    v_erros:=v_erros+1;
  end if;

  insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,item_id,codigo,severidade,campo,mensagem,created_by)
  select v_guia.empresa_id,v_guia.unidade_id,v_guia.id,gi.id,'TISS-GUIA-ITEM-001','erro','codigo_procedimento','Item sem código de procedimento.',v_user
    from public.tiss_guia_itens gi
   where gi.guia_id=v_guia.id and nullif(btrim(coalesce(gi.codigo_procedimento,'')),'') is null;
  get diagnostics v_itens = row_count;
  v_erros:=v_erros+v_itens;

  insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,item_id,codigo,severidade,campo,mensagem,created_by)
  select v_guia.empresa_id,v_guia.unidade_id,v_guia.id,gi.id,'TISS-GUIA-ITEM-002','erro','tabela','Item sem tabela TISS/TUSS.',v_user
    from public.tiss_guia_itens gi
   where gi.guia_id=v_guia.id and nullif(btrim(coalesce(gi.tabela,'')),'') is null;
  get diagnostics v_itens = row_count;
  v_erros:=v_erros+v_itens;

  insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,item_id,codigo,severidade,campo,mensagem,created_by)
  select v_guia.empresa_id,v_guia.unidade_id,v_guia.id,gi.id,'TISS-GUIA-ITEM-003','erro','quantidade','Quantidade do item deve ser maior que zero.',v_user
    from public.tiss_guia_itens gi
   where gi.guia_id=v_guia.id and coalesce(gi.quantidade,0)<=0;
  get diagnostics v_itens = row_count;
  v_erros:=v_erros+v_itens;

  insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,item_id,codigo,severidade,campo,mensagem,created_by)
  select v_guia.empresa_id,v_guia.unidade_id,v_guia.id,gi.id,'TISS-GUIA-ITEM-004','erro','data_execucao','Data de execução do item não informada.',v_user
    from public.tiss_guia_itens gi
   where gi.guia_id=v_guia.id
     and v_guia.tipo_guia in ('consulta','sp_sadt','resumo_internacao','honorario_individual','tratamento_odontologico','outras_despesas','opme','quimioterapia','radioterapia')
     and gi.data_execucao is null;
  get diagnostics v_itens = row_count;
  v_erros:=v_erros+v_itens;

  insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,item_id,codigo,severidade,campo,mensagem,created_by)
  select v_guia.empresa_id,v_guia.unidade_id,v_guia.id,gi.id,'TISS-GUIA-ITEM-005','erro','valor_total','Valores do item não podem ser negativos.',v_user
    from public.tiss_guia_itens gi
   where gi.guia_id=v_guia.id and (coalesce(gi.valor_unitario,0)<0 or coalesce(gi.valor_total,0)<0);
  get diagnostics v_itens = row_count;
  v_erros:=v_erros+v_itens;

  insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,item_id,codigo,severidade,campo,mensagem,created_by)
  select v_guia.empresa_id,v_guia.unidade_id,v_guia.id,gi.id,'TISS-GUIA-ITEM-006','erro','codigo_procedimento','Código próprio em tabela 00 excede 10 caracteres.',v_user
    from public.tiss_guia_itens gi
   where gi.guia_id=v_guia.id and gi.tabela='00' and length(coalesce(gi.codigo_procedimento,''))>10;
  get diagnostics v_itens = row_count;
  v_erros:=v_erros+v_itens;

  insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,item_id,codigo,severidade,campo,mensagem,created_by)
  select v_guia.empresa_id,v_guia.unidade_id,v_guia.id,gi.id,'TISS-GUIA-DOM-061','erro','via_acesso','Via de acesso informada não existe no domínio ANS/TUSS 61 carregado.',v_user
    from public.tiss_guia_itens gi
   where gi.guia_id=v_guia.id
     and nullif(btrim(coalesce(gi.via_acesso,'')),'') is not null
     and gi.via_acesso_tuss61_conceito_id is null;
  get diagnostics v_itens = row_count;
  v_erros:=v_erros+v_itens;

  insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,item_id,codigo,severidade,campo,mensagem,created_by)
  select v_guia.empresa_id,v_guia.unidade_id,v_guia.id,gi.id,'TISS-GUIA-DOM-048','erro','tecnica_utilizada','Técnica utilizada informada não existe no domínio ANS/TUSS 48 carregado.',v_user
    from public.tiss_guia_itens gi
   where gi.guia_id=v_guia.id
     and nullif(btrim(coalesce(gi.tecnica_utilizada,'')),'') is not null
     and gi.tecnica_utilizada_tuss48_conceito_id is null;
  get diagnostics v_itens = row_count;
  v_erros:=v_erros+v_itens;

  if v_guia.tipo_guia='consulta' and exists(
    select 1 from public.tiss_guia_itens gi where gi.guia_id=v_guia.id and gi.tabela='19'
  ) then
    insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by)
    values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'TISS-GUIA-CONS-MAT','erro','itens','Guia de consulta não deve transportar material/OPME da TUSS 19.',v_user);
    v_erros:=v_erros+1;
  end if;

  select coalesce(sum(valor_total),0) into v_soma from public.tiss_guia_itens where guia_id=v_guia.id;
  if abs(coalesce(v_guia.valor_total,0)-v_soma)>0.01 then
    insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by)
    values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'TISS-GUIA-VAL-001','erro','valor_total','Valor total da guia diverge da soma dos itens.',v_user);
    v_erros:=v_erros+1;
  end if;

  if v_guia.validade_senha is not null and v_guia.data_atendimento is not null
     and v_guia.validade_senha < v_guia.data_atendimento then
    insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by)
    values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'TISS-GUIA-AUT-006','erro','validade_senha','Senha/autorização vencida na data do atendimento.',v_user);
    v_erros:=v_erros+1;
  end if;

  if v_tem_autorizacao then
    if v_autorizacao.empresa_id is distinct from v_guia.empresa_id
       or v_autorizacao.unidade_id is distinct from v_guia.unidade_id
       or (v_autorizacao.convenio_id is not null and v_autorizacao.convenio_id is distinct from v_guia.convenio_id)
       or (v_autorizacao.plano_id is not null and v_autorizacao.plano_id is distinct from v_guia.plano_id) then
      insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by)
      values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'TISS-GUIA-AUT-007','erro','autorizacao','Autorização vinculada ao atendimento não corresponde ao escopo, convênio ou plano da guia.',v_user);
      v_erros:=v_erros+1;
    end if;
    if v_autorizacao.status in ('pendente','solicitada') then
      insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by)
      values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'TISS-GUIA-AUT-002','erro','autorizacao','Autorização do atendimento ainda está pendente de conclusão.',v_user);
      v_erros:=v_erros+1;
    elsif v_autorizacao.status='negada' then
      insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by)
      values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'TISS-GUIA-AUT-003','erro','autorizacao','Autorização do atendimento foi negada.',v_user);
      v_erros:=v_erros+1;
    elsif v_autorizacao.status='autorizada' then
      if nullif(btrim(coalesce(v_guia.numero_guia_operadora,'')),'') is null then
        insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by)
        values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'TISS-GUIA-AUT-004','erro','numero_guia_operadora','Atendimento autorizado sem número da guia/autorização da operadora fotografado na guia.',v_user);
        v_erros:=v_erros+1;
      elsif nullif(btrim(coalesce(v_autorizacao.numero_guia_operadora,'')),'') is not null
         and btrim(v_autorizacao.numero_guia_operadora)<>btrim(v_guia.numero_guia_operadora) then
        insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by)
        values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'TISS-GUIA-AUT-004','erro','numero_guia_operadora','Número da guia/autorização diverge do registro de autorização do atendimento.',v_user);
        v_erros:=v_erros+1;
      end if;
      if nullif(btrim(coalesce(v_autorizacao.senha_autorizacao,'')),'') is not null
         and btrim(coalesce(v_guia.senha_autorizacao,''))<>btrim(v_autorizacao.senha_autorizacao) then
        insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by)
        values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'TISS-GUIA-AUT-005','erro','senha_autorizacao','Senha da autorização diverge do registro autorizado do atendimento.',v_user);
        v_erros:=v_erros+1;
      end if;
      if v_autorizacao.validade is not null and v_guia.data_atendimento is not null
         and v_autorizacao.validade < v_guia.data_atendimento then
        insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by)
        values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'TISS-GUIA-AUT-006','erro','validade_senha','Autorização estava vencida na data do atendimento.',v_user);
        v_erros:=v_erros+1;
      end if;
    end if;
  elsif v_guia.tipo_guia in ('sp_sadt','solicitacao_internacao','resumo_internacao','opme','quimioterapia','radioterapia')
        and nullif(btrim(coalesce(v_guia.numero_guia_operadora,'')),'') is null then
    insert into public.tiss_guia_criticas(empresa_id,unidade_id,guia_id,codigo,severidade,campo,mensagem,created_by)
    values(v_guia.empresa_id,v_guia.unidade_id,v_guia.id,'TISS-GUIA-AUT-001','alerta','numero_guia_operadora','Não há autorização registrada para o atendimento nem número de guia da operadora; confirme se o procedimento exige autorização.',v_user);
    v_alertas:=v_alertas+1;
  end if;

  update public.tiss_guias
     set status=case when v_erros=0 then 'pronta' else 'rascunho' end,
         validado_em=now(),validado_por=v_user,updated_at=now(),updated_by=v_user
   where id=v_guia.id;

  return jsonb_build_object(
    'guia_id',v_guia.id,
    'status',case when v_erros=0 then 'pronta' else 'rascunho' end,
    'preservada',false,
    'erros',v_erros,
    'alertas',v_alertas
  );
end
$function$;

create or replace function public.proteger_item_guia_tiss_fechada()
returns trigger
language plpgsql
security definer
set search_path to 'public','pg_catalog'
as $function$
declare
  v_guia_id uuid := case when tg_op='DELETE' then old.guia_id else new.guia_id end;
  v_status text;
begin
  if tg_op='UPDATE' and new.guia_id is distinct from old.guia_id then
    raise exception 'TISS_GUIA_ITEM_NAO_PODE_MUDAR_DE_GUIA' using errcode='23514';
  end if;

  select status into v_status from public.tiss_guias where id=v_guia_id;
  if v_status is null then
    raise exception 'TISS_GUIA_NAO_LOCALIZADA' using errcode='P0002';
  end if;
  if v_status not in ('rascunho','pronta') then
    raise exception 'TISS_GUIA_ITEM_IMUTAVEL_STATUS_%',upper(v_status) using errcode='23514';
  end if;
  return case when tg_op='DELETE' then old else new end;
end
$function$;

create or replace function public.invalidar_guia_tiss_apos_mutacao_item()
returns trigger
language plpgsql
security definer
set search_path to 'public','pg_catalog'
as $function$
declare
  v_guia_id uuid := case when tg_op='DELETE' then old.guia_id else new.guia_id end;
  v_user uuid := auth.uid();
begin
  update public.tiss_guias
     set status='rascunho',validado_em=null,validado_por=null,updated_at=now(),updated_by=coalesce(v_user,updated_by)
   where id=v_guia_id and status in ('rascunho','pronta');

  update public.tiss_guia_criticas
     set resolvida=true,resolvida_em=now()
   where guia_id=v_guia_id and not resolvida;
  return null;
end
$function$;

revoke all on function public.validar_guia_tiss_internal(uuid) from public,anon,authenticated;
revoke all on function public.proteger_item_guia_tiss_fechada() from public,anon,authenticated;
revoke all on function public.invalidar_guia_tiss_apos_mutacao_item() from public,anon,authenticated;

drop trigger if exists trg_proteger_item_guia_tiss_fechada on public.tiss_guia_itens;
create trigger trg_proteger_item_guia_tiss_fechada
before insert or update or delete on public.tiss_guia_itens
for each row execute function public.proteger_item_guia_tiss_fechada();

drop trigger if exists trg_invalidar_guia_tiss_apos_atualizar_item on public.tiss_guia_itens;
create trigger trg_invalidar_guia_tiss_apos_atualizar_item
after update of sequencial,data_execucao,hora_inicio,hora_fim,tabela,codigo_procedimento,descricao,quantidade,via_acesso,tecnica_utilizada,reducao_acrescimo,valor_unitario,valor_total on public.tiss_guia_itens
for each row execute function public.invalidar_guia_tiss_apos_mutacao_item();

drop trigger if exists trg_invalidar_guia_tiss_apos_excluir_item on public.tiss_guia_itens;
create trigger trg_invalidar_guia_tiss_apos_excluir_item
after delete on public.tiss_guia_itens
for each row execute function public.invalidar_guia_tiss_apos_mutacao_item();
