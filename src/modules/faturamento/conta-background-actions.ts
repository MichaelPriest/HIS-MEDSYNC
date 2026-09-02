"use server";

import { revalidatePath } from "next/cache";
import type { BackgroundActionState } from "@/lib/actions/background-action";
import { requirePermission } from "@/lib/permissions/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type BillingAccountActionData = {
  kind: "summary" | "sync" | "reprice" | "validate" | "delete-item";
  itemId?: string;
};

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function decimal(formData: FormData, key: string, fallback = 0) {
  const raw = text(formData, key);
  if (!raw) return fallback;
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : fallback;
}

function accountMessage(message = "") {
  if (message.includes("FAT_CONTA_COM_GUIA_TISS_ATIVA")) return ["guia-tiss-ativa", "A conta possui Guia TISS ativa e não aceita esta alteração."] as const;
  if (message.includes("FAT_CONTA_NAO_EDITAVEL")) return ["conta-nao-editavel", "A conta não está mais editável nesta etapa."] as const;
  if (message.includes("FAT_ITEM_SEM_PERMISSAO") || message.includes("FAT_CONTA_SEM_PERMISSAO") || message.includes("SEM_PERMISSAO")) return ["acesso-negado", "Seu perfil não possui permissão para esta operação."] as const;
  if (message.includes("FAT_DESCONTO_MAIOR_QUE_BRUTO")) return ["desconto-invalido", "O desconto não pode ser maior que o valor bruto da conta."] as const;
  return ["operacao", "Não foi possível concluir a operação na conta."] as const;
}

function refreshAccount(contaId: string) {
  revalidatePath("/faturamento");
  revalidatePath(`/faturamento/${contaId}`);
  revalidatePath(`/faturamento/${contaId}/lancamentos`);
  revalidatePath(`/faturamento/${contaId}/catalogo`);
}

export async function atualizarResumoContaBackground(
  contaId: string,
  _previous: BackgroundActionState<BillingAccountActionData>,
  formData: FormData,
): Promise<BackgroundActionState<BillingAccountActionData>> {
  void _previous;
  if (!UUID.test(contaId)) return { status: "error", code: "conta", message: "Conta inválida." };
  const { supabase } = await requirePermission("faturamento.criar");
  const competencia = text(formData, "competencia");
  const desconto = decimal(formData, "valor_desconto", 0);
  if (!/^\d{4}-\d{2}$/.test(competencia) || desconto < 0) {
    return { status: "error", code: "dados", message: "Revise competência e desconto." };
  }

  const { error } = await supabase.rpc("atualizar_resumo_conta_faturamento", {
    p_conta_id: contaId,
    p_competencia: competencia,
    p_valor_desconto: desconto,
  });
  if (error) {
    const [code, message] = accountMessage(error.message);
    return { status: "error", code, message };
  }
  refreshAccount(contaId);
  return { status: "success", code: "resumo-atualizado", message: "Competência e desconto atualizados.", data: { kind: "summary" } };
}

export async function sincronizarProducaoContaBackground(
  contaId: string,
  _previous: BackgroundActionState<BillingAccountActionData>,
  _formData: FormData,
): Promise<BackgroundActionState<BillingAccountActionData>> {
  void _previous;
  void _formData;
  if (!UUID.test(contaId)) return { status: "error", code: "conta", message: "Conta inválida." };
  const { supabase, empresaId, unidadeId } = await requirePermission("producao.reprocessar");
  const { data: conta } = await supabase
    .from("contas_faturamento")
    .select("atendimento_id")
    .eq("id", contaId)
    .eq("empresa_id", empresaId)
    .eq("unidade_id", unidadeId)
    .maybeSingle();
  if (!conta) return { status: "error", code: "conta", message: "Conta não localizada no seu escopo." };

  const { count: guiasAtivas } = await supabase
    .from("tiss_guias")
    .select("id", { count: "exact", head: true })
    .eq("conta_id", contaId)
    .neq("status", "cancelada");
  if ((guiasAtivas ?? 0) > 0) {
    return { status: "error", code: "guia-tiss-ativa", message: "Cancele ou trate a Guia TISS ativa antes de sincronizar novamente a produção." };
  }

  const { error } = await supabase.rpc("sincronizar_producao_atendimento", { p_atendimento_id: conta.atendimento_id });
  if (error) return { status: "error", code: "sincronizacao-producao", message: "Não foi possível sincronizar a produção assistencial." };

  refreshAccount(contaId);
  revalidatePath("/faturamento/producao");
  return { status: "success", code: "producao-sincronizada", message: "Produção assistencial sincronizada com a conta.", data: { kind: "sync" } };
}

export async function recalcularPrecosContaBackground(
  contaId: string,
  _previous: BackgroundActionState<BillingAccountActionData>,
  _formData: FormData,
): Promise<BackgroundActionState<BillingAccountActionData>> {
  void _previous;
  void _formData;
  if (!UUID.test(contaId)) return { status: "error", code: "conta", message: "Conta inválida." };
  const { supabase } = await requirePermission("faturamento.criar");
  const { count: guiasAtivas } = await supabase
    .from("tiss_guias")
    .select("id", { count: "exact", head: true })
    .eq("conta_id", contaId)
    .neq("status", "cancelada");
  if ((guiasAtivas ?? 0) > 0) {
    return { status: "error", code: "guia-tiss-ativa", message: "A conta possui Guia TISS ativa. Os preços não podem ser recalculados nesta etapa." };
  }

  const { error } = await supabase.rpc("recalcular_conta_contratual_avancada", { p_conta_id: contaId });
  if (error) return { status: "error", code: "recalculo-contratual", message: "Não foi possível recalcular os valores contratuais da conta." };
  refreshAccount(contaId);
  return { status: "success", code: "precos-recalculados", message: "Regras contratuais recalculadas.", data: { kind: "reprice" } };
}

export async function validarContaTissBackground(
  contaId: string,
  _previous: BackgroundActionState<BillingAccountActionData>,
  _formData: FormData,
): Promise<BackgroundActionState<BillingAccountActionData>> {
  void _previous;
  void _formData;
  if (!UUID.test(contaId)) return { status: "error", code: "conta", message: "Conta inválida." };
  const { supabase } = await requirePermission("faturamento.criar");
  const { error } = await supabase.rpc("validar_conta_tiss", { p_conta_id: contaId });
  if (error) return { status: "error", code: "validacao-tiss", message: "Não foi possível executar a validação TISS da conta." };
  refreshAccount(contaId);
  return { status: "success", code: "conta-validada", message: "Validação TISS executada. Revise as críticas atualizadas.", data: { kind: "validate" } };
}

export async function excluirLancamentoContaBackground(
  contaId: string,
  _previous: BackgroundActionState<BillingAccountActionData>,
  formData: FormData,
): Promise<BackgroundActionState<BillingAccountActionData>> {
  void _previous;
  const itemId = text(formData, "item_id");
  if (!UUID.test(contaId) || !UUID.test(itemId)) return { status: "error", code: "item-invalido", message: "Lançamento inválido." };
  const { supabase } = await requirePermission("faturamento.criar");
  const { error } = await supabase.rpc("excluir_item_conta_faturamento", { p_conta_id: contaId, p_item_id: itemId });
  if (error) {
    const [code, message] = accountMessage(error.message);
    return { status: "error", code, message };
  }
  refreshAccount(contaId);
  return { status: "success", code: "item-excluido", message: "Lançamento excluído e totais recalculados.", data: { kind: "delete-item", itemId } };
}
