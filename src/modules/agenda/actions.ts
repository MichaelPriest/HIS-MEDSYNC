"use server";

import { redirect } from "next/navigation";
import { getAssistencialContext } from "@/modules/assistencial/context";

export async function criarAgendamento(formData: FormData) {
  const { supabase, user, empresaId, unidadeId } = await getAssistencialContext();
  const pacienteId = String(formData.get("paciente_id") ?? "").trim();
  const profissionalId = String(formData.get("profissional_id") ?? "").trim() || null;
  const convenioId = String(formData.get("convenio_id") ?? "").trim() || null;
  const inicioLocal = String(formData.get("inicio") ?? "").trim();
  const fimLocal = String(formData.get("fim") ?? "").trim();
  const tipoAtendimento = String(formData.get("tipo_atendimento") ?? "").trim() || null;
  const observacoes = String(formData.get("observacoes") ?? "").trim() || null;
  if (!pacienteId || !inicioLocal || !fimLocal) redirect("/agenda/novo?erro=campos-obrigatorios");

  const { error } = await supabase.from("agendamentos").insert({
    empresa_id: empresaId,
    unidade_id: unidadeId,
    paciente_id: pacienteId,
    profissional_id: profissionalId,
    convenio_id: convenioId,
    inicio: new Date(inicioLocal).toISOString(),
    fim: new Date(fimLocal).toISOString(),
    tipo_atendimento: tipoAtendimento,
    observacoes,
    created_by: user.id,
    updated_by: user.id,
  });

  if (error) redirect("/agenda/novo?erro=falha-cadastro");
  redirect("/agenda?sucesso=agendado");
}
