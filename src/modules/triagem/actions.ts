"use server";

import { revalidatePath } from "next/cache";
import type { BackgroundActionState } from "@/lib/actions/background-action";
import { getAssistencialContext } from "@/modules/assistencial/context";
import { encaminharPosTriagem } from "@/modules/triagem/fluxo-pos-triagem";

type TriageActionData = { redirectTo?: string };
type TriageActionState = BackgroundActionState<TriageActionData>;

function numberOrNull(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim().replace(",", ".");
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function failure(code: string, message: string, detail?: string): TriageActionState {
  return { status: "error", code, message, detail };
}

function success(message: string, data?: TriageActionData): TriageActionState {
  return { status: "success", message, data };
}

export async function chamarPacienteTriagem(
  _previousState: TriageActionState,
  formData: FormData,
): Promise<TriageActionState> {
  const { supabase, user, empresaId, unidadeId } = await getAssistencialContext();
  const atendimentoId = String(formData.get("atendimento_id") ?? "").trim();
  const ponto = String(formData.get("ponto_atendimento") ?? "Sala de Triagem").trim() || "Sala de Triagem";
  if (!atendimentoId) return failure("atendimento", "Atendimento não informado para a chamada.");

  const { data: atendimento, error: atendimentoError } = await supabase
    .from("atendimentos")
    .select("id,paciente_id,triagem_concluida_em,status")
    .eq("id", atendimentoId)
    .eq("unidade_id", unidadeId)
    .maybeSingle();

  if (atendimentoError) {
    console.error("[triagem.chamada] falha ao validar atendimento", { atendimentoId, code: atendimentoError.code });
    return failure("atendimento", "Não foi possível validar o atendimento antes da chamada.");
  }
  if (!atendimento || atendimento.triagem_concluida_em || ["alta", "cancelado", "encerrado"].includes(String(atendimento.status))) {
    return failure("atendimento", "Este atendimento não está mais disponível para chamada na Triagem.");
  }

  const { data: filaExistente, error: filaConsultaError } = await supabase
    .from("filas_setoriais")
    .select("id,status")
    .eq("atendimento_id", atendimentoId)
    .eq("unidade_id", unidadeId)
    .eq("setor_codigo", "triagem")
    .neq("status", "cancelado")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (filaConsultaError) {
    console.error("[triagem.chamada] falha ao localizar fila", { atendimentoId, code: filaConsultaError.code });
    return failure("chamada", "Não foi possível localizar a fila da Triagem.");
  }

  const now = new Date().toISOString();
  if (filaExistente) {
    const { error } = await supabase
      .from("filas_setoriais")
      .update({
        status: "chamado",
        ponto_atendimento: ponto,
        chamado_em: now,
        concluido_em: null,
        updated_by: user.id,
        updated_at: now,
      })
      .eq("id", filaExistente.id);
    if (error) {
      console.error("[triagem.chamada] falha ao atualizar fila", { atendimentoId, code: error.code });
      return failure("chamada", "Não foi possível chamar o paciente no painel.");
    }
  } else {
    const { error } = await supabase.from("filas_setoriais").insert({
      empresa_id: empresaId,
      unidade_id: unidadeId,
      atendimento_id: atendimentoId,
      paciente_id: atendimento.paciente_id,
      setor_codigo: "triagem",
      origem: "recepcao",
      motivo: "Triagem inicial",
      prioridade: "normal",
      status: "chamado",
      ponto_atendimento: ponto,
      chamado_em: now,
      created_by: user.id,
      updated_by: user.id,
    });
    if (error) {
      console.error("[triagem.chamada] falha ao criar fila", { atendimentoId, code: error.code });
      return failure("chamada", "Não foi possível chamar o paciente no painel.");
    }
  }

  const { error: setorError } = await supabase
    .from("atendimentos")
    .update({ setor_atual: "triagem", ultima_movimentacao_em: now, updated_by: user.id, updated_at: now })
    .eq("id", atendimentoId)
    .eq("unidade_id", unidadeId);
  if (setorError) console.error("[triagem.chamada] chamada realizada, mas falhou atualização do setor", { atendimentoId, code: setorError.code });

  revalidatePath("/triagem");
  revalidatePath(`/painel-chamadas/${unidadeId}`);
  return success("Paciente chamado no painel. A chamada pode ser repetida sem recarregar a página.");
}

export async function registrarTriagem(
  _previousState: TriageActionState,
  formData: FormData,
): Promise<TriageActionState> {
  const { supabase, user, empresaId, unidadeId } = await getAssistencialContext();
  const atendimentoId = String(formData.get("atendimento_id") ?? "").trim();
  const especialidade = String(formData.get("especialidade_destino") ?? "").trim();
  if (!atendimentoId || !especialidade) {
    return failure("atendimento-especialidade", "Informe o atendimento e a especialidade de destino.");
  }

  const { data: atendimento, error: atendimentoConsultaError } = await supabase
    .from("atendimentos")
    .select("id,paciente_id,cobertura,triagem_concluida_em,tipo_atendimento")
    .eq("id", atendimentoId)
    .eq("unidade_id", unidadeId)
    .maybeSingle();
  if (atendimentoConsultaError) {
    console.error("[triagem] falha ao validar atendimento", { atendimentoId, code: atendimentoConsultaError.code });
    return failure("atendimento", "Não foi possível validar o atendimento antes de salvar a Triagem.");
  }
  if (!atendimento || atendimento.triagem_concluida_em) {
    return failure("atendimento", "Este atendimento não está mais disponível para registro de Triagem.");
  }

  const classificacao = String(formData.get("classificacao_risco") ?? "").trim() || null;
  const queixaPrincipal = String(formData.get("queixa_principal") ?? "").trim() || null;
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
    queixa_principal: queixaPrincipal,
    observacoes: String(formData.get("observacoes") ?? "").trim() || null,
    created_by: user.id,
    updated_by: user.id,
  };

  const { error: triagemError } = await supabase.from("triagens").upsert(payload, { onConflict: "atendimento_id" });
  if (triagemError) {
    console.error("[triagem] falha ao salvar", { atendimentoId, code: triagemError.code, message: triagemError.message });
    return failure("salvar", "Não foi possível salvar os dados da Triagem.");
  }

  let autorizacaoLiberada = atendimento.cobertura !== "convenio";
  if (!autorizacaoLiberada) {
    const [{ data: autorizacao }, { data: guiaCentral }] = await Promise.all([
      supabase.from("autorizacoes_atendimento").select("status").eq("atendimento_id", atendimentoId).maybeSingle(),
      supabase.from("central_guias").select("status").eq("atendimento_id", atendimentoId).in("status", ["autorizada", "dispensada"]).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    autorizacaoLiberada = Boolean(
      (autorizacao && ["autorizada", "dispensada"].includes(String(autorizacao.status))) ||
      (guiaCentral && ["autorizada", "dispensada"].includes(String(guiaCentral.status)))
    );
  }

  const now = new Date().toISOString();
  const { error: atendimentoError } = await supabase
    .from("atendimentos")
    .update({
      especialidade_destino: especialidade,
      triagem_concluida_em: now,
      status: "em_espera",
      setor_atual: autorizacaoLiberada ? "triagem_concluida" : "autorizacoes",
      ultima_movimentacao_em: now,
      updated_at: now,
      updated_by: user.id,
    })
    .eq("id", atendimentoId)
    .eq("unidade_id", unidadeId);
  if (atendimentoError) {
    console.error("[triagem] falha ao concluir atendimento", { atendimentoId, code: atendimentoError.code, message: atendimentoError.message });
    return failure(
      "encaminhar",
      "Os dados da Triagem foram gravados, mas o encaminhamento do atendimento não foi concluído.",
      "Tente novamente. O sistema não apagou os dados já registrados.",
    );
  }

  const { error: filaError } = await supabase
    .from("filas_setoriais")
    .update({ status: "concluido", concluido_em: now, updated_by: user.id, updated_at: now })
    .eq("atendimento_id", atendimentoId)
    .eq("unidade_id", unidadeId)
    .eq("setor_codigo", "triagem")
    .in("status", ["aguardando", "chamado", "em_atendimento"]);
  if (filaError) console.error("[triagem] falha ao concluir fila", { atendimentoId, code: filaError.code });

  revalidatePath("/triagem");
  revalidatePath(`/painel-chamadas/${unidadeId}`);

  if (!autorizacaoLiberada) {
    revalidatePath("/autorizacoes");
    return success("Triagem salva. O atendimento precisa seguir para Autorização.", {
      redirectTo: `/autorizacoes?atendimento=${atendimentoId}&sucesso=triagem-salva`,
    });
  }

  let destino: Awaited<ReturnType<typeof encaminharPosTriagem>>;
  try {
    destino = await encaminharPosTriagem({
      supabase,
      userId: user.id,
      empresaId,
      unidadeId,
      atendimentoId,
      pacienteId: atendimento.paciente_id,
      tipoAtendimento: atendimento.tipo_atendimento,
      especialidade,
      classificacao,
      queixaPrincipal,
    });
  } catch (error) {
    console.error("[triagem] falha no encaminhamento pos-triagem", { atendimentoId, error });
    return failure(
      "encaminhar",
      "A Triagem foi salva, mas o encaminhamento para o próximo setor não foi concluído.",
      "Tente novamente sem refazer os dados já registrados.",
    );
  }

  revalidatePath("/fila-medica");
  revalidatePath("/assistencial/urgencia");
  revalidatePath("/pronto-socorro");

  if (destino.prontoSocorro) {
    return success("Triagem concluída. Encaminhando para o Pronto-Socorro.", {
      redirectTo: `/pronto-socorro?atendimento=${atendimentoId}&sucesso=triagem`,
    });
  }

  return success("Triagem concluída e paciente encaminhado para a fila assistencial.");
}
