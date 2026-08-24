"use server";

import { redirect } from "next/navigation";
import { getAssistencialContext } from "@/modules/assistencial/context";

const base = "/assistencial/laboratorio";
const txt = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const go = (query: string): never => redirect(`${base}?${query}` as never);

async function profissionalLogado(supabase: any, userId: string, empresaId: string) {
  const { data } = await supabase.from("profissionais").select("id").eq("usuario_id", userId).eq("empresa_id", empresaId).eq("ativo", true).limit(1).maybeSingle();
  return data?.id ?? null;
}

export async function prepararAmostraLaboratorio(formData: FormData) {
  const { supabase, user, empresaId, unidadeId } = await getAssistencialContext();
  const solicitacaoId = txt(formData, "solicitacao_id");
  if (!solicitacaoId) go("erro=solicitacao");
  const { data: sol } = await supabase.from("solicitacoes_exames").select("id,atendimento_id,empresa_id,unidade_id,prioridade").eq("id", solicitacaoId).eq("empresa_id", empresaId).eq("unidade_id", unidadeId).maybeSingle();
  if (!sol) go("erro=solicitacao");
  const { data: at } = await supabase.from("atendimentos").select("paciente_id").eq("id", sol.atendimento_id).maybeSingle();
  if (!at?.paciente_id) go("erro=atendimento");
  const stamp = Date.now().toString(36).toUpperCase();
  const codigo = txt(formData, "codigo_amostra") || `LAB-${stamp}`;
  const accession = txt(formData, "accession_number") || `ACC-${stamp}`;
  const { error } = await supabase.from("laboratorio_amostras").insert({
    empresa_id: empresaId, unidade_id: unidadeId, solicitacao_id: sol.id, atendimento_id: sol.atendimento_id, paciente_id: at.paciente_id,
    codigo_amostra: codigo, accession_number: accession, etiqueta_codigo: codigo,
    material: txt(formData, "material") || null, recipiente: txt(formData, "recipiente") || null,
    prioridade: txt(formData, "prioridade") || sol.prioridade || "rotina",
    coleta_prevista_em: txt(formData, "coleta_prevista_em") || null,
    status: "aguardando_coleta", created_by: user.id, updated_by: user.id,
  });
  if (error) go(`erro=${encodeURIComponent(error.message)}`);
  go("sucesso=amostra");
}

export async function atualizarStatusAmostraLaboratorio(formData: FormData) {
  const { supabase, user, empresaId, unidadeId } = await getAssistencialContext();
  const id = txt(formData, "amostra_id");
  const acao = txt(formData, "acao");
  const profissionalId = await profissionalLogado(supabase, user.id, empresaId);
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString(), updated_by: user.id };
  if (acao === "coletar") Object.assign(patch, { status: "coletada", coletada_em: new Date().toISOString(), coletada_por: profissionalId });
  else if (acao === "receber") Object.assign(patch, { status: "recebida", recebida_em: new Date().toISOString(), recebida_por: profissionalId, temperatura_recebimento: txt(formData, "temperatura_recebimento") || null });
  else if (acao === "rejeitar") Object.assign(patch, { status: "rejeitada", rejeitada_em: new Date().toISOString(), rejeitada_por: profissionalId, rejeitada_motivo: txt(formData, "motivo") || "Amostra rejeitada" });
  else go("erro=acao");
  const { error } = await supabase.from("laboratorio_amostras").update(patch).eq("id", id).eq("empresa_id", empresaId).eq("unidade_id", unidadeId);
  if (error) go(`erro=${encodeURIComponent(error.message)}`);
  go("sucesso=amostra-status");
}

export async function registrarResultadoLaboratorio(formData: FormData) {
  const { supabase, user, empresaId, unidadeId } = await getAssistencialContext();
  const amostraId = txt(formData, "amostra_id");
  const analitoId = txt(formData, "catalogo_analito_id");
  const resultadoTexto = txt(formData, "resultado");
  const valorRaw = txt(formData, "valor_numerico").replace(",", ".");
  const valor = valorRaw ? Number(valorRaw) : null;
  const { data: amostra } = await supabase.from("laboratorio_amostras").select("id,solicitacao_id,atendimento_id").eq("id", amostraId).eq("empresa_id", empresaId).eq("unidade_id", unidadeId).maybeSingle();
  const { data: analito } = await supabase.from("laboratorio_catalogo_analitos").select("id,analito,unidade_medida,referencia_min,referencia_max,referencia_texto,critico_min,critico_max,metodo").eq("id", analitoId).eq("empresa_id", empresaId).maybeSingle();
  if (!amostra || !analito) go("erro=dados-resultado");
  let flag: string | null = null; let criticidade: string | null = null; let critico = false;
  if (valor !== null && Number.isFinite(valor)) {
    if (analito.critico_min !== null && valor <= Number(analito.critico_min)) { flag = "LL"; criticidade = "critico_baixo"; critico = true; }
    else if (analito.critico_max !== null && valor >= Number(analito.critico_max)) { flag = "HH"; criticidade = "critico_alto"; critico = true; }
    else if (analito.referencia_min !== null && valor < Number(analito.referencia_min)) flag = "L";
    else if (analito.referencia_max !== null && valor > Number(analito.referencia_max)) flag = "H";
  }
  const { error } = await supabase.from("laboratorio_resultados").insert({
    empresa_id: empresaId, unidade_id: unidadeId, solicitacao_id: amostra.solicitacao_id, amostra_id: amostra.id, atendimento_id: amostra.atendimento_id,
    catalogo_analito_id: analito.id, analito: analito.analito, resultado: resultadoTexto || (valor !== null ? String(valor) : null), valor_numerico: Number.isFinite(valor as number) ? valor : null,
    unidade_medida: analito.unidade_medida, referencia_min: analito.referencia_min, referencia_max: analito.referencia_max, referencia_texto: analito.referencia_texto,
    flag, criticidade, valor_critico: critico, metodo: analito.metodo, created_by: user.id, updated_by: user.id,
  });
  if (error) go(`erro=${encodeURIComponent(error.message)}`);
  go("sucesso=resultado");
}

export async function liberarResultadoLaboratorio(formData: FormData) {
  const { supabase } = await getAssistencialContext();
  const { error } = await supabase.rpc("liberar_resultado_laboratorio", { p_resultado_id: txt(formData, "resultado_id") });
  if (error) go(`erro=${encodeURIComponent(error.message)}`);
  go("sucesso=liberado");
}

export async function notificarResultadoCriticoLaboratorio(formData: FormData) {
  const { supabase } = await getAssistencialContext();
  const { error } = await supabase.rpc("registrar_notificacao_resultado_critico", {
    p_resultado_id: txt(formData, "resultado_id"), p_notificado_a: txt(formData, "notificado_a"), p_meio: txt(formData, "meio") || null,
    p_readback: formData.get("readback") === "on", p_observacoes: txt(formData, "observacoes") || null,
  });
  if (error) go(`erro=${encodeURIComponent(error.message)}`);
  go("sucesso=notificado");
}
