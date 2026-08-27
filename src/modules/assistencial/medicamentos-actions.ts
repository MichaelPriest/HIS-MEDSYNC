"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAssistencialContext } from "@/modules/assistencial/context";

function text(fd: FormData, key: string) {
  const value = String(fd.get(key) ?? "").trim();
  return value || null;
}

function numberValue(fd: FormData, key: string) {
  const raw = text(fd, key);
  if (!raw) return null;
  const n = Number(raw.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function go(url: string): never {
  redirect(url as Route);
}

function farmaciaUrl(params: Record<string, string>) {
  const qs = new URLSearchParams(params);
  return `/assistencial/medicamentos?${qs.toString()}`;
}

export async function gerarAprazamentosAction(fd: FormData) {
  const { supabase } = await getAssistencialContext();
  const prescricaoId = String(fd.get("prescricao_id") ?? "").trim();
  const horizonte = Math.max(1, Math.min(7, Number(fd.get("horizonte_dias") ?? 2) || 2));
  if (!prescricaoId) go(farmaciaUrl({ erro: "prescricao" }));

  const { data, error } = await supabase.rpc("gerar_aprazamentos_prescricao", {
    p_prescricao_id: prescricaoId,
    p_horizonte_dias: horizonte,
  });
  if (error) {
    console.error("[medicamentos] aprazar", error);
    go(farmaciaUrl({ erro: error.message }));
  }

  revalidatePath("/assistencial/medicamentos");
  revalidatePath("/assistencial/enfermagem");
  go(farmaciaUrl({ sucesso: "aprazamento", gerados: String(Number(data ?? 0)) }));
}

export async function validarPrescricaoFarmaceuticaAction(fd: FormData) {
  const { supabase } = await getAssistencialContext();
  const prescricaoId = String(fd.get("prescricao_id") ?? "").trim();
  if (!prescricaoId) go(farmaciaUrl({ erro: "prescricao" }));

  const { error } = await supabase.rpc("validar_prescricao_farmaceutica", {
    p_prescricao_id: prescricaoId,
    p_status: text(fd, "status") ?? "validada",
    p_alergias: fd.get("alergias") === "on",
    p_interacoes: fd.get("interacoes") === "on",
    p_dose: fd.get("dose") === "on",
    p_via: fd.get("via") === "on",
    p_funcao_renal: fd.get("funcao_renal") === "on",
    p_duplicidade: fd.get("duplicidade") === "on",
    p_incompatibilidades: text(fd, "incompatibilidades"),
    p_intervencao: text(fd, "intervencao"),
  });
  if (error) {
    console.error("[medicamentos] validar", error);
    go(farmaciaUrl({ erro: error.message }));
  }

  revalidatePath("/assistencial/medicamentos");
  go(farmaciaUrl({ sucesso: "validacao" }));
}

export async function dispensarPrescricaoAction(fd: FormData) {
  const { supabase } = await getAssistencialContext();
  const prescricaoId = String(fd.get("prescricao_id") ?? "").trim();
  const quantidade = numberValue(fd, "quantidade");
  const farmaciaLocalId = text(fd, "farmacia_local_id");
  if (!prescricaoId || !quantidade || quantidade <= 0) go(farmaciaUrl({ erro: "dispensacao" }));

  const { data, error } = await supabase.rpc("dispensar_medicamento_prescricao_fefo", {
    p_prescricao_id: prescricaoId,
    p_quantidade: quantidade,
    p_farmacia_local_id: farmaciaLocalId,
  });
  if (error) {
    console.error("[medicamentos] dispensar FEFO", error);
    go(farmaciaUrl({ erro: error.message }));
  }

  const alocacoes = data && typeof data === "object" && "alocacoes" in data && Array.isArray(data.alocacoes) ? data.alocacoes.length : 1;
  revalidatePath("/assistencial/medicamentos");
  revalidatePath("/assistencial/enfermagem");
  go(farmaciaUrl({ sucesso: "dispensacao-fefo", lotes: String(alocacoes) }));
}

export async function dispensarComponentePrescricaoAction(fd: FormData) {
  const { supabase } = await getAssistencialContext();
  const componenteId = String(fd.get("prescricao_componente_id") ?? "").trim();
  const quantidade = numberValue(fd, "quantidade");
  const farmaciaLocalId = text(fd, "farmacia_local_id");
  if (!componenteId || !quantidade || quantidade <= 0) go(farmaciaUrl({ erro: "dispensacao_componente" }));

  const { data, error } = await supabase.rpc("dispensar_componente_prescricao_fefo", {
    p_prescricao_componente_id: componenteId,
    p_quantidade: quantidade,
    p_farmacia_local_id: farmaciaLocalId,
  });
  if (error) {
    console.error("[medicamentos] dispensar componente FEFO", error);
    go(farmaciaUrl({ erro: error.message }));
  }

  const alocacoes = data && typeof data === "object" && "alocacoes" in data && Array.isArray(data.alocacoes) ? data.alocacoes.length : 1;
  revalidatePath("/assistencial/medicamentos");
  revalidatePath("/assistencial/enfermagem");
  go(farmaciaUrl({ sucesso: "dispensacao-componente-fefo", lotes: String(alocacoes) }));
}

export async function devolverMedicamentoAction(fd: FormData) {
  const { supabase } = await getAssistencialContext();
  const dispensacaoId = String(fd.get("dispensacao_id") ?? "").trim();
  const quantidade = numberValue(fd, "quantidade");
  const motivo = String(fd.get("motivo") ?? "").trim();
  if (!dispensacaoId || !quantidade || quantidade <= 0 || !motivo) go(farmaciaUrl({ erro: "devolucao" }));

  const { error } = await supabase.rpc("devolver_medicamento_dispensacao", {
    p_dispensacao_id: dispensacaoId,
    p_quantidade: quantidade,
    p_motivo: motivo,
  });
  if (error) {
    console.error("[medicamentos] devolver", error);
    go(farmaciaUrl({ erro: error.message }));
  }

  revalidatePath("/assistencial/medicamentos");
  revalidatePath("/assistencial/enfermagem");
  go(farmaciaUrl({ sucesso: "devolucao" }));
}

export async function registrarConciliacaoMedicamentosaAction(fd: FormData) {
  const { supabase } = await getAssistencialContext();
  const atendimentoId = String(fd.get("atendimento_id") ?? "").trim();
  const medicamento = String(fd.get("medicamento") ?? "").trim();
  if (!atendimentoId || !medicamento) go(farmaciaUrl({ erro: "conciliacao" }));

  const { error } = await supabase.rpc("registrar_conciliacao_medicamentosa", {
    p_atendimento_id: atendimentoId,
    p_momento: text(fd, "momento") ?? "admissao",
    p_medicamento: medicamento,
    p_dose_domiciliar: text(fd, "dose_domiciliar"),
    p_via_domiciliar: text(fd, "via_domiciliar"),
    p_frequencia_domiciliar: text(fd, "frequencia_domiciliar"),
    p_fonte_informacao: text(fd, "fonte_informacao"),
    p_decisao: text(fd, "decisao") ?? "manter",
    p_prescricao_id: text(fd, "prescricao_id"),
    p_divergencia: text(fd, "divergencia"),
    p_intencional: fd.get("intencional") === "on",
    p_justificativa: text(fd, "justificativa"),
    p_observacoes: text(fd, "observacoes"),
  });
  if (error) {
    console.error("[medicamentos] conciliar", error);
    go(farmaciaUrl({ erro: error.message }));
  }

  revalidatePath("/assistencial/medicamentos");
  revalidatePath("/internacao/altas");
  go(farmaciaUrl({ sucesso: "conciliacao" }));
}

export async function administrarBeiraLeitoAction(fd: FormData) {
  const { supabase } = await getAssistencialContext();
  const aprazamentoId = String(fd.get("aprazamento_id") ?? "").trim();
  const status = String(fd.get("status") ?? "administrado").trim();
  if (!aprazamentoId) go(farmaciaUrl({ erro: "aprazamento" }));

  const { error } = await supabase.rpc("registrar_administracao_beira_leito", {
    p_aprazamento_id: aprazamentoId,
    p_dispensacao_id: text(fd, "dispensacao_id"),
    p_codigo_paciente: String(fd.get("codigo_paciente") ?? "").trim(),
    p_codigo_medicamento: String(fd.get("codigo_medicamento") ?? "").trim(),
    p_status: status,
    p_justificativa: text(fd, "justificativa"),
    p_dose: text(fd, "dose"),
    p_via: text(fd, "via"),
    p_dupla_checagem: fd.get("dupla_checagem") === "on",
    p_segundo_profissional_id: text(fd, "segundo_profissional_id"),
  });
  if (error) {
    console.error("[medicamentos] beira-leito", error);
    go(farmaciaUrl({ erro: error.message }));
  }

  revalidatePath("/assistencial/medicamentos");
  revalidatePath("/assistencial/enfermagem");
  go(farmaciaUrl({ sucesso: status }));
}
