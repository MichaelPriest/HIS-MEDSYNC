export type InternacaoAdmissionInput = {
  atendimentoId: string;
  setor: string;
  profissionalResponsavelId?: string | null;
  leitoId?: string | null;
  acomodacao?: string | null;
  acomodacaoTuss49Codigo?: string | null;
  motivo?: string | null;
  previsaoAlta?: string | null;
  observacoes?: string | null;
};

function optional(value?: string | null) {
  const normalized = value?.trim();
  return normalized || null;
}

export function buildInternacaoAdmissionRpcParams(input: InternacaoAdmissionInput) {
  const atendimentoId = input.atendimentoId.trim();
  const setor = input.setor.trim();

  if (!atendimentoId || !setor) {
    throw new Error("INTERNACAO_CAMPOS_OBRIGATORIOS");
  }

  return {
    p_atendimento_id: atendimentoId,
    p_setor: setor,
    p_profissional_responsavel_id: optional(input.profissionalResponsavelId),
    p_leito_id: optional(input.leitoId),
    p_acomodacao: optional(input.acomodacao),
    p_acomodacao_tuss49_codigo: optional(input.acomodacaoTuss49Codigo),
    p_motivo: optional(input.motivo),
    p_previsao_alta: optional(input.previsaoAlta),
    p_observacoes: optional(input.observacoes),
  };
}
