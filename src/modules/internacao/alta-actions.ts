"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { asRoute } from "@/lib/route-cast";
import { getAssistencialContext } from "@/modules/assistencial/context";

type AssistencialContext = Awaited<ReturnType<typeof getAssistencialContext>>;

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const lines = (value: string) => value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);

function goDetail(internacaoId: string, query: string): never {
  redirect(asRoute(`/internacao/altas/${internacaoId}?${query}`));
}

function revalidateAlta(internacaoId: string) {
  revalidatePath("/internacao");
  revalidatePath("/internacao/altas");
  revalidatePath(`/internacao/altas/${internacaoId}`);
}

async function profissionalLogado(
  supabase: AssistencialContext["supabase"],
  userId: string,
  empresaId: string,
) {
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

async function carregarInternacao(internacaoId: string) {
  const context = await getAssistencialContext();
  const { data: internacao } = await context.supabase
    .from("internacoes")
    .select("id,atendimento_id,motivo,status")
    .eq("id", internacaoId)
    .eq("empresa_id", context.empresaId)
    .eq("unidade_id", context.unidadeId)
    .maybeSingle();
  return { ...context, internacao };
}

export async function revalidarAltaSegura(formData: FormData) {
  const internacaoId = text(formData, "internacao_id");
  if (!internacaoId) redirect(asRoute("/internacao/altas?erro=internacao"));
  const { supabase } = await getAssistencialContext();
  const { error } = await supabase.rpc("sincronizar_pendencias_alta", {
    p_internacao_id: internacaoId,
  });
  if (error) goDetail(internacaoId, "erro=revalidar");
  revalidateAlta(internacaoId);
  goDetail(internacaoId, "sucesso=revalidada");
}

export async function salvarPlanoAltaSegura(formData: FormData) {
  const internacaoId = text(formData, "internacao_id");
  if (!internacaoId) redirect(asRoute("/internacao/altas?erro=internacao"));
  const { supabase, user, empresaId, unidadeId, internacao } = await carregarInternacao(internacaoId);
  if (!internacao || !["aguardando_leito", "internado", "transferido"].includes(internacao.status)) goDetail(internacaoId, "erro=internacao");

  const { data: atendimento } = await supabase
    .from("atendimentos")
    .select("paciente_id")
    .eq("id", internacao.atendimento_id)
    .maybeSingle();
  if (!atendimento?.paciente_id) goDetail(internacaoId, "erro=atendimento");

  const profissionalId = await profissionalLogado(supabase, user.id, empresaId);
  if (!profissionalId) goDetail(internacaoId, "erro=profissional");

  const status = formData.get("concluir") === "on" ? "concluido" : "em_planejamento";
  const { error } = await supabase.from("planejamentos_alta").insert({
    empresa_id: empresaId,
    unidade_id: unidadeId,
    atendimento_id: internacao.atendimento_id,
    paciente_id: atendimento.paciente_id,
    internacao_id: internacao.id,
    previsao_alta: text(formData, "previsao_alta") || null,
    destino: text(formData, "destino") || null,
    cuidador_responsavel: text(formData, "cuidador_responsavel") || null,
    necessidades_domiciliares: text(formData, "necessidades_domiciliares") || null,
    equipamentos: text(formData, "equipamentos") || null,
    medicamentos_orientados: text(formData, "medicamentos_orientados") || null,
    retorno_agendado: text(formData, "retorno_agendado") || null,
    transporte: text(formData, "transporte") || null,
    orientacoes: text(formData, "orientacoes") || null,
    status,
    profissional_id: profissionalId,
    concluido_em: status === "concluido" ? new Date().toISOString() : null,
    created_by: user.id,
    updated_by: user.id,
  });
  if (error) goDetail(internacaoId, "erro=plano");

  await supabase.rpc("sincronizar_pendencias_alta", { p_internacao_id: internacaoId });
  revalidateAlta(internacaoId);
  goDetail(internacaoId, "sucesso=plano");
}

export async function registrarConciliacaoAltaSegura(formData: FormData) {
  const internacaoId = text(formData, "internacao_id");
  if (!internacaoId) redirect(asRoute("/internacao/altas?erro=internacao"));
  const { supabase, user, empresaId, unidadeId, internacao } = await carregarInternacao(internacaoId);
  if (!internacao) goDetail(internacaoId, "erro=internacao");

  const medicamento = text(formData, "medicamento");
  if (!medicamento) goDetail(internacaoId, "erro=medicamento");

  const [{ data: atendimento }, profissionalId] = await Promise.all([
    supabase.from("atendimentos").select("paciente_id").eq("id", internacao.atendimento_id).maybeSingle(),
    profissionalLogado(supabase, user.id, empresaId),
  ]);
  if (!atendimento?.paciente_id || !profissionalId) goDetail(internacaoId, "erro=profissional");

  const { error } = await supabase.from("conciliacoes_medicamentosas").insert({
    empresa_id: empresaId,
    unidade_id: unidadeId,
    atendimento_id: internacao.atendimento_id,
    paciente_id: atendimento.paciente_id,
    profissional_id: profissionalId,
    momento: "alta",
    medicamento,
    dose_domiciliar: text(formData, "dose_domiciliar") || null,
    via_domiciliar: text(formData, "via_domiciliar") || null,
    frequencia_domiciliar: text(formData, "frequencia_domiciliar") || null,
    fonte_informacao: text(formData, "fonte_informacao") || "paciente/prontuario",
    decisao: text(formData, "decisao") || "manter",
    divergencia: text(formData, "divergencia") || null,
    intencional: formData.get("intencional") === "on",
    justificativa: text(formData, "justificativa") || null,
    observacoes: text(formData, "observacoes") || null,
    created_by: user.id,
    updated_by: user.id,
  });
  if (error) goDetail(internacaoId, "erro=conciliacao");

  await supabase.rpc("sincronizar_pendencias_alta", { p_internacao_id: internacaoId });
  revalidateAlta(internacaoId);
  goDetail(internacaoId, "sucesso=conciliacao");
}

export async function criarSumarioAltaSeguro(formData: FormData) {
  const internacaoId = text(formData, "internacao_id");
  if (!internacaoId) redirect(asRoute("/internacao/altas?erro=internacao"));
  const { supabase, user, empresaId, unidadeId, internacao } = await carregarInternacao(internacaoId);
  if (!internacao) goDetail(internacaoId, "erro=internacao");

  const [{ data: atendimento }, profissionalId] = await Promise.all([
    supabase.from("atendimentos").select("paciente_id").eq("id", internacao.atendimento_id).maybeSingle(),
    profissionalLogado(supabase, user.id, empresaId),
  ]);
  if (!atendimento?.paciente_id || !profissionalId) goDetail(internacaoId, "erro=profissional");

  const { data: sumario, error } = await supabase
    .from("sumarios_alta")
    .insert({
      empresa_id: empresaId,
      unidade_id: unidadeId,
      atendimento_id: internacao.atendimento_id,
      paciente_id: atendimento.paciente_id,
      internacao_id: internacao.id,
      profissional_id: profissionalId,
      motivo_internacao: text(formData, "motivo_internacao") || internacao.motivo,
      diagnosticos: lines(text(formData, "diagnosticos")),
      procedimentos: lines(text(formData, "procedimentos")),
      evolucao_resumida: text(formData, "evolucao_resumida") || null,
      condicao_alta: text(formData, "condicao_alta") || null,
      medicamentos_alta: lines(text(formData, "medicamentos_alta")),
      orientacoes: text(formData, "orientacoes") || null,
      sinais_alarme: text(formData, "sinais_alarme") || null,
      cuidados_domiciliares: text(formData, "cuidados_domiciliares") || null,
      dieta: text(formData, "dieta") || null,
      atividade: text(formData, "atividade") || null,
      curativos_dispositivos: text(formData, "curativos_dispositivos") || null,
      resultados_pendentes: lines(text(formData, "resultados_pendentes")),
      retorno: text(formData, "retorno") || null,
      encaminhamentos: lines(text(formData, "encaminhamentos")),
      data_alta_prevista: text(formData, "data_alta_prevista") || null,
      created_by: user.id,
      updated_by: user.id,
    })
    .select("id")
    .single();
  if (error || !sumario) goDetail(internacaoId, "erro=sumario");

  revalidateAlta(internacaoId);
  goDetail(internacaoId, `sucesso=sumario&sumario=${sumario.id}`);
}

export async function assinarSumarioAltaSeguro(formData: FormData) {
  const internacaoId = text(formData, "internacao_id");
  const sumarioId = text(formData, "sumario_id");
  if (!internacaoId || !sumarioId) redirect(asRoute("/internacao/altas?erro=internacao"));
  const { supabase } = await getAssistencialContext();
  const { error } = await supabase.rpc("assinar_sumario_alta", { p_sumario_id: sumarioId });
  if (error) goDetail(internacaoId, "erro=assinatura");

  await supabase.rpc("sincronizar_pendencias_alta", { p_internacao_id: internacaoId });
  revalidateAlta(internacaoId);
  goDetail(internacaoId, "sucesso=assinado");
}

export async function concluirAltaSegura(formData: FormData) {
  const internacaoId = text(formData, "internacao_id");
  if (!internacaoId) redirect(asRoute("/internacao/altas?erro=internacao"));

  const motivoCodigo = text(formData, "motivo_codigo");
  if (!motivoCodigo) redirect(asRoute(`/internacao/altas/${internacaoId}/encerrar`));

  const { supabase } = await getAssistencialContext();
  const { error } = await supabase.rpc("dar_alta_internacao_tiss", {
    p_internacao_id: internacaoId,
    p_motivo_tiss_codigo: motivoCodigo,
    p_declaracao_obito_numero: text(formData, "declaracao_obito_numero") || null,
    p_documento_svo_iml_numero: text(formData, "documento_svo_iml_numero") || null,
    p_observacao: text(formData, "observacao_encerramento") || null,
    p_data_alta: null,
  });

  if (error) {
    console.error("[internacao.alta] falha ao concluir encerramento", { code: error.code, message: error.message });
    if (error.message.includes("DO_OBRIGATORIA")) redirect(asRoute(`/internacao/altas/${internacaoId}/encerrar?erro=declaracao-obito`));
    if (error.message.includes("SVO_IML_DOCUMENTO")) redirect(asRoute(`/internacao/altas/${internacaoId}/encerrar?erro=documento-externo`));
    if (error.message.includes("PENDENCIAS_BLOQUEANTES")) goDetail(internacaoId, "erro=alta-bloqueada");
    redirect(asRoute(`/internacao/altas/${internacaoId}/encerrar?erro=encerramento`));
  }

  revalidateAlta(internacaoId);
  revalidatePath("/internacao/contas");
  revalidatePath("/faturamento");
  revalidatePath("/faturamento/contas");
  redirect(asRoute("/internacao/altas?sucesso=alta"));
}
