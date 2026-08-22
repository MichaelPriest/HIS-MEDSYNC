"use server";

import { redirect } from "next/navigation";
import { getAssistencialContext } from "@/modules/assistencial/context";

export async function registrarEvolucao(formData: FormData) {
  const { supabase, user, empresaId, unidadeId } = await getAssistencialContext();
  const atendimentoId = String(formData.get("atendimento_id") ?? "").trim();
  const profissionalId = String(formData.get("profissional_id") ?? "").trim();
  if (!atendimentoId || !profissionalId) redirect("/prontuario?erro=campos-obrigatorios");

  const { error } = await supabase.from("prontuario_evolucoes").insert({
    empresa_id: empresaId,
    unidade_id: unidadeId,
    atendimento_id: atendimentoId,
    profissional_id: profissionalId,
    tipo_evolucao: String(formData.get("tipo_evolucao") ?? "evolucao"),
    subjetivo: String(formData.get("subjetivo") ?? "").trim() || null,
    objetivo: String(formData.get("objetivo") ?? "").trim() || null,
    avaliacao: String(formData.get("avaliacao") ?? "").trim() || null,
    plano: String(formData.get("plano") ?? "").trim() || null,
    texto_livre: String(formData.get("texto_livre") ?? "").trim() || null,
    created_by: user.id,
    updated_by: user.id,
  });
  if (error) redirect("/prontuario?erro=salvar");
  redirect("/prontuario?sucesso=1");
}
