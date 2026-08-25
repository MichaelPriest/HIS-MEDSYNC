"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAssistencialContext } from "@/modules/assistencial/context";

function text(fd: FormData, key: string) {
  const value = String(fd.get(key) ?? "").trim();
  return value || null;
}

function go(url: string): never {
  redirect(url as Route);
}

export async function checarAdministracaoEnfermagemAction(fd: FormData) {
  const { supabase } = await getAssistencialContext();
  const aprazamentoId = String(fd.get("aprazamento_id") ?? "").trim();
  const status = String(fd.get("status") ?? "administrado").trim();
  if (!aprazamentoId) go("/assistencial/enfermagem?erro=aprazamento");

  const { error } = await supabase.rpc("registrar_administracao_beira_leito", {
    p_aprazamento_id: aprazamentoId,
    p_dispensacao_id: text(fd, "dispensacao_id"),
    p_codigo_paciente: String(fd.get("codigo_paciente") ?? "").trim(),
    p_codigo_medicamento: String(fd.get("codigo_medicamento") ?? "").trim(),
    p_status: status,
    p_justificativa: text(fd, "justificativa"),
    p_dose: text(fd, "dose"),
    p_via: text(fd, "via"),
    p_dupla_checagem: fd.get("dupla_checagem") === "on",
    p_segundo_profissional_id: text(fd, "segundo_profissional_id"),
  });

  if (error) {
    console.error("[enfermagem] checagem", { code: error.code, message: error.message });
    go(`/assistencial/enfermagem?erro=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/assistencial/enfermagem");
  revalidatePath("/assistencial/medicamentos");
  go(`/assistencial/enfermagem?sucesso=${encodeURIComponent(status)}`);
}
