"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/permissions/server";

const txt = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const go = (processoId: string, query: string): never =>
  redirect(`/contas-medicas/${processoId}?${query}` as never);

export async function resolverPendenciaContaMedica(formData: FormData) {
  const { supabase, user } = await requirePermission("contas_medicas.processar");
  const processoId = txt(formData, "processo_id");
  const pendenciaId = txt(formData, "pendencia_id");
  if (!processoId || !pendenciaId) return go(processoId || "", "erro=pendencia");

  const { error } = await supabase
    .from("contas_medicas_pendencias")
    .update({
      resolvida: true,
      resolvida_em: new Date().toISOString(),
      resolvida_por: user.id,
    })
    .eq("id", pendenciaId)
    .eq("processo_id", processoId);

  if (error) return go(processoId, `erro=${encodeURIComponent(error.message)}`);
  revalidatePath(`/contas-medicas/${processoId}`);
  return go(processoId, "sucesso=pendencia-resolvida");
}

export async function reabrirPendenciaContaMedica(formData: FormData) {
  const { supabase } = await requirePermission("contas_medicas.processar");
  const processoId = txt(formData, "processo_id");
  const pendenciaId = txt(formData, "pendencia_id");
  if (!processoId || !pendenciaId) return go(processoId || "", "erro=pendencia");

  const { error } = await supabase
    .from("contas_medicas_pendencias")
    .update({ resolvida: false, resolvida_em: null, resolvida_por: null })
    .eq("id", pendenciaId)
    .eq("processo_id", processoId);

  if (error) return go(processoId, `erro=${encodeURIComponent(error.message)}`);
  revalidatePath(`/contas-medicas/${processoId}`);
  return go(processoId, "sucesso=pendencia-reaberta");
}
