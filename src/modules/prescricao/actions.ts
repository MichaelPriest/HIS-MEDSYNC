"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAssistencialContext } from "@/modules/assistencial/context";

function text(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}
function numberValue(formData: FormData, key: string) {
  const raw = text(formData, key);
  if (!raw) return null;
  const n = Number(raw.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
function listValue(formData: FormData, key: string) {
  const raw = text(formData, key);
  return raw ? raw.split(/[;,\n]/).map((v) => v.trim()).filter(Boolean) : [];
}

export async function criarPrescricao(formData: FormData) {
  const { supabase, user, empresaId, unidadeId } = await getAssistencialContext();
  const atendimentoId = String(formData.get("atendimento_id") ?? "").trim();
  const profissionalId = String(formData.get("profissional_id") ?? "").trim();
  const item = String(formData.get("item") ?? "").trim();
  const tipo = String(formData.get("tipo") ?? "medicamento");
  if (!atendimentoId || !profissionalId || !item) redirect("/prescricao?erro=campos");

  const { data: atendimento } = await supabase.from("atendimentos").select("id,paciente_id").eq("id", atendimentoId).eq("unidade_id", unidadeId).maybeSingle();
  if (!atendimento) redirect("/prescricao?erro=atendimento");

  const { error } = await supabase.from("prescricoes").insert({
    empresa_id: empresaId,
    unidade_id: unidadeId,
    atendimento_id: atendimentoId,
    profissional_id: profissionalId,
    tipo,
    item,
    produto_id: text(formData, "produto_id"),
    quantidade: numberValue(formData, "quantidade"),
    unidade_dose: text(formData, "unidade_dose"),
    dose: text(formData, "dose"),
    via: text(formData, "via"),
    frequencia: text(formData, "frequencia"),
    duracao: text(formData, "duracao"),
    inicio_em: text(formData, "inicio_em"),
    fim_em: text(formData, "fim_em"),
    horarios: listValue(formData, "horarios"),
    aprazamento: listValue(formData, "aprazamento"),
    se_necessario: formData.get("se_necessario") === "on",
    diluente: text(formData, "diluente"),
    velocidade_infusao: text(formData, "velocidade_infusao"),
    instrucoes: text(formData, "instrucoes"),
    orientacoes: text(formData, "orientacoes"),
    requer_validacao_farmaceutica: formData.get("requer_validacao_farmaceutica") === "on",
    status: "rascunho",
    created_by: user.id,
    updated_by: user.id,
  });
  if (error) {
    console.error("[prescricao] criar", error);
    redirect("/prescricao?erro=salvar");
  }
  revalidatePath("/prescricao");
  redirect("/prescricao?sucesso=rascunho");
}

export async function assinarPrescricaoAction(formData: FormData) {
  const { supabase, user, empresaId, unidadeId } = await getAssistencialContext();
  const prescricaoId = String(formData.get("prescricao_id") ?? "").trim();
  if (!prescricaoId) redirect("/prescricao?erro=prescricao");

  const { error: assinaturaError } = await supabase.rpc("assinar_prescricao", { p_prescricao_id: prescricaoId });
  if (assinaturaError) {
    console.error("[prescricao] assinar", assinaturaError);
    redirect(`/prescricao?erro=${encodeURIComponent(assinaturaError.message)}`);
  }

  const { data: p } = await supabase.from("prescricoes").select("id,tipo,item,atendimento_id,profissional_id,atendimento:atendimentos(paciente_id)").eq("id", prescricaoId).eq("empresa_id", empresaId).eq("unidade_id", unidadeId).maybeSingle();
  if (p?.tipo === "medicamento") {
    const atendimento = Array.isArray(p.atendimento) ? p.atendimento[0] : p.atendimento;
    const { data: existente } = await supabase.from("filas_setoriais").select("id").eq("atendimento_id", p.atendimento_id).eq("setor_codigo", "farmacia").eq("origem", "prescricao").in("status", ["aguardando","chamado","em_atendimento"]).limit(1).maybeSingle();
    if (!existente && atendimento?.paciente_id) {
      await supabase.from("filas_setoriais").insert({
        empresa_id: empresaId, unidade_id: unidadeId, atendimento_id: p.atendimento_id, paciente_id: atendimento.paciente_id,
        setor_codigo: "farmacia", origem: "prescricao", motivo: `Dispensação da prescrição assinada: ${p.item}`,
        prioridade: "normal", profissional_origem_id: p.profissional_id, created_by: user.id, updated_by: user.id,
      });
      await supabase.from("atendimentos").update({ setor_atual: "farmacia", ultima_movimentacao_em: new Date().toISOString(), updated_by: user.id }).eq("id", p.atendimento_id);
    }
  }
  revalidatePath("/prescricao");
  redirect("/prescricao?sucesso=assinada");
}

export async function suspenderPrescricaoAction(formData: FormData) {
  const { supabase } = await getAssistencialContext();
  const prescricaoId = String(formData.get("prescricao_id") ?? "").trim();
  const motivo = String(formData.get("motivo") ?? "").trim();
  if (!prescricaoId || !motivo) redirect("/prescricao?erro=suspensao");
  const { error } = await supabase.rpc("suspender_prescricao", { p_prescricao_id: prescricaoId, p_motivo: motivo });
  if (error) {
    console.error("[prescricao] suspender", error);
    redirect("/prescricao?erro=suspensao");
  }
  revalidatePath("/prescricao");
  redirect("/prescricao?sucesso=suspensa");
}
