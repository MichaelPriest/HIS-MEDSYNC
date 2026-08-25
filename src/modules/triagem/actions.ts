"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { asRoute } from "@/lib/route-cast";
import { getAssistencialContext } from "@/modules/assistencial/context";
import { encaminharPosTriagem } from "@/modules/triagem/fluxo-pos-triagem";

function numberOrNull(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim().replace(",", ".");
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function chamarPacienteTriagem(formData: FormData) {
  const { supabase, user, empresaId, unidadeId } = await getAssistencialContext();
  const atendimentoId = String(formData.get("atendimento_id") ?? "").trim();
  const ponto = String(formData.get("ponto_atendimento") ?? "Sala de Triagem").trim() || "Sala de Triagem";
  if (!atendimentoId) redirect("/triagem?erro=atendimento");

  const { data: atendimento } = await supabase.from("atendimentos").select("id,paciente_id,triagem_concluida_em,status")
    .eq("id", atendimentoId).eq("unidade_id", unidadeId).maybeSingle();
  if (!atendimento || atendimento.triagem_concluida_em || ["alta", "cancelado", "encerrado"].includes(String(atendimento.status))) redirect("/triagem?erro=atendimento");

  const { data: filaExistente } = await supabase.from("filas_setoriais").select("id,status")
    .eq("atendimento_id", atendimentoId).eq("unidade_id", unidadeId).eq("setor_codigo", "triagem").neq("status", "cancelado")
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  const now = new Date().toISOString();

  if (filaExistente) {
    const { error } = await supabase.from("filas_setoriais").update({ status: "chamado", ponto_atendimento: ponto, chamado_em: now, concluido_em: null, updated_by: user.id, updated_at: now }).eq("id", filaExistente.id);
    if (error) redirect(`/triagem?atendimento=${atendimentoId}&erro=chamada`);
  } else {
    const { error } = await supabase.from("filas_setoriais").insert({ empresa_id: empresaId, unidade_id: unidadeId, atendimento_id: atendimentoId, paciente_id: atendimento.paciente_id, setor_codigo: "triagem", origem: "recepcao", motivo: "Triagem inicial", prioridade: "normal", status: "chamado", ponto_atendimento: ponto, chamado_em: now, created_by: user.id, updated_by: user.id });
    if (error) redirect(`/triagem?atendimento=${atendimentoId}&erro=chamada`);
  }

  await supabase.from("atendimentos").update({ setor_atual: "triagem", ultima_movimentacao_em: now, updated_by: user.id, updated_at: now }).eq("id", atendimentoId).eq("unidade_id", unidadeId);
  revalidatePath("/triagem");
  revalidatePath(`/painel-chamadas/${unidadeId}`);
  redirect(`/triagem?atendimento=${atendimentoId}&chamado=1`);
}

export async function registrarTriagem(formData: FormData) {
  const { supabase, user, empresaId, unidadeId } = await getAssistencialContext();
  const atendimentoId = String(formData.get("atendimento_id") ?? "").trim();
  const especialidade = String(formData.get("especialidade_destino") ?? "").trim();
  if (!atendimentoId || !especialidade) redirect("/triagem?erro=atendimento-especialidade");

  const { data: atendimento } = await supabase.from("atendimentos")
    .select("id,paciente_id,cobertura,triagem_concluida_em,tipo_atendimento")
    .eq("id", atendimentoId).eq("unidade_id", unidadeId).maybeSingle();
  if (!atendimento || atendimento.triagem_concluida_em) redirect("/triagem?erro=atendimento");

  const classificacao = String(formData.get("classificacao_risco") ?? "").trim() || null;
  const queixaPrincipal = String(formData.get("queixa_principal") ?? "").trim() || null;
  const payload = {
    empresa_id: empresaId,
    unidade_id: unidadeId,
    atendimento_id: atendimentoId,
    peso_kg: numberOrNull(formData.get("peso_kg")),
    altura_cm: numberOrNull(formData.get("altura_cm")),
    pressao_arterial: String(formData.get("pressao_arterial") ?? "").trim() || null,
    frequencia_cardiaca: numberOrNull(formData.get("frequencia_cardiaca")),
    frequencia_respiratoria: numberOrNull(formData.get("frequencia_respiratoria")),
    saturacao_o2: numberOrNull(formData.get("saturacao_o2")),
    temperatura_c: numberOrNull(formData.get("temperatura_c")),
    glicemia_mg_dl: numberOrNull(formData.get("glicemia_mg_dl")),
    dor_escala: numberOrNull(formData.get("dor_escala")),
    classificacao_risco: classificacao,
    queixa_principal: queixaPrincipal,
    observacoes: String(formData.get("observacoes") ?? "").trim() || null,
    created_by: user.id,
    updated_by: user.id,
  };

  const { error: triagemError } = await supabase.from("triagens").upsert(payload, { onConflict: "atendimento_id" });
  if (triagemError) {
    console.error("[triagem] falha ao salvar", { atendimentoId, code: triagemError.code, message: triagemError.message });
    redirect("/triagem?erro=salvar");
  }

  const now = new Date().toISOString();
  let autorizacaoLiberada = atendimento.cobertura !== "convenio";
  if (!autorizacaoLiberada) {
    const { data: autorizacao } = await supabase.from("autorizacoes_atendimento").select("status").eq("atendimento_id", atendimentoId).maybeSingle();
    autorizacaoLiberada = Boolean(autorizacao && ["autorizada", "dispensada"].includes(String(autorizacao.status)));
  }

  const { error: atendimentoError } = await supabase.from("atendimentos").update({
    especialidade_destino: especialidade,
    triagem_concluida_em: now,
    status: "em_espera",
    setor_atual: autorizacaoLiberada ? "triagem_concluida" : "autorizacoes",
    ultima_movimentacao_em: now,
    updated_at: now,
    updated_by: user.id,
  }).eq("id", atendimentoId).eq("unidade_id", unidadeId);
  if (atendimentoError) {
    console.error("[triagem] falha ao concluir atendimento", { atendimentoId, code: atendimentoError.code, message: atendimentoError.message });
    redirect("/triagem?erro=encaminhar");
  }

  const { error: filaError } = await supabase.from("filas_setoriais").update({ status: "concluido", concluido_em: now, updated_by: user.id, updated_at: now })
    .eq("atendimento_id", atendimentoId).eq("unidade_id", unidadeId).eq("setor_codigo", "triagem").in("status", ["aguardando", "chamado", "em_atendimento"]);
  if (filaError) console.error("[triagem] falha ao concluir fila", { atendimentoId, code: filaError.code });

  revalidatePath("/triagem");
  revalidatePath(`/painel-chamadas/${unidadeId}`);

  if (!autorizacaoLiberada) {
    revalidatePath("/autorizacoes");
    redirect(`/autorizacoes?atendimento=${atendimentoId}&sucesso=triagem-salva`);
  }

  try {
    const destino = await encaminharPosTriagem({
      supabase,
      userId: user.id,
      empresaId,
      unidadeId,
      atendimentoId,
      pacienteId: atendimento.paciente_id,
      tipoAtendimento: atendimento.tipo_atendimento,
      especialidade,
      classificacao,
      queixaPrincipal,
    });
    revalidatePath("/fila-medica");
    revalidatePath("/assistencial/urgencia");
    revalidatePath("/pronto-socorro");
    redirect(asRoute(destino.prontoSocorro ? `/pronto-socorro?atendimento=${atendimentoId}&sucesso=triagem` : "/triagem?sucesso=encaminhado"));
  } catch (error) {
    console.error("[triagem] falha no encaminhamento pos-triagem", { atendimentoId, error });
    redirect("/triagem?erro=encaminhar");
  }
}
