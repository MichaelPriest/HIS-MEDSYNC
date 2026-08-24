"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/permissions/server";

const txt = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const go = (query: string): never => redirect(`/auditoria?${query}` as never);

export async function executarAuditoriaAutomatica(formData: FormData) {
  const { supabase } = await requirePermission("auditoria.executar");
  const auditoriaId = txt(formData, "auditoria_id");
  if (!auditoriaId) return go("erro=auditoria");

  const { data, error } = await supabase.rpc("executar_auditoria_conta_automatica", {
    p_auditoria_id: auditoriaId,
  });

  if (error) return go(`erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/auditoria");
  return go(`sucesso=auditoria-automatica&gerados=${Number(data ?? 0)}`);
}

export async function resolverPendenciaAuditoria(formData: FormData) {
  const { supabase } = await requirePermission("auditoria.executar");
  const itemId = txt(formData, "item_id");
  if (!itemId) return go("erro=pendencia");

  const { error } = await supabase.rpc("resolver_item_auditoria", {
    p_item_id: itemId,
    p_resolucao: txt(formData, "resolucao") || null,
  });

  if (error) return go(`erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/auditoria");
  return go("sucesso=pendencia-resolvida");
}

export async function reabrirPendenciaAuditoria(formData: FormData) {
  const { supabase } = await requirePermission("auditoria.executar");
  const itemId = txt(formData, "item_id");
  if (!itemId) return go("erro=pendencia");

  const { error } = await supabase.rpc("reabrir_item_auditoria", {
    p_item_id: itemId,
  });

  if (error) return go(`erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/auditoria");
  return go("sucesso=pendencia-reaberta");
}
