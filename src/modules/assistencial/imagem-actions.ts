"use server";

import { redirect } from "next/navigation";
import { getAssistencialContext } from "@/modules/assistencial/context";

const base = "/assistencial/imagem";
const txt = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const go = (query: string): never => redirect(`${base}?${query}` as never);
const numero = (value: string) => {
  if (!value) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
};

async function profissionalLogado(supabase: Awaited<ReturnType<typeof getAssistencialContext>>["supabase"], userId: string, empresaId: string) {
  const { data } = await supabase.from("profissionais").select("id").eq("usuario_id", userId).eq("empresa_id", empresaId).eq("ativo", true).limit(1).maybeSingle();
  return data?.id ?? null;
}

export async function agendarImagem(formData: FormData) {
  const { supabase } = await getAssistencialContext();
  const solicitacaoId = txt(formData, "solicitacao_id");
  const agendadoEm = txt(formData, "agendado_em");
  if (!solicitacaoId || !agendadoEm) return go("erro=campos-agenda");

  const { error } = await supabase.rpc("agendar_exame_imagem_operacional", {
    p_solicitacao_id: solicitacaoId,
    p_agendado_em: agendadoEm,
    p_duracao_minutos: numero(txt(formData, "duracao_minutos")) ?? 30,
    p_protocolo_id: txt(formData, "protocolo_id") || null,
    p_sala: txt(formData, "sala") || null,
    p_engenharia_equipamento_id: txt(formData, "engenharia_equipamento_id") || null,
    p_observacoes: txt(formData, "observacoes") || null,
  });
  if (error) return go(`erro=${encodeURIComponent(error.message)}`);
  return go("sucesso=agendado");
}

export async function atualizarAgendaImagem(formData: FormData) {
  const { supabase } = await getAssistencialContext();
  const id = txt(formData, "agendamento_id");
  const status = txt(formData, "status");
  if (!id || !["confirmado", "chegou", "faltou", "cancelado"].includes(status)) return go("erro=agenda-status");

  const { error } = await supabase.rpc("atualizar_agendamento_imagem_operacional", {
    p_agendamento_id: id,
    p_status: status,
  });
  if (error) return go(`erro=${encodeURIComponent(error.message)}`);
  return go("sucesso=agenda-status");
}

export async function iniciarExecucaoImagem(formData: FormData) {
  const { supabase } = await getAssistencialContext();
  const solicitacaoId = txt(formData, "solicitacao_id");
  if (!solicitacaoId) return go("erro=solicitacao");

  const { error } = await supabase.rpc("iniciar_execucao_imagem_operacional", {
    p_solicitacao_id: solicitacaoId,
    p_agendamento_id: txt(formData, "agendamento_id") || null,
    p_protocolo_id: txt(formData, "protocolo_id") || null,
    p_sala: txt(formData, "sala") || null,
    p_engenharia_equipamento_id: txt(formData, "engenharia_equipamento_id") || null,
    p_accession_number: txt(formData, "accession_number") || null,
  });
  if (error) return go(`erro=${encodeURIComponent(error.message)}`);
  return go("sucesso=execucao-iniciada");
}

export async function concluirExecucaoImagem(formData: FormData) {
  const { supabase } = await getAssistencialContext();
  const id = txt(formData, "execucao_id");
  if (!id) return go("erro=execucao");

  const { error } = await supabase.rpc("concluir_execucao_imagem_operacional", {
    p_execucao_id: id,
    p_study_instance_uid: txt(formData, "study_instance_uid") || null,
    p_series_instance_uid: txt(formData, "series_instance_uid") || null,
    p_pacs_url: txt(formData, "pacs_url") || null,
    p_intercorrencias: txt(formData, "intercorrencias") || null,
  });
  if (error) return go(`erro=${encodeURIComponent(error.message)}`);
  return go("sucesso=execucao-concluida");
}

export async function registrarContrasteImagem(formData: FormData) {
  const { supabase, user, empresaId, unidadeId } = await getAssistencialContext();
  const execucaoId = txt(formData, "execucao_id");
  const { data: exec } = await supabase.from("imagem_execucoes").select("id,atendimento_id").eq("id", execucaoId).eq("empresa_id", empresaId).eq("unidade_id", unidadeId).maybeSingle();
  if (!exec) return go("erro=execucao");
  const contraste = txt(formData, "contraste");
  if (!contraste || formData.get("alergia_questionada") !== "on") return go("erro=seguranca-contraste");
  const profissionalId = await profissionalLogado(supabase, user.id, empresaId);
  const { error } = await supabase.from("imagem_contraste_registros").insert({
    empresa_id: empresaId,
    unidade_id: unidadeId,
    atendimento_id: exec.atendimento_id,
    execucao_id: exec.id,
    contraste,
    lote: txt(formData, "lote") || null,
    validade: txt(formData, "validade") || null,
    volume_ml: numero(txt(formData, "volume_ml")),
    via: txt(formData, "via") || null,
    alergia_questionada: true,
    alergia_negada: formData.get("alergia_negada") === "on",
    funcao_renal_verificada: formData.get("funcao_renal_verificada") === "on",
    creatinina: numero(txt(formData, "creatinina")),
    egfr: numero(txt(formData, "egfr")),
    consentimento_confirmado: formData.get("consentimento_confirmado") === "on",
    administrado_em: new Date().toISOString(),
    administrado_por: profissionalId,
    reacao_adversa: txt(formData, "reacao_adversa") || null,
    conduta_reacao: txt(formData, "conduta_reacao") || null,
    created_by: user.id,
  });
  if (error) return go(`erro=${encodeURIComponent(error.message)}`);
  return go("sucesso=contraste");
}

export async function registrarDoseImagem(formData: FormData) {
  const { supabase, user, empresaId, unidadeId } = await getAssistencialContext();
  const execucaoId = txt(formData, "execucao_id");
  const { data: exec } = await supabase.from("imagem_execucoes").select("id,atendimento_id").eq("id", execucaoId).eq("empresa_id", empresaId).eq("unidade_id", unidadeId).maybeSingle();
  if (!exec) return go("erro=execucao");
  const { error } = await supabase.from("imagem_dose_radiacao").insert({
    empresa_id: empresaId,
    unidade_id: unidadeId,
    atendimento_id: exec.atendimento_id,
    execucao_id: exec.id,
    modalidade: txt(formData, "modalidade") || null,
    ctdivol: numero(txt(formData, "ctdivol")),
    dlp: numero(txt(formData, "dlp")),
    dap: numero(txt(formData, "dap")),
    dose_mgy: numero(txt(formData, "dose_mgy")),
    tempo_fluoroscopia_segundos: numero(txt(formData, "tempo_fluoroscopia_segundos")),
    observacoes: txt(formData, "observacoes") || null,
    created_by: user.id,
  });
  if (error) return go(`erro=${encodeURIComponent(error.message)}`);
  return go("sucesso=dose");
}

export async function salvarLaudoImagem(formData: FormData) {
  const { supabase } = await getAssistencialContext();
  const execucaoId = txt(formData, "execucao_id");
  if (!execucaoId) return go("erro=execucao");
  const { data: laudoId, error } = await supabase.rpc("salvar_laudo_imagem", {
    p_execucao_id: execucaoId,
    p_tecnica: txt(formData, "tecnica") || null,
    p_achados: txt(formData, "achados") || null,
    p_conclusao: txt(formData, "conclusao") || null,
    p_recomendacoes: txt(formData, "recomendacoes") || null,
  });
  if (error || !laudoId) return go(`erro=${encodeURIComponent(error?.message ?? "Não foi possível salvar o laudo")}`);
  redirect(`${base}/laudos/${String(laudoId)}?sucesso=rascunho` as never);
}

export async function registrarCriticidadeLaudoImagem(formData: FormData) {
  const { supabase } = await getAssistencialContext();
  const laudoId = txt(formData, "laudo_id");
  if (!laudoId) return go("erro=laudo");

  const { error } = await supabase.rpc("registrar_criticidade_laudo_imagem", {
    p_laudo_id: laudoId,
    p_achado_critico: formData.get("achado_critico") === "on",
    p_comunicada_a: txt(formData, "comunicada_a") || null,
    p_meio: txt(formData, "meio") || null,
    p_readback: formData.get("readback") === "on",
    p_observacao: txt(formData, "observacao") || null,
  });
  if (error) redirect(`${base}/laudos/${laudoId}?erro=${encodeURIComponent(error.message)}` as never);
  redirect(`${base}/laudos/${laudoId}?sucesso=criticidade` as never);
}

export async function liberarLaudoImagem(formData: FormData) {
  const { supabase } = await getAssistencialContext();
  const laudoId = txt(formData, "laudo_id");
  const retorno = txt(formData, "retorno");
  const { error } = await supabase.rpc("liberar_laudo_imagem", { p_laudo_id: laudoId });
  if (error) {
    if (retorno === "editor") redirect(`${base}/laudos/${laudoId}?erro=${encodeURIComponent(error.message)}` as never);
    return go(`erro=${encodeURIComponent(error.message)}`);
  }
  if (retorno === "editor") redirect(`${base}/laudos/${laudoId}?sucesso=liberado` as never);
  return go("sucesso=laudo-liberado");
}

export async function abrirRetificacaoLaudoImagem(formData: FormData) {
  const { supabase } = await getAssistencialContext();
  const laudoId = txt(formData, "laudo_id");
  const motivo = txt(formData, "motivo");
  const { error } = await supabase.rpc("abrir_retificacao_laudo_imagem", { p_laudo_id: laudoId, p_motivo: motivo });
  if (error) redirect(`${base}/laudos/${laudoId}?erro=${encodeURIComponent(error.message)}` as never);
  redirect(`${base}/laudos/${laudoId}?sucesso=retificacao` as never);
}
