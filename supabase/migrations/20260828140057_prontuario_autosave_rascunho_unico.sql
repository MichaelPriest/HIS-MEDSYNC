create unique index if not exists ux_prontuario_anamneses_rascunho_profissional
  on public.prontuario_anamneses(atendimento_id, profissional_id)
  where assinado_em is null and bloqueado is false;

create unique index if not exists ux_prontuario_evolucoes_soap_rascunho_profissional
  on public.prontuario_evolucoes(atendimento_id, profissional_id)
  where assinado_em is null and bloqueado is false and tipo_evolucao = 'soap';
