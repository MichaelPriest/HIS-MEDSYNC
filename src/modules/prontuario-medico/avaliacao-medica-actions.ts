"use server";

import { revalidatePath } from "next/cache";
import type { BackgroundActionState } from "@/lib/actions/background-action";
import { requireAnyPermission } from "@/lib/permissions/server";

const texto = (fd: FormData, nome: string) => String(fd.get(nome) ?? "").trim();

export async function solicitarAvaliacaoMedicaAction(
  _previousState: BackgroundActionState,
  formData: FormData,
): Promise<BackgroundActionState> {
  const atendimentoId = texto(formData, "atendimento_id");
  const especialidade = texto(formData, "especialidade");
  const prioridade = texto(formData, "prioridade") || "rotina";
  const motivo = texto(formData, "motivo");
  const observacoes = texto(formData, "observacoes") || null;

  if (!atendimentoId || !especialidade || !motivo || !["rotina", "urgente", "emergencia"].includes(prioridade)) {
    return { status: "error", code: "campos", message: "Revise especialidade, prioridade e motivo da avaliação." };
  }

  const { supabase, user, empresaId, unidadeId } = await requireAnyPermission(["prontuario.visualizar", "prescricao.criar"]);
  if (!unidadeId) {
    return { status: "error", code: "unidade", message: "Selecione uma unidade antes de solicitar a avaliação." };
  }

  const [{ data: atendimento }, { data: profissional }] = await Promise.all([
    supabase.from("atendimentos").select("id,paciente_id,status").eq("id", atendimentoId).eq("empresa_id", empresaId).eq("unidade_id", unidadeId).maybeSingle(),
    supabase.from("profissionais").select("id").eq("empresa_id", empresaId).eq("usuario_id", user.id).eq("ativo", true).limit(1).maybeSingle(),
  ]);

  if (!atendimento?.paciente_id) {
    return { status: "error", code: "atendimento", message: "O atendimento não foi localizado nesta unidade." };
  }
  if (!profissional?.id) {
    return { status: "error", code: "profissional", message: "Seu usuário não está vinculado a um profissional ativo." };
  }

  const { error } = await supabase.from("solicitacoes_avaliacao_medica").insert({
    empresa_id: empresaId,
    unidade_id: unidadeId,
    atendimento_id: atendimentoId,
    paciente_id: atendimento.paciente_id,
    solicitante_profissional_id: profissional.id,
    especialidade,
    prioridade,
    motivo,
    observacoes,
    status: "solicitada",
    created_by: user.id,
    updated_by: user.id,
  });

  if (error) {
    console.error("[avaliacao-medica] falha ao solicitar", { code: error.code, message: error.message, atendimentoId });
    return { status: "error", code: "salvar", message: "Não foi possível registrar a avaliação. Tente novamente." };
  }

  revalidatePath(`/prontuario/${atendimentoId}/avaliacoes`);
  revalidatePath(`/prontuario/${atendimentoId}`);

  return {
    status: "success",
    code: "solicitada",
    message: "Avaliação solicitada e vinculada ao episódio.",
  };
}
