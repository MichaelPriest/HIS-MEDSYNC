"use server";

import { revalidatePath } from "next/cache";
import type { BackgroundActionState } from "@/lib/actions/background-action";
import { getAssistencialContext } from "@/modules/assistencial/context";

export type RadiologyReportActionData = { redirectTo?: string };
export type RadiologyReportActionState = BackgroundActionState<RadiologyReportActionData>;

const txt = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

function failure(code: string, message: string, error?: { code?: string | null }): RadiologyReportActionState {
  return {
    status: "error",
    code,
    message,
    detail: error?.code ? `Código técnico: ${error.code}` : undefined,
  };
}

function revalidateReport(laudoId?: string) {
  revalidatePath("/assistencial/imagem");
  revalidatePath("/assistencial/imagem/laudos");
  if (laudoId) revalidatePath(`/assistencial/imagem/laudos/${laudoId}`);
}

function success(message: string, laudoId?: string, data?: RadiologyReportActionData): RadiologyReportActionState {
  revalidateReport(laudoId);
  return { status: "success", message, data };
}

export async function abrirLaudoImagemBackground(
  _previousState: RadiologyReportActionState,
  formData: FormData,
): Promise<RadiologyReportActionState> {
  const { supabase } = await getAssistencialContext();
  const execucaoId = txt(formData, "execucao_id");
  if (!execucaoId) return failure("execucao", "Selecione uma execução concluída antes de iniciar o laudo.");

  const { data: laudoId, error } = await supabase.rpc("salvar_laudo_imagem", {
    p_execucao_id: execucaoId,
    p_tecnica: txt(formData, "tecnica") || null,
    p_achados: txt(formData, "achados") || null,
    p_conclusao: txt(formData, "conclusao") || null,
    p_recomendacoes: txt(formData, "recomendacoes") || null,
  });

  if (error || !laudoId) {
    console.error("[imagem-laudo] abrir", { code: error?.code, operation: "salvar_laudo_imagem" });
    return failure("abrir-laudo", "Não foi possível iniciar o laudo de imagem.", error ?? undefined);
  }

  const id = String(laudoId);
  return success("Laudo iniciado.", id, { redirectTo: `/assistencial/imagem/laudos/${id}` });
}

export async function salvarLaudoImagemBackground(
  _previousState: RadiologyReportActionState,
  formData: FormData,
): Promise<RadiologyReportActionState> {
  const { supabase } = await getAssistencialContext();
  const execucaoId = txt(formData, "execucao_id");
  const laudoIdAtual = txt(formData, "laudo_id");
  if (!execucaoId || !laudoIdAtual) return failure("laudo", "O laudo ou a execução não foi informado.");

  const { data: laudoId, error } = await supabase.rpc("salvar_laudo_imagem", {
    p_execucao_id: execucaoId,
    p_tecnica: txt(formData, "tecnica") || null,
    p_achados: txt(formData, "achados") || null,
    p_conclusao: txt(formData, "conclusao") || null,
    p_recomendacoes: txt(formData, "recomendacoes") || null,
  });

  if (error || !laudoId) {
    console.error("[imagem-laudo] salvar", { code: error?.code, operation: "salvar_laudo_imagem" });
    return failure("salvar-laudo", "Não foi possível salvar o rascunho do laudo.", error ?? undefined);
  }

  return success("Rascunho do laudo salvo.", String(laudoId));
}

export async function registrarCriticidadeLaudoImagemBackground(
  _previousState: RadiologyReportActionState,
  formData: FormData,
): Promise<RadiologyReportActionState> {
  const { supabase } = await getAssistencialContext();
  const laudoId = txt(formData, "laudo_id");
  if (!laudoId) return failure("laudo", "O laudo não foi informado.");

  const achadoCritico = formData.get("achado_critico") === "on";
  const comunicadaA = txt(formData, "comunicada_a");
  if (achadoCritico && !comunicadaA) {
    return failure("comunicacao-critica", "Informe a pessoa comunicada quando houver achado crítico.");
  }

  const { error } = await supabase.rpc("registrar_criticidade_laudo_imagem", {
    p_laudo_id: laudoId,
    p_achado_critico: achadoCritico,
    p_comunicada_a: comunicadaA || null,
    p_meio: txt(formData, "meio") || null,
    p_readback: formData.get("readback") === "on",
    p_observacao: txt(formData, "observacao") || null,
  });

  if (error) {
    console.error("[imagem-laudo] criticidade", { code: error.code, operation: "registrar_criticidade_laudo_imagem" });
    return failure("criticidade", "Não foi possível registrar a criticidade/comunicação clínica.", error);
  }

  return success(
    achadoCritico ? "Criticidade e comunicação clínica registradas." : "Criticidade do laudo atualizada.",
    laudoId,
  );
}

export async function liberarLaudoImagemBackground(
  _previousState: RadiologyReportActionState,
  formData: FormData,
): Promise<RadiologyReportActionState> {
  const { supabase } = await getAssistencialContext();
  const laudoId = txt(formData, "laudo_id");
  if (!laudoId) return failure("laudo", "O laudo não foi informado para liberação.");

  const { error } = await supabase.rpc("liberar_laudo_imagem", { p_laudo_id: laudoId });
  if (error) {
    console.error("[imagem-laudo] liberar", { code: error.code, operation: "liberar_laudo_imagem" });
    return failure("liberar-laudo", "Não foi possível assinar e liberar o laudo.", error);
  }

  return success("Laudo assinado e liberado.", laudoId);
}

export async function abrirRetificacaoLaudoImagemBackground(
  _previousState: RadiologyReportActionState,
  formData: FormData,
): Promise<RadiologyReportActionState> {
  const { supabase } = await getAssistencialContext();
  const laudoId = txt(formData, "laudo_id");
  const motivo = txt(formData, "motivo");
  if (!laudoId || !motivo) return failure("retificacao", "Informe o motivo obrigatório da retificação.");

  const { error } = await supabase.rpc("abrir_retificacao_laudo_imagem", {
    p_laudo_id: laudoId,
    p_motivo: motivo,
  });

  if (error) {
    console.error("[imagem-laudo] retificar", { code: error.code, operation: "abrir_retificacao_laudo_imagem" });
    return failure("retificar-laudo", "Não foi possível abrir uma nova revisão para retificação.", error);
  }

  return success("Nova revisão de retificação aberta.", laudoId);
}
