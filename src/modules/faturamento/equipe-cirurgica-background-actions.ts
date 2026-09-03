"use server";

import { revalidatePath } from "next/cache";
import type { BackgroundActionState } from "@/lib/actions/background-action";
import { requirePermission } from "@/lib/permissions/server";

export type SurgicalTeamBillingActionData = {
  kind: "sync" | "update";
  procedureId?: string;
  billingTeamId?: string;
};

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const checked = (formData: FormData, key: string) => formData.get(key) === "on" || formData.get(key) === "true";

function refresh(contaId: string) {
  revalidatePath(`/faturamento/${contaId}`);
  revalidatePath(`/faturamento/${contaId}/procedimentos-cirurgicos`);
  revalidatePath(`/faturamento/${contaId}/lancamentos`);
}

function message(code: string | undefined) {
  const messages: Record<string, string> = {
    FAT_EQUIPE_CONTA_NAO_LOCALIZADA: "Conta hospitalar não localizada.",
    FAT_EQUIPE_CONTA_NAO_EDITAVEL: "A conta não permite mais alterações da equipe.",
    FAT_EQUIPE_GUIA_TISS_ATIVA: "Existe Guia TISS ativa. Trate a guia antes de alterar honorários.",
    FAT_EQUIPE_PROCEDIMENTO_INCOMPATIVEL: "O procedimento cirúrgico não pertence a este atendimento.",
    FAT_EQUIPE_PROCEDIMENTO_SEM_ITEM_TABELA: "O procedimento não possui item de tabela contratual vinculado.",
    FAT_EQUIPE_ITEM_TABELA_NAO_LOCALIZADO: "O item da tabela contratual não foi localizado.",
    FAT_EQUIPE_CONTRATO_NAO_LOCALIZADO: "Nenhum contrato ativo foi localizado para esta cirurgia.",
    FAT_EQUIPE_TABELA_NAO_VINCULADA_AO_CONTRATO: "A tabela usada na cirurgia não está vinculada ao contrato ativo.",
    FAT_EQUIPE_CALCULO_PENDENTE: "Este membro ainda não possui cálculo contratual válido para cobrança.",
    FAT_EQUIPE_JUSTIFICATIVA_OBRIGATORIA: "Informe a justificativa para alterar a decisão de cobrança sugerida pela regra.",
  };
  return code ? messages[code] ?? `Não foi possível concluir a operação (${code}).` : "Não foi possível concluir a operação.";
}

export async function sincronizarEquipeCirurgicaBackground(
  contaId: string,
  procedureId: string,
  _previous: BackgroundActionState<SurgicalTeamBillingActionData>,
  _formData: FormData,
): Promise<BackgroundActionState<SurgicalTeamBillingActionData>> {
  const { supabase } = await requirePermission("faturamento.criar");
  const { data, error } = await supabase.rpc("faturamento_sincronizar_equipe_cirurgica", {
    p_conta_id: contaId,
    p_cirurgia_procedimento_id: procedureId,
  });
  if (error) return { status: "error", code: error.message, message: message(error.message) };
  refresh(contaId);
  const result = data as { membros?: number; pendencias?: number } | null;
  return {
    status: "success",
    code: "equipe-sincronizada",
    message: `Equipe sincronizada: ${result?.membros ?? 0} membro(s), ${result?.pendencias ?? 0} pendência(s).`,
    data: { kind: "sync", procedureId },
  };
}

export async function atualizarEquipeCirurgicaBackground(
  contaId: string,
  billingTeamId: string,
  _previous: BackgroundActionState<SurgicalTeamBillingActionData>,
  formData: FormData,
): Promise<BackgroundActionState<SurgicalTeamBillingActionData>> {
  const { supabase } = await requirePermission("faturamento.criar");
  const cobrar = checked(formData, "cobrar");
  const repasse = checked(formData, "repasse");
  const justificativa = text(formData, "justificativa");
  const { error } = await supabase.rpc("faturamento_atualizar_equipe_cirurgica", {
    p_equipe_faturamento_id: billingTeamId,
    p_cobrar: cobrar,
    p_repasse: repasse,
    p_justificativa: justificativa || null,
  });
  if (error) return { status: "error", code: error.message, message: message(error.message) };
  refresh(contaId);
  return {
    status: "success",
    code: "equipe-atualizada",
    message: "Cobrança e repasse atualizados com histórico.",
    data: { kind: "update", billingTeamId },
  };
}
