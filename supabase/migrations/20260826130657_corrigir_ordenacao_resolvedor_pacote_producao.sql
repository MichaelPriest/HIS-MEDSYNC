-- Corrige a ordenação do resolvedor: contrato_pacotes não possui created_at.
-- A ordem passa a ser determinística por aplicação, código e IDs estáveis.

create or replace function public.resolver_evento_producao_contratual_internal(p_evento_id uuid)
returns jsonb
language plpgsql security definer
set search_path=public,pg_catalog,extensions
as $$
declare
  v_e public.producao_assistencial_eventos%rowtype;
  v_at public.atendimentos%rowtype;
  v_contrato public.credenciamento_contratos%rowtype;
  v_map public.contrato_producao_mapeamentos%rowtype;
  v_item public.itens_assistenciais%rowtype;
  v_codigo text;
  v_tabela text;
  v_origem text := 'pendente';
  v_pacote_id uuid;
  v_pacote_vinculo_id uuid;
  v_pacote_item_id uuid;
  v_pacote_codigo text;
  v_pacote_nome text;
  v_pacote_valor numeric;
  v_quantidade_inclusa numeric;
  v_cobranca_excedente boolean;
  v_exige_autorizacao boolean := false;
  v_data date;
begin
  select * into v_e from public.producao_assistencial_eventos where id=p_evento_id;
  if not found then raise exception 'PRODUCAO_EVENTO_NAO_LOCALIZADO'; end if;
  select * into v_at from public.atendimentos where id=v_e.atendimento_id;
  v_data := (v_e.ocorrido_em at time zone 'America/Sao_Paulo')::date;

  if v_at.convenio_id is not null then
    select * into v_contrato
      from public.credenciamento_contratos c
     where c.empresa_id=v_e.empresa_id
       and c.convenio_id=v_at.convenio_id
       and (c.unidade_id is null or c.unidade_id=v_e.unidade_id)
       and c.status='ativo'
       and (c.data_inicio is null or c.data_inicio<=v_data)
       and (c.data_fim is null or c.data_fim>=v_data)
     order by case when c.unidade_id=v_e.unidade_id then 0 else 1 end,
              c.data_inicio desc nulls last,c.created_at desc,c.id
     limit 1;
  end if;

  if v_e.item_assistencial_id is not null then
    select * into v_item from public.itens_assistenciais
     where id=v_e.item_assistencial_id and empresa_id=v_e.empresa_id and ativo;
  end if;

  if v_contrato.id is not null then
    select * into v_map
      from public.contrato_producao_mapeamentos m
     where m.contrato_id=v_contrato.id
       and m.empresa_id=v_e.empresa_id
       and (m.unidade_id is null or m.unidade_id=v_e.unidade_id)
       and m.ativo
       and m.tipo_evento=v_e.tipo_evento
       and (m.acomodacao is null or lower(m.acomodacao)=lower(coalesce(v_e.metadados->>'acomodacao','')))
       and (m.setor is null or lower(m.setor)=lower(coalesce(v_e.setor,v_e.metadados->>'setor','')))
       and (m.vigencia_inicio is null or m.vigencia_inicio<=v_data)
       and (m.vigencia_fim is null or m.vigencia_fim>=v_data)
     order by case when m.acomodacao is not null then 0 else 1 end,
              case when m.setor is not null then 0 else 1 end,
              m.prioridade,m.vigencia_inicio desc nulls last,m.created_at desc,m.id
     limit 1;
  end if;

  v_exige_autorizacao := case
    when v_map.id is not null and v_map.exige_autorizacao is not null then v_map.exige_autorizacao
    when v_e.tipo_evento='sessao_tea_aba' and v_at.convenio_id is not null then true
    else false
  end;

  if v_map.id is not null then
    v_codigo := v_map.codigo;
    v_tabela := v_map.codigo_tabela;
    v_origem := 'contrato';
    if v_map.item_assistencial_id is not null then
      select * into v_item from public.itens_assistenciais
       where id=v_map.item_assistencial_id and empresa_id=v_e.empresa_id and ativo;
    end if;
  elsif v_item.id is not null then
    v_codigo := case when v_item.tabela_tiss_codigo in ('00','98') then v_item.codigo_tabela_propria else v_item.codigo_tuss end;
    v_tabela := v_item.tabela_tiss_codigo;
    v_origem := 'catalogo';
  elsif v_e.codigo_tuss_fallback is not null then
    v_codigo := v_e.codigo_tuss_fallback;
    v_tabela := '22';
    v_origem := 'fallback';
  end if;

  if v_contrato.id is not null and v_codigo is not null then
    select ap.id,p.id,pi.id,p.codigo,p.nome,p.valor,pi.quantidade_inclusa,pi.cobranca_excedente
      into v_pacote_vinculo_id,v_pacote_id,v_pacote_item_id,v_pacote_codigo,v_pacote_nome,v_pacote_valor,v_quantidade_inclusa,v_cobranca_excedente
      from public.atendimento_pacotes_contratados ap
      join public.contrato_pacotes p on p.id=ap.pacote_id and p.contrato_id=ap.contrato_id
      join public.contrato_pacote_itens pi on pi.pacote_id=p.id and pi.codigo=v_codigo
     where ap.atendimento_id=v_e.atendimento_id
       and ap.empresa_id=v_e.empresa_id
       and ap.unidade_id=v_e.unidade_id
       and ap.contrato_id=v_contrato.id
       and ap.status='ativo'
       and p.ativo
       and (p.vigencia_inicio is null or p.vigencia_inicio<=v_data)
       and (p.vigencia_fim is null or p.vigencia_fim>=v_data)
       and (pi.tabela is null or pi.tabela=v_tabela)
     order by ap.aplicado_em,p.codigo,p.id,pi.id
     limit 1;
  end if;

  if v_pacote_id is not null then
    return jsonb_build_object(
      'status','pacote','contrato_id',v_contrato.id,'pacote_vinculo_id',v_pacote_vinculo_id,
      'pacote_id',v_pacote_id,'pacote_item_id',v_pacote_item_id,'pacote_codigo',v_pacote_codigo,
      'pacote_nome',v_pacote_nome,'pacote_valor',v_pacote_valor,'quantidade_inclusa',v_quantidade_inclusa,
      'cobranca_excedente',coalesce(v_cobranca_excedente,false),'codigo_evento',v_codigo,
      'tabela_evento',v_tabela,'item_assistencial_id',v_item.id,'origem_codigo',v_origem,
      'mapeamento_id',v_map.id,'exige_autorizacao',v_exige_autorizacao
    );
  end if;

  if v_codigo is null then
    return jsonb_build_object(
      'status','pendente_codigo','contrato_id',v_contrato.id,'origem_codigo','pendente',
      'exige_autorizacao',v_exige_autorizacao,
      'motivo',case when v_e.tipo_evento in ('diaria','taxa') then 'codigo_deve_ser_configurado_no_contrato' else 'codigo_nao_resolvido' end
    );
  end if;

  return jsonb_build_object(
    'status','individual','contrato_id',v_contrato.id,'codigo_evento',v_codigo,
    'tabela_evento',coalesce(v_tabela,'22'),'item_assistencial_id',v_item.id,
    'origem_codigo',v_origem,'mapeamento_id',v_map.id,'exige_autorizacao',v_exige_autorizacao
  );
end $$;
revoke execute on function public.resolver_evento_producao_contratual_internal(uuid) from public,anon,authenticated;
