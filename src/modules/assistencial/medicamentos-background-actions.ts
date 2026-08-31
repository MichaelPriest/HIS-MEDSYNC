"use server";

import { revalidatePath } from "next/cache";
import type { BackgroundActionState } from "@/lib/actions/background-action";
import { getAssistencialContext } from "@/modules/assistencial/context";

type PharmacyActionData = {
  allocations?: number;
  generated?: number;
};

export type PharmacyActionState = BackgroundActionState<PharmacyActionData>;

function text(fd: FormData, key: string) {
  const value = String(fd.get(key) ?? "").trim();
  return value || null;
}

function numberValue(fd: FormData, key: string) {
  const raw = text(fd, key);
  if (!raw) return null;
  const n = Number(raw.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function failure(code: string, message: string, detail?: string): PharmacyActionState {
  return { status: "error", code, message, detail };
}

function technicalDetail(error: { code?: string | null }) {
  return error.code ? `Código técnico: ${error.code}` : undefined;
}

function medicationErrorMessage(raw: string) {
  const messages: Record<string, string> = {
    FARMACIA_ESTOQUE_FEFO_INSUFICIENTE: "Estoque FEFO válido insuficiente. Confira lotes disponíveis, validade e farmácia configurada.",
    FARMACIA_PRODUTO_SEM_LOCAL_DISPENSACAO: "O produto não está habilitado para dispensação em uma farmácia desta unidade.",
    FARMACIA_VALIDACAO_FARMACEUTICA_PENDENTE: "A prescrição ainda precisa de validação farmacêutica antes da dispensação.",
    FARMACIA_PRESCRICAO_SEM_PRODUTO_ESTOQUE: "A prescrição ainda não está vinculada a um produto de estoque.",
    FARMACIA_COMPONENTE_SEM_PRODUTO_ESTOQUE: "O componente ainda não está vinculado a um produto de estoque.",
    FARMACIA_DEVOLUCAO_SUPERIOR_SALDO: "A quantidade informada é maior que o saldo disponível para devolução.",
    CONCILIACAO_SEM_PERMISSAO: "Seu perfil não possui permissão para registrar conciliação medicamentosa.",
  };
  return messages[raw] ?? "Não foi possível concluir a operação farmacêutica. Confira os dados e tente novamente.";
}

function invalidateMedicationViews() {
  revalidatePath("/assistencial/medicamentos");
  revalidatePath("/assistencial/enfermagem");
  revalidatePath("/assistencial/enfermagem/andares");
  revalidatePath("/assistencial/enfermagem/pronto-socorro");
}

export async function gerarAprazamentosBackgroundAction(
  _previousState: PharmacyActionState,
  fd: FormData,
): Promise<PharmacyActionState> {
  const { supabase } = await getAssistencialContext();
  const prescricaoId = String(fd.get("prescricao_id") ?? "").trim();
  const horizonte = Math.max(1, Math.min(7, Number(fd.get("horizonte_dias") ?? 2) || 2));
  if (!prescricaoId) return failure("prescricao", "A prescrição não foi informada.");

  const { data, error } = await supabase.rpc("gerar_aprazamentos_prescricao", {
    p_prescricao_id: prescricaoId,
    p_horizonte_dias: horizonte,
  });
  if (error) {
    console.error("[medicamentos] aprazar", { code: error.code, operation: "gerar_aprazamentos_prescricao" });
    return failure("aprazamento", medicationErrorMessage(error.message), technicalDetail(error));
  }

  invalidateMedicationViews();
  const generated = Number(data ?? 0);
  return { status: "success", message: `${generated} aprazamento(s) gerado(s).`, data: { generated } };
}

export async function validarPrescricaoFarmaceuticaBackgroundAction(
  _previousState: PharmacyActionState,
  fd: FormData,
): Promise<PharmacyActionState> {
  const { supabase } = await getAssistencialContext();
  const prescricaoId = String(fd.get("prescricao_id") ?? "").trim();
  if (!prescricaoId) return failure("prescricao", "A prescrição não foi informada.");

  const { error } = await supabase.rpc("validar_prescricao_farmaceutica", {
    p_prescricao_id: prescricaoId,
    p_status: text(fd, "status") ?? "validada",
    p_alergias: fd.get("alergias") === "on",
    p_interacoes: fd.get("interacoes") === "on",
    p_dose: fd.get("dose") === "on",
    p_via: fd.get("via") === "on",
    p_funcao_renal: fd.get("funcao_renal") === "on",
    p_duplicidade: fd.get("duplicidade") === "on",
    p_incompatibilidades: text(fd, "incompatibilidades"),
    p_intervencao: text(fd, "intervencao"),
  });
  if (error) {
    console.error("[medicamentos] validar", { code: error.code, operation: "validar_prescricao_farmaceutica" });
    return failure("validacao", medicationErrorMessage(error.message), technicalDetail(error));
  }

  revalidatePath("/assistencial/medicamentos");
  return { status: "success", message: "Validação farmacêutica registrada." };
}

export async function dispensarPrescricaoBackgroundAction(
  _previousState: PharmacyActionState,
  fd: FormData,
): Promise<PharmacyActionState> {
  const { supabase } = await getAssistencialContext();
  const prescricaoId = String(fd.get("prescricao_id") ?? "").trim();
  const quantidade = numberValue(fd, "quantidade");
  const farmaciaLocalId = text(fd, "farmacia_local_id");
  if (!prescricaoId || !quantidade || quantidade <= 0) {
    return failure("dispensacao", "Informe uma prescrição e uma quantidade válida para dispensação.");
  }

  const { data, error } = await supabase.rpc("dispensar_medicamento_prescricao_fefo", {
    p_prescricao_id: prescricaoId,
    p_quantidade: quantidade,
    p_farmacia_local_id: farmaciaLocalId,
  });
  if (error) {
    console.error("[medicamentos] dispensar FEFO", { code: error.code, operation: "dispensar_medicamento_prescricao_fefo" });
    return failure("dispensacao-fefo", medicationErrorMessage(error.message), technicalDetail(error));
  }

  const allocations = data && typeof data === "object" && "alocacoes" in data && Array.isArray(data.alocacoes) ? data.alocacoes.length : 1;
  invalidateMedicationViews();
  return { status: "success", message: `Dispensação FEFO concluída em ${allocations} lote(s).`, data: { allocations } };
}

export async function dispensarComponentePrescricaoBackgroundAction(
  _previousState: PharmacyActionState,
  fd: FormData,
): Promise<PharmacyActionState> {
  const { supabase } = await getAssistencialContext();
  const componenteId = String(fd.get("prescricao_componente_id") ?? "").trim();
  const quantidade = numberValue(fd, "quantidade");
  const farmaciaLocalId = text(fd, "farmacia_local_id");
  if (!componenteId || !quantidade || quantidade <= 0) {
    return failure("dispensacao-componente", "Informe o componente e uma quantidade válida para dispensação.");
  }

  const { data, error } = await supabase.rpc("dispensar_componente_prescricao_fefo", {
    p_prescricao_componente_id: componenteId,
    p_quantidade: quantidade,
    p_farmacia_local_id: farmaciaLocalId,
  });
  if (error) {
    console.error("[medicamentos] dispensar componente FEFO", { code: error.code, operation: "dispensar_componente_prescricao_fefo" });
    return failure("dispensacao-componente-fefo", medicationErrorMessage(error.message), technicalDetail(error));
  }

  const allocations = data && typeof data === "object" && "alocacoes" in data && Array.isArray(data.alocacoes) ? data.alocacoes.length : 1;
  invalidateMedicationViews();
  return { status: "success", message: `Componente dispensado por FEFO em ${allocations} lote(s).`, data: { allocations } };
}

export async function devolverMedicamentoBackgroundAction(
  _previousState: PharmacyActionState,
  fd: FormData,
): Promise<PharmacyActionState> {
  const { supabase } = await getAssistencialContext();
  const dispensacaoId = String(fd.get("dispensacao_id") ?? "").trim();
  const quantidade = numberValue(fd, "quantidade");
  const motivo = String(fd.get("motivo") ?? "").trim();
  if (!dispensacaoId || !quantidade || quantidade <= 0 || !motivo) {
    return failure("devolucao", "Informe dispensação, quantidade e motivo da devolução.");
  }

  const { error } = await supabase.rpc("devolver_medicamento_dispensacao", {
    p_dispensacao_id: dispensacaoId,
    p_quantidade: quantidade,
    p_motivo: motivo,
  });
  if (error) {
    console.error("[medicamentos] devolver", { code: error.code, operation: "devolver_medicamento_dispensacao" });
    return failure("devolucao", medicationErrorMessage(error.message), technicalDetail(error));
  }

  invalidateMedicationViews();
  return { status: "success", message: "Devolução registrada e estoque revalidado." };
}

export async function registrarConciliacaoMedicamentosaBackgroundAction(
  _previousState: PharmacyActionState,
  fd: FormData,
): Promise<PharmacyActionState> {
  const { supabase } = await getAssistencialContext();
  const atendimentoId = String(fd.get("atendimento_id") ?? "").trim();
  const medicamento = String(fd.get("medicamento") ?? "").trim();
  if (!atendimentoId || !medicamento) {
    return failure("conciliacao", "Selecione o atendimento e informe o medicamento de uso domiciliar.");
  }

  const { error } = await supabase.rpc("registrar_conciliacao_medicamentosa", {
    p_atendimento_id: atendimentoId,
    p_momento: text(fd, "momento") ?? "admissao",
    p_medicamento: medicamento,
    p_dose_domiciliar: text(fd, "dose_domiciliar"),
    p_via_domiciliar: text(fd, "via_domiciliar"),
    p_frequencia_domiciliar: text(fd, "frequencia_domiciliar"),
    p_fonte_informacao: text(fd, "fonte_informacao"),
    p_decisao: text(fd, "decisao") ?? "manter",
    p_prescricao_id: text(fd, "prescricao_id"),
    p_divergencia: text(fd, "divergencia"),
    p_intencional: fd.get("intencional") === "on",
    p_justificativa: text(fd, "justificativa"),
    p_observacoes: text(fd, "observacoes"),
  });
  if (error) {
    console.error("[medicamentos] conciliar", { code: error.code, operation: "registrar_conciliacao_medicamentosa" });
    return failure("conciliacao", medicationErrorMessage(error.message), technicalDetail(error));
  }

  revalidatePath("/assistencial/medicamentos");
  revalidatePath("/internacao/altas");
  return { status: "success", message: "Conciliação medicamentosa registrada." };
}
