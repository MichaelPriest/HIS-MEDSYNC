"use server";

import { redirect } from "next/navigation";
import { getAssistencialContext } from "@/modules/assistencial/context";

function numberOrNull(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim().replace(",", ".");
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function registrarTriagem(formData: FormData) {
  const { supabase, user, empresaId, unidadeId } = await getAssistencialContext();
  const atendimentoId = String(formData.get("atendimento_id") ?? "").trim();
  if (!atendimentoId) redirect("/triagem?erro=atendimento");

  const payload = {
    empresa_id: empresaId,
    unidade_id: unidadeId,
    atendimento_id: atendimentoId,
    peso_kg: numberOrNull(formData.get("peso_kg")),
    altura_cm: numberOrNull(formData.get("altura_cm")),
    pressao_arterial: String(formData.get("pressao_arterial") ?? "").trim() || null,
    frequencia_cardiaca: numberOrNull(formData.get("frequencia_cardiaca")),
    frequencia_respiratoria: numberOrNull(formData.get("frequencia_respiratoria")),
    saturacao_o2: numberOrNull(formData.get("saturacao_o2")),
    temperatura_c: numberOrNull(formData.get("temperatura_c")),
    glicemia_mg_dl: numberOrNull(formData.get("glicemia_mg_dl")),
    dor_escala: numberOrNull(formData.get("dor_escala")),
    classificacao_risco: String(formData.get("classificacao_risco") ?? "").trim() || null,
    queixa_principal: String(formData.get("queixa_principal") ?? "").trim() || null,
    observacoes: String(formData.get("observacoes") ?? "").trim() || null,
    created_by: user.id,
    updated_by: user.id,
  };

  const { error } = await supabase.from("triagens").upsert(payload, { onConflict: "atendimento_id" });
  if (error) redirect("/triagem?erro=salvar");
  redirect("/triagem?sucesso=1");
}
