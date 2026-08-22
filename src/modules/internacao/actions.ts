"use server";

import { redirect } from "next/navigation";
import { getAssistencialContext } from "@/modules/assistencial/context";

export async function criarInternacao(formData: FormData) {
  const { supabase, user, empresaId, unidadeId } = await getAssistencialContext();
  const atendimentoId = String(formData.get("atendimento_id") ?? "").trim();
  const setor = String(formData.get("setor") ?? "").trim();
  if (!atendimentoId || !setor) redirect("/internacao?erro=campos");

  const { error } = await supabase.from("internacoes").insert({
    empresa_id: empresaId,
    unidade_id: unidadeId,
    atendimento_id: atendimentoId,
    profissional_responsavel_id: String(formData.get("profissional_responsavel_id") ?? "").trim() || null,
    setor,
    leito: String(formData.get("leito") ?? "").trim() || null,
    acomodacao: String(formData.get("acomodacao") ?? "").trim() || null,
    motivo: String(formData.get("motivo") ?? "").trim() || null,
    previsao_alta: String(formData.get("previsao_alta") ?? "").trim() || null,
    observacoes: String(formData.get("observacoes") ?? "").trim() || null,
    created_by: user.id,
    updated_by: user.id,
  });
  if (error) redirect("/internacao?erro=salvar");
  redirect("/internacao?sucesso=1");
}
