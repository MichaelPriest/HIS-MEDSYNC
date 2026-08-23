"use server";

import { redirect } from "next/navigation";
import { getAssistencialContext } from "@/modules/assistencial/context";

export async function criarPrescricao(formData: FormData) {
  const { supabase, user, empresaId, unidadeId } = await getAssistencialContext();
  const atendimentoId = String(formData.get("atendimento_id") ?? "").trim();
  const profissionalId = String(formData.get("profissional_id") ?? "").trim();
  const item = String(formData.get("item") ?? "").trim();
  const tipo = String(formData.get("tipo") ?? "medicamento");
  if (!atendimentoId || !profissionalId || !item) redirect("/prescricao?erro=campos");

  const { data: atendimento } = await supabase.from("atendimentos").select("id,paciente_id").eq("id", atendimentoId).eq("unidade_id", unidadeId).maybeSingle();
  if (!atendimento) redirect("/prescricao?erro=atendimento");

  const { data: prescricao, error } = await supabase.from("prescricoes").insert({
    empresa_id: empresaId,
    unidade_id: unidadeId,
    atendimento_id: atendimentoId,
    profissional_id: profissionalId,
    tipo,
    item,
    dose: String(formData.get("dose") ?? "").trim() || null,
    via: String(formData.get("via") ?? "").trim() || null,
    frequencia: String(formData.get("frequencia") ?? "").trim() || null,
    duracao: String(formData.get("duracao") ?? "").trim() || null,
    instrucoes: String(formData.get("instrucoes") ?? "").trim() || null,
    created_by: user.id,
    updated_by: user.id,
  }).select("id").single();
  if (error || !prescricao) redirect("/prescricao?erro=salvar");

  if (tipo === "medicamento") {
    await supabase.from("filas_setoriais").insert({
      empresa_id: empresaId,
      unidade_id: unidadeId,
      atendimento_id: atendimentoId,
      paciente_id: atendimento.paciente_id,
      setor_codigo: "farmacia",
      origem: "prescricao",
      motivo: `Dispensação da prescrição: ${item}`,
      prioridade: "normal",
      profissional_origem_id: profissionalId,
      created_by: user.id,
      updated_by: user.id,
    });
    await supabase.from("atendimentos").update({ setor_atual: "farmacia", ultima_movimentacao_em: new Date().toISOString(), updated_by: user.id }).eq("id", atendimentoId);
  }
  redirect("/prescricao?sucesso=1");
}
