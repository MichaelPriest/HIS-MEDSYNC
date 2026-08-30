"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { asRoute } from "@/lib/route-cast";
import { requirePermission } from "@/lib/permissions/server";

const BASE = "/assistencial/urgencia";

function text(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function integer(formData: FormData, key: string) {
  const raw = text(formData, key);
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? Math.trunc(value) : null;
}

function lines(formData: FormData, key: string) {
  return String(formData.get(key) ?? "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function go(query: string): never {
  redirect(asRoute(`${BASE}?${query}`));
}

function transitionError(message?: string | null) {
  const value = String(message ?? "");
  if (value.includes("REGISTRO_ATIVO")) return "registro-ativo";
  if (value.includes("ATENDIMENTO_INDISPONIVEL")) return "atendimento-indisponivel";
  if (value.includes("CLASSIFICACAO_INVALIDA")) return "classificacao";
  if (value.includes("DESTINO_INVALIDO")) return "destino";
  if (value.includes("SEM_PERMISSAO") || value.includes("NAO_AUTENTICADO")) return "permissao";
  return "operacao";
}

export async function abrirRegistroEmergencia(formData: FormData) {
  const { supabase, unidadeId } = await requirePermission("emergencia.gerenciar");
  const atendimentoId = text(formData, "atendimento_id");
  if (!atendimentoId || !unidadeId) return go("erro=atendimento");

  const { data: registroId, error } = await supabase.rpc("abrir_registro_emergencia_operacional", {
    p_atendimento_id: atendimentoId,
    p_origem: text(formData, "origem"),
    p_mecanismo: text(formData, "mecanismo"),
    p_classificacao_risco: text(formData, "classificacao_risco"),
    p_protocolo: text(formData, "protocolo"),
    p_sala: text(formData, "sala"),
    p_estado_geral: text(formData, "estado_geral"),
    p_via_aerea: text(formData, "via_aerea"),
    p_respiracao: text(formData, "respiracao"),
    p_circulacao: text(formData, "circulacao"),
    p_neurologico: text(formData, "neurologico"),
    p_exposicao: text(formData, "exposicao"),
    p_procedimentos_imediatos: lines(formData, "procedimentos_imediatos"),
    p_reavaliacao_em: text(formData, "reavaliacao_em"),
    p_destino: text(formData, "destino"),
    p_observacoes: text(formData, "observacoes"),
  });

  if (error || !registroId) {
    console.error("[urgencia] abrir registro", { code: error?.code ?? "unknown", operation: "abrir_registro_emergencia_operacional" });
    return go(`erro=${transitionError(error?.message)}`);
  }

  revalidatePath(BASE);
  revalidatePath(`/prontuario/${atendimentoId}`);
  return go(`registro=${registroId}&sucesso=registro-aberto`);
}

export async function registrarReavaliacaoEmergencia(formData: FormData) {
  const { supabase, empresaId, unidadeId } = await requirePermission("emergencia.reavaliar");
  const emergenciaId = text(formData, "emergencia_id");
  if (!emergenciaId || !unidadeId) return go("erro=registro");

  const { data: emergencia } = await supabase
    .from("emergencia_registros")
    .select("id,atendimento_id,status")
    .eq("id", emergenciaId)
    .eq("empresa_id", empresaId)
    .eq("unidade_id", unidadeId)
    .maybeSingle();

  if (!emergencia || emergencia.status === "encerrado") return go("erro=registro");

  const dor = integer(formData, "dor");
  if (dor !== null && (dor < 0 || dor > 10)) return go(`registro=${emergenciaId}&erro=dor`);

  const sinaisVitais = {
    pa: text(formData, "pa"),
    fc: integer(formData, "fc"),
    fr: integer(formData, "fr"),
    spo2: integer(formData, "spo2"),
    temperatura: text(formData, "temperatura"),
    glicemia: integer(formData, "glicemia"),
  };
  const abcde = {
    a: text(formData, "via_aerea"),
    b: text(formData, "respiracao"),
    c: text(formData, "circulacao"),
    d: text(formData, "neurologico"),
    e: text(formData, "exposicao"),
  };

  const { error } = await supabase.rpc("registrar_reavaliacao_emergencia", {
    p_emergencia_id: emergencia.id,
    p_queixa: text(formData, "queixa"),
    p_classificacao_risco: text(formData, "classificacao_risco"),
    p_abcde: abcde,
    p_sinais_vitais: sinaisVitais,
    p_dor: dor,
    p_conduta: text(formData, "conduta"),
    p_destino: text(formData, "destino"),
    p_observacoes: text(formData, "observacoes"),
    p_proxima_reavaliacao_em: text(formData, "proxima_reavaliacao_em"),
  });

  if (error) {
    console.error("[urgencia] reavaliar", { code: error.code });
    return go(`registro=${emergenciaId}&erro=reavaliar`);
  }

  revalidatePath(BASE);
  revalidatePath(`/prontuario/${emergencia.atendimento_id}`);
  return go(`registro=${emergenciaId}&sucesso=reavaliado`);
}

export async function encerrarRegistroEmergencia(formData: FormData) {
  const { supabase, empresaId, unidadeId } = await requirePermission("emergencia.gerenciar");
  const emergenciaId = text(formData, "emergencia_id");
  if (!emergenciaId || !unidadeId) return go("erro=registro");

  const { data: emergencia } = await supabase
    .from("emergencia_registros")
    .select("id,atendimento_id")
    .eq("id", emergenciaId)
    .eq("empresa_id", empresaId)
    .eq("unidade_id", unidadeId)
    .maybeSingle();
  if (!emergencia) return go("erro=registro");

  const destino = text(formData, "destino") ?? "alta";
  const { error } = await supabase.rpc("encerrar_registro_emergencia_operacional", {
    p_emergencia_id: emergencia.id,
    p_destino: destino,
    p_observacoes: text(formData, "observacoes"),
  });

  if (error) {
    console.error("[urgencia] encerrar", { code: error.code, operation: "encerrar_registro_emergencia_operacional" });
    return go(`registro=${emergenciaId}&erro=${transitionError(error.message)}`);
  }

  revalidatePath(BASE);
  revalidatePath(`/prontuario/${emergencia.atendimento_id}`);

  if (destino === "internacao") {
    redirect(asRoute(`/internacao/nova/${emergencia.atendimento_id}`));
  }

  return go("sucesso=encerrado");
}
