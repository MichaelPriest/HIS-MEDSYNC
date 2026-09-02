"use server";

import { revalidatePath } from "next/cache";
import type { BackgroundActionState } from "@/lib/actions/background-action";
import { requirePermission } from "@/lib/permissions/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function sincronizarProducaoBackground(
  _previous: BackgroundActionState,
  formData: FormData,
): Promise<BackgroundActionState> {
  const atendimentoId = String(formData.get("atendimento_id") ?? "").trim();
  if (!UUID.test(atendimentoId)) {
    return { status: "error", code: "atendimento-invalido", message: "Selecione um atendimento válido." };
  }

  const { supabase } = await requirePermission("producao.reprocessar");
  const { error } = await supabase.rpc("sincronizar_producao_atendimento", {
    p_atendimento_id: atendimentoId,
  });

  if (error) {
    const value = String(error.message ?? "");
    const code = value.includes("PRODUCAO_SEM_PERMISSAO")
      ? "acesso-negado"
      : value.includes("PRODUCAO_ATENDIMENTO_NAO_LOCALIZADO")
        ? "atendimento-nao-localizado"
        : "sincronizacao";
    const message = code === "acesso-negado"
      ? "Seu perfil não permite reprocessar produção."
      : code === "atendimento-nao-localizado"
        ? "O atendimento não foi localizado no escopo atual."
        : "Não foi possível sincronizar a produção do atendimento.";
    console.error("[producao.background] sincronizar atendimento", { code: error.code, category: code });
    return { status: "error", code, message };
  }

  revalidatePath("/faturamento/producao");
  revalidatePath("/faturamento");
  return {
    status: "success",
    code: "sincronizado",
    message: "Produção sincronizada sem criar lançamentos clínicos manuais.",
  };
}
