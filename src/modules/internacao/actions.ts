"use server";

import { redirect } from "next/navigation";
import { getAssistencialContext } from "@/modules/assistencial/context";

const base = "/internacao";
const txt = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const go = (query: string): never => redirect(`${base}?${query}` as never);
const lines = (value: string) => value.split(/\r?\n/).map((v) => v.trim()).filter(Boolean);

async function profissionalLogado(supabase: any, userId: string, empresaId: string) {
  const { data } = await supabase
    .from("profissionais")
    .select("id")
    .eq("usuario_id", userId)
    .eq("empresa_id", empresaId)
    .eq("ativo", true)
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

export async function criarInternacao(formData: FormData) {
  const { supabase, user, empresaId, unidadeId } = await getAssistencialContext();
  const atendimentoId = txt(formData, "atendimento_id");
  const setor = txt(formData, "setor");
  if (!atendimentoId || !setor) return go("erro=campos");

  const { data: internacao, error } = await supabase
    .from("internacoes")
    .insert({
      empresa_id: empresaId,
      unidade_id: unidadeId,
      atendimento_id: atendimentoId,
      profissional_responsavel_id: txt(formData, "profissional_responsavel_id") || null,
      setor,
      acomodacao: txt(formData, "acomodacao") || null,
      motivo: txt(formData, "motivo") || null,
      previsao_alta: txt(formData, "previsao_alta") || null,
      observacoes: txt(formData, "observacoes") || null,
      status: "internado",
      created_by: user.id,
      updated_by: user.id,
    })
    .select("id")
    .single();

  if (error || !internacao) return go(`erro=${encodeURIComponent(error?.message ?? "salvar")}`);

  const leitoId = txt(formData, "leito_id");
  if (leitoId) {
    const { error: moveError } = await supabase.rpc("movimentar_internacao_leito", {
      p_internacao_id: internacao.id,
      p_leito_destino_id: leitoId,
      p_motivo: "Admissão",
    });
    if (moveError) return go(`erro=${encodeURIComponent(moveError.message)}`);
  }

  return go("sucesso=internacao");
}

export async function reservarLeito(formData: FormData) {
  const { supabase } = await getAssistencialContext();
  const ate = txt(formData, "reservado_ate");
  const { error } = await supabase.rpc("reservar_leito", {
    p_leito_id: txt(formData, "leito_id"),
    p_atendimento_id: txt(formData, "atendimento_id"),
    p_reservado_ate: ate || null,
    p_observacoes: txt(formData, "observacoes") || null,
  });
  if (error) return go(`erro=${encodeURIComponent(error.message)}`);
  return go("sucesso=reserva");
}

export async function cancelarReservaLeito(formData: FormData) {
  const { supabase } = await getAssistencialContext();
  const { error } = await supabase.rpc("cancelar_reserva_leito", {
    p_reserva_id: txt(formData, "reserva_id"),
    p_motivo: txt(formData, "motivo") || null,
  });
  if (error) return go(`erro=${encodeURIComponent(error.message)}`);
  return go("sucesso=reserva-cancelada");
}

export async function bloquearLeito(formData: FormData) {
  const { supabase } = await getAssistencialContext();
  const ate = txt(formData, "previsto_ate");
  const { error } = await supabase.rpc("bloquear_leito", {
    p_leito_id: txt(formData, "leito_id"),
    p_motivo: txt(formData, "motivo"),
    p_tipo: txt(formData, "tipo") || "operacional",
    p_previsto_ate: ate || null,
  });
  if (error) return go(`erro=${encodeURIComponent(error.message)}`);
  return go("sucesso=bloqueio");
}

export async function desbloquearLeito(formData: FormData) {
  const { supabase } = await getAssistencialContext();
  const { error } = await supabase.rpc("desbloquear_leito", {
    p_bloqueio_id: txt(formData, "bloqueio_id"),
    p_observacoes: txt(formData, "observacoes") || null,
  });
  if (error) return go(`erro=${encodeURIComponent(error.message)}`);
  return go("sucesso=desbloqueio");
}

export async function iniciarHigienizacaoLeito(formData: FormData) {
  const { supabase } = await getAssistencialContext();
  const { error } = await supabase.rpc("iniciar_higienizacao_leito", {
    p_leito_id: txt(formData, "leito_id"),
    p_observacoes: txt(formData, "observacoes") || null,
  });
  if (error) return go(`erro=${encodeURIComponent(error.message)}`);
  return go("sucesso=higienizacao-iniciada");
}

export async function concluirHigienizacaoLeito(formData: FormData) {
  const { supabase } = await getAssistencialContext();
  const { error } = await supabase.rpc("concluir_higienizacao_leito", {
    p_leito_id: txt(formData, "leito_id"),
    p_observacoes: txt(formData, "observacoes") || null,
  });
  if (error) return go(`erro=${encodeURIComponent(error.message)}`);
  return go("sucesso=higienizacao-concluida");
}

export async function movimentarInternacao(formData: FormData) {
  const { supabase } = await getAssistencialContext();
  const { error } = await supabase.rpc("movimentar_internacao_leito", {
    p_internacao_id: txt(formData, "internacao_id"),
    p_leito_destino_id: txt(formData, "leito_id"),
    p_motivo: txt(formData, "motivo") || null,
  });
  if (error) return go(`erro=${encodeURIComponent(error.message)}`);
  return go("sucesso=movimentacao");
}

export async function sincronizarPendenciasAlta(formData: FormData) {
  const { supabase } = await getAssistencialContext();
  const { error } = await supabase.rpc("sincronizar_pendencias_alta", {
    p_internacao_id: txt(formData, "internacao_id"),
  });
  if (error) return go(`erro=${encodeURIComponent(error.message)}`);
  return go("sucesso=pendencias-atualizadas");
}

export async function salvarPlanejamentoAlta(formData: FormData) {
  const { supabase, user, empresaId, unidadeId } = await getAssistencialContext();
  const internacaoId = txt(formData, "internacao_id");
  const { data: internacao } = await supabase
    .from("internacoes")
    .select("id,atendimento_id")
    .eq("id", internacaoId)
    .eq("empresa_id", empresaId)
    .eq("unidade_id", unidadeId)
    .maybeSingle();
  if (!internacao) return go("erro=internacao");

  const { data: atendimento } = await supabase
    .from("atendimentos")
    .select("paciente_id")
    .eq("id", internacao.atendimento_id)
    .maybeSingle();
  if (!atendimento?.paciente_id) return go("erro=atendimento");

  const profissionalId = await profissionalLogado(supabase, user.id, empresaId);
  const status = formData.get("concluir") === "on" ? "concluido" : "em_planejamento";
  const { error } = await supabase.from("planejamentos_alta").insert({
    empresa_id: empresaId,
    unidade_id: unidadeId,
    atendimento_id: internacao.atendimento_id,
    paciente_id: atendimento.paciente_id,
    internacao_id: internacao.id,
    previsao_alta: txt(formData, "previsao_alta") || null,
    destino: txt(formData, "destino") || null,
    cuidador_responsavel: txt(formData, "cuidador_responsavel") || null,
    necessidades_domiciliares: txt(formData, "necessidades_domiciliares") || null,
    equipamentos: txt(formData, "equipamentos") || null,
    medicamentos_orientados: txt(formData, "medicamentos_orientados") || null,
    retorno_agendado: txt(formData, "retorno_agendado") || null,
    transporte: txt(formData, "transporte") || null,
    orientacoes: txt(formData, "orientacoes") || null,
    status,
    profissional_id: profissionalId,
    concluido_em: status === "concluido" ? new Date().toISOString() : null,
    created_by: user.id,
    updated_by: user.id,
  });
  if (error) return go(`erro=${encodeURIComponent(error.message)}`);

  await supabase.rpc("sincronizar_pendencias_alta", { p_internacao_id: internacao.id });
  return go("sucesso=plano-alta");
}

export async function registrarConciliacaoAlta(formData: FormData) {
  const { supabase, user, empresaId, unidadeId } = await getAssistencialContext();
  const internacaoId = txt(formData, "internacao_id");
  const { data: internacao } = await supabase
    .from("internacoes")
    .select("id,atendimento_id")
    .eq("id", internacaoId)
    .eq("empresa_id", empresaId)
    .eq("unidade_id", unidadeId)
    .maybeSingle();
  if (!internacao) return go("erro=internacao");

  const { data: atendimento } = await supabase
    .from("atendimentos")
    .select("paciente_id")
    .eq("id", internacao.atendimento_id)
    .maybeSingle();
  const profissionalId = await profissionalLogado(supabase, user.id, empresaId);
  if (!atendimento?.paciente_id || !profissionalId) return go("erro=profissional");

  const medicamento = txt(formData, "medicamento");
  if (!medicamento) return go("erro=medicamento");

  const { error } = await supabase.from("conciliacoes_medicamentosas").insert({
    empresa_id: empresaId,
    unidade_id: unidadeId,
    atendimento_id: internacao.atendimento_id,
    paciente_id: atendimento.paciente_id,
    profissional_id: profissionalId,
    momento: "alta",
    medicamento,
    dose_domiciliar: txt(formData, "dose_domiciliar") || null,
    via_domiciliar: txt(formData, "via_domiciliar") || null,
    frequencia_domiciliar: txt(formData, "frequencia_domiciliar") || null,
    fonte_informacao: txt(formData, "fonte_informacao") || "paciente/prontuario",
    decisao: txt(formData, "decisao") || "manter",
    divergencia: txt(formData, "divergencia") || null,
    intencional: formData.get("intencional") === "on",
    justificativa: txt(formData, "justificativa") || null,
    observacoes: txt(formData, "observacoes") || null,
    created_by: user.id,
    updated_by: user.id,
  });
  if (error) return go(`erro=${encodeURIComponent(error.message)}`);

  await supabase.rpc("sincronizar_pendencias_alta", { p_internacao_id: internacao.id });
  return go("sucesso=conciliacao-alta");
}

export async function criarSumarioAlta(formData: FormData) {
  const { supabase, user, empresaId, unidadeId } = await getAssistencialContext();
  const internacaoId = txt(formData, "internacao_id");
  const { data: internacao } = await supabase
    .from("internacoes")
    .select("id,atendimento_id,motivo")
    .eq("id", internacaoId)
    .eq("empresa_id", empresaId)
    .eq("unidade_id", unidadeId)
    .maybeSingle();
  if (!internacao) return go("erro=internacao");

  const { data: atendimento } = await supabase
    .from("atendimentos")
    .select("paciente_id")
    .eq("id", internacao.atendimento_id)
    .maybeSingle();
  const profissionalId = await profissionalLogado(supabase, user.id, empresaId);
  if (!atendimento?.paciente_id || !profissionalId) return go("erro=profissional");

  const { data: sumario, error } = await supabase
    .from("sumarios_alta")
    .insert({
      empresa_id: empresaId,
      unidade_id: unidadeId,
      atendimento_id: internacao.atendimento_id,
      paciente_id: atendimento.paciente_id,
      internacao_id: internacao.id,
      profissional_id: profissionalId,
      motivo_internacao: txt(formData, "motivo_internacao") || internacao.motivo,
      diagnosticos: lines(txt(formData, "diagnosticos")),
      procedimentos: lines(txt(formData, "procedimentos")),
      evolucao_resumida: txt(formData, "evolucao_resumida") || null,
      condicao_alta: txt(formData, "condicao_alta") || null,
      medicamentos_alta: lines(txt(formData, "medicamentos_alta")),
      orientacoes: txt(formData, "orientacoes") || null,
      sinais_alarme: txt(formData, "sinais_alarme") || null,
      cuidados_domiciliares: txt(formData, "cuidados_domiciliares") || null,
      dieta: txt(formData, "dieta") || null,
      atividade: txt(formData, "atividade") || null,
      curativos_dispositivos: txt(formData, "curativos_dispositivos") || null,
      resultados_pendentes: lines(txt(formData, "resultados_pendentes")),
      retorno: txt(formData, "retorno") || null,
      encaminhamentos: lines(txt(formData, "encaminhamentos")),
      data_alta_prevista: txt(formData, "data_alta_prevista") || null,
      created_by: user.id,
      updated_by: user.id,
    })
    .select("id")
    .single();

  if (error || !sumario) return go(`erro=${encodeURIComponent(error?.message ?? "sumario")}`);
  return go(`sucesso=sumario&sumario=${sumario.id}`);
}

export async function assinarSumarioAlta(formData: FormData) {
  const { supabase } = await getAssistencialContext();
  const internacaoId = txt(formData, "internacao_id");
  const { error } = await supabase.rpc("assinar_sumario_alta", {
    p_sumario_id: txt(formData, "sumario_id"),
  });
  if (error) return go(`erro=${encodeURIComponent(error.message)}`);

  await supabase.rpc("sincronizar_pendencias_alta", { p_internacao_id: internacaoId });
  return go("sucesso=sumario-assinado");
}

export async function darAltaInternacao(formData: FormData) {
  const { supabase } = await getAssistencialContext();
  const { error } = await supabase.rpc("dar_alta_internacao", {
    p_internacao_id: txt(formData, "internacao_id"),
    p_motivo: txt(formData, "motivo"),
  });
  if (error) return go(`erro=${encodeURIComponent(error.message)}`);
  return go("sucesso=alta");
}
