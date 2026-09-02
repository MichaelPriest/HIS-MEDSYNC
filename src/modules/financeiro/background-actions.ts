"use server";

import { revalidatePath } from "next/cache";
import type { BackgroundActionState } from "@/lib/actions/background-action";
import { getAssistencialContext } from "@/modules/assistencial/context";

export type ReceivableActionData = {
  kind: "receive" | "reconcile" | "reverse";
};

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function money(formData: FormData, key: string) {
  const raw = text(formData, key);
  if (!raw) return 0;
  const value = Number(raw.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(value) ? value : Number.NaN;
}

function moneyNullable(formData: FormData, key: string) {
  const raw = text(formData, key);
  if (!raw) return null;
  const value = Number(raw.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

function financeiroMessage(message?: string | null) {
  const value = String(message ?? "");
  if (value.includes("SEM_PERMISSAO") || value.includes("NAO_AUTENTICADO")) return ["permissao", "Seu perfil não possui permissão para esta operação financeira."] as const;
  if (value.includes("EXCEDE_SALDO")) return ["excede-saldo", "O valor da baixa excede o saldo restante do recebível."] as const;
  if (value.includes("COMPOSICAO_INVALIDA")) return ["composicao", "A baixa deve corresponder à soma do valor creditado, retenções e tarifas."] as const;
  if (value.includes("FORMA_INVALIDA")) return ["forma", "A forma de recebimento informada é inválida."] as const;
  if (value.includes("CANCELADO")) return ["cancelado", "O recebível está cancelado e não aceita novas baixas."] as const;
  if (value.includes("ESTORNADO")) return ["estornado", "Este recebimento já foi estornado."] as const;
  if (value.includes("MOTIVO_OBRIGATORIO")) return ["motivo", "Informe o motivo do estorno."] as const;
  if (value.includes("DADOS_INVALIDOS")) return ["dados", "Revise data e valores do recebimento."] as const;
  if (value.includes("NAO_LOCALIZADO")) return ["nao-localizado", "Registro financeiro não localizado no seu escopo."] as const;
  return ["operacao", "A operação financeira não pôde ser concluída."] as const;
}

function refresh(recebivelId: string) {
  revalidatePath("/financeiro");
  revalidatePath("/financeiro/recebiveis");
  revalidatePath(`/financeiro/recebiveis/${recebivelId}`);
  revalidatePath("/faturamento");
  revalidatePath("/integracoes");
}

export async function registrarRecebimentoFinanceiroBackground(
  recebivelId: string,
  _previous: BackgroundActionState<ReceivableActionData>,
  formData: FormData,
): Promise<BackgroundActionState<ReceivableActionData>> {
  const { supabase } = await getAssistencialContext();
  const data = text(formData, "data_recebimento");
  const valorBaixado = money(formData, "valor_baixado");
  const retencoes = money(formData, "valor_retencoes");
  const tarifas = money(formData, "valor_tarifas");
  const creditado = moneyNullable(formData, "valor_creditado");

  if (!data || !Number.isFinite(valorBaixado) || valorBaixado <= 0 || !Number.isFinite(retencoes) || !Number.isFinite(tarifas)) {
    return { status: "error", code: "dados", message: "Revise data e valores do recebimento." };
  }

  const { error } = await supabase.rpc("registrar_recebimento_financeiro_operacional", {
    p_recebivel_id: recebivelId,
    p_data_recebimento: data,
    p_valor_baixado: valorBaixado,
    p_valor_retencoes: retencoes,
    p_valor_tarifas: tarifas,
    p_valor_creditado: creditado,
    p_forma_recebimento: text(formData, "forma_recebimento") || "credito_bancario",
    p_referencia_bancaria: text(formData, "referencia_bancaria") || null,
    p_documento_operadora: text(formData, "documento_operadora") || null,
    p_observacoes: text(formData, "observacoes") || null,
  });

  if (error) {
    const [code, message] = financeiroMessage(error.message);
    console.error("[financeiro.background] registrar recebimento", { code: error.code, category: code });
    return { status: "error", code, message };
  }

  refresh(recebivelId);
  return {
    status: "success",
    code: "recebimento",
    message: "Recebimento registrado no ledger e saldo recalculado.",
    data: { kind: "receive" },
  };
}

export async function conciliarRecebimentoFinanceiroBackground(
  recebimentoId: string,
  recebivelId: string,
  _previous: BackgroundActionState<ReceivableActionData>,
  formData: FormData,
): Promise<BackgroundActionState<ReceivableActionData>> {
  const { supabase } = await getAssistencialContext();
  const { error } = await supabase.rpc("conciliar_recebimento_financeiro_operacional", {
    p_recebimento_id: recebimentoId,
    p_referencia_bancaria: text(formData, "referencia_bancaria") || null,
    p_observacoes: text(formData, "observacoes") || null,
  });

  if (error) {
    const [code, message] = financeiroMessage(error.message);
    console.error("[financeiro.background] conciliar recebimento", { code: error.code, category: code });
    return { status: "error", code, message };
  }

  refresh(recebivelId);
  return {
    status: "success",
    code: "conciliado",
    message: "Recebimento conciliado com rastreabilidade preservada.",
    data: { kind: "reconcile" },
  };
}

export async function estornarRecebimentoFinanceiroBackground(
  recebimentoId: string,
  recebivelId: string,
  _previous: BackgroundActionState<ReceivableActionData>,
  formData: FormData,
): Promise<BackgroundActionState<ReceivableActionData>> {
  const { supabase } = await getAssistencialContext();
  const motivo = text(formData, "motivo");
  if (!motivo) return { status: "error", code: "motivo", message: "Informe o motivo do estorno." };

  const { error } = await supabase.rpc("estornar_recebimento_financeiro_operacional", {
    p_recebimento_id: recebimentoId,
    p_motivo: motivo,
  });

  if (error) {
    const [code, message] = financeiroMessage(error.message);
    console.error("[financeiro.background] estornar recebimento", { code: error.code, category: code });
    return { status: "error", code, message };
  }

  refresh(recebivelId);
  return {
    status: "success",
    code: "estornado",
    message: "Recebimento estornado sem apagar a baixa original do ledger.",
    data: { kind: "reverse" },
  };
}
