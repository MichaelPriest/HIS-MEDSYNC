"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { asRoute } from "@/lib/route-cast";
import { requireAnyPermission } from "@/lib/permissions/server";
import { buildInternacaoAdmissionRpcParams } from "@/modules/internacao/admission";

function text(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function back(atendimentoId: string, query: string): never {
  redirect(asRoute(`/internacao/nova/${atendimentoId}?${query}`));
}

function admissionError(message?: string) {
  if (!message) return "salvar";
  if (message.includes("INTERNACAO_ATIVA_JA_EXISTE")) return "internacao-ativa";
  if (message.includes("ACOMODACAO_ANS")) return "acomodacao-ans";
  if (message.includes("LEITO_")) return "leito";
  if (message.includes("RESPONSAVEL")) return "profissional";
  if (message.includes("ATENDIMENTO")) return "atendimento";
  return "salvar";
}

export async function admitirPacienteInternacao(formData: FormData) {
  const { supabase, unidadeId } = await requireAnyPermission([
    "internacao.admitir",
    "internacao.criar",
  ]);
  const atendimentoId = text(formData, "atendimento_id");
  const setor = text(formData, "setor");
  if (!atendimentoId || !setor || !unidadeId) return back(atendimentoId ?? "invalido", "erro=campos");

  const params = buildInternacaoAdmissionRpcParams({
    atendimentoId,
    setor,
    profissionalResponsavelId: text(formData, "profissional_responsavel_id"),
    leitoId: text(formData, "leito_id"),
    acomodacao: text(formData, "acomodacao"),
    acomodacaoTuss49Codigo: text(formData, "acomodacao_tuss49_codigo"),
    motivo: text(formData, "motivo"),
    previsaoAlta: text(formData, "previsao_alta"),
    observacoes: text(formData, "observacoes"),
  });

  const { data: internacaoId, error } = await supabase.rpc("admitir_internacao_operacional", params);
  if (error || !internacaoId) {
    console.error("[internacao] admissao contextual transacional", { code: error?.code ?? "unknown" });
    return back(atendimentoId, `erro=${admissionError(error?.message)}`);
  }

  revalidatePath("/internacao");
  revalidatePath("/internacao/nir");
  revalidatePath(`/prontuario/${atendimentoId}`);
  redirect(asRoute(`/prontuario/${atendimentoId}?sucesso=internacao`));
}
