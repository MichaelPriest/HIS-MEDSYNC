"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAssistencialContext } from "@/modules/assistencial/context";

function normalizar(value: string | null | undefined) {
  return (value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function codigo(value: string | null | undefined) {
  return normalizar(value).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function setorClinico(setorAtual: string | null | undefined, origem: string | null | undefined, tipoAtendimento: string | null | undefined) {
  const setor = codigo(setorAtual);
  const origemNormalizada = codigo(origem);
  const tipo = codigo(tipoAtendimento);

  if (["pronto_socorro", "ps", "urgencia", "emergencia"].some((valor) => setor.includes(valor)) || ["urgencia", "emergencia"].some((valor) => tipo.includes(valor))) return "pronto_socorro";
  if (setor === "triagem" && ["demanda_espontanea", "porta", "pronto_atendimento"].some((valor) => origemNormalizada.includes(valor))) return "pronto_socorro";

  if (["internacao", "internado", "enfermaria", "uti", "cti", "semi_intensiva", "centro_cirurgico"].some((valor) => setor.includes(valor)) || tipo.includes("internacao")) {
    return setor && setor !== "triagem" ? setor : "internacao";
  }

  if (["ambulatorio", "consultorio"].some((valor) => setor.includes(valor)) || ["agenda", "agendamento", "eletivo", "ambulatorio"].some((valor) => origemNormalizada.includes(valor) || tipo.includes(valor))) return "consultorio";

  return setor && setor !== "triagem" ? setor : "consultorio";
}

function filaComErro(filaSetor: string, erro: string): Route {
  const query = new URLSearchParams({ erro });
  if (["ps", "ambulatorio", "internacao", "outros"].includes(filaSetor)) query.set("setor", filaSetor);
  return `/fila-medica?${query.toString()}` as Route;
}

export async function assumirPaciente(formData: FormData) {
  const { supabase, user, empresaId, unidadeId } = await getAssistencialContext();
  const encaminhamentoId = String(formData.get("encaminhamento_id") ?? "").trim();
  const filaSetor = String(formData.get("fila_setor") ?? "").trim();
  const pontoAtendimento = String(formData.get("ponto_atendimento") ?? "").trim() || "Consultório 01";
  if (!encaminhamentoId) redirect(filaComErro(filaSetor, "encaminhamento"));

  let { data: profissional } = await supabase.from("profissionais").select("id,nome_completo,especialidade").eq("usuario_id", user.id).eq("ativo", true).maybeSingle();
  if (!profissional && user.email) {
    const fallback = await supabase.from("profissionais").select("id,nome_completo,especialidade").ilike("email", user.email).eq("ativo", true).limit(1).maybeSingle();
    profissional = fallback.data;
  }
  if (!profissional) redirect(filaComErro(filaSetor, "perfil-profissional"));
  const profissionalId = profissional.id;

  const { data: encaminhamento } = await supabase.from("encaminhamentos_assistenciais")
    .select("id,atendimento_id,paciente_id,especialidade,status,prioridade,motivo")
    .eq("id", encaminhamentoId)
    .eq("unidade_id", unidadeId)
    .maybeSingle();
  if (!encaminhamento || encaminhamento.status !== "aguardando_profissional") redirect(filaComErro(filaSetor, "indisponivel"));

  const especialidadeProf = normalizar(profissional.especialidade);
  const especialidadeFila = normalizar(encaminhamento.especialidade);
  if (!especialidadeProf || (!especialidadeProf.includes(especialidadeFila) && !especialidadeFila.includes(especialidadeProf))) redirect(filaComErro(filaSetor, "especialidade"));

  const { data: atendimento, error: atendimentoConsultaError } = await supabase.from("atendimentos")
    .select("id,paciente_id,setor_atual,origem,tipo_atendimento")
    .eq("id", encaminhamento.atendimento_id)
    .eq("unidade_id", unidadeId)
    .maybeSingle();
  if (atendimentoConsultaError || !atendimento) redirect(filaComErro(filaSetor, "atendimento"));

  const setorCodigo = setorClinico(atendimento.setor_atual, atendimento.origem, atendimento.tipo_atendimento);
  const pacienteId = encaminhamento.paciente_id ?? atendimento.paciente_id;
  const now = new Date().toISOString();

  // Faz primeiro a tomada otimista do encaminhamento. A condição no status garante
  // que apenas um profissional vença a corrida e só o vencedor publique a chamada.
  const { data: encaminhamentoAtualizado, error: claimError } = await supabase.from("encaminhamentos_assistenciais").update({
    profissional_id: profissionalId,
    status: "em_atendimento",
    chamado_em: now,
    iniciado_em: now,
    updated_at: now,
    updated_by: user.id,
  }).eq("id", encaminhamentoId).eq("unidade_id", unidadeId).eq("status", "aguardando_profissional").select("id").maybeSingle();
  if (claimError || !encaminhamentoAtualizado) redirect(filaComErro(filaSetor, "assumir"));

  async function liberarClaim() {
    await supabase.from("encaminhamentos_assistenciais").update({
      profissional_id: null,
      status: "aguardando_profissional",
      chamado_em: null,
      iniciado_em: null,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    }).eq("id", encaminhamentoId).eq("unidade_id", unidadeId).eq("profissional_id", profissionalId).eq("status", "em_atendimento");
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
    redirect(filaComErro(filaSetor, "fila-setorial"));
  }

  const filaSetorialPayload = {
    status: "em_atendimento",
    ponto_atendimento: pontoAtendimento,
    chamado_em: now,
    iniciado_em: now,
    profissional_destino_id: profissionalId,
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
      origem: atendimento.origem || "encaminhamento_medico",
      motivo: encaminhamento.motivo || `Consulta médica · ${encaminhamento.especialidade}`,
      prioridade: encaminhamento.prioridade || "normal",
      created_by: user.id,
      ...filaSetorialPayload,
    });
  if (filaSetorialResult.error) {
    await liberarClaim();
    redirect(filaComErro(filaSetor, "fila-setorial"));
  }

  const { error: atendimentoError } = await supabase.from("atendimentos").update({
    profissional_id: profissionalId,
    status: "em_atendimento",
    setor_atual: setorCodigo,
    ultima_movimentacao_em: now,
    updated_at: now,
    updated_by: user.id,
  }).eq("id", encaminhamento.atendimento_id).eq("unidade_id", unidadeId);
  if (atendimentoError) {
    await liberarClaim();
    redirect(filaComErro(filaSetor, "atendimento"));
  }

  revalidatePath("/fila-medica");
  revalidatePath(`/painel-chamadas/${unidadeId}`);
  redirect(`/prontuario/${encaminhamento.atendimento_id}/clinico`);
}
