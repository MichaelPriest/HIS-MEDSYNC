"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/permissions/server";

export async function reconciliarIntegracoesAction() {
  const { supabase, empresaId, unidadeId } = await requirePermission("integracao.reconciliar");
  if (!unidadeId) redirect("/integracoes?erro=selecione-unidade");

  const { error } = await supabase.rpc("reconciliar_pendencias_integracao", {
    p_empresa_id: empresaId,
    p_unidade_id: unidadeId,
    p_atendimento_id: null,
  });

  if (error) {
    console.error("[integracao] falha ao reconciliar pendencias", { code: error.code });
    redirect("/integracoes?erro=reconciliacao");
  }

  revalidatePath("/integracoes");
  redirect("/integracoes?sucesso=reconciliado");
}
