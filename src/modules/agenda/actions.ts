"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { BackgroundActionState } from "@/lib/actions/background-action";
import { getAssistencialContext } from "@/modules/assistencial/context";

function optional(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? "").trim();
  return value || null;
}

function toIso(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export async function criarAgendamento(
  _previousState: BackgroundActionState,
  formData: FormData,
): Promise<BackgroundActionState> {
  const { supabase, empresaId, unidadeId } = await getAssistencialContext();
  const pacienteId = String(formData.get("paciente_id") ?? "").trim();
  const inicioLocal = String(formData.get("inicio") ?? "").trim();
  const fimLocal = String(formData.get("fim") ?? "").trim();
  const inicio = toIso(inicioLocal);
  const fim = toIso(fimLocal);

  if (!pacienteId || !inicio || !fim) {
    return {
      status: "error",
      code: "campos-obrigatorios",
      message: "Selecione o paciente e informe início e fim do agendamento.",
    };
  }

  const { error } = await supabase.rpc("criar_agendamento_operacional", {
    p_payload: {
      empresa_id: empresaId,
      unidade_id: unidadeId,
      paciente_id: pacienteId,
      profissional_id: optional(formData, "profissional_id"),
      convenio_id: optional(formData, "convenio_id"),
      plano_id: optional(formData, "plano_id"),
      tipo_atendimento: optional(formData, "tipo_atendimento"),
      especialidade: optional(formData, "especialidade"),
      estrutura_fisica_id: optional(formData, "estrutura_fisica_id"),
      cirurgia_eletiva: String(formData.get("cirurgia_eletiva") ?? "") === "true",
      encaixe: String(formData.get("encaixe") ?? "") === "true",
      retorno: String(formData.get("retorno") ?? "") === "true",
      motivo_agendamento: optional(formData, "motivo_agendamento"),
      observacoes: optional(formData, "observacoes"),
      inicio,
      fim,
    },
  });

  if (error) {
    const code = String(error.message ?? "");
    if (code.includes("AGENDA_CONFLITO_HORARIO")) {
      return {
        status: "error",
        code: "conflito-horario",
        message: "Existe conflito de horário para o profissional ou local selecionado.",
      };
    }
    if (code.includes("AGENDA_PLANO_INVALIDO")) {
      return {
        status: "error",
        code: "plano",
        message: "O plano selecionado não pertence ao convênio informado ou está inativo.",
      };
    }
    if (code.includes("AGENDA_LOCAL_INVALIDO")) {
      return {
        status: "error",
        code: "local",
        message: "O local selecionado não está disponível para atendimento nesta unidade.",
      };
    }

    console.error("[agenda.criar] falha", { code: error.code });
    return {
      status: "error",
      code: "falha-cadastro",
      message: "Não foi possível salvar o agendamento. Revise os dados e suas permissões.",
    };
  }

  revalidatePath("/agenda");

  return {
    status: "success",
    code: "agendado",
    message: "Agendamento criado com sucesso.",
  };
}

export async function atualizarStatusAgendamento(
  _previousState: BackgroundActionState,
  formData: FormData,
): Promise<BackgroundActionState> {
  const { supabase } = await getAssistencialContext();
  const agendamentoId = String(formData.get("agendamento_id") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  const motivo = optional(formData, "motivo");

  if (!agendamentoId || !status) {
    return {
      status: "error",
      code: "acao-invalida",
      message: "A ação solicitada para este agendamento é inválida.",
    };
  }

  let cirurgiaEletiva = false;
  if (status === "checkin") {
    const { data: agendamento, error: agendaError } = await supabase
      .from("agendamentos")
      .select("cirurgia_eletiva")
      .eq("id", agendamentoId)
      .maybeSingle();

    if (agendaError || !agendamento) {
      console.error("[agenda.checkin] falha ao resolver destino", {
        code: agendaError?.code ?? "SEM_DADO",
      });
      return {
        status: "error",
        code: "destino-checkin",
        message: "Não foi possível identificar a próxima etapa deste agendamento.",
      };
    }
    cirurgiaEletiva = Boolean(agendamento.cirurgia_eletiva);
  }

  const { error } = await supabase.rpc("atualizar_status_agendamento", {
    p_agendamento: agendamentoId,
    p_status: status,
    p_motivo: motivo,
  });

  if (error) {
    const code = String(error.message ?? "");
    if (code.includes("AGENDA_MOTIVO_CANCELAMENTO_OBRIGATORIO")) {
      return {
        status: "error",
        code: "motivo-cancelamento",
        message: "Informe o motivo do cancelamento.",
      };
    }
    if (code.includes("AGENDA_TRANSICAO_INVALIDA") || code.includes("AGENDA_STATUS_FINAL")) {
      return {
        status: "error",
        code: "status",
        message: "O status do agendamento mudou ou não permite mais esta ação.",
      };
    }

    console.error("[agenda.status] falha", { code: error.code });
    return {
      status: "error",
      code: "acao",
      message: "Não foi possível atualizar o agendamento.",
    };
  }

  revalidatePath("/agenda");

  if (status === "checkin") {
    if (cirurgiaEletiva) {
      redirect(`/assistencial/centro-cirurgico?agendamento=${agendamentoId}` as Route);
    }
    redirect(`/atendimentos/novo?agendamento=${agendamentoId}` as Route);
  }

  const labels: Record<string, string> = {
    confirmado: "Agendamento confirmado.",
    atendido: "Atendimento marcado como concluído na Agenda.",
    faltou: "Falta registrada na Agenda.",
    cancelado: "Agendamento cancelado.",
  };

  return {
    status: "success",
    code: status,
    message: labels[status] ?? "Agenda atualizada com sucesso.",
  };
}
