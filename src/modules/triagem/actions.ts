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
  const especialidade = String(formData.get("especialidade_destino") ?? "").trim();
  if (!atendimentoId || !especialidade) redirect("/triagem?erro=atendimento-especialidade");

  const { data: atendimento } = await supabase.from("atendimentos").select("id,paciente_id,cobertura").eq("id", atendimentoId).eq("unidade_id", unidadeId).maybeSingle();
  if (!atendimento) redirect("/triagem?erro=atendimento");

  if (atendimento.cobertura === "convenio") {
    const { data: autorizacao } = await supabase.from("autorizacoes_atendimento").select("status").eq("atendimento_id", atendimentoId).maybeSingle();
    if (!autorizacao || !["autorizada","dispensada"].includes(String(autorizacao.status))) redirect(`/autorizacoes?atendimento=${atendimentoId}&erro=autorizacao-pendente`);
  }

  const classificacao = String(formData.get("classificacao_risco") ?? "").trim() || null;
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
    classificacao_risco: classificacao,
    queixa_principal: String(formData.get("queixa_principal") ?? "").trim() || null,
    observacoes: String(formData.get("observacoes") ?? "").trim() || null,
    created_by: user.id,
    updated_by: user.id,
  };

  const { error } = await supabase.from("triagens").upsert(payload, { onConflict: "atendimento_id" });
  if (error) redirect("/triagem?erro=salvar");

  const now = new Date().toISOString();
  const { error: atendimentoError } = await supabase.from("atendimentos").update({ especialidade_destino: especialidade, triagem_concluida_em: now, status: "em_espera", updated_at: now, updated_by: user.id }).eq("id", atendimentoId).eq("unidade_id", unidadeId);
  if (atendimentoError) redirect("/triagem?erro=encaminhar");

  const prioridade = classificacao === "vermelho" ? "emergencia" : classificacao === "laranja" || classificacao === "amarelo" ? "preferencial" : "normal";
  const { error: encaminhamentoError } = await supabase.from("encaminhamentos_assistenciais").upsert({
    empresa_id: empresaId, unidade_id: unidadeId, atendimento_id: atendimentoId, paciente_id: atendimento.paciente_id,
    origem: "triagem", especialidade, status: "aguardando_profissional", prioridade, created_by: user.id, updated_by: user.id, updated_at: now,
  }, { onConflict: "atendimento_id" });
  if (encaminhamentoError) redirect("/triagem?erro=encaminhar");

  redirect(`/triagem?sucesso=encaminhado&atendimento=${atendimentoId}`);
}
