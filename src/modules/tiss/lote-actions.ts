"use server";

import { redirect } from "next/navigation";
import { getAssistencialContext } from "@/modules/assistencial/context";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

type CriarLoteResult = {
  lote_id?: string;
  numero_lote?: string;
  competencia?: string;
  quantidade_guias?: number;
  valor_total?: number;
};

function erroLote(message?: string | null) {
  const value = String(message ?? "");
  if (value.includes("TISS_LOTE_SEM_GUIAS_ELEGIVEIS")) return "sem-guias";
  if (value.includes("TISS_LOTE_COMPETENCIA_INVALIDA")) return "competencia";
  if (value.includes("TISS_LOTE_VERSAO_INDISPONIVEL")) return "versao";
  if (value.includes("TISS_LOTE_CONVENIO_INVALIDO")) return "convenio";
  if (
    value.includes("TISS_LOTE_SEM_PERMISSAO") ||
    value.includes("TISS_LOTE_SEM_ACESSO_UNIDADE") ||
    value.includes("TISS_NAO_AUTENTICADO")
  ) return "permissao";
  return "criar";
}

export async function criarLoteTiss(formData: FormData) {
  const { supabase, unidadeId } = await getAssistencialContext();
  const convenioId = text(formData, "convenio_id");
  const competencia = text(formData, "competencia");
  const previsaoPagamento = text(formData, "previsao_pagamento") || null;

  if (!convenioId || !competencia) redirect("/faturamento/lotes?erro=campos");

  const { data, error } = await supabase.rpc("criar_lote_tiss_transacional", {
    p_unidade_id: unidadeId,
    p_convenio_id: convenioId,
    p_competencia: competencia,
    p_previsao_pagamento: previsaoPagamento,
  });

  if (error) {
    console.error("[tiss.lote] falha transacional", {
      code: error.code,
      operation: "criar_lote_tiss_transacional",
    });
    redirect(`/faturamento/lotes?erro=${erroLote(error.message)}`);
  }

  const result = (data ?? {}) as CriarLoteResult;
  if (!result.lote_id) redirect("/faturamento/lotes?erro=criar");
  redirect(`/faturamento/lotes/${result.lote_id}`);
}
