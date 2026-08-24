"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { asRoute } from "@/lib/route-cast";
import { requireAnyPermission, requirePermission } from "@/lib/permissions/server";

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

async function getEpisode(
  supabase: Awaited<ReturnType<typeof requireAnyPermission>>["supabase"],
  empresaId: string,
  unidadeId: string | null,
  atendimentoId: string,
) {
  if (!unidadeId) return null;

  const { data } = await supabase
    .from("atendimentos")
    .select("id,paciente_id,empresa_id,unidade_id")
    .eq("id", atendimentoId)
    .eq("empresa_id", empresaId)
    .eq("unidade_id", unidadeId)
    .maybeSingle();

  return data;
}

async function getProfessionalId(
  supabase: Awaited<ReturnType<typeof requireAnyPermission>>["supabase"],
  empresaId: string,
  userId: string,
) {
  const { data } = await supabase
    .from("profissionais")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("usuario_id", userId)
    .eq("ativo", true)
    .limit(1)
    .maybeSingle();

  return data?.id ?? null;
}

export async function abrirRegistroEmergencia(formData: FormData) {
  const { supabase, user, empresaId, unidadeId } = await requirePermission("emergencia.gerenciar");
  const atendimentoId = text(formData, "atendimento_id");
  if (!atendimentoId || !unidadeId) return go("erro=atendimento");

  const atendimento = await getEpisode(supabase, empresaId, unidadeId, atendimentoId);
  if (!atendimento) return go("erro=atendimento");

  const { data: existente } = await supabase
    .from("emergencia_registros")
    .select("id,status")
    .eq("atendimento_id", atendimento.id)
    .eq("empresa_id", empresaId)
    .eq("unidade_id", unidadeId)
    .neq("status", "encerrado")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existente) return go(`registro=${existente.id}&erro=registro-ativo`);

  const professionalId = await getProfessionalId(supabase, empresaId, user.id);
  const reavaliacaoEm = text(formData, "reavaliacao_em");
  const { data: registro, error } = await supabase
    .from("emergencia_registros")
    .insert({
      empresa_id: empresaId,
      unidade_id: unidadeId,
      atendimento_id: atendimento.id,
      paciente_id: atendimento.paciente_id,
      profissional_id: professionalId,
      origem: text(formData, "origem"),
      mecanismo: text(formData, "mecanismo"),
      classificacao_risco: text(formData, "classificacao_risco"),
      protocolo: text(formData, "protocolo"),
      sala: text(formData, "sala"),
      estado_geral: text(formData, "estado_geral"),
      via_aerea: text(formData, "via_aerea"),
      respiracao: text(formData, "respiracao"),
      circulacao: text(formData, "circulacao"),
      neurologico: text(formData, "neurologico"),
      exposicao: text(formData, "exposicao"),
      procedimentos_imediatos: lines(formData, "procedimentos_imediatos"),
      reavaliacao_em: reavaliacaoEm || null,
      destino: text(formData, "destino"),
      observacoes: text(formData, "observacoes"),
      status: "em_atendimento",
      created_by: user.id,
      updated_by: user.id,
    })
    .select("id")
    .single();

  if (error || !registro) {
    console.error("[urgencia] abrir registro", { code: error?.code ?? "unknown" });
    return go("erro=salvar");
  }

  revalidatePath(BASE);
  revalidatePath(`/prontuario/${atendimento.id}`);
  return go(`registro=${registro.id}&sucesso=registro-aberto`);
}

export async function registrarReavaliacaoEmergencia(formData: FormData) {
  const { supabase, user, empresaId, unidadeId } = await requirePermission("emergencia.reavaliar");
  const emergenciaId = text(formData, "emergencia_id");
  if (!emergenciaId || !unidadeId) return go("erro=registro");

  const { data: emergencia } = await supabase
    .from("emergencia_registros")
    .select("id,atendimento_id,paciente_id,status")
    .eq("id", emergenciaId)
    .eq("empresa_id", empresaId)
    .eq("unidade_id", unidadeId)
    .maybeSingle();

  if (!emergencia || emergencia.status === "encerrado") return go("erro=registro");

  const professionalId = await getProfessionalId(supabase, empresaId, user.id);
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

  const destino = text(formData, "destino");
  const { error } = await supabase.from("emergencia_reavaliacoes").insert({
    empresa_id: empresaId,
    unidade_id: unidadeId,
    emergencia_id: emergencia.id,
    atendimento_id: emergencia.atendimento_id,
    profissional_id: professionalId,
    reavaliado_em: new Date().toISOString(),
    queixa: text(formData, "queixa"),
    classificacao_risco: text(formData, "classificacao_risco"),
    abcde,
    sinais_vitais: sinaisVitais,
    dor,
    conduta: text(formData, "conduta"),
    destino,
    observacoes: text(formData, "observacoes"),
    created_by: user.id,
  });

  if (error) {
    console.error("[urgencia] reavaliar", { code: error.code });
    return go(`registro=${emergenciaId}&erro=reavaliar`);
  }

  const proximaReavaliacao = text(formData, "proxima_reavaliacao_em");
  const { error: updateError } = await supabase
    .from("emergencia_registros")
    .update({
      classificacao_risco: text(formData, "classificacao_risco"),
      reavaliacao_em: proximaReavaliacao || null,
      destino,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    })
    .eq("id", emergencia.id)
    .eq("empresa_id", empresaId)
    .eq("unidade_id", unidadeId);

  if (updateError) {
    console.error("[urgencia] atualizar reavaliacao", { code: updateError.code });
    return go(`registro=${emergenciaId}&erro=atualizar`);
  }

  revalidatePath(BASE);
  revalidatePath(`/prontuario/${emergencia.atendimento_id}`);
  return go(`registro=${emergenciaId}&sucesso=reavaliado`);
}

export async function encerrarRegistroEmergencia(formData: FormData) {
  const { supabase, user, empresaId, unidadeId } = await requirePermission("emergencia.gerenciar");
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
  const { error } = await supabase
    .from("emergencia_registros")
    .update({
      destino,
      status: "encerrado",
      observacoes: text(formData, "observacoes"),
      reavaliacao_em: null,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    })
    .eq("id", emergencia.id)
    .eq("empresa_id", empresaId)
    .eq("unidade_id", unidadeId);

  if (error) {
    console.error("[urgencia] encerrar", { code: error.code });
    return go(`registro=${emergenciaId}&erro=encerrar`);
  }

  revalidatePath(BASE);
  revalidatePath(`/prontuario/${emergencia.atendimento_id}`);

  if (destino === "internacao") {
    redirect(asRoute(`/internacao/nova/${emergencia.atendimento_id}`));
  }

  return go("sucesso=encerrado");
}
