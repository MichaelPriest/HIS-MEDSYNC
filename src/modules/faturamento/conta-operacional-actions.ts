"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/permissions/server";
import { saveBillingAccountItem } from "@/modules/faturamento/conta-item-service";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function erroLancamento(message = "") {
  if (message.includes("FAT_CONTA_COM_GUIA_TISS_ATIVA")) return "guia-tiss-ativa";
  if (message.includes("FAT_CONTA_NAO_EDITAVEL")) return "conta-nao-editavel";
  if (message.includes("FAT_ITEM_SEM_PERMISSAO") || message.includes("FAT_CONTA_SEM_PERMISSAO")) return "acesso-negado";
  if (message.includes("FAT_ITEM_QUANTIDADE_INVALIDA")) return "quantidade-invalida";
  if (message.includes("FAT_ITEM_VALOR_INVALIDO")) return "valor-invalido";
  if (message.includes("FAT_ITEM_PERCENTUAL_INVALIDO")) return "percentual-invalido";
  if (message.includes("FAT_DESCONTO_MAIOR_QUE_BRUTO")) return "desconto-invalido";
  return "lancamento";
}

/**
 * Wrapper legado mantido para rotas ainda não migradas. O cálculo e a persistência
 * já vivem no serviço único usado também pelo fluxo de background save.
 */
export async function salvarLancamentoConta(contaId: string, formData: FormData) {
  const result = await saveBillingAccountItem(contaId, formData);
  if (!result.ok) redirect(`/faturamento/${contaId}?erro=${result.code}#lancamentos`);
  revalidatePath(`/faturamento/${contaId}`);
  revalidatePath(`/faturamento/${contaId}/catalogo`);
  redirect(`/faturamento/${contaId}?sucesso=${result.mode === "updated" ? "item-atualizado" : "item-adicionado"}#lancamentos`);
}

export async function excluirLancamentoConta(contaId: string, formData: FormData) {
  const { supabase } = await requirePermission("faturamento.criar");
  const itemId = text(formData, "item_id");
  if (!UUID.test(contaId) || !UUID.test(itemId)) redirect(`/faturamento/${contaId}?erro=item-invalido`);
  const { error } = await supabase.rpc("excluir_item_conta_faturamento", { p_conta_id: contaId, p_item_id: itemId });
  if (error) redirect(`/faturamento/${contaId}?erro=${erroLancamento(error.message)}`);
  revalidatePath(`/faturamento/${contaId}`);
  redirect(`/faturamento/${contaId}?sucesso=item-excluido#lancamentos`);
}

export async function atualizarResumoConta(contaId: string, formData: FormData) {
  const { supabase } = await requirePermission("faturamento.criar");
  const competencia = text(formData, "competencia");
  const desconto = decimal(formData, "valor_desconto", 0);
  const { error } = await supabase.rpc("atualizar_resumo_conta_faturamento", {
    p_conta_id: contaId,
    p_competencia: competencia,
    p_valor_desconto: desconto,
  });
  if (error) redirect(`/faturamento/${contaId}?erro=${erroLancamento(error.message)}`);
  revalidatePath(`/faturamento/${contaId}`);
  redirect(`/faturamento/${contaId}?sucesso=resumo-atualizado#conta`);
}

export async function sincronizarProducaoConta(contaId: string) {
  const { supabase, empresaId, unidadeId } = await requirePermission("producao.reprocessar");
  const { data: conta } = await supabase.from("contas_faturamento").select("atendimento_id").eq("id", contaId).eq("empresa_id", empresaId).eq("unidade_id", unidadeId).maybeSingle();
  if (!conta) redirect("/faturamento?erro=conta");
  const { count: guiasAtivas } = await supabase.from("tiss_guias").select("id", { count: "exact", head: true }).eq("conta_id", contaId).neq("status", "cancelada");
  if ((guiasAtivas ?? 0) > 0) redirect(`/faturamento/${contaId}?erro=guia-tiss-ativa#producao`);
  const { error } = await supabase.rpc("sincronizar_producao_atendimento", { p_atendimento_id: conta.atendimento_id });
  if (error) redirect(`/faturamento/${contaId}?erro=sincronizacao-producao`);
  revalidatePath(`/faturamento/${contaId}`);
  revalidatePath("/faturamento/producao");
  redirect(`/faturamento/${contaId}?sucesso=producao-sincronizada#producao`);
}

export async function recalcularPrecosConta(contaId: string) {
  const { supabase } = await requirePermission("faturamento.criar");
  const { count: guiasAtivas } = await supabase.from("tiss_guias").select("id", { count: "exact", head: true }).eq("conta_id", contaId).neq("status", "cancelada");
  if ((guiasAtivas ?? 0) > 0) redirect(`/faturamento/${contaId}?erro=guia-tiss-ativa#lancamentos`);
  const { error } = await supabase.rpc("recalcular_conta_contratual_avancada", { p_conta_id: contaId });
  if (error) redirect(`/faturamento/${contaId}?erro=recalculo-contratual`);
  revalidatePath(`/faturamento/${contaId}`);
  redirect(`/faturamento/${contaId}?sucesso=precos-recalculados#lancamentos`);
}

export async function validarContaTissOperacional(contaId: string) {
  const { supabase } = await requirePermission("faturamento.criar");
  const { error } = await supabase.rpc("validar_conta_tiss", { p_conta_id: contaId });
  if (error) redirect(`/faturamento/${contaId}?erro=validacao-tiss`);
  revalidatePath(`/faturamento/${contaId}`);
  redirect(`/faturamento/${contaId}?sucesso=conta-validada#criticas`);
}
