create or replace function public.preparar_conta_pos_alta_internal(p_atendimento_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_catalog', 'extensions'
as $function$
declare
  v_at public.atendimentos%rowtype;
  v_conta_id uuid;
  v_conta_status text;
  v_auditoria_id uuid;
  v_total numeric(14,2) := 0;
  v_proc integer := 0;
  v_exames integer := 0;
  v_materiais integer := 0;
  v_medicamentos integer := 0;
  v_consulta integer := 0;
  v_criticas integer := 0;
begin
  select * into v_at
    from public.atendimentos
   where id = p_atendimento_id;

  if not found then
    raise exception 'FAT_POS_ALTA_ATENDIMENTO_NAO_LOCALIZADO';
  end if;

  if v_at.status <> 'alta' then
    raise exception 'FAT_POS_ALTA_ATENDIMENTO_NAO_FINALIZADO';
  end if;

  if auth.uid() is not null and not public.tem_unidade(v_at.empresa_id, v_at.unidade_id) then
    raise exception 'FAT_POS_ALTA_SEM_ACESSO_UNIDADE' using errcode = '42501';
  end if;

  select id, status into v_conta_id, v_conta_status
    from public.contas_faturamento
   where atendimento_id = v_at.id
   limit 1;

  if v_conta_id is null then
    insert into public.contas_faturamento (
      empresa_id, unidade_id, atendimento_id, paciente_id, convenio_id, plano_id,
      competencia, tipo_cobranca, status, auditoria_liberada, contas_medicas_liberada,
      created_by, updated_by
    ) values (
      v_at.empresa_id,
      v_at.unidade_id,
      v_at.id,
      v_at.paciente_id,
      v_at.convenio_id,
      v_at.plano_id,
      to_char(coalesce(v_at.data_fechamento, now()) at time zone 'America/Sao_Paulo', 'YYYY-MM'),
      case when v_at.cobertura::text = 'convenio' then 'convenio' else 'particular' end,
      'pre_faturamento',
      false,
      false,
      auth.uid(),
      auth.uid()
    )
    returning id, status into v_conta_id, v_conta_status;
  elsif v_conta_status in ('faturada', 'cancelada') then
    return jsonb_build_object(
      'conta_id', v_conta_id,
      'status', v_conta_status,
      'preservada', true,
      'motivo', 'conta_em_estado_final'
    );
  else
    update public.contas_faturamento
       set status = case when status in ('aberta','pre_faturamento','com_criticas') then 'pre_faturamento' else status end,
           competencia = coalesce(nullif(competencia,''), to_char(coalesce(v_at.data_fechamento, now()) at time zone 'America/Sao_Paulo', 'YYYY-MM')),
           updated_at = now(),
           updated_by = auth.uid()
     where id = v_conta_id;
  end if;

  insert into public.conta_faturamento_itens (
    conta_id, origem_tipo, origem_id, data_execucao, tabela, codigo, descricao,
    quantidade, valor_unitario, valor_total, profissional_id, setor, cobravel, observacao,
    item_assistencial_id, categoria_item, familia_tuss
  )
  select
    v_conta_id,
    'procedimento',
    p.id,
    p.executado_em,
    ia.tabela_tiss_codigo,
    coalesce(
      case when ia.tabela_tiss_codigo in ('00','98') then ia.codigo_tabela_propria else ia.codigo_tuss end,
      p.codigo_tuss,
      p.codigo_interno
    ),
    p.procedimento,
    p.quantidade,
    0,
    0,
    p.profissional_id,
    p.area,
    true,
    'Importado automaticamente da execucao assistencial na alta.',
    ia.id,
    case when ia.categoria in ('procedimento','pacote','taxa','diaria') then ia.categoria else 'procedimento' end,
    ia.familia_tuss
  from public.procedimentos_assistenciais p
  left join lateral (
    select i.*
      from public.itens_assistenciais i
     where i.empresa_id = p.empresa_id
       and i.ativo
       and (
         (p.codigo_tuss is not null and i.codigo_tuss = p.codigo_tuss)
         or (p.codigo_interno is not null and i.codigo_interno = p.codigo_interno)
       )
     order by case when p.codigo_tuss is not null and i.codigo_tuss = p.codigo_tuss then 0 else 1 end, i.created_at
     limit 1
  ) ia on true
  where p.atendimento_id = v_at.id
    and p.empresa_id = v_at.empresa_id
    and p.unidade_id = v_at.unidade_id
    and p.status = 'realizado'
  on conflict (conta_id, origem_tipo, origem_id) do nothing;
  get diagnostics v_proc = row_count;

  insert into public.conta_faturamento_itens (
    conta_id, origem_tipo, origem_id, data_execucao, tabela, codigo, descricao,
    quantidade, valor_unitario, valor_total, profissional_id, setor, cobravel, observacao,
    item_assistencial_id, categoria_item, familia_tuss
  )
  select
    v_conta_id,
    case when s.modalidade = 'laboratorio' then 'laboratorio' when s.modalidade = 'imagem' then 'imagem' else 'exame' end,
    s.id,
    coalesce(s.resultado_em, s.updated_at),
    ia.tabela_tiss_codigo,
    coalesce(
      case when ia.tabela_tiss_codigo in ('00','98') then ia.codigo_tabela_propria else ia.codigo_tuss end,
      s.codigo_tuss
    ),
    s.exame,
    1,
    0,
    0,
    s.profissional_id,
    s.modalidade,
    true,
    'Importado automaticamente de exame liberado na alta.',
    ia.id,
    case when ia.categoria in ('procedimento','pacote','taxa') then ia.categoria else 'procedimento' end,
    ia.familia_tuss
  from public.solicitacoes_exames s
  left join lateral (
    select i.*
      from public.itens_assistenciais i
     where i.empresa_id = s.empresa_id
       and i.ativo
       and s.codigo_tuss is not null
       and i.codigo_tuss = s.codigo_tuss
     order by i.created_at
     limit 1
  ) ia on true
  where s.atendimento_id = v_at.id
    and s.empresa_id = v_at.empresa_id
    and s.unidade_id = v_at.unidade_id
    and s.status = 'liberado'
  on conflict (conta_id, origem_tipo, origem_id) do nothing;
  get diagnostics v_exames = row_count;

  insert into public.conta_faturamento_itens (
    conta_id, origem_tipo, origem_id, data_execucao, tabela, codigo, descricao,
    quantidade, valor_unitario, valor_total, profissional_id, setor, cobravel, observacao,
    item_assistencial_id, categoria_item, familia_tuss
  )
  select
    v_conta_id,
    case when s.categoria in ('material','opme','gas_medicinal') then s.categoria else 'material' end,
    s.id,
    s.updated_at,
    ia.tabela_tiss_codigo,
    coalesce(
      case when ia.tabela_tiss_codigo in ('00','98') then ia.codigo_tabela_propria else ia.codigo_tuss end,
      ia.codigo_tuss,
      ia.codigo_tabela_propria
    ),
    coalesce(ia.descricao, s.descricao),
    s.quantidade,
    0,
    0,
    s.profissional_id,
    'almoxarifado',
    true,
    'Importado automaticamente de material entregue ao atendimento.',
    ia.id,
    case when ia.categoria in ('material','opme','gas_medicinal') then ia.categoria else s.categoria end,
    ia.familia_tuss
  from public.solicitacoes_materiais_assistenciais s
  left join public.itens_assistenciais ia on ia.id = s.item_assistencial_id and ia.empresa_id = s.empresa_id
  where s.atendimento_id = v_at.id
    and s.empresa_id = v_at.empresa_id
    and s.unidade_id = v_at.unidade_id
    and s.status = 'entregue'
  on conflict (conta_id, origem_tipo, origem_id) do nothing;
  get diagnostics v_materiais = row_count;

  insert into public.conta_faturamento_itens (
    conta_id, origem_tipo, origem_id, data_execucao, tabela, codigo, descricao,
    quantidade, valor_unitario, valor_total, profissional_id, setor, cobravel, observacao,
    item_assistencial_id, categoria_item, familia_tuss
  )
  select
    v_conta_id,
    'medicamento',
    x.id,
    x.dispensado_em,
    ia.tabela_tiss_codigo,
    coalesce(
      case when ia.tabela_tiss_codigo in ('00','98') then ia.codigo_tabela_propria else ia.codigo_tuss end,
      ep.codigo_tuss,
      ep.codigo
    ),
    coalesce(ia.descricao, x.item, ep.descricao),
    x.quantidade_liquida,
    0,
    0,
    null,
    'farmacia',
    true,
    'Importado automaticamente da dispensacao liquida (dispensado menos devolvido).',
    ia.id,
    'medicamento',
    ia.familia_tuss
  from (
    select d.*,
           greatest(d.quantidade - coalesce(dev.total_devolvido,0),0) as quantidade_liquida
      from public.dispensacoes_medicamentos d
      left join lateral (
        select coalesce(sum(dm.quantidade),0) as total_devolvido
          from public.devolucoes_medicamentos dm
         where dm.dispensacao_id = d.id
      ) dev on true
     where d.atendimento_id = v_at.id
       and d.empresa_id = v_at.empresa_id
       and d.unidade_id = v_at.unidade_id
       and d.status in ('dispensado','parcial')
  ) x
  left join public.prescricoes p on p.id = x.prescricao_id
  left join public.estoque_produtos ep on ep.id = x.produto_id and ep.empresa_id = x.empresa_id
  left join public.itens_assistenciais ia
    on ia.id = coalesce(p.item_assistencial_id, ep.item_assistencial_id)
   and ia.empresa_id = x.empresa_id
  where x.quantidade_liquida > 0
  on conflict (conta_id, origem_tipo, origem_id) do nothing;
  get diagnostics v_medicamentos = row_count;

  insert into public.conta_faturamento_itens (
    conta_id, origem_tipo, origem_id, data_execucao, tabela, codigo, descricao,
    quantidade, valor_unitario, valor_total, profissional_id, setor, cobravel, observacao,
    item_assistencial_id, categoria_item, familia_tuss
  )
  select
    v_conta_id,
    'procedimento',
    g.id,
    coalesce(g.data_retorno, v_at.data_fechamento, g.data_solicitacao),
    ia.tabela_tiss_codigo,
    coalesce(
      case when ia.tabela_tiss_codigo in ('00','98') then ia.codigo_tabela_propria else ia.codigo_tuss end,
      g.codigo_procedimento
    ),
    coalesce(g.descricao_procedimento, ia.descricao, 'Consulta autorizada'),
    1,
    coalesce(
      nullif(g.valor_contratual,0),
      case when coalesce(g.quantidade_autorizada,0) > 0 then nullif(g.valor_autorizado,0) / g.quantidade_autorizada else null end,
      case when coalesce(g.quantidade_solicitada,0) > 0 then nullif(g.valor_solicitado,0) / g.quantidade_solicitada else null end,
      0
    ),
    0,
    v_at.profissional_id,
    'consultorio',
    true,
    'Importado automaticamente da guia de consulta autorizada apos conclusao do episodio.',
    ia.id,
    'procedimento',
    ia.familia_tuss
  from public.central_guias g
  left join lateral (
    select i.*
      from public.itens_assistenciais i
     where i.empresa_id = g.empresa_id
       and i.ativo
       and g.codigo_procedimento is not null
       and (i.codigo_tuss = g.codigo_procedimento or i.codigo_tabela_propria = g.codigo_procedimento)
     order by case when i.codigo_tuss = g.codigo_procedimento then 0 else 1 end, i.created_at
     limit 1
  ) ia on true
  where g.atendimento_id = v_at.id
    and g.empresa_id = v_at.empresa_id
    and g.unidade_id = v_at.unidade_id
    and g.status = 'autorizada'
    and g.tipo = 'consulta'
    and not exists (
      select 1
        from public.conta_faturamento_itens ci
       where ci.conta_id = v_conta_id
         and ci.codigo is not distinct from coalesce(
           case when ia.tabela_tiss_codigo in ('00','98') then ia.codigo_tabela_propria else ia.codigo_tuss end,
           g.codigo_procedimento
         )
         and ci.origem_tipo in ('procedimento','laboratorio','imagem','exame')
    )
  on conflict (conta_id, origem_tipo, origem_id) do nothing;
  get diagnostics v_consulta = row_count;

  select coalesce(sum(i.valor_total) filter (where i.cobravel),0)
    into v_total
    from public.conta_faturamento_itens i
   where i.conta_id = v_conta_id;

  update public.contas_faturamento
     set valor_bruto = v_total,
         valor_liquido = greatest(v_total - coalesce(valor_desconto,0), 0),
         status = case when status in ('aberta','pre_faturamento','com_criticas') then 'pre_faturamento' else status end,
         updated_at = now(),
         updated_by = auth.uid()
   where id = v_conta_id;

  v_auditoria_id := public.encaminhar_conta_para_auditoria_internal(v_at.id);
  v_criticas := public.executar_auditoria_conta_automatica_internal(v_auditoria_id);

  return jsonb_build_object(
    'conta_id', v_conta_id,
    'auditoria_id', v_auditoria_id,
    'status', 'pre_faturamento',
    'itens_importados', jsonb_build_object(
      'procedimentos', v_proc,
      'exames', v_exames,
      'materiais', v_materiais,
      'medicamentos', v_medicamentos,
      'consulta', v_consulta
    ),
    'valor_bruto', v_total,
    'criticas_auditoria', v_criticas
  );
end
$function$;

revoke all on function public.preparar_conta_pos_alta_internal(uuid) from public, anon, authenticated;

create or replace function public.preparar_conta_pos_alta(p_atendimento_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
declare
  v_at record;
begin
  if auth.uid() is null then
    raise exception 'FAT_POS_ALTA_USUARIO_NAO_AUTENTICADO' using errcode = '42501';
  end if;

  select empresa_id, unidade_id, status
    into v_at
    from public.atendimentos
   where id = p_atendimento_id;

  if v_at.empresa_id is null then
    raise exception 'FAT_POS_ALTA_ATENDIMENTO_NAO_LOCALIZADO';
  end if;

  if not public.tem_unidade(v_at.empresa_id, v_at.unidade_id)
     or not public.tem_alguma_permissao_funcional(
       v_at.empresa_id,
       v_at.unidade_id,
       array[
         'faturamento.criar','faturamento.fechar',
         'auditoria.executar','auditoria.analisar','auditoria.liberar',
         'contas_medicas.processar','contas_medicas.analisar','contas_medicas.liberar'
       ]
     ) then
    raise exception 'FAT_POS_ALTA_SEM_PERMISSAO' using errcode = '42501';
  end if;

  return public.preparar_conta_pos_alta_internal(p_atendimento_id);
end
$function$;

revoke all on function public.preparar_conta_pos_alta(uuid) from public, anon;
grant execute on function public.preparar_conta_pos_alta(uuid) to authenticated;

create or replace function public.integrar_alta_medica_faturamento()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
begin
  if new.status = 'alta' and old.status is distinct from 'alta' then
    begin
      perform public.preparar_conta_pos_alta_internal(new.id);
    exception when others then
      raise warning 'INTEGRACAO_ALTA_FATURAMENTO_PENDENTE atendimento=% sqlstate=%', new.id, sqlstate;
    end;
  end if;
  return new;
end
$function$;

revoke all on function public.integrar_alta_medica_faturamento() from public, anon, authenticated;

drop trigger if exists trg_integrar_alta_medica_faturamento on public.atendimentos;
create trigger trg_integrar_alta_medica_faturamento
after update of status on public.atendimentos
for each row
when (new.status = 'alta' and old.status is distinct from 'alta')
execute function public.integrar_alta_medica_faturamento();

comment on function public.preparar_conta_pos_alta(uuid) is
  'Reprocessa a entrega de um atendimento em alta para pre-faturamento/auditoria, consolidando apenas eventos assistenciais executados e consumos liquidos.';
comment on function public.preparar_conta_pos_alta_internal(uuid) is
  'Helper interno idempotente da integracao alta -> conta -> auditoria. Nao deve ser exposto diretamente ao cliente.';
comment on function public.integrar_alta_medica_faturamento() is
  'Trigger nao bloqueante que entrega automaticamente atendimentos em alta ao pre-faturamento/auditoria.';