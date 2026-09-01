"use server";

import { revalidatePath } from "next/cache";
import type { BackgroundActionState } from "@/lib/actions/background-action";
import { getAssistencialContext } from "@/modules/assistencial/context";

export type LaboratoryReportActionData = { redirectTo?: string };
export type LaboratoryReportActionState = BackgroundActionState<LaboratoryReportActionData>;

const txt = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

function failure(code: string, message: string, error?: { code?: string | null }): LaboratoryReportActionState {
  return {
    status: "error",
    code,
    message,
    detail: error?.code ? `Código técnico: ${error.code}` : undefined,
  };
}

function revalidateReport(laudoId?: string) {
  revalidatePath("/assistencial/laboratorio");
  revalidatePath("/assistencial/laboratorio/laudos");
  if (laudoId) revalidatePath(`/assistencial/laboratorio/laudos/${laudoId}`);
}

function success(message: string, laudoId?: string, data?: LaboratoryReportActionData): LaboratoryReportActionState {
  revalidateReport(laudoId);
  return { status: "success", message, data };
}

export async function abrirLaudoLaboratorio(
  _previousState: LaboratoryReportActionState,
  formData: FormData,
): Promise<LaboratoryReportActionState> {
  const { supabase } = await getAssistencialContext();
  const solicitacaoId = txt(formData, "solicitacao_id");
  if (!solicitacaoId) return failure("solicitacao", "A solicitação de exame não foi informada.");

  const { data: laudoId, error } = await supabase.rpc("salvar_laudo_laboratorio", {
    p_solicitacao_id: solicitacaoId,
    p_titulo: null,
    p_material: null,
    p_metodo: null,
    p_corpo: null,
    p_conclusao: null,
    p_observacoes: null,
  });

  if (error || !laudoId) {
    console.error("[laboratorio-laudo] abrir", { code: error?.code, operation: "salvar_laudo_laboratorio" });
    return failure("abrir-laudo", "Não foi possível iniciar o laudo laboratorial.", error ?? undefined);
  }

  const id = String(laudoId);
  return success("Laudo iniciado.", id, { redirectTo: `/assistencial/laboratorio/laudos/${id}` });
}

export async function salvarLaudoLaboratorio(
  _previousState: LaboratoryReportActionState,
  formData: FormData,
): Promise<LaboratoryReportActionState> {
  const { supabase } = await getAssistencialContext();
  const solicitacaoId = txt(formData, "solicitacao_id");
  const laudoIdAtual = txt(formData, "laudo_id");
  if (!solicitacaoId || !laudoIdAtual) return failure("laudo", "O laudo ou a solicitação não foi informado.");

  const { data: laudoId, error } = await supabase.rpc("salvar_laudo_laboratorio", {
    p_solicitacao_id: solicitacaoId,
    p_titulo: txt(formData, "titulo") || null,
    p_material: txt(formData, "material") || null,
    p_metodo: txt(formData, "metodo") || null,
    p_corpo: txt(formData, "corpo") || null,
    p_conclusao: txt(formData, "conclusao") || null,
    p_observacoes: txt(formData, "observacoes") || null,
  });

  if (error || !laudoId) {
    console.error("[laboratorio-laudo] salvar", { code: error?.code, operation: "salvar_laudo_laboratorio" });
    return failure("salvar-laudo", "Não foi possível salvar o rascunho do laudo.", error ?? undefined);
  }

  return success("Rascunho do laudo salvo.", String(laudoId));
}

export async function validarResultadoNoLaudo(
  _previousState: LaboratoryReportActionState,
  formData: FormData,
): Promise<LaboratoryReportActionState> {
  const { supabase } = await getAssistencialContext();
  const laudoId = txt(formData, "laudo_id");
  const resultadoId = txt(formData, "resultado_id");
  if (!laudoId || !resultadoId) return failure("resultado", "O laudo ou o resultado não foi informado.");

  const { error } = await supabase.rpc("liberar_resultado_laboratorio", { p_resultado_id: resultadoId });
  if (error) {
    console.error("[laboratorio-laudo] validar resultado", { code: error.code, operation: "liberar_resultado_laboratorio" });
    return failure("validar-resultado", "Não foi possível validar tecnicamente o analito.", error);
  }
  return success("Analito validado tecnicamente.", laudoId);
}

export async function notificarCriticoNoLaudo(
  _previousState: LaboratoryReportActionState,
  formData: FormData,
): Promise<LaboratoryReportActionState> {
  const { supabase } = await getAssistencialContext();
  const laudoId = txt(formData, "laudo_id");
  const resultadoId = txt(formData, "resultado_id");
  const notificadoA = txt(formData, "notificado_a");
  if (!laudoId || !resultadoId || !notificadoA) return failure("notificacao", "Informe o resultado crítico e a pessoa comunicada.");

  const { error } = await supabase.rpc("registrar_notificacao_resultado_critico", {
    p_resultado_id: resultadoId,
    p_notificado_a: notificadoA,
    p_meio: txt(formData, "meio") || null,
    p_readback: formData.get("readback") === "on",
    p_observacoes: txt(formData, "observacoes") || null,
  });
  if (error) {
    console.error("[laboratorio-laudo] notificar crítico", { code: error.code, operation: "registrar_notificacao_resultado_critico" });
    return failure("notificar-critico", "Não foi possível registrar a comunicação do resultado crítico.", error);
  }
  return success("Comunicação do resultado crítico registrada.", laudoId);
}

export async function liberarLaudoLaboratorio(
  _previousState: LaboratoryReportActionState,
  formData: FormData,
): Promise<LaboratoryReportActionState> {
  const { supabase } = await getAssistencialContext();
  const laudoId = txt(formData, "laudo_id");
  if (!laudoId) return failure("laudo", "O laudo não foi informado para liberação.");

  const { error } = await supabase.rpc("liberar_laudo_laboratorio", { p_laudo_id: laudoId });
  if (error) {
    console.error("[laboratorio-laudo] liberar", { code: error.code, operation: "liberar_laudo_laboratorio" });
    return failure("liberar-laudo", "Não foi possível assinar e liberar o laudo.", error);
  }
  return success("Laudo assinado e liberado.", laudoId);
}

export async function abrirRetificacaoLaudoLaboratorio(
  _previousState: LaboratoryReportActionState,
  formData: FormData,
): Promise<LaboratoryReportActionState> {
  const { supabase } = await getAssistencialContext();
  const laudoId = txt(formData, "laudo_id");
  const motivo = txt(formData, "motivo");
  if (!laudoId || !motivo) return failure("retificacao", "Informe o motivo obrigatório da retificação.");

  const { error } = await supabase.rpc("abrir_retificacao_laudo_laboratorio", {
    p_laudo_id: laudoId,
    p_motivo: motivo,
  });
  if (error) {
    console.error("[laboratorio-laudo] retificar", { code: error.code, operation: "abrir_retificacao_laudo_laboratorio" });
    return failure("retificar-laudo", "Não foi possível abrir uma nova versão para retificação.", error);
  }
  return success("Nova versão de retificação aberta.", laudoId);
}
