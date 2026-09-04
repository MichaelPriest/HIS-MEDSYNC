"use server";

import { revalidatePath } from "next/cache";
import type { BackgroundActionState } from "@/lib/actions/background-action";
import { requirePermission } from "@/lib/permissions/server";

export type SurgicalTeamBillingActionData = {
  kind: "sync" | "update" | "complete";
  procedureId?: string;
  billingTeamId?: string;
  clinicalMemberId?: string;
};

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const checked = (formData: FormData, key: string) => formData.get(key) === "on" || formData.get(key) === "true";

function refresh(contaId: string) {
  revalidatePath(`/faturamento/${contaId}`);
  revalidatePath(`/faturamento/${contaId}/procedimentos-cirurgicos`);
  revalidatePath(`/faturamento/${contaId}/lancamentos`);
  revalidatePath("/assistencial/centro-cirurgico");
  revalidatePath("/assistencial/centro-cirurgico/procedimentos");
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
    FAT_EQUIPE_JUSTIFICATIVA_OBRIGATORIA: "Informe a justificativa para complementar ou alterar a equipe sugerida.",
    FAT_EQUIPE_PAPEL_INVALIDO: "O papel informado para a equipe cirúrgica é inválido.",
    FAT_EQUIPE_ORDEM_AUXILIAR_INVALIDA: "Informe a ordem do auxiliar entre 1 e 4.",
    FAT_EQUIPE_ORDEM_RESTRITA_AUXILIAR: "A ordem de participação só pode ser usada para auxiliares do cirurgião.",
    FAT_EQUIPE_PROFISSIONAL_INVALIDO: "O profissional selecionado não está ativo na empresa.",
  };
  return code ? messages[code] ?? `Não foi possível concluir a operação (${code}).` : "Não foi possível concluir a operação.";
}

export async function sincronizarEquipeCirurgicaBackground(
  contaId: string,
  procedureId: string,
  previous: BackgroundActionState<SurgicalTeamBillingActionData>,
  formData: FormData,
): Promise<BackgroundActionState<SurgicalTeamBillingActionData>> {
  void previous;
  void formData;
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

export async function complementarEquipeCirurgicaBackground(
  contaId: string,
  procedureId: string,
  previous: BackgroundActionState<SurgicalTeamBillingActionData>,
  formData: FormData,
): Promise<BackgroundActionState<SurgicalTeamBillingActionData>> {
  void previous;
  const { supabase } = await requirePermission("faturamento.criar");
  const profissionalId = text(formData, "profissional_id");
  const papelSelecao = text(formData, "papel_selecao");
  const justificativa = text(formData, "justificativa");
  const [papel, ordemRaw] = papelSelecao.split(":");
  const ordem = papel === "cirurgiao_auxiliar" ? Number(ordemRaw) : null;

  if (!profissionalId || !papel || !justificativa) {
    return { status: "error", code: "campos", message: "Selecione o profissional, o papel faltante e informe a justificativa." };
  }

  const { data, error } = await supabase.rpc("faturamento_complementar_membro_equipe_cirurgica", {
    p_conta_id: contaId,
    p_cirurgia_procedimento_id: procedureId,
    p_profissional_id: profissionalId,
    p_papel: papel,
    p_ordem: Number.isFinite(ordem) ? ordem : null,
    p_justificativa: justificativa,
  });
  if (error) return { status: "error", code: error.message, message: message(error.message) };
  refresh(contaId);
  const result = data as { membro_id?: string } | null;
  return {
    status: "success",
    code: "equipe-complementada",
    message: "Membro incluído como complemento do Faturamento e honorários sincronizados. O Centro Cirúrgico poderá confirmar o registro assistencialmente.",
    data: { kind: "complete", procedureId, clinicalMemberId: result?.membro_id },
  };
}

export async function atualizarEquipeCirurgicaBackground(
  contaId: string,
  billingTeamId: string,
  previous: BackgroundActionState<SurgicalTeamBillingActionData>,
  formData: FormData,
): Promise<BackgroundActionState<SurgicalTeamBillingActionData>> {
  void previous;
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
