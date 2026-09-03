"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAssistencialContext } from "@/modules/assistencial/context";

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const bool = (fd: FormData, key: string) => fd.get(key) === "on";
const nullable = (value: string) => value || null;

function destination(formData: FormData, params?: Record<string, string | null | undefined>) {
  const query = new URLSearchParams();
  const contrato = text(formData, "contrato_id");
  const data = text(formData, "data_referencia");
  if (contrato) query.set("contrato", contrato);
  if (data) query.set("data", data);
  for (const [key, value] of Object.entries(params ?? {})) if (value) query.set(key, value);
  return `/comercial/homologacao${query.size ? `?${query.toString()}` : ""}`;
}

function fail(formData: FormData, message: string): never {
  redirect(destination(formData, { erro: message }) as never);
}

function revalidateCommercial() {
  for (const path of ["/comercial", "/comercial/homologacao", "/comercial/prontidao", "/comercial/simulador"]) {
    revalidatePath(path);
  }
}

export async function homologarContratoComercial(formData: FormData) {
  const { supabase } = await getAssistencialContext();
  const contratoId = text(formData, "contrato_id");
  const dataReferencia = nullable(text(formData, "data_referencia"));
  if (!contratoId) return fail(formData, "Contrato não informado.");

  const { error } = await supabase.rpc("comercial_homologar_contrato", {
    p_contrato_id: contratoId,
    p_data: dataReferencia,
    p_aceitar_avisos: bool(formData, "aceitar_avisos"),
    p_observacoes: nullable(text(formData, "observacoes")),
  });

  if (error) return fail(formData, error.message);
  revalidateCommercial();
  redirect(destination(formData, { sucesso: "homologado" }) as never);
}

export async function revogarHomologacaoComercial(formData: FormData) {
  const { supabase } = await getAssistencialContext();
  const homologacaoId = text(formData, "homologacao_id");
  const motivo = text(formData, "motivo_revogacao");
  if (!homologacaoId) return fail(formData, "Homologação não informada.");
  if (!motivo) return fail(formData, "Informe o motivo da revogação.");

  const { error } = await supabase.rpc("comercial_revogar_homologacao", {
    p_homologacao_id: homologacaoId,
    p_motivo: motivo,
  });

  if (error) return fail(formData, error.message);
  revalidateCommercial();
  redirect(destination(formData, { sucesso: "revogado" }) as never);
}
