"use server";

import { redirect } from "next/navigation";
import { getAssistencialContext } from "@/modules/assistencial/context";

const base = "/assistencial/laboratorio";
const txt = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const go = (query: string): never => redirect(`${base}?${query}` as never);
const numero = (value: string) => {
  if (!value) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
};

export async function prepararAmostraLaboratorio(formData: FormData) {
  const { supabase } = await getAssistencialContext();
  const solicitacaoId = txt(formData, "solicitacao_id");
  if (!solicitacaoId) return go("erro=solicitacao");

  const { error } = await supabase.rpc("preparar_amostra_laboratorio_operacional", {
    p_solicitacao_id: solicitacaoId,
    p_material: txt(formData, "material") || null,
    p_recipiente: txt(formData, "recipiente") || null,
    p_prioridade: txt(formData, "prioridade") || null,
    p_coleta_prevista_em: txt(formData, "coleta_prevista_em") || null,
  });
  if (error) return go(`erro=${encodeURIComponent(error.message)}`);
  return go("sucesso=amostra");
}

export async function atualizarStatusAmostraLaboratorio(formData: FormData) {
  const { supabase } = await getAssistencialContext();
  const id = txt(formData, "amostra_id");
  const acao = txt(formData, "acao");
  if (!id || !acao) return go("erro=acao");

  const { error } = await supabase.rpc("atualizar_status_amostra_laboratorio_operacional", {
    p_amostra_id: id,
    p_acao: acao,
    p_temperatura_recebimento: numero(txt(formData, "temperatura_recebimento")),
    p_motivo: txt(formData, "motivo") || null,
  });
  if (error) return go(`erro=${encodeURIComponent(error.message)}`);
  return go("sucesso=amostra-status");
}

export async function registrarResultadoLaboratorio(formData: FormData) {
  const { supabase } = await getAssistencialContext();
  const amostraId = txt(formData, "amostra_id");
  const analitoId = txt(formData, "catalogo_analito_id");
  if (!amostraId || !analitoId) return go("erro=dados-resultado");

  const { error } = await supabase.rpc("registrar_resultado_laboratorio_operacional", {
    p_amostra_id: amostraId,
    p_catalogo_analito_id: analitoId,
    p_laboratorio_equipamento_id: txt(formData, "laboratorio_equipamento_id") || null,
    p_resultado: txt(formData, "resultado") || null,
    p_valor_numerico: numero(txt(formData, "valor_numerico")),
  });
  if (error) return go(`erro=${encodeURIComponent(error.message)}`);
  return go("sucesso=resultado");
}

export async function liberarResultadoLaboratorio(formData: FormData) {
  const { supabase } = await getAssistencialContext();
  const { error } = await supabase.rpc("liberar_resultado_laboratorio", { p_resultado_id: txt(formData, "resultado_id") });
  if (error) return go(`erro=${encodeURIComponent(error.message)}`);
  return go("sucesso=liberado");
}

export async function notificarResultadoCriticoLaboratorio(formData: FormData) {
  const { supabase } = await getAssistencialContext();
  const { error } = await supabase.rpc("registrar_notificacao_resultado_critico", {
    p_resultado_id: txt(formData, "resultado_id"),
    p_notificado_a: txt(formData, "notificado_a"),
    p_meio: txt(formData, "meio") || null,
    p_readback: formData.get("readback") === "on",
    p_observacoes: txt(formData, "observacoes") || null,
  });
  if (error) return go(`erro=${encodeURIComponent(error.message)}`);
  return go("sucesso=notificado");
}
