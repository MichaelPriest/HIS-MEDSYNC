"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getAssistencialContext } from "@/modules/assistencial/context";

function optional(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? "").trim();
  return value || null;
}

export async function atualizarAutorizacao(formData: FormData) {
  const { supabase, user, unidadeId } = await getAssistencialContext();
  const id = String(formData.get("autorizacao_id") ?? "").trim();
  const status = String(formData.get("status") ?? "pendente").trim();
  if (!id || !["pendente","solicitada","autorizada","negada","dispensada"].includes(status)) redirect("/autorizacoes?erro=dados");

  const { data: autorizacao } = await supabase.from("autorizacoes_atendimento").select("id,atendimento_id").eq("id", id).eq("unidade_id", unidadeId).maybeSingle();
  if (!autorizacao) redirect("/autorizacoes?erro=nao-encontrada");

  const payload = {
    numero_guia_prestador: optional(formData, "numero_guia_prestador"),
    numero_guia_operadora: optional(formData, "numero_guia_operadora"),
    senha_autorizacao: optional(formData, "senha_autorizacao"),
    validade: optional(formData, "validade"),
    status,
    observacao: optional(formData, "observacao"),
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  };
  const { error } = await supabase.from("autorizacoes_atendimento").update(payload).eq("id", id);
  if (error) redirect(`/autorizacoes?atendimento=${autorizacao.atendimento_id}&erro=salvar`);

  if (status === "autorizada" || status === "dispensada") {
    await supabase.from("atendimentos").update({
      numero_autorizacao: payload.numero_guia_operadora,
      senha_autorizacao: payload.senha_autorizacao,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    }).eq("id", autorizacao.atendimento_id).eq("unidade_id", unidadeId);
  }
  revalidatePath("/autorizacoes");
  redirect(`/triagem?atendimento=${autorizacao.atendimento_id}&sucesso=autorizacao`);
}
