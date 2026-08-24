"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAssistencialContext } from "@/modules/assistencial/context";

function optional(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? "").trim();
  return value || null;
}

function toIso(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function agendaReturn(formData: FormData) {
  const requested = String(formData.get("retorno") ?? "/agenda").trim();
  return requested.startsWith("/agenda") ? requested : "/agenda";
}

function agendaRedirect(base: string, key: "erro" | "sucesso", value: string) {
  const separator = base.includes("?") ? "&" : "?";
  redirect(`${base}${separator}${key}=${encodeURIComponent(value)}` as Route);
}

export async function criarAgendamento(formData: FormData) {
  const { supabase, empresaId, unidadeId } = await getAssistencialContext();
  const pacienteId = String(formData.get("paciente_id") ?? "").trim();
  const inicioLocal = String(formData.get("inicio") ?? "").trim();
  const fimLocal = String(formData.get("fim") ?? "").trim();
  const inicio = toIso(inicioLocal);
  const fim = toIso(fimLocal);

  if (!pacienteId || !inicio || !fim) redirect("/agenda/novo?erro=campos-obrigatorios");

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
    if (code.includes("AGENDA_CONFLITO_HORARIO")) redirect("/agenda/novo?erro=conflito-horario");
    if (code.includes("AGENDA_PLANO_INVALIDO")) redirect("/agenda/novo?erro=plano");
    if (code.includes("AGENDA_LOCAL_INVALIDO")) redirect("/agenda/novo?erro=local");
    console.error("[agenda.criar] falha", { code: error.code });
    redirect("/agenda/novo?erro=falha-cadastro");
  }

  revalidatePath("/agenda");
  redirect("/agenda?sucesso=agendado");
}

export async function atualizarStatusAgendamento(formData: FormData) {
  const { supabase } = await getAssistencialContext();
  const agendamentoId = String(formData.get("agendamento_id") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  const motivo = optional(formData, "motivo");
  const retorno = agendaReturn(formData);

  if (!agendamentoId || !status) redirect("/agenda?erro=acao-invalida");

  const { error } = await supabase.rpc("atualizar_status_agendamento", {
    p_agendamento: agendamentoId,
    p_status: status,
    p_motivo: motivo,
  });

  if (error) {
    const code = String(error.message ?? "");
    if (code.includes("AGENDA_MOTIVO_CANCELAMENTO_OBRIGATORIO")) agendaRedirect(retorno, "erro", "motivo-cancelamento");
    if (code.includes("AGENDA_TRANSICAO_INVALIDA") || code.includes("AGENDA_STATUS_FINAL")) agendaRedirect(retorno, "erro", "status");
    console.error("[agenda.status] falha", { code: error.code });
    agendaRedirect(retorno, "erro", "acao");
  }

  revalidatePath("/agenda");

  if (status === "checkin") {
    const { data: agendamento, error: agendaError } = await supabase
      .from("agendamentos")
      .select("cirurgia_eletiva")
      .eq("id", agendamentoId)
      .maybeSingle();

    if (agendaError || !agendamento) {
      console.error("[agenda.checkin] falha ao resolver destino", { code: agendaError?.code ?? "SEM_DADO" });
      agendaRedirect(retorno, "erro", "acao");
    }

    if (agendamento.cirurgia_eletiva) redirect(`/assistencial/centro-cirurgico?agendamento=${agendamentoId}` as Route);
    redirect(`/atendimentos/novo?agendamento=${agendamentoId}` as Route);
  }

  agendaRedirect(retorno, "sucesso", "status");
}
