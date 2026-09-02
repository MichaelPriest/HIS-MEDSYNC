"use server";

import { revalidatePath } from "next/cache";
import type { BackgroundActionState } from "@/lib/actions/background-action";
import { createClient } from "@/lib/supabase/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type GuideValidationActionData = {
  guiaId: string;
};

function validationMessage(message?: string | null) {
  const value = String(message ?? "");
  if (value.includes("TISS_GUIA_SEM_PERMISSAO") || value.includes("TISS_GUIA_NAO_AUTENTICADO")) return ["permissao", "Seu perfil não possui permissão para revalidar esta guia."] as const;
  if (value.includes("TISS_GUIA_NAO_LOCALIZADA")) return ["nao-localizada", "A guia não foi localizada para validação."] as const;
  return ["falha", "Não foi possível concluir a validação. Os dados da guia foram preservados."] as const;
}

export async function validarGuiaTissBackground(
  guiaId: string,
  _previous: BackgroundActionState<GuideValidationActionData>,
  _formData: FormData,
): Promise<BackgroundActionState<GuideValidationActionData>> {
  void _previous;
  void _formData;
  if (!UUID_RE.test(guiaId)) return { status: "error", code: "guia", message: "Identificador da guia inválido." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("validar_guia_tiss", { p_guia_id: guiaId });
  if (error) {
    const [code, message] = validationMessage(error.message);
    console.error("[tiss.guia.background] falha de validacao", { code: error.code, category: code });
    return { status: "error", code, message };
  }

  revalidatePath("/faturamento/guias");
  revalidatePath(`/faturamento/guias/${guiaId}`);
  return {
    status: "success",
    code: "validada",
    message: "Validação concluída. As críticas da guia foram atualizadas.",
    data: { guiaId },
  };
}
