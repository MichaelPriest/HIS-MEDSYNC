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
  const raw = text(fd,key); if (!raw) return null; const n=Number(raw.replace(",",".")); return Number.isFinite(n)?n:null;
}
function go(url:string):never { redirect(url as Route); }

export async function gerarAprazamentosAction(fd: FormData) {
  const { supabase } = await getAssistencialContext();
  const prescricaoId = String(fd.get("prescricao_id") ?? "").trim();
  const horizonte = Math.max(1,Math.min(7,Number(fd.get("horizonte_dias") ?? 2) || 2));
  if (!prescricaoId) go("/assistencial/medicamentos?erro=prescricao");
  const { data, error } = await supabase.rpc("gerar_aprazamentos_prescricao", { p_prescricao_id:prescricaoId, p_horizonte_dias:horizonte });
  if (error) { console.error("[medicamentos] aprazar",error); go(`/assistencial/medicamentos?erro=${encodeURIComponent(error.message)}`); }
  revalidatePath("/assistencial/medicamentos");
  revalidatePath("/assistencial/enfermagem");
  go(`/assistencial/medicamentos?sucesso=aprazamento&gerados=${Number(data ?? 0)}`);
}

export async function validarPrescricaoFarmaceuticaAction(fd: FormData) {
  const { supabase } = await getAssistencialContext();
  const prescricaoId=String(fd.get("prescricao_id") ?? "").trim();
  if (!prescricaoId) go("/assistencial/medicamentos?erro=prescricao");
  const { error } = await supabase.rpc("validar_prescricao_farmaceutica", {
    p_prescricao_id:prescricaoId, p_status:text(fd,"status") ?? "validada", p_alergias:fd.get("alergias")==="on",
    p_interacoes:fd.get("interacoes")==="on", p_dose:fd.get("dose")==="on", p_via:fd.get("via")==="on",
    p_funcao_renal:fd.get("funcao_renal")==="on", p_duplicidade:fd.get("duplicidade")==="on",
    p_incompatibilidades:text(fd,"incompatibilidades"), p_intervencao:text(fd,"intervencao"),
  });
  if (error) { console.error("[medicamentos] validar",error); go(`/assistencial/medicamentos?erro=${encodeURIComponent(error.message)}`); }
  revalidatePath("/assistencial/medicamentos"); go("/assistencial/medicamentos?sucesso=validacao");
}

export async function dispensarPrescricaoAction(fd: FormData) {
  const { supabase } = await getAssistencialContext();
  const prescricaoId=String(fd.get("prescricao_id") ?? "").trim();
  const loteId=String(fd.get("estoque_lote_id") ?? "").trim();
  const quantidade=numberValue(fd,"quantidade");
  if (!prescricaoId || !loteId || !quantidade || quantidade<=0) go("/assistencial/medicamentos?erro=dispensacao");
  const { error } = await supabase.rpc("dispensar_medicamento_prescricao", { p_prescricao_id:prescricaoId, p_estoque_lote_id:loteId, p_quantidade:quantidade });
  if (error) { console.error("[medicamentos] dispensar",error); go(`/assistencial/medicamentos?erro=${encodeURIComponent(error.message)}`); }
  revalidatePath("/assistencial/medicamentos");
  revalidatePath("/assistencial/enfermagem");
  go("/assistencial/medicamentos?sucesso=dispensacao");
}

export async function dispensarComponentePrescricaoAction(fd: FormData) {
  const { supabase } = await getAssistencialContext();
  const componenteId=String(fd.get("prescricao_componente_id") ?? "").trim();
  const loteId=String(fd.get("estoque_lote_id") ?? "").trim();
  const quantidade=numberValue(fd,"quantidade");
  if (!componenteId || !loteId || !quantidade || quantidade<=0) go("/assistencial/medicamentos?erro=dispensacao_componente");
  const { error } = await supabase.rpc("dispensar_componente_prescricao", { p_prescricao_componente_id:componenteId, p_estoque_lote_id:loteId, p_quantidade:quantidade });
  if (error) { console.error("[medicamentos] dispensar componente",error); go(`/assistencial/medicamentos?erro=${encodeURIComponent(error.message)}`); }
  revalidatePath("/assistencial/medicamentos");
  revalidatePath("/assistencial/enfermagem");
  go("/assistencial/medicamentos?sucesso=dispensacao_componente");
}

export async function devolverMedicamentoAction(fd: FormData) {
  const { supabase } = await getAssistencialContext();
  const dispensacaoId=String(fd.get("dispensacao_id") ?? "").trim();
  const quantidade=numberValue(fd,"quantidade");
  const motivo=String(fd.get("motivo") ?? "").trim();
  if (!dispensacaoId || !quantidade || quantidade<=0 || !motivo) go("/assistencial/medicamentos?erro=devolucao");
  const { error } = await supabase.rpc("devolver_medicamento_dispensacao", { p_dispensacao_id:dispensacaoId, p_quantidade:quantidade, p_motivo:motivo });
  if (error) { console.error("[medicamentos] devolver",error); go(`/assistencial/medicamentos?erro=${encodeURIComponent(error.message)}`); }
  revalidatePath("/assistencial/medicamentos");
  revalidatePath("/assistencial/enfermagem");
  go("/assistencial/medicamentos?sucesso=devolucao");
}

export async function administrarBeiraLeitoAction(fd: FormData) {
  const { supabase } = await getAssistencialContext();
  const aprazamentoId=String(fd.get("aprazamento_id") ?? "").trim();
  const status=String(fd.get("status") ?? "administrado").trim();
  if (!aprazamentoId) go("/assistencial/medicamentos?erro=aprazamento");
  const { error } = await supabase.rpc("registrar_administracao_beira_leito", {
    p_aprazamento_id:aprazamentoId,
    p_dispensacao_id:text(fd,"dispensacao_id"),
    p_codigo_paciente:String(fd.get("codigo_paciente") ?? "").trim(),
    p_codigo_medicamento:String(fd.get("codigo_medicamento") ?? "").trim(),
    p_status:status,
    p_justificativa:text(fd,"justificativa"),
    p_dose:text(fd,"dose"),
    p_via:text(fd,"via"),
    p_dupla_checagem:fd.get("dupla_checagem")==="on",
    p_segundo_profissional_id:text(fd,"segundo_profissional_id"),
  });
  if (error) { console.error("[medicamentos] beira-leito",error); go(`/assistencial/medicamentos?erro=${encodeURIComponent(error.message)}`); }
  revalidatePath("/assistencial/medicamentos");
  revalidatePath("/assistencial/enfermagem");
  go(`/assistencial/medicamentos?sucesso=${status}`);
}
