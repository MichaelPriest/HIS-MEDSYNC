"use server";

import { redirect } from "next/navigation";
import { getAssistencialContext } from "@/modules/assistencial/context";

const base = "/assistencial/imagem";
const txt = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const go = (query: string): never => redirect(`${base}?${query}` as never);

async function profissionalLogado(supabase: Awaited<ReturnType<typeof getAssistencialContext>>["supabase"], userId: string, empresaId: string) {
  const { data } = await supabase.from("profissionais").select("id").eq("usuario_id", userId).eq("empresa_id", empresaId).eq("ativo", true).limit(1).maybeSingle();
  return data?.id ?? null;
}

async function equipamentoOperacional(supabase: Awaited<ReturnType<typeof getAssistencialContext>>["supabase"], empresaId: string, unidadeId: string, equipamentoId: string | null) {
  if (!equipamentoId) return null;
  const { data } = await supabase.from("engenharia_equipamentos").select("id,patrimonio,nome,status").eq("id", equipamentoId).eq("empresa_id", empresaId).eq("unidade_id", unidadeId).maybeSingle();
  if (!data) throw new Error("Equipamento não encontrado na unidade");
  if (!["operacional", "reserva"].includes(data.status)) throw new Error(`Equipamento ${data.patrimonio} · ${data.nome} indisponível (${data.status})`);
  return data;
}

export async function agendarImagem(formData: FormData) {
  const { supabase, user, empresaId, unidadeId } = await getAssistencialContext();
  const solicitacaoId = txt(formData, "solicitacao_id"), agendadoEm = txt(formData, "agendado_em"), equipamentoId = txt(formData, "engenharia_equipamento_id") || null;
  if (!solicitacaoId || !agendadoEm) return go("erro=campos-agenda");
  const { data: sol } = await supabase.from("solicitacoes_exames").select("id,atendimento_id,empresa_id,unidade_id").eq("id", solicitacaoId).eq("empresa_id", empresaId).eq("unidade_id", unidadeId).maybeSingle();
  if (!sol) return go("erro=solicitacao");
  const { data: at } = await supabase.from("atendimentos").select("paciente_id").eq("id", sol.atendimento_id).maybeSingle();
  if (!at?.paciente_id) return go("erro=atendimento");
  let equipamento = null;
  try { equipamento = await equipamentoOperacional(supabase, empresaId, unidadeId, equipamentoId); } catch (error) { return go(`erro=${encodeURIComponent(error instanceof Error ? error.message : "equipamento")}`); }
  const { error } = await supabase.from("imagem_agendamentos").insert({ empresa_id: empresaId, unidade_id: unidadeId, solicitacao_id: sol.id, atendimento_id: sol.atendimento_id, paciente_id: at.paciente_id, protocolo_id: txt(formData, "protocolo_id") || null, agendado_em: agendadoEm, duracao_minutos: Number(txt(formData, "duracao_minutos") || 30), sala: txt(formData, "sala") || null, equipamento: equipamento ? `${equipamento.patrimonio} · ${equipamento.nome}` : txt(formData, "equipamento") || null, engenharia_equipamento_id: equipamentoId, status: "agendado", observacoes: txt(formData, "observacoes") || null, created_by: user.id, updated_by: user.id });
  if (error) return go(`erro=${encodeURIComponent(error.message)}`);
  return go("sucesso=agendado");
}

export async function atualizarAgendaImagem(formData: FormData) {
  const { supabase, user, empresaId, unidadeId } = await getAssistencialContext();
  const id = txt(formData, "agendamento_id"), status = txt(formData, "status");
  if (!id || !["confirmado","chegou","faltou","cancelado"].includes(status)) return go("erro=agenda-status");
  const { error } = await supabase.from("imagem_agendamentos").update({ status, updated_at: new Date().toISOString(), updated_by: user.id }).eq("id", id).eq("empresa_id", empresaId).eq("unidade_id", unidadeId);
  if (error) return go(`erro=${encodeURIComponent(error.message)}`);
  return go("sucesso=agenda-status");
}

export async function iniciarExecucaoImagem(formData: FormData) {
  const { supabase, user, empresaId, unidadeId } = await getAssistencialContext();
  const solicitacaoId = txt(formData, "solicitacao_id"), agendamentoId = txt(formData, "agendamento_id") || null;
  let equipamentoId = txt(formData, "engenharia_equipamento_id") || null;
  const { data: sol } = await supabase.from("solicitacoes_exames").select("id,atendimento_id").eq("id", solicitacaoId).eq("empresa_id", empresaId).eq("unidade_id", unidadeId).maybeSingle();
  if (!sol) return go("erro=solicitacao");
  const { data: at } = await supabase.from("atendimentos").select("paciente_id").eq("id", sol.atendimento_id).maybeSingle();
  if (!at?.paciente_id) return go("erro=atendimento");
  if (agendamentoId && !equipamentoId) {
    const { data: ag } = await supabase.from("imagem_agendamentos").select("engenharia_equipamento_id").eq("id", agendamentoId).eq("empresa_id", empresaId).eq("unidade_id", unidadeId).maybeSingle();
    equipamentoId = ag?.engenharia_equipamento_id ?? null;
  }
  if (!equipamentoId) return go("erro=selecione-equipamento");
  let equipamento;
  try { equipamento = await equipamentoOperacional(supabase, empresaId, unidadeId, equipamentoId); } catch (error) { return go(`erro=${encodeURIComponent(error instanceof Error ? error.message : "equipamento")}`); }
  const stamp = Date.now().toString(36).toUpperCase();
  const { error } = await supabase.from("imagem_execucoes").insert({ empresa_id: empresaId, unidade_id: unidadeId, solicitacao_id: sol.id, atendimento_id: sol.atendimento_id, paciente_id: at.paciente_id, protocolo_id: txt(formData, "protocolo_id") || null, agendamento_id: agendamentoId, accession_number: txt(formData, "accession_number") || `IMG-${stamp}`, sala: txt(formData, "sala") || null, equipamento: `${equipamento?.patrimonio ?? ""} · ${equipamento?.nome ?? ""}`, engenharia_equipamento_id: equipamentoId, iniciado_em: new Date().toISOString(), status: "em_execucao", created_by: user.id, updated_by: user.id });
  if (error) return go(`erro=${encodeURIComponent(error.message)}`);
  if (agendamentoId) await supabase.from("imagem_agendamentos").update({ status: "em_execucao", updated_by: user.id }).eq("id", agendamentoId);
  return go("sucesso=execucao-iniciada");
}

export async function concluirExecucaoImagem(formData: FormData) {
  const { supabase, user, empresaId, unidadeId } = await getAssistencialContext();
  const id = txt(formData, "execucao_id"), profissionalId = await profissionalLogado(supabase, user.id, empresaId);
  const { data: exec, error } = await supabase.from("imagem_execucoes").update({ status: "concluido", finalizado_em: new Date().toISOString(), executado_por: profissionalId, study_instance_uid: txt(formData, "study_instance_uid") || null, series_instance_uid: txt(formData, "series_instance_uid") || null, pacs_url: txt(formData, "pacs_url") || null, intercorrencias: txt(formData, "intercorrencias") || null, updated_at: new Date().toISOString(), updated_by: user.id }).eq("id", id).eq("empresa_id", empresaId).eq("unidade_id", unidadeId).select("agendamento_id").maybeSingle();
  if (error) return go(`erro=${encodeURIComponent(error.message)}`);
  if (exec?.agendamento_id) await supabase.from("imagem_agendamentos").update({ status: "concluido", updated_by: user.id }).eq("id", exec.agendamento_id);
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
  const { error } = await supabase.from("imagem_contraste_registros").insert({ empresa_id: empresaId, unidade_id: unidadeId, atendimento_id: exec.atendimento_id, execucao_id: exec.id, contraste, lote: txt(formData, "lote") || null, validade: txt(formData, "validade") || null, volume_ml: txt(formData, "volume_ml") || null, via: txt(formData, "via") || null, alergia_questionada: true, alergia_negada: formData.get("alergia_negada") === "on", funcao_renal_verificada: formData.get("funcao_renal_verificada") === "on", creatinina: txt(formData, "creatinina") || null, egfr: txt(formData, "egfr") || null, consentimento_confirmado: formData.get("consentimento_confirmado") === "on", administrado_em: new Date().toISOString(), administrado_por: profissionalId, reacao_adversa: txt(formData, "reacao_adversa") || null, conduta_reacao: txt(formData, "conduta_reacao") || null, created_by: user.id });
  if (error) return go(`erro=${encodeURIComponent(error.message)}`);
  return go("sucesso=contraste");
}

export async function registrarDoseImagem(formData: FormData) {
  const { supabase, user, empresaId, unidadeId } = await getAssistencialContext();
  const execucaoId = txt(formData, "execucao_id");
  const { data: exec } = await supabase.from("imagem_execucoes").select("id,atendimento_id").eq("id", execucaoId).eq("empresa_id", empresaId).eq("unidade_id", unidadeId).maybeSingle();
  if (!exec) return go("erro=execucao");
  const num = (key: string) => { const v=txt(formData,key).replace(",", "."); return v ? Number(v) : null; };
  const { error } = await supabase.from("imagem_dose_radiacao").insert({ empresa_id: empresaId, unidade_id: unidadeId, atendimento_id: exec.atendimento_id, execucao_id: exec.id, modalidade: txt(formData, "modalidade") || null, ctdivol: num("ctdivol"), dlp: num("dlp"), dap: num("dap"), dose_mgy: num("dose_mgy"), tempo_fluoroscopia_segundos: num("tempo_fluoroscopia_segundos"), observacoes: txt(formData, "observacoes") || null, created_by: user.id });
  if (error) return go(`erro=${encodeURIComponent(error.message)}`);
  return go("sucesso=dose");
}

export async function salvarLaudoImagem(formData: FormData) {
  const { supabase, user, empresaId, unidadeId } = await getAssistencialContext();
  const execucaoId = txt(formData, "execucao_id");
  const { data: exec } = await supabase.from("imagem_execucoes").select("id,solicitacao_id,atendimento_id").eq("id", execucaoId).eq("empresa_id", empresaId).eq("unidade_id", unidadeId).maybeSingle();
  if (!exec) return go("erro=execucao");
  const { error } = await supabase.from("imagem_laudos").insert({ empresa_id: empresaId, unidade_id: unidadeId, solicitacao_id: exec.solicitacao_id, execucao_id: exec.id, atendimento_id: exec.atendimento_id, tecnica: txt(formData, "tecnica") || null, achados: txt(formData, "achados") || null, conclusao: txt(formData, "conclusao") || null, recomendacoes: txt(formData, "recomendacoes") || null, status: "rascunho", created_by: user.id, updated_by: user.id });
  if (error) return go(`erro=${encodeURIComponent(error.message)}`);
  return go("sucesso=laudo");
}

export async function liberarLaudoImagem(formData: FormData) {
  const { supabase } = await getAssistencialContext();
  const { error } = await supabase.rpc("liberar_laudo_imagem", { p_laudo_id: txt(formData, "laudo_id") });
  if (error) return go(`erro=${encodeURIComponent(error.message)}`);
  return go("sucesso=laudo-liberado");
}
