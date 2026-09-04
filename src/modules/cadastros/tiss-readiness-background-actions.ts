"use server";

import { revalidatePath } from "next/cache";
import type { BackgroundActionState } from "@/lib/actions/background-action";
import { requirePermission } from "@/lib/permissions/server";

export type InstitutionTissProfileData = { kind: "empresa" | "unidade"; ready: boolean };

function digits(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").replace(/\D/g, "");
}

function refresh() {
  revalidatePath("/cadastros/tiss");
  revalidatePath("/configuracoes/empresa");
  revalidatePath("/faturamento/guias");
  revalidatePath("/faturamento/lotes");
}

export async function salvarIdentificacaoTissEmpresa(
  _previous: BackgroundActionState<InstitutionTissProfileData>,
  formData: FormData,
): Promise<BackgroundActionState<InstitutionTissProfileData>> {
  const { supabase, user, empresaId } = await requirePermission("empresas.administrar");
  const cnpj = digits(formData, "cnpj");
  const cnes = digits(formData, "cnes");
  if (cnpj.length !== 14) return { status: "error", code: "cnpj", message: "O CNPJ da empresa deve conter 14 dígitos." };
  if (cnes.length !== 7) return { status: "error", code: "cnes", message: "O CNES da empresa deve conter 7 dígitos." };

  const { error } = await supabase.from("empresas").update({ cnpj, cnes, updated_at: new Date().toISOString(), updated_by: user.id }).eq("id", empresaId);
  if (error) {
    console.error("[cadastros.tiss] empresa", { code: error.code });
    return { status: "error", code: "salvar", message: "Não foi possível atualizar a identificação TISS da empresa." };
  }
  refresh();
  return { status: "success", code: "empresa-pronta", message: "CNPJ e CNES da empresa atualizados.", data: { kind: "empresa", ready: true } };
}

export async function salvarCnesUnidadeTiss(
  unidadeId: string,
  _previous: BackgroundActionState<InstitutionTissProfileData>,
  formData: FormData,
): Promise<BackgroundActionState<InstitutionTissProfileData>> {
  const { supabase, user, empresaId } = await requirePermission("empresas.administrar");
  const cnes = digits(formData, "cnes");
  if (cnes.length !== 7) return { status: "error", code: "cnes", message: "O CNES da unidade deve conter 7 dígitos." };

  const { data: unidade, error } = await supabase
    .from("unidades")
    .update({ cnes, updated_at: new Date().toISOString(), updated_by: user.id })
    .eq("id", unidadeId)
    .eq("empresa_id", empresaId)
    .select("id")
    .maybeSingle();
  if (error || !unidade) {
    console.error("[cadastros.tiss] unidade", { code: error?.code, unidadeId });
    return { status: "error", code: "salvar", message: "Não foi possível atualizar o CNES da unidade ativa." };
  }
  refresh();
  return { status: "success", code: "unidade-pronta", message: "CNES da unidade atualizado.", data: { kind: "unidade", ready: true } };
}
