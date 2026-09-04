"use server";

import { revalidatePath } from "next/cache";
import type { BackgroundActionState } from "@/lib/actions/background-action";
import { requirePermission } from "@/lib/permissions/server";

export type ConvenioTissProfileData = { ready: boolean };

function text(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function digits(value: string | null) {
  return value ? value.replace(/\D/g, "") : null;
}

export async function salvarIdentificacaoTissConvenio(
  convenioId: string,
  _previous: BackgroundActionState<ConvenioTissProfileData>,
  formData: FormData,
): Promise<BackgroundActionState<ConvenioTissProfileData>> {
  const { supabase, user, empresaId } = await requirePermission("convenios.editar");
  const registroAns = digits(text(formData, "registro_ans"));
  const cnpj = digits(text(formData, "cnpj"));

  if (!registroAns || registroAns.length !== 6) {
    return { status: "error", code: "ans-invalido", message: "O registro ANS da operadora deve conter 6 dígitos." };
  }
  if (cnpj && cnpj.length !== 14) {
    return { status: "error", code: "cnpj-invalido", message: "O CNPJ deve conter 14 dígitos quando informado." };
  }

  const { data: convenio, error } = await supabase
    .from("convenios")
    .update({
      registro_ans: registroAns,
      cnpj,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    })
    .eq("id", convenioId)
    .eq("empresa_id", empresaId)
    .select("id")
    .maybeSingle();

  if (error || !convenio) {
    console.error("[convenios.tiss] salvar identificacao", { convenioId, code: error?.code });
    return { status: "error", code: "salvar", message: "Não foi possível atualizar a identificação regulatória do convênio." };
  }

  revalidatePath("/convenios");
  revalidatePath(`/convenios/${convenioId}`);
  revalidatePath("/cadastros/tiss");
  revalidatePath("/faturamento/guias");
  revalidatePath("/faturamento/lotes");

  return {
    status: "success",
    code: "pronto-tiss",
    message: "Identificação regulatória atualizada. O registro ANS está pronto para os snapshots TISS.",
    data: { ready: true },
  };
}
