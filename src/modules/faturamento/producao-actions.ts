"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/permissions/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function sincronizarProducaoAtendimentoAction(formData: FormData) {
  const { supabase } = await requirePermission("producao.reprocessar");
  const atendimentoId = String(formData.get("atendimento_id") ?? "").trim();

  if (!UUID.test(atendimentoId)) {
    redirect("/faturamento/producao?erro=atendimento-invalido");
  }

  const { error } = await supabase.rpc("sincronizar_producao_atendimento", {
    p_atendimento_id: atendimentoId,
  });

  if (error) {
    console.error("[producao] falha ao sincronizar atendimento", {
      code: error.code,
      message: error.message,
    });
    const motivo = error.message.includes("PRODUCAO_SEM_PERMISSAO")
      ? "acesso-negado"
      : error.message.includes("PRODUCAO_ATENDIMENTO_NAO_LOCALIZADO")
        ? "atendimento-nao-localizado"
        : "sincronizacao";
    redirect(`/faturamento/producao?erro=${motivo}`);
  }

  revalidatePath("/faturamento/producao");
  revalidatePath("/faturamento");
  redirect(`/faturamento/producao?sucesso=sincronizado&atendimento=${atendimentoId}`);
}
