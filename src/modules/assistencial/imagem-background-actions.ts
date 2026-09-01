"use server";

import { revalidatePath } from "next/cache";
import type { BackgroundActionState } from "@/lib/actions/background-action";
import { getAssistencialContext } from "@/modules/assistencial/context";

export type RadiologyActionState = BackgroundActionState;

const txt = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const numero = (value: string) => {
  if (!value) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
};

function failure(code: string, message: string, error?: { code?: string | null }): RadiologyActionState {
  return {
    status: "error",
    code,
    message,
    detail: error?.code ? `Código técnico: ${error.code}` : undefined,
  };
}

function success(message: string): RadiologyActionState {
  revalidatePath("/assistencial/imagem");
  revalidatePath("/assistencial/imagem/laudos");
  return { status: "success", message };
}

async function profissionalLogado(
  supabase: Awaited<ReturnType<typeof getAssistencialContext>>["supabase"],
  userId: string,
  empresaId: string,
) {
  const { data } = await supabase
    .from("profissionais")
    .select("id")
    .eq("usuario_id", userId)
    .eq("empresa_id", empresaId)
    .eq("ativo", true)
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

export async function agendarImagemBackground(
  _previousState: RadiologyActionState,
  formData: FormData,
): Promise<RadiologyActionState> {
  const { supabase } = await getAssistencialContext();
  const solicitacaoId = txt(formData, "solicitacao_id");
  const agendadoEm = txt(formData, "agendado_em");
  if (!solicitacaoId || !agendadoEm) return failure("campos-agenda", "Informe a solicitação e a data/hora do agendamento.");

  const { error } = await supabase.rpc("agendar_exame_imagem_operacional", {
    p_solicitacao_id: solicitacaoId,
    p_agendado_em: agendadoEm,
    p_duracao_minutos: numero(txt(formData, "duracao_minutos")) ?? 30,
    p_protocolo_id: txt(formData, "protocolo_id") || null,
    p_sala: txt(formData, "sala") || null,
    p_engenharia_equipamento_id: txt(formData, "engenharia_equipamento_id") || null,
    p_observacoes: txt(formData, "observacoes") || null,
  });
  if (error) {
    console.error("[imagem] agendar exame", { code: error.code, operation: "agendar_exame_imagem_operacional" });
    return failure("agendar-exame", "Não foi possível confirmar o agendamento do exame.", error);
  }
  return success("Exame agendado e vinculado à solicitação.");
}

export async function atualizarAgendaImagemBackground(
  _previousState: RadiologyActionState,
  formData: FormData,
): Promise<RadiologyActionState> {
  const { supabase } = await getAssistencialContext();
  const id = txt(formData, "agendamento_id");
  const status = txt(formData, "status");
  if (!id || !["confirmado", "chegou", "faltou", "cancelado"].includes(status)) {
    return failure("agenda-status", "Informe um agendamento e uma transição de status válida.");
  }

  const { error } = await supabase.rpc("atualizar_agendamento_imagem_operacional", {
    p_agendamento_id: id,
    p_status: status,
  });
  if (error) {
    console.error("[imagem] atualizar agenda", { code: error.code, operation: "atualizar_agendamento_imagem_operacional" });
    return failure("agenda-status", "Não foi possível atualizar o status do agendamento.", error);
  }
  return success("Status do agendamento atualizado.");
}

export async function iniciarExecucaoImagemBackground(
  _previousState: RadiologyActionState,
  formData: FormData,
): Promise<RadiologyActionState> {
  const { supabase } = await getAssistencialContext();
  const solicitacaoId = txt(formData, "solicitacao_id");
  if (!solicitacaoId) return failure("solicitacao", "A solicitação do exame não foi informada.");

  const { error } = await supabase.rpc("iniciar_execucao_imagem_operacional", {
    p_solicitacao_id: solicitacaoId,
    p_agendamento_id: txt(formData, "agendamento_id") || null,
    p_protocolo_id: txt(formData, "protocolo_id") || null,
    p_sala: txt(formData, "sala") || null,
    p_engenharia_equipamento_id: txt(formData, "engenharia_equipamento_id") || null,
    p_accession_number: txt(formData, "accession_number") || null,
  });
  if (error) {
    console.error("[imagem] iniciar execução", { code: error.code, operation: "iniciar_execucao_imagem_operacional" });
    return failure("iniciar-execucao", "Não foi possível iniciar a execução do exame.", error);
  }
  return success("Execução do exame iniciada.");
}

export async function concluirExecucaoImagemBackground(
  _previousState: RadiologyActionState,
  formData: FormData,
): Promise<RadiologyActionState> {
  const { supabase } = await getAssistencialContext();
  const id = txt(formData, "execucao_id");
  if (!id) return failure("execucao", "A execução do exame não foi informada.");

  const { error } = await supabase.rpc("concluir_execucao_imagem_operacional", {
    p_execucao_id: id,
    p_study_instance_uid: txt(formData, "study_instance_uid") || null,
    p_series_instance_uid: txt(formData, "series_instance_uid") || null,
    p_pacs_url: txt(formData, "pacs_url") || null,
    p_intercorrencias: txt(formData, "intercorrencias") || null,
  });
  if (error) {
    console.error("[imagem] concluir execução", { code: error.code, operation: "concluir_execucao_imagem_operacional" });
    return failure("concluir-execucao", "Não foi possível concluir a execução do exame.", error);
  }
  return success("Execução concluída e dados PACS/DICOM atualizados.");
}

export async function registrarContrasteImagemBackground(
  _previousState: RadiologyActionState,
  formData: FormData,
): Promise<RadiologyActionState> {
  const { supabase, user, empresaId, unidadeId } = await getAssistencialContext();
  const execucaoId = txt(formData, "execucao_id");
  if (!execucaoId) return failure("execucao", "Selecione a execução antes de registrar o contraste.");

  const { data: exec } = await supabase
    .from("imagem_execucoes")
    .select("id,atendimento_id")
    .eq("id", execucaoId)
    .eq("empresa_id", empresaId)
    .eq("unidade_id", unidadeId)
    .maybeSingle();
  if (!exec) return failure("execucao", "A execução não foi localizada no escopo da unidade atual.");

  const contraste = txt(formData, "contraste");
  if (!contraste || formData.get("alergia_questionada") !== "on") {
    return failure("seguranca-contraste", "Informe o contraste e confirme que a alergia foi questionada.");
  }

  const profissionalId = await profissionalLogado(supabase, user.id, empresaId);
  const { error } = await supabase.from("imagem_contraste_registros").insert({
    empresa_id: empresaId,
    unidade_id: unidadeId,
    atendimento_id: exec.atendimento_id,
    execucao_id: exec.id,
    contraste,
    lote: txt(formData, "lote") || null,
    validade: txt(formData, "validade") || null,
    volume_ml: numero(txt(formData, "volume_ml")),
    via: txt(formData, "via") || null,
    alergia_questionada: true,
    alergia_negada: formData.get("alergia_negada") === "on",
    funcao_renal_verificada: formData.get("funcao_renal_verificada") === "on",
    creatinina: numero(txt(formData, "creatinina")),
    egfr: numero(txt(formData, "egfr")),
    consentimento_confirmado: formData.get("consentimento_confirmado") === "on",
    administrado_em: new Date().toISOString(),
    administrado_por: profissionalId,
    reacao_adversa: txt(formData, "reacao_adversa") || null,
    conduta_reacao: txt(formData, "conduta_reacao") || null,
    created_by: user.id,
  });
  if (error) {
    console.error("[imagem] registrar contraste", { code: error.code, operation: "imagem_contraste_registros.insert" });
    return failure("contraste", "Não foi possível registrar o contraste e as verificações de segurança.", error);
  }
  return success("Contraste e verificações de segurança registrados.");
}

export async function registrarDoseImagemBackground(
  _previousState: RadiologyActionState,
  formData: FormData,
): Promise<RadiologyActionState> {
  const { supabase, user, empresaId, unidadeId } = await getAssistencialContext();
  const execucaoId = txt(formData, "execucao_id");
  if (!execucaoId) return failure("execucao", "Selecione a execução antes de registrar a dose.");

  const { data: exec } = await supabase
    .from("imagem_execucoes")
    .select("id,atendimento_id")
    .eq("id", execucaoId)
    .eq("empresa_id", empresaId)
    .eq("unidade_id", unidadeId)
    .maybeSingle();
  if (!exec) return failure("execucao", "A execução não foi localizada no escopo da unidade atual.");

  const { error } = await supabase.from("imagem_dose_radiacao").insert({
    empresa_id: empresaId,
    unidade_id: unidadeId,
    atendimento_id: exec.atendimento_id,
    execucao_id: exec.id,
    modalidade: txt(formData, "modalidade") || null,
    ctdivol: numero(txt(formData, "ctdivol")),
    dlp: numero(txt(formData, "dlp")),
    dap: numero(txt(formData, "dap")),
    dose_mgy: numero(txt(formData, "dose_mgy")),
    tempo_fluoroscopia_segundos: numero(txt(formData, "tempo_fluoroscopia_segundos")),
    observacoes: txt(formData, "observacoes") || null,
    created_by: user.id,
  });
  if (error) {
    console.error("[imagem] registrar dose", { code: error.code, operation: "imagem_dose_radiacao.insert" });
    return failure("dose", "Não foi possível registrar a dose de radiação.", error);
  }
  return success("Dose de radiação registrada.");
}
