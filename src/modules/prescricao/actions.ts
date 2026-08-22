"use server";

import { redirect } from "next/navigation";
import { getAssistencialContext } from "@/modules/assistencial/context";

export async function criarPrescricao(formData: FormData) {
  const { supabase, user, empresaId, unidadeId } = await getAssistencialContext();
  const atendimentoId = String(formData.get("atendimento_id") ?? "").trim();
  const profissionalId = String(formData.get("profissional_id") ?? "").trim();
  const item = String(formData.get("item") ?? "").trim();
  if (!atendimentoId || !profissionalId || !item) redirect("/prescricao?erro=campos");

  const { error } = await supabase.from("prescricoes").insert({
    empresa_id: empresaId,
    unidade_id: unidadeId,
    atendimento_id: atendimentoId,
    profissional_id: profissionalId,
    tipo: String(formData.get("tipo") ?? "medicamento"),
    item,
    dose: String(formData.get("dose") ?? "").trim() || null,
    via: String(formData.get("via") ?? "").trim() || null,
    frequencia: String(formData.get("frequencia") ?? "").trim() || null,
    duracao: String(formData.get("duracao") ?? "").trim() || null,
    instrucoes: String(formData.get("instrucoes") ?? "").trim() || null,
    created_by: user.id,
    updated_by: user.id,
  });
  if (error) redirect("/prescricao?erro=salvar");
  redirect("/prescricao?sucesso=1");
}
