"use server";

import { revalidatePath } from "next/cache";
import type { BackgroundActionState } from "@/lib/actions/background-action";
import { getAssistencialContext } from "@/modules/assistencial/context";

export type TissGuideCommunicationData = {
  guiaId: string;
  status: string;
  errors: number;
};

function text(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function communicationMessage(message?: string | null) {
  const value = String(message ?? "");
  if (value.includes("TISS_GUIA_NAO_EDITAVEL")) return ["nao-editavel", "A guia já entrou em uma etapa que não permite alterar o complemento de comunicação."] as const;
  if (value.includes("TISS_GUIA_SEM_PERMISSAO") || value.includes("TISS_GUIA_NAO_AUTENTICADO")) return ["permissao", "Seu perfil não possui permissão para alterar o complemento TISS."] as const;
  if (value.includes("TISS_GUIA_NAO_LOCALIZADA")) return ["nao-localizada", "A guia não foi localizada no escopo atual."] as const;
  if (value.includes("check constraint") || value.includes("violates check constraint")) return ["dominio", "Um dos códigos informados não pertence ao domínio permitido pela Comunicação TISS 04.03.00."] as const;
  return ["falha", "Não foi possível salvar o complemento de comunicação. Os campos foram preservados."] as const;
}

export async function salvarComplementoComunicacaoTissBackground(
  guiaId: string,
  _previous: BackgroundActionState<TissGuideCommunicationData>,
  formData: FormData,
): Promise<BackgroundActionState<TissGuideCommunicationData>> {
  const { supabase } = await getAssistencialContext();
  const { data, error } = await supabase.rpc("salvar_complemento_comunicacao_tiss_040300_operacional", {
    p_guia_id: guiaId,
    p_codigo_conselho_ans: text(formData, "codigo_conselho_ans_snapshot"),
    p_indicador_acidente: text(formData, "indicador_acidente"),
    p_regime_atendimento: text(formData, "regime_atendimento_tiss"),
    p_carater_atendimento: text(formData, "carater_atendimento"),
    p_numero_solicitacao_internacao: text(formData, "numero_solicitacao_internacao"),
    p_data_autorizacao: text(formData, "data_autorizacao"),
    p_tipo_faturamento: text(formData, "tipo_faturamento_tiss"),
    p_data_inicio_faturamento: text(formData, "data_inicio_faturamento"),
    p_hora_inicio_faturamento: text(formData, "hora_inicio_faturamento"),
    p_data_fim_faturamento: text(formData, "data_fim_faturamento"),
    p_hora_fim_faturamento: text(formData, "hora_fim_faturamento"),
    p_tipo_internacao: text(formData, "tipo_internacao_tiss"),
    p_regime_internacao: text(formData, "regime_internacao_tiss"),
    p_motivo_encerramento: text(formData, "motivo_encerramento_tiss"),
    p_solicitante_codigo_prestador: text(formData, "solicitante_codigo_prestador_snapshot"),
    p_solicitante_cnpj: text(formData, "solicitante_cnpj_snapshot"),
    p_solicitante_nome_contratado: text(formData, "solicitante_nome_contratado_snapshot"),
    p_solicitante_nome_profissional: text(formData, "solicitante_nome_profissional_snapshot"),
    p_solicitante_codigo_conselho_ans: text(formData, "solicitante_codigo_conselho_ans_snapshot"),
    p_solicitante_numero_conselho: text(formData, "solicitante_numero_conselho_snapshot"),
    p_solicitante_uf_conselho: text(formData, "solicitante_uf_conselho_snapshot"),
    p_solicitante_cbo: text(formData, "solicitante_cbo_snapshot"),
  });

  if (error) {
    const [code, message] = communicationMessage(error.message);
    console.error("[tiss.guia.comunicacao] falha ao salvar complemento", { code: error.code, category: code });
    return { status: "error", code, message };
  }

  const result = (data ?? {}) as { status?: string; erros?: number };
  const status = String(result.status ?? "rascunho");
  const errors = Number(result.erros ?? 0);

  revalidatePath("/faturamento/guias");
  revalidatePath(`/faturamento/guias/${guiaId}`);
  revalidatePath("/faturamento/lotes");

  return {
    status: "success",
    code: errors > 0 ? "complemento-com-criticas" : "complemento-pronto",
    message: errors > 0
      ? `Complemento salvo. A guia continua bloqueada por ${errors} crítica(s); revise a validação acima.`
      : "Complemento salvo e revalidado. A guia está pronta para composição do XML TISS.",
    data: { guiaId, status, errors },
  };
}
