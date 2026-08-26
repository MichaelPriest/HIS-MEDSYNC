"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAssistencialContext } from "@/modules/assistencial/context";

type ValidarGuiaResult = {
  guia_id?: string;
  status?: string;
  erros?: number;
  alertas?: number;
  preservada?: boolean;
};

export async function validarGuiaTiss(guiaId: string, _formData: FormData) {
  const { supabase } = await getAssistencialContext();
  const { data, error } = await supabase.rpc("validar_guia_tiss", { p_guia_id: guiaId });

  if (error) {
    console.error("[tiss.guia] falha ao validar guia", {
      code: error.code,
      operation: "validar_guia_tiss",
      guiaId,
    });
    redirect(`/faturamento/guias/${guiaId}?erro=validacao`);
  }

  const result = (data ?? {}) as ValidarGuiaResult;
  revalidatePath(`/faturamento/guias/${guiaId}`);
  redirect(
    `/faturamento/guias/${guiaId}?validado=1&status=${encodeURIComponent(result.status ?? "rascunho")}&erros=${Number(result.erros ?? 0)}&alertas=${Number(result.alertas ?? 0)}`,
  );
}
