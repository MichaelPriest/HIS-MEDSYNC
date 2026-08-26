"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAssistencialContext } from "@/modules/assistencial/context";

type ResultadoPosAlta = {
  conta_id?: string | null;
  status?: string | null;
};

export async function reprocessarContaPosAlta(formData: FormData) {
  const atendimentoId = String(formData.get("atendimento_id") ?? "").trim();
  if (!atendimentoId) redirect("/faturamento?erro=atendimento");

  const { supabase, unidadeId } = await getAssistencialContext();
  const { data: atendimento } = await supabase
    .from("atendimentos")
    .select("id,status")
    .eq("id", atendimentoId)
    .eq("unidade_id", unidadeId)
    .maybeSingle();

  if (!atendimento || atendimento.status !== "alta") {
    redirect("/faturamento?erro=alta-invalida");
  }

  const { data, error } = await supabase.rpc("preparar_conta_pos_alta", {
    p_atendimento_id: atendimentoId,
  });

  if (error) {
    console.error("[faturamento] preparar conta pos-alta", {
      code: error.code,
      message: error.message,
    });
    redirect("/faturamento?erro=integracao-pos-alta");
  }

  revalidatePath("/faturamento");
  revalidatePath("/auditoria");
  revalidatePath("/contas-medicas");

  const resultado = (data ?? {}) as ResultadoPosAlta;
  if (resultado.conta_id) {
    redirect(`/faturamento/${resultado.conta_id}?sucesso=pos-alta`);
  }

  redirect("/faturamento?sucesso=pos-alta");
}