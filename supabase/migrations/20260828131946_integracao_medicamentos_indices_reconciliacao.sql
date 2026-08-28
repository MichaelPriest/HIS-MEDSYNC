-- Índices focados nas correlações usadas pela reconciliação ponta a ponta de medicamentos.
create index if not exists idx_devolucoes_medicamentos_dispensacao
  on public.devolucoes_medicamentos(dispensacao_id, devolvido_em desc);

create index if not exists idx_administracoes_medicamentos_dispensacao_status
  on public.administracoes_medicamentos(dispensacao_id, status)
  where dispensacao_id is not null;

create index if not exists idx_estoque_movimentos_reconciliacao_medicamento
  on public.estoque_movimentos(empresa_id, unidade_id, atendimento_id, tipo, prescricao_id, produto_id, lote_id, created_at)
  where tipo in ('consumo_paciente','devolucao') and atendimento_id is not null;
