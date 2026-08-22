"use server";

import { redirect } from "next/navigation";
import { getAssistencialContext } from "@/modules/assistencial/context";

export async function abrirAtendimento(formData: FormData) {
  const { supabase, user, empresaId, unidadeId } = await getAssistencialContext();
  const pacienteId = String(formData.get("paciente_id") ?? "").trim();
  const profissionalId = String(formData.get("profissional_id") ?? "").trim() || null;
  const tipoAtendimento = String(formData.get("tipo_atendimento") ?? "").trim();
  const origem = String(formData.get("origem") ?? "").trim() || null;
  const observacoes = String(formData.get("observacoes") ?? "").trim() || null;
  if (!pacienteId || !tipoAtendimento) redirect("/atendimentos/novo?erro=campos-obrigatorios");

  const { error } = await supabase.from("atendimentos").insert({
    empresa_id: empresaId,
    unidade_id: unidadeId,
    paciente_id: pacienteId,
    profissional_id: profissionalId,
    tipo_atendimento: tipoAtendimento,
    origem,
    observacoes,
    created_by: user.id,
    updated_by: user.id,
  });

  if (error) redirect("/atendimentos/novo?erro=falha-cadastro");
  redirect("/atendimentos?sucesso=aberto");
}
