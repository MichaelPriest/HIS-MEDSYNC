"use server";

import { revalidatePath } from "next/cache";
import type { BackgroundActionState } from "@/lib/actions/background-action";
import { getAssistencialContext } from "@/modules/assistencial/context";

export type BillingType = "pronto_atendimento" | "ambulatorio" | "internacao" | "sadt";
export type TissBatchByTypeData = { redirectTo: string; id?: string; tipo?: BillingType };

const TYPES: BillingType[] = ["pronto_atendimento", "ambulatorio", "internacao", "sadt"];
const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

function message(raw?: string | null) {
  const value = String(raw ?? "");
  if (value.includes("TISS_LOTE_SEM_GUIAS_ELEGIVEIS")) return ["sem-guias", "Não há guias elegíveis deste tipo para a operadora e competência selecionadas."] as const;
  if (value.includes("TISS_LOTE_COMPETENCIA_INVALIDA")) return ["competencia", "A competência informada é inválida."] as const;
  if (value.includes("TISS_LOTE_TIPO_ATENDIMENTO_INVALIDO")) return ["tipo", "Selecione um tipo de atendimento faturável válido."] as const;
  if (value.includes("TISS_LOTE_TIPO_ATENDIMENTO_MISTO")) return ["tipo-misto", "O lote tentou misturar naturezas de atendimento e foi bloqueado pelo banco."] as const;
  if (value.includes("TISS_LOTE_VERSAO_INDISPONIVEL")) return ["versao", "Não há versão TISS ativa para criar o lote."] as const;
  if (value.includes("TISS_LOTE_CONVENIO_INVALIDO")) return ["convenio", "O convênio selecionado não está disponível."] as const;
  if (value.includes("SEM_PERMISSAO") || value.includes("SEM_ACESSO") || value.includes("NAO_AUTENTICADO")) return ["permissao", "Seu perfil não possui permissão para criar este lote."] as const;
  return ["criar", "Não foi possível criar o lote TISS separado por tipo de atendimento."] as const;
}

export async function criarLoteTissPorTipoBackground(
  _previous: BackgroundActionState<TissBatchByTypeData>,
  formData: FormData,
): Promise<BackgroundActionState<TissBatchByTypeData>> {
  const { supabase, unidadeId } = await getAssistencialContext();
  const convenioId = text(formData, "convenio_id");
  const competencia = text(formData, "competencia");
  const tipo = text(formData, "tipo_atendimento_faturamento") as BillingType;
  const previsaoPagamento = text(formData, "previsao_pagamento") || null;

  if (!convenioId || !competencia || !TYPES.includes(tipo)) {
    return { status: "error", code: "campos", message: "Informe convênio, competência e tipo de atendimento." };
  }

  const { data, error } = await supabase.rpc("criar_lote_tiss_por_tipo_transacional", {
    p_unidade_id: unidadeId,
    p_convenio_id: convenioId,
    p_competencia: competencia,
    p_tipo_atendimento_faturamento: tipo,
    p_previsao_pagamento: previsaoPagamento,
  });

  if (error) {
    const [code, detail] = message(error.message);
    console.error("[faturamento.lote-tipo] criar lote", { code: error.code, category: code, tipo });
    return { status: "error", code, message: detail };
  }

  const value = Array.isArray(data) ? data[0] : data;
  const result = (value ?? {}) as { lote_id?: string; numero_lote?: string; tipo_atendimento_faturamento?: BillingType };
  if (!result.lote_id) return { status: "error", code: "criar", message: "O lote não retornou um identificador válido." };

  revalidatePath("/faturamento");
  revalidatePath("/faturamento/lotes");
  revalidatePath("/faturamento/contas");
  revalidatePath("/financeiro");

  return {
    status: "success",
    code: "lote-criado",
    message: result.numero_lote ? `Lote ${result.numero_lote} criado sem misturar tipos de atendimento.` : "Lote criado sem misturar tipos de atendimento.",
    data: { id: result.lote_id, tipo: result.tipo_atendimento_faturamento ?? tipo, redirectTo: `/faturamento/lotes/${result.lote_id}` },
  };
}
