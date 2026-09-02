"use server";

import { revalidatePath } from "next/cache";
import type { BackgroundActionState } from "@/lib/actions/background-action";
import { requirePermission } from "@/lib/permissions/server";

export type ProfessionalTissProfileData = {
  ready: boolean;
};

function text(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function onlyDigits(value: string | null) {
  return value ? value.replace(/\D/g, "") : null;
}

export async function salvarHabilitacaoTissProfissional(
  profissionalId: string,
  _previous: BackgroundActionState<ProfessionalTissProfileData>,
  formData: FormData,
): Promise<BackgroundActionState<ProfessionalTissProfileData>> {
  const { supabase, user, empresaId } = await requirePermission("profissionais.editar");
  const conselho = text(formData, "conselho")?.toUpperCase() ?? null;
  const numeroConselho = text(formData, "numero_conselho");
  const ufConselho = text(formData, "uf_conselho")?.toUpperCase() ?? null;
  const cbo = onlyDigits(text(formData, "cbo"));
  const especialidade = text(formData, "especialidade");

  const informed = [conselho, numeroConselho, ufConselho, cbo].some(Boolean);
  if (informed && (!conselho || !numeroConselho || !ufConselho || !cbo)) {
    return {
      status: "error",
      code: "habilitacao-incompleta",
      message: "Para uso como executante TISS, preencha conselho, número, UF e CBO em conjunto.",
    };
  }
  if (ufConselho && !/^[A-Z]{2}$/.test(ufConselho)) {
    return { status: "error", code: "uf-invalida", message: "Informe a UF do conselho com duas letras, por exemplo SP." };
  }
  if (cbo && cbo.length !== 6) {
    return { status: "error", code: "cbo-invalido", message: "O CBO deve conter 6 dígitos." };
  }

  const { data: profissional, error } = await supabase
    .from("profissionais")
    .update({
      conselho,
      numero_conselho: numeroConselho,
      uf_conselho: ufConselho,
      cbo,
      especialidade,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    })
    .eq("id", profissionalId)
    .eq("empresa_id", empresaId)
    .select("id")
    .maybeSingle();

  if (error || !profissional) {
    console.error("[profissionais.tiss] salvar habilitacao", { profissionalId, code: error?.code });
    return { status: "error", code: "salvar", message: "Não foi possível atualizar a habilitação do profissional." };
  }

  const ready = Boolean(conselho && numeroConselho && ufConselho && cbo);
  revalidatePath("/profissionais");
  revalidatePath(`/profissionais/${profissionalId}`);
  revalidatePath("/cadastros/tiss");
  revalidatePath("/faturamento/guias");

  return {
    status: "success",
    code: ready ? "pronto-tiss" : "salvo",
    message: ready
      ? "Habilitação atualizada. O cadastro possui os campos-base para o snapshot profissional TISS."
      : "Dados profissionais atualizados. Este cadastro continua sem habilitação TISS completa.",
    data: { ready },
  };
}
