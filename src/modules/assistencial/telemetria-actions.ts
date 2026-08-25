"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAssistencialContext } from "@/modules/assistencial/context";

export async function reconhecerAlertaTelemetria(formData: FormData) {
  const { supabase, user, empresaId, unidadeId } = await getAssistencialContext();
  const id = String(formData.get("alerta_id") ?? "").trim();
  if (!id) redirect("/assistencial/uti/equipamentos?erro=alerta");
  const { error } = await supabase.from("monitorizacao_alertas_clinicos").update({
    status: "reconhecido",
    reconhecido_em: new Date().toISOString(),
    reconhecido_por: user.id,
  }).eq("id", id).eq("empresa_id", empresaId).eq("unidade_id", unidadeId).eq("status", "aberto");
  if (error) redirect("/assistencial/uti/equipamentos?erro=alerta");
  revalidatePath("/assistencial/uti/equipamentos");
  revalidatePath("/assistencial/enfermagem");
  redirect("/assistencial/uti/equipamentos?sucesso=alerta-reconhecido");
}
