"use server";

import { revalidatePath } from "next/cache";
import type { BackgroundActionState } from "@/lib/actions/background-action";
import { getAssistencialContext } from "@/modules/assistencial/context";
import { especialidadesCompativeis } from "@/modules/fila-medica/especialidade";

type AssumirPacienteData = { redirectTo?: string };
type AssumirPacienteState = BackgroundActionState<AssumirPacienteData>;

const ERROR_MESSAGES: Record<string, string> = {
  encaminhamento: "Encaminhamento inválido.",
  "perfil-profissional": "O usuário não está vinculado a um profissional ativo.",
  indisponivel: "Este paciente já foi chamado ou assumido por outro profissional.",
  especialidade: "A especialidade do profissional não corresponde à fila do paciente.",
  atendimento: "Não foi possível atualizar o atendimento clínico.",
  "fila-setorial": "Não foi possível publicar a chamada no painel integrado.",
  assumir: "O paciente foi assumido por outro profissional antes desta chamada.",
};

function failure(code: string, detail?: string): AssumirPacienteState {
  return {
    status: "error",
    code,
    message: ERROR_MESSAGES[code] ?? "Não foi possível chamar e assumir o paciente.",
    detail,
  };
}

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

export async function assumirPaciente(
  _previousState: AssumirPacienteState,
  formData: FormData,
): Promise<AssumirPacienteState> {
  const { supabase, user, empresaId, unidadeId } = await getAssistencialContext();
  const encaminhamentoId = String(formData.get("encaminhamento_id") ?? "").trim();
  const pontoAtendimento = String(formData.get("ponto_atendimento") ?? "").trim() || "Consultório 01";
  if (!encaminhamentoId) return failure("encaminhamento");

  let { data: profissional } = await supabase.from("profissionais").select("id,nome_completo,especialidade").eq("usuario_id", user.id).eq("ativo", true).maybeSingle();
  if (!profissional && user.email) {
    const fallback = await supabase.from("profissionais").select("id,nome_completo,especialidade").ilike("email", user.email).eq("ativo", true).limit(1).maybeSingle();
    profissional = fallback.data;
  }
  if (!profissional) return failure("perfil-profissional");
  const profissionalId = profissional.id;

  const { data: encaminhamento, error: encaminhamentoError } = await supabase.from("encaminhamentos_assistenciais")
    .select("id,atendimento_id,paciente_id,especialidade,status,prioridade,motivo")
    .eq("id", encaminhamentoId)
    .eq("unidade_id", unidadeId)
    .maybeSingle();
  if (encaminhamentoError) {
    console.error("[fila-medica] falha ao consultar encaminhamento", { code: encaminhamentoError.code });
    return failure("encaminhamento");
  }
  if (!encaminhamento || encaminhamento.status !== "aguardando_profissional") return failure("indisponivel");

  if (!especialidadesCompativeis(profissional.especialidade, encaminhamento.especialidade)) return failure("especialidade");

  const { data: atendimento, error: atendimentoConsultaError } = await supabase.from("atendimentos")
    .select("id,paciente_id,setor_atual,origem,tipo_atendimento")
    .eq("id", encaminhamento.atendimento_id)
    .eq("unidade_id", unidadeId)
    .maybeSingle();
  if (atendimentoConsultaError || !atendimento) {
    if (atendimentoConsultaError) console.error("[fila-medica] falha ao consultar atendimento", { code: atendimentoConsultaError.code });
    return failure("atendimento");
  }

  const setorCodigo = setorClinico(atendimento.setor_atual, atendimento.origem, atendimento.tipo_atendimento);
  const pacienteId = encaminhamento.paciente_id ?? atendimento.paciente_id;
  const now = new Date().toISOString();

  // A condição no status garante que apenas um profissional vença a corrida.
  const { data: encaminhamentoAtualizado, error: claimError } = await supabase.from("encaminhamentos_assistenciais").update({
    profissional_id: profissionalId,
    status: "em_atendimento",
    chamado_em: now,
    iniciado_em: now,
    updated_at: now,
    updated_by: user.id,
  }).eq("id", encaminhamentoId).eq("unidade_id", unidadeId).eq("status", "aguardando_profissional").select("id").maybeSingle();
  if (claimError || !encaminhamentoAtualizado) {
    if (claimError) console.error("[fila-medica] falha ao assumir encaminhamento", { code: claimError.code });
    return failure("assumir");
  }

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
    console.error("[fila-medica] falha ao consultar fila setorial", { code: filaSetorialConsultaError.code });
    return failure("fila-setorial");
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
    console.error("[fila-medica] falha ao publicar fila setorial", { code: filaSetorialResult.error.code });
    return failure("fila-setorial");
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
    console.error("[fila-medica] falha ao atualizar atendimento", { code: atendimentoError.code });
    return failure("atendimento");
  }

  revalidatePath("/fila-medica");
  revalidatePath(`/painel-chamadas/${unidadeId}`);
  return {
    status: "success",
    message: "Paciente chamado e assumido. Abrindo o prontuário…",
    data: { redirectTo: `/prontuario/${encaminhamento.atendimento_id}/clinico` },
  };
}