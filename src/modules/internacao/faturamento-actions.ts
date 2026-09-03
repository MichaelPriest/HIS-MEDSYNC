"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { asRoute } from "@/lib/route-cast";
import { getAssistencialContext } from "@/modules/assistencial/context";

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

function go(query: string): never {
  redirect(asRoute(`/internacao/contas?${query}`));
}

export async function fecharContaParcialInternacao(formData: FormData) {
  const internacaoId = text(formData, "internacao_id");
  const inicio = text(formData, "periodo_inicio");
  const fim = text(formData, "periodo_fim");
  const motivo = text(formData, "motivo_permanencia_codigo");
  const observacao = text(formData, "observacao");

  if (!internacaoId || !/^\d{4}-\d{2}-\d{2}$/.test(inicio) || !/^\d{4}-\d{2}-\d{2}$/.test(fim) || !motivo) {
    go("erro=campos-parcial");
  }

  const { supabase, empresaId, unidadeId } = await getAssistencialContext();
  const { data: internacao } = await supabase
    .from("internacoes")
    .select("id,status,data_alta")
    .eq("id", internacaoId)
    .eq("empresa_id", empresaId)
    .eq("unidade_id", unidadeId)
    .maybeSingle();

  if (!internacao || !["internado", "transferido", "aguardando_leito"].includes(String(internacao.status)) || internacao.data_alta) {
    go("erro=internacao-inativa");
  }

  const { data, error } = await supabase.rpc("faturamento_fechar_parcial_internacao_tiss", {
    p_internacao_id: internacaoId,
    p_periodo_inicio: inicio,
    p_periodo_fim: fim,
    p_motivo_permanencia_tiss: motivo,
    p_observacao: observacao || null,
  });

  if (error) {
    console.error("[internacao.conta-parcial] falha ao fechar parcial", { code: error.code, message: error.message });
    if (error.message.includes("SOBREPOS")) go("erro=periodo-sobreposto");
    if (error.message.includes("CONTINUIDADE") || error.message.includes("INICIO")) go("erro=periodo-continuo");
    if (error.message.includes("FUTUR")) go("erro=periodo-futuro");
    if (error.message.includes("PERMANENCIA")) go("erro=motivo-permanencia");
    go("erro=fechar-parcial");
  }

  const result = (data ?? {}) as { conta_id?: string; parcial_numero?: number };
  revalidatePath("/internacao");
  revalidatePath("/internacao/contas");
  revalidatePath("/faturamento");
  revalidatePath("/faturamento/contas");
  if (result.conta_id) revalidatePath(`/faturamento/${result.conta_id}`);

  go(`sucesso=parcial${result.parcial_numero ? `&parcial=${result.parcial_numero}` : ""}`);
}
