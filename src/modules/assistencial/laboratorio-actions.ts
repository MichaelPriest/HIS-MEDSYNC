"use server";

import { revalidatePath } from "next/cache";
import type { BackgroundActionState } from "@/lib/actions/background-action";
import { getAssistencialContext } from "@/modules/assistencial/context";

export type LaboratoryActionState = BackgroundActionState;

const txt = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const numero = (value: string) => {
  if (!value) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
};

function failure(code: string, message: string, error?: { code?: string | null }): LaboratoryActionState {
  return {
    status: "error",
    code,
    message,
    detail: error?.code ? `Código técnico: ${error.code}` : undefined,
  };
}

function success(message: string): LaboratoryActionState {
  revalidatePath("/assistencial/laboratorio");
  revalidatePath("/assistencial/laboratorio/laudos");
  return { status: "success", message };
}

export async function prepararAmostraLaboratorio(
  _previousState: LaboratoryActionState,
  formData: FormData,
): Promise<LaboratoryActionState> {
  const { supabase } = await getAssistencialContext();
  const solicitacaoId = txt(formData, "solicitacao_id");
  if (!solicitacaoId) return failure("solicitacao", "A solicitação de exame não foi informada.");

  const { error } = await supabase.rpc("preparar_amostra_laboratorio_operacional", {
    p_solicitacao_id: solicitacaoId,
    p_material: txt(formData, "material") || null,
    p_recipiente: txt(formData, "recipiente") || null,
    p_prioridade: txt(formData, "prioridade") || null,
    p_coleta_prevista_em: txt(formData, "coleta_prevista_em") || null,
  });
  if (error) {
    console.error("[laboratorio] preparar amostra", { code: error.code, operation: "preparar_amostra_laboratorio_operacional" });
    return failure("preparar-amostra", "Não foi possível gerar a amostra e o accession.", error);
  }
  return success("Amostra preparada e vinculada à solicitação.");
}

export async function atualizarStatusAmostraLaboratorio(
  _previousState: LaboratoryActionState,
  formData: FormData,
): Promise<LaboratoryActionState> {
  const { supabase } = await getAssistencialContext();
  const id = txt(formData, "amostra_id");
  const acao = txt(formData, "acao");
  if (!id || !acao) return failure("acao", "Informe a amostra e a ação operacional.");

  const { error } = await supabase.rpc("atualizar_status_amostra_laboratorio_operacional", {
    p_amostra_id: id,
    p_acao: acao,
    p_temperatura_recebimento: numero(txt(formData, "temperatura_recebimento")),
    p_motivo: txt(formData, "motivo") || null,
  });
  if (error) {
    console.error("[laboratorio] status amostra", { code: error.code, operation: "atualizar_status_amostra_laboratorio_operacional" });
    return failure("status-amostra", "Não foi possível atualizar a cadeia de custódia da amostra.", error);
  }
  return success("Status da amostra atualizado.");
}

export async function encaminharAmostraLaboratorio(
  _previousState: LaboratoryActionState,
  formData: FormData,
): Promise<LaboratoryActionState> {
  const { supabase } = await getAssistencialContext();
  const id = txt(formData, "amostra_id");
  const setor = txt(formData, "setor");
  if (!id || !setor) return failure("setor-obrigatorio", "Informe o setor de processamento da amostra.");

  const { error } = await supabase.rpc("encaminhar_amostra_laboratorio_operacional", {
    p_amostra_id: id,
    p_setor: setor,
    p_bancada: txt(formData, "bancada") || null,
  });
  if (error) {
    console.error("[laboratorio] encaminhar amostra", { code: error.code, operation: "encaminhar_amostra_laboratorio_operacional" });
    return failure("encaminhar-amostra", "Não foi possível encaminhar a amostra para o setor/bancada.", error);
  }
  return success("Amostra encaminhada para processamento.");
}

export async function registrarResultadoLaboratorio(
  _previousState: LaboratoryActionState,
  formData: FormData,
): Promise<LaboratoryActionState> {
  const { supabase } = await getAssistencialContext();
  const amostraId = txt(formData, "amostra_id");
  const analitoId = txt(formData, "catalogo_analito_id");
  if (!amostraId || !analitoId) return failure("dados-resultado", "Selecione a amostra e o analito antes de salvar o resultado.");

  const { error } = await supabase.rpc("registrar_resultado_laboratorio_operacional", {
    p_amostra_id: amostraId,
    p_catalogo_analito_id: analitoId,
    p_laboratorio_equipamento_id: txt(formData, "laboratorio_equipamento_id") || null,
    p_resultado: txt(formData, "resultado") || null,
    p_valor_numerico: numero(txt(formData, "valor_numerico")),
  });
  if (error) {
    console.error("[laboratorio] registrar resultado", { code: error.code, operation: "registrar_resultado_laboratorio_operacional" });
    return failure("resultado", "Não foi possível registrar o resultado laboratorial.", error);
  }
  return success("Resultado laboratorial salvo.");
}

export async function liberarResultadoLaboratorio(
  _previousState: LaboratoryActionState,
  formData: FormData,
): Promise<LaboratoryActionState> {
  const { supabase } = await getAssistencialContext();
  const resultadoId = txt(formData, "resultado_id");
  if (!resultadoId) return failure("resultado", "O resultado não foi informado para validação técnica.");

  const { error } = await supabase.rpc("liberar_resultado_laboratorio", { p_resultado_id: resultadoId });
  if (error) {
    console.error("[laboratorio] liberar resultado", { code: error.code, operation: "liberar_resultado_laboratorio" });
    return failure("liberar-resultado", "Não foi possível validar tecnicamente o resultado.", error);
  }
  return success("Resultado validado tecnicamente.");
}

export async function notificarResultadoCriticoLaboratorio(
  _previousState: LaboratoryActionState,
  formData: FormData,
): Promise<LaboratoryActionState> {
  const { supabase } = await getAssistencialContext();
  const resultadoId = txt(formData, "resultado_id");
  const notificadoA = txt(formData, "notificado_a");
  if (!resultadoId || !notificadoA) return failure("notificacao", "Informe o resultado e a pessoa comunicada.");

  const { error } = await supabase.rpc("registrar_notificacao_resultado_critico", {
    p_resultado_id: resultadoId,
    p_notificado_a: notificadoA,
    p_meio: txt(formData, "meio") || null,
    p_readback: formData.get("readback") === "on",
    p_observacoes: txt(formData, "observacoes") || null,
  });
  if (error) {
    console.error("[laboratorio] notificar crítico", { code: error.code, operation: "registrar_notificacao_resultado_critico" });
    return failure("notificar-critico", "Não foi possível registrar a comunicação do resultado crítico.", error);
  }
  return success("Comunicação do resultado crítico registrada com rastreabilidade.");
}
