"use server";

import { revalidatePath } from "next/cache";
import type { BackgroundActionState } from "@/lib/actions/background-action";
import { getAssistencialContext } from "@/modules/assistencial/context";

export type RecursoRetornoActionData = { retornoId?: string };

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function money(formData: FormData, key: string) {
  const raw = text(formData, key);
  if (!raw) return 0;
  const value = Number(raw.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(value) ? value : Number.NaN;
}

function retornoMessage(message?: string | null) {
  const value = String(message ?? "");
  if (value.includes("SEM_PERMISSAO") || value.includes("NAO_AUTENTICADO")) return ["permissao", "Seu perfil não possui permissão para registrar o retorno da operadora."] as const;
  if (value.includes("SEM_ITENS")) return ["itens", "Informe ao menos um item com valor deferido ou indeferido."] as const;
  if (value.includes("EXCEDE_RECURSADO")) return ["excede-recursado", "O retorno informado excede o saldo recursado de um dos itens."] as const;
  if (value.includes("DEFERIDO_EXCEDE_GLOSA")) return ["excede-glosa", "O deferimento informado excede a glosa original."] as const;
  if (value.includes("VALOR_INVALIDO")) return ["valor", "Revise os valores deferidos e indeferidos."] as const;
  if (value.includes("ITEM_FORA_RECURSO") || value.includes("ITEM_INVALIDO")) return ["item", "Um dos itens não pertence a este recurso."] as const;
  if (value.includes("NAO_LOCALIZADO")) return ["nao-localizado", "O recurso não foi localizado no seu escopo."] as const;
  return ["operacao", "O retorno do recurso não pôde ser registrado."] as const;
}

export async function registrarRetornoRecursoBackground(
  recursoId: string,
  itemIds: string[],
  _previous: BackgroundActionState<RecursoRetornoActionData>,
  formData: FormData,
): Promise<BackgroundActionState<RecursoRetornoActionData>> {
  const itens = itemIds.flatMap((itemId) => {
    const valorDeferido = money(formData, `deferido_${itemId}`);
    const valorIndeferido = money(formData, `indeferido_${itemId}`);
    if (!Number.isFinite(valorDeferido) || !Number.isFinite(valorIndeferido) || valorDeferido < 0 || valorIndeferido < 0) return [{ item_id: itemId, valor_deferido: Number.NaN, valor_indeferido: Number.NaN }];
    if (valorDeferido + valorIndeferido <= 0) return [];
    return [{ item_id: itemId, valor_deferido: valorDeferido, valor_indeferido: valorIndeferido }];
  });

  if (!itens.length) return { status: "error", code: "itens", message: "Informe ao menos um item com valor deferido ou indeferido." };
  if (itens.some((item) => !Number.isFinite(item.valor_deferido) || !Number.isFinite(item.valor_indeferido))) {
    return { status: "error", code: "valor", message: "Revise os valores deferidos e indeferidos." };
  }

  const { supabase } = await getAssistencialContext();
  const retornoEm = text(formData, "retorno_em");
  const { data, error } = await supabase.rpc("registrar_retorno_recurso_glosa_transacional", {
    p_recurso_id: recursoId,
    p_protocolo_operadora: text(formData, "protocolo_operadora") || null,
    p_retorno_em: retornoEm ? new Date(retornoEm).toISOString() : null,
    p_itens: itens,
    p_observacao: text(formData, "observacao") || null,
    p_origem: "manual",
  });

  if (error) {
    const [code, message] = retornoMessage(error.message);
    console.error("[tiss.recurso.background] registrar retorno", { code: error.code, category: code });
    return { status: "error", code, message };
  }

  revalidatePath("/faturamento");
  revalidatePath("/faturamento/glosas");
  revalidatePath("/faturamento/recursos");
  revalidatePath(`/faturamento/recursos/${recursoId}`);
  revalidatePath("/financeiro");
  revalidatePath("/financeiro/recebiveis");
  revalidatePath("/integracoes");

  return {
    status: "success",
    code: "retorno-registrado",
    message: "Retorno registrado. Glosa, recurso e recebível foram recalculados de forma transacional.",
    data: { retornoId: typeof data === "string" ? data : undefined },
  };
}
