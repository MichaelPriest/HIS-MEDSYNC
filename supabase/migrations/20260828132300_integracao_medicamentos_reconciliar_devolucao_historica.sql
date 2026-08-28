-- Refina a reconciliação de medicamento para considerar a tabela de devoluções como evidência histórica,
-- mesmo quando registros legados não propagaram quantidade_devolvida/status para a dispensação.

create or replace function public.reconciliar_pendencias_medicamentos_internal(
  p_empresa_id uuid,
  p_unidade_id uuid,
  p_atendimento_id uuid default null,
  p_resolvida_por uuid default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_catalog'
as $function$
declare
  v_resolvidas integer := 0;
  v_abertas integer := 0;
begin
  insert into public.integracao_pendencias(empresa_id,unidade_id,atendimento_id,paciente_id,regra_chave,origem_tabela,origem_id,setor_origem,setor_destino,severidade,titulo,detalhes,contexto)
  select p.empresa_id,p.unidade_id,p.atendimento_id,a.paciente_id,'prescricao_validacao_farmaceutica_pendente','prescricoes',p.id,'medico','farmacia','alta',
         'Prescrição aguardando validação farmacêutica','A prescrição está assinada e ativa, porém a validação farmacêutica obrigatória ainda não foi concluída.',
         jsonb_build_object('item',p.item,'tipo',p.tipo,'assinado_em',p.assinado_em,'produto_id',p.produto_id)
  from public.prescricoes p join public.atendimentos a on a.id=p.atendimento_id
  where p.empresa_id=p_empresa_id and p.unidade_id=p_unidade_id and p.status='ativa' and p.assinado_em is not null and p.requer_validacao_farmaceutica
    and (p_atendimento_id is null or p.atendimento_id=p_atendimento_id)
    and not exists(select 1 from public.validacoes_farmaceuticas v where v.prescricao_id=p.id and v.status in ('validada','validada_com_ressalva'))
  on conflict do nothing;

  insert into public.integracao_pendencias(empresa_id,unidade_id,atendimento_id,paciente_id,regra_chave,origem_tabela,origem_id,setor_origem,setor_destino,severidade,titulo,detalhes,contexto)
  select d.empresa_id,d.unidade_id,d.atendimento_id,d.paciente_id,'dispensacao_excedente_aprazamento_unico','dispensacoes_medicamentos',d.id,'farmacia','farmacia','critica',
         'Dispensação excedente para aprazamento único','Há outra dispensação anterior ainda consumida/não devolvida para uma prescrição que possui somente um aprazamento. Não gere nova cobrança; regularize a sobra física.',
         jsonb_build_object('prescricao_id',d.prescricao_id,'dispensado_em',d.dispensado_em,'quantidade',d.quantidade,'lote',d.lote)
  from public.dispensacoes_medicamentos d
  where d.empresa_id=p_empresa_id and d.unidade_id=p_unidade_id and d.prescricao_id is not null and d.prescricao_componente_id is null and d.status in ('dispensado','parcial')
    and (p_atendimento_id is null or d.atendimento_id=p_atendimento_id)
    and (select count(*) from public.prescricao_aprazamentos pa where pa.prescricao_id=d.prescricao_id)=1
    and exists(
      select 1 from public.dispensacoes_medicamentos d0
      where d0.prescricao_id=d.prescricao_id and d0.prescricao_componente_id is null and d0.dispensado_em<d.dispensado_em
        and (greatest(
               coalesce(nullif(d0.quantidade_atendida,0),d0.quantidade)
               - greatest(coalesce(d0.quantidade_devolvida,0),coalesce((select sum(dm.quantidade) from public.devolucoes_medicamentos dm where dm.dispensacao_id=d0.id),0)),0
             )>0
             or exists(select 1 from public.administracoes_medicamentos am where am.dispensacao_id=d0.id and am.status='administrado'))
    )
  on conflict do nothing;

  insert into public.integracao_pendencias(empresa_id,unidade_id,atendimento_id,paciente_id,regra_chave,origem_tabela,origem_id,setor_origem,setor_destino,severidade,titulo,detalhes,contexto)
  select d.empresa_id,d.unidade_id,d.atendimento_id,d.paciente_id,'dispensacao_sem_destino_assistencial','dispensacoes_medicamentos',d.id,'enfermagem','farmacia','alta',
         'Medicamento dispensado sem administração ou devolução','A dispensação mantém saldo e não foi usada em administração; não há mais aprazamento pendente. O item deve ser conferido e devolvido/regularizado fisicamente.',
         jsonb_build_object('prescricao_id',d.prescricao_id,'quantidade',d.quantidade,'quantidade_devolvida_registrada',d.quantidade_devolvida,'quantidade_devolvida_eventos',coalesce((select sum(dm.quantidade) from public.devolucoes_medicamentos dm where dm.dispensacao_id=d.id),0),'lote',d.lote,'validade',d.validade)
  from public.dispensacoes_medicamentos d
  where d.empresa_id=p_empresa_id and d.unidade_id=p_unidade_id and d.prescricao_id is not null and d.status in ('dispensado','parcial')
    and (p_atendimento_id is null or d.atendimento_id=p_atendimento_id)
    and greatest(
          coalesce(nullif(d.quantidade_atendida,0),d.quantidade)
          - greatest(coalesce(d.quantidade_devolvida,0),coalesce((select sum(dm.quantidade) from public.devolucoes_medicamentos dm where dm.dispensacao_id=d.id),0)),0
        )>0
    and exists(select 1 from public.prescricao_aprazamentos pa where pa.prescricao_id=d.prescricao_id)
    and not exists(select 1 from public.prescricao_aprazamentos pa where pa.prescricao_id=d.prescricao_id and pa.status='pendente')
    and not exists(select 1 from public.administracoes_medicamentos am where am.dispensacao_id=d.id and am.status='administrado')
  on conflict do nothing;

  insert into public.integracao_pendencias(empresa_id,unidade_id,atendimento_id,paciente_id,regra_chave,origem_tabela,origem_id,setor_origem,setor_destino,severidade,titulo,detalhes,contexto)
  select d.empresa_id,d.unidade_id,d.atendimento_id,d.paciente_id,'dispensacao_sem_movimento_estoque','dispensacoes_medicamentos',d.id,'farmacia','almoxarifado','critica',
         'Dispensação sem baixa rastreável no estoque','A dispensação foi registrada, mas não foi localizado movimento de consumo do mesmo lote/prescrição no estoque.',
         jsonb_build_object('prescricao_id',d.prescricao_id,'produto_id',d.produto_id,'estoque_lote_id',d.estoque_lote_id,'quantidade',d.quantidade,'dispensado_em',d.dispensado_em)
  from public.dispensacoes_medicamentos d
  where d.empresa_id=p_empresa_id and d.unidade_id=p_unidade_id and d.status in ('dispensado','parcial') and d.produto_id is not null and d.estoque_lote_id is not null
    and (p_atendimento_id is null or d.atendimento_id=p_atendimento_id)
    and not exists(
      select 1 from public.estoque_movimentos m
      where m.empresa_id=d.empresa_id and m.unidade_id=d.unidade_id and m.tipo='consumo_paciente' and m.atendimento_id=d.atendimento_id
        and m.prescricao_id is not distinct from d.prescricao_id and m.produto_id=d.produto_id and m.lote_id=d.estoque_lote_id
        and abs(extract(epoch from (m.created_at-d.dispensado_em))) <= 300 and m.quantidade=d.quantidade
    )
  on conflict do nothing;

  insert into public.integracao_pendencias(empresa_id,unidade_id,atendimento_id,paciente_id,regra_chave,origem_tabela,origem_id,setor_origem,setor_destino,severidade,titulo,detalhes,contexto)
  select am.empresa_id,am.unidade_id,am.atendimento_id,am.paciente_id,'administracao_sem_producao_medicamento','administracoes_medicamentos',am.id,'enfermagem','faturamento','alta',
         'Medicamento administrado sem produção ativa','A administração está concluída à beira-leito, mas não existe evento ativo de medicamento no Livro de Produção para a dispensação usada.',
         jsonb_build_object('prescricao_id',am.prescricao_id,'dispensacao_id',am.dispensacao_id,'produto_id',am.produto_id,'estoque_lote_id',am.estoque_lote_id,'administrado_em',am.administrado_em)
  from public.administracoes_medicamentos am
  where am.empresa_id=p_empresa_id and am.unidade_id=p_unidade_id and am.status='administrado' and am.dispensacao_id is not null
    and (p_atendimento_id is null or am.atendimento_id=p_atendimento_id)
    and not exists(select 1 from public.producao_assistencial_eventos pe where pe.origem_tipo='dispensacao_medicamento' and pe.origem_id=am.dispensacao_id and pe.status in ('registrado','consolidado'))
  on conflict do nothing;

  insert into public.integracao_pendencias(empresa_id,unidade_id,atendimento_id,paciente_id,regra_chave,origem_tabela,origem_id,setor_origem,setor_destino,severidade,titulo,detalhes,contexto)
  select pe.empresa_id,pe.unidade_id,pe.atendimento_id,pe.paciente_id,'producao_medicamento_sem_administracao','producao_assistencial_eventos',pe.id,'farmacia','faturamento','critica',
         'Produção de medicamento sem administração confirmada','O Livro de Produção mantém medicamento cobravel, porém a dispensação de origem não foi administrada e não existe mais aprazamento pendente.',
         jsonb_build_object('dispensacao_id',d.id,'prescricao_id',d.prescricao_id,'quantidade_producao',pe.quantidade,'dispensado_em',d.dispensado_em)
  from public.producao_assistencial_eventos pe
  join public.dispensacoes_medicamentos d on pe.origem_tipo='dispensacao_medicamento' and pe.origem_id=d.id
  where pe.empresa_id=p_empresa_id and pe.unidade_id=p_unidade_id and pe.tipo_evento='medicamento' and pe.status in ('registrado','consolidado') and pe.cobravel
    and (p_atendimento_id is null or pe.atendimento_id=p_atendimento_id)
    and exists(select 1 from public.prescricao_aprazamentos pa where pa.prescricao_id=d.prescricao_id)
    and not exists(select 1 from public.prescricao_aprazamentos pa where pa.prescricao_id=d.prescricao_id and pa.status='pendente')
    and not exists(select 1 from public.administracoes_medicamentos am where am.dispensacao_id=d.id and am.status='administrado')
  on conflict do nothing;

  insert into public.integracao_pendencias(empresa_id,unidade_id,atendimento_id,paciente_id,regra_chave,origem_tabela,origem_id,setor_origem,setor_destino,severidade,titulo,detalhes,contexto)
  select dm.empresa_id,dm.unidade_id,dm.atendimento_id,a.paciente_id,'devolucao_sem_movimento_estoque','devolucoes_medicamentos',dm.id,'farmacia','almoxarifado','critica',
         'Devolução de medicamento sem entrada rastreável no estoque','A devolução foi registrada, mas não foi localizado o movimento de retorno do mesmo lote/quantidade no estoque.',
         jsonb_build_object('dispensacao_id',dm.dispensacao_id,'produto_id',dm.produto_id,'estoque_lote_id',dm.estoque_lote_id,'quantidade',dm.quantidade,'devolvido_em',dm.devolvido_em)
  from public.devolucoes_medicamentos dm join public.atendimentos a on a.id=dm.atendimento_id
  left join public.dispensacoes_medicamentos d on d.id=dm.dispensacao_id
  where dm.empresa_id=p_empresa_id and dm.unidade_id=p_unidade_id and dm.produto_id is not null and dm.estoque_lote_id is not null
    and (p_atendimento_id is null or dm.atendimento_id=p_atendimento_id)
    and not exists(
      select 1 from public.estoque_movimentos m
      where m.empresa_id=dm.empresa_id and m.unidade_id=dm.unidade_id and m.tipo='devolucao' and m.atendimento_id=dm.atendimento_id
        and m.produto_id=dm.produto_id and m.lote_id=dm.estoque_lote_id and m.prescricao_id is not distinct from d.prescricao_id
        and abs(extract(epoch from (m.created_at-dm.devolvido_em))) <= 300 and m.quantidade=dm.quantidade
    )
  on conflict do nothing;

  update public.integracao_pendencias x
  set status='resolvida',resolvida_em=now(),resolvida_por=p_resolvida_por,updated_at=now()
  where x.empresa_id=p_empresa_id and x.unidade_id=p_unidade_id and x.status='aberta'
    and (p_atendimento_id is null or x.atendimento_id=p_atendimento_id)
    and x.regra_chave in (
      'prescricao_validacao_farmaceutica_pendente','dispensacao_excedente_aprazamento_unico','dispensacao_sem_destino_assistencial',
      'dispensacao_sem_movimento_estoque','administracao_sem_producao_medicamento','producao_medicamento_sem_administracao','devolucao_sem_movimento_estoque'
    )
    and (
      (x.regra_chave='prescricao_validacao_farmaceutica_pendente' and not exists(
        select 1 from public.prescricoes p where p.id=x.origem_id and p.status='ativa' and p.assinado_em is not null and p.requer_validacao_farmaceutica
          and not exists(select 1 from public.validacoes_farmaceuticas v where v.prescricao_id=p.id and v.status in ('validada','validada_com_ressalva'))
      ))
      or (x.regra_chave='dispensacao_excedente_aprazamento_unico' and not exists(
        select 1 from public.dispensacoes_medicamentos d where d.id=x.origem_id and d.status in ('dispensado','parcial')
          and (select count(*) from public.prescricao_aprazamentos pa where pa.prescricao_id=d.prescricao_id)=1
          and exists(select 1 from public.dispensacoes_medicamentos d0 where d0.prescricao_id=d.prescricao_id and d0.prescricao_componente_id is null and d0.dispensado_em<d.dispensado_em and (greatest(coalesce(nullif(d0.quantidade_atendida,0),d0.quantidade)-greatest(coalesce(d0.quantidade_devolvida,0),coalesce((select sum(dm.quantidade) from public.devolucoes_medicamentos dm where dm.dispensacao_id=d0.id),0)),0)>0 or exists(select 1 from public.administracoes_medicamentos am where am.dispensacao_id=d0.id and am.status='administrado')))
      ))
      or (x.regra_chave='dispensacao_sem_destino_assistencial' and not exists(
        select 1 from public.dispensacoes_medicamentos d where d.id=x.origem_id and d.status in ('dispensado','parcial')
          and greatest(coalesce(nullif(d.quantidade_atendida,0),d.quantidade)-greatest(coalesce(d.quantidade_devolvida,0),coalesce((select sum(dm.quantidade) from public.devolucoes_medicamentos dm where dm.dispensacao_id=d.id),0)),0)>0
          and exists(select 1 from public.prescricao_aprazamentos pa where pa.prescricao_id=d.prescricao_id)
          and not exists(select 1 from public.prescricao_aprazamentos pa where pa.prescricao_id=d.prescricao_id and pa.status='pendente')
          and not exists(select 1 from public.administracoes_medicamentos am where am.dispensacao_id=d.id and am.status='administrado')
      ))
      or (x.regra_chave='dispensacao_sem_movimento_estoque' and not exists(
        select 1 from public.dispensacoes_medicamentos d where d.id=x.origem_id and d.status in ('dispensado','parcial') and d.produto_id is not null and d.estoque_lote_id is not null
          and not exists(select 1 from public.estoque_movimentos m where m.empresa_id=d.empresa_id and m.unidade_id=d.unidade_id and m.tipo='consumo_paciente' and m.atendimento_id=d.atendimento_id and m.prescricao_id is not distinct from d.prescricao_id and m.produto_id=d.produto_id and m.lote_id=d.estoque_lote_id and abs(extract(epoch from (m.created_at-d.dispensado_em)))<=300 and m.quantidade=d.quantidade)
      ))
      or (x.regra_chave='administracao_sem_producao_medicamento' and not exists(
        select 1 from public.administracoes_medicamentos am where am.id=x.origem_id and am.status='administrado' and am.dispensacao_id is not null
          and not exists(select 1 from public.producao_assistencial_eventos pe where pe.origem_tipo='dispensacao_medicamento' and pe.origem_id=am.dispensacao_id and pe.status in ('registrado','consolidado'))
      ))
      or (x.regra_chave='producao_medicamento_sem_administracao' and not exists(
        select 1 from public.producao_assistencial_eventos pe join public.dispensacoes_medicamentos d on pe.origem_tipo='dispensacao_medicamento' and pe.origem_id=d.id
        where pe.id=x.origem_id and pe.tipo_evento='medicamento' and pe.status in ('registrado','consolidado') and pe.cobravel
          and exists(select 1 from public.prescricao_aprazamentos pa where pa.prescricao_id=d.prescricao_id)
          and not exists(select 1 from public.prescricao_aprazamentos pa where pa.prescricao_id=d.prescricao_id and pa.status='pendente')
          and not exists(select 1 from public.administracoes_medicamentos am where am.dispensacao_id=d.id and am.status='administrado')
      ))
      or (x.regra_chave='devolucao_sem_movimento_estoque' and not exists(
        select 1 from public.devolucoes_medicamentos dm left join public.dispensacoes_medicamentos d on d.id=dm.dispensacao_id where dm.id=x.origem_id and dm.produto_id is not null and dm.estoque_lote_id is not null
          and not exists(select 1 from public.estoque_movimentos m where m.empresa_id=dm.empresa_id and m.unidade_id=dm.unidade_id and m.tipo='devolucao' and m.atendimento_id=dm.atendimento_id and m.produto_id=dm.produto_id and m.lote_id=dm.estoque_lote_id and m.prescricao_id is not distinct from d.prescricao_id and abs(extract(epoch from (m.created_at-dm.devolvido_em)))<=300 and m.quantidade=dm.quantidade)
      ))
    );
  get diagnostics v_resolvidas = row_count;

  select count(*) into v_abertas from public.integracao_pendencias
  where empresa_id=p_empresa_id and unidade_id=p_unidade_id and status='aberta'
    and regra_chave in ('prescricao_validacao_farmaceutica_pendente','dispensacao_excedente_aprazamento_unico','dispensacao_sem_destino_assistencial','dispensacao_sem_movimento_estoque','administracao_sem_producao_medicamento','producao_medicamento_sem_administracao','devolucao_sem_movimento_estoque')
    and (p_atendimento_id is null or atendimento_id=p_atendimento_id);
  return jsonb_build_object('abertas_medicamentos',v_abertas,'resolvidas_nesta_execucao',v_resolvidas);
end;
$function$;
revoke all on function public.reconciliar_pendencias_medicamentos_internal(uuid,uuid,uuid,uuid) from public,anon,authenticated;

do $block$
declare r record;
begin
  for r in select distinct empresa_id,unidade_id from public.atendimentos loop
    perform public.reconciliar_pendencias_medicamentos_internal(r.empresa_id,r.unidade_id,null,null);
  end loop;
end;
$block$;
