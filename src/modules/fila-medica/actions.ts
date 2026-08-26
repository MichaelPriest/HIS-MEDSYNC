"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAssistencialContext } from "@/modules/assistencial/context";

function normalizar(value: string | null | undefined) {
  return (value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function setorClinico(setorAtual: string | null | undefined) {
  return normalizar(setorAtual).replace(/\s+/g, "_") === "pronto_socorro" ? "pronto_socorro" : "consultorio";
}

export async function assumirPaciente(formData: FormData) {
  const { supabase, user, empresaId, unidadeId } = await getAssistencialContext();
  const encaminhamentoId = String(formData.get("encaminhamento_id") ?? "").trim();
  const pontoAtendimento = String(formData.get("ponto_atendimento") ?? "").trim() || "Consultório 01";
  if (!encaminhamentoId) redirect("/fila-medica?erro=encaminhamento");

  let { data: profissional } = await supabase.from("profissionais").select("id,nome_completo,especialidade").eq("usuario_id", user.id).eq("ativo", true).maybeSingle();
  if (!profissional && user.email) {
    const fallback = await supabase.from("profissionais").select("id,nome_completo,especialidade").ilike("email", user.email).eq("ativo", true).limit(1).maybeSingle();
    profissional = fallback.data;
  }
  if (!profissional) redirect("/fila-medica?erro=perfil-profissional");

  const { data: encaminhamento } = await supabase.from("encaminhamentos_assistenciais")
    .select("id,atendimento_id,paciente_id,especialidade,status,prioridade,motivo")
    .eq("id", encaminhamentoId)
    .eq("unidade_id", unidadeId)
    .maybeSingle();
  if (!encaminhamento || encaminhamento.status !== "aguardando_profissional") redirect("/fila-medica?erro=indisponivel");

  const especialidadeProf = normalizar(profissional.especialidade);
  const especialidadeFila = normalizar(encaminhamento.especialidade);
  if (!especialidadeProf || (!especialidadeProf.includes(especialidadeFila) && !especialidadeFila.includes(especialidadeProf))) redirect("/fila-medica?erro=especialidade");

  const { data: atendimento, error: atendimentoConsultaError } = await supabase.from("atendimentos")
    .select("id,paciente_id,setor_atual")
    .eq("id", encaminhamento.atendimento_id)
    .eq("unidade_id", unidadeId)
    .maybeSingle();
  if (atendimentoConsultaError || !atendimento) redirect("/fila-medica?erro=atendimento");

  const setorCodigo = setorClinico(atendimento.setor_atual);
  const pacienteId = encaminhamento.paciente_id ?? atendimento.paciente_id;
  const now = new Date().toISOString();

  // Faz primeiro a tomada otimista do encaminhamento. A condição no status garante
  // que apenas um profissional vença a corrida e só o vencedor publique a chamada.
  const { data: encaminhamentoAtualizado, error: claimError } = await supabase.from("encaminhamentos_assistenciais").update({
    profissional_id: profissional.id,
    status: "em_atendimento",
    chamado_em: now,
    iniciado_em: now,
    updated_at: now,
    updated_by: user.id,
  }).eq("id", encaminhamentoId).eq("unidade_id", unidadeId).eq("status", "aguardando_profissional").select("id").maybeSingle();
  if (claimError || !encaminhamentoAtualizado) redirect("/fila-medica?erro=assumir");

  async function liberarClaim() {
    await supabase.from("encaminhamentos_assistenciais").update({
      profissional_id: null,
      status: "aguardando_profissional",
      chamado_em: null,
      iniciado_em: null,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    }).eq("id", encaminhamentoId).eq("unidade_id", unidadeId).eq("profissional_id", profissional.id).eq("status", "em_atendimento");
  }

  const { data: filaSetorial, error: filaSetorialConsultaError } = await supabase.from("filas_setoriais")
    .select("id,status")
    .eq("atendimento_id", encaminhamento.atendimento_id)
    .eq("unidade_id", unidadeId)
    .eq("setor_codigo", setorCodigo)
    .in("status", ["aguardando", "chamado", "em_atendimento"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (filaSetorialConsultaError) {
    await liberarClaim();
    redirect("/fila-medica?erro=fila-setorial");
  }

  const filaSetorialPayload = {
    status: "em_atendimento",
    ponto_atendimento: pontoAtendimento,
    chamado_em: now,
    iniciado_em: now,
    profissional_destino_id: profissional.id,
    updated_by: user.id,
    updated_at: now,
  };

  const filaSetorialResult = filaSetorial
    ? await supabase.from("filas_setoriais").update(filaSetorialPayload).eq("id", filaSetorial.id).eq("unidade_id", unidadeId)
    : await supabase.from("filas_setoriais").insert({
      empresa_id: empresaId,
      unidade_id: unidadeId,
      atendimento_id: encaminhamento.atendimento_id,
      paciente_id: pacienteId,
      setor_codigo: setorCodigo,
      origem: "triagem",
      motivo: encaminhamento.motivo || `Consulta médica · ${encaminhamento.especialidade}`,
      prioridade: encaminhamento.prioridade || "normal",
      created_by: user.id,
      ...filaSetorialPayload,
    });
  if (filaSetorialResult.error) {
    await liberarClaim();
    redirect("/fila-medica?erro=fila-setorial");
  }

  const { error: atendimentoError } = await supabase.from("atendimentos").update({
    profissional_id: profissional.id,
    status: "em_atendimento",
    setor_atual: setorCodigo,
    ultima_movimentacao_em: now,
    updated_at: now,
    updated_by: user.id,
  }).eq("id", encaminhamento.atendimento_id).eq("unidade_id", unidadeId);
  if (atendimentoError) {
    await liberarClaim();
    redirect("/fila-medica?erro=atendimento");
  }

  revalidatePath("/fila-medica");
  revalidatePath(`/painel-chamadas/${unidadeId}`);
  redirect(`/prontuario/${encaminhamento.atendimento_id}/clinico`);
}
