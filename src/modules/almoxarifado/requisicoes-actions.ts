"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAssistencialContext } from "@/modules/assistencial/context";

function text(fd: FormData, key: string) {
  const value = String(fd.get(key) ?? "").trim();
  return value || null;
}

function numberValue(fd: FormData, key: string) {
  const raw = text(fd, key);
  if (!raw) return null;
  const value = Number(raw.replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

function go(url: string): never {
  redirect(url as Route);
}

export async function criarRequisicaoSetorialAction(fd: FormData) {
  const { supabase, empresaId, unidadeId } = await getAssistencialContext();
  const setorId = text(fd, "setor_id");
  const localDestinoId = text(fd, "local_destino_id");
  const prioridade = text(fd, "prioridade") ?? "normal";
  const justificativa = text(fd, "justificativa");
  if (!unidadeId || !localDestinoId) go("/almoxarifado/requisicoes?erro=escopo");

  const itens = Array.from({ length: 8 }, (_, index) => index + 1)
    .map((n) => ({
      produto_id: text(fd, `produto_${n}_id`),
      quantidade: numberValue(fd, `produto_${n}_quantidade`),
      unidade_medida: text(fd, `produto_${n}_unidade`),
      observacoes: text(fd, `produto_${n}_observacoes`),
    }))
    .filter((item) => item.produto_id && item.quantidade && item.quantidade > 0);

  if (!itens.length) go("/almoxarifado/requisicoes?erro=itens");

  const { data, error } = await supabase.rpc("criar_requisicao_setorial", {
    p_empresa_id: empresaId,
    p_unidade_id: unidadeId,
    p_setor_id: setorId,
    p_local_destino_id: localDestinoId,
    p_prioridade: prioridade,
    p_justificativa: justificativa,
    p_itens: itens,
  });

  if (error) {
    console.error("[almoxarifado] criar requisição", { code: error.code, message: error.message });
    go(`/almoxarifado/requisicoes?erro=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/almoxarifado");
  revalidatePath("/almoxarifado/requisicoes");
  go(`/almoxarifado/requisicoes?sucesso=criada&id=${encodeURIComponent(String(data ?? ""))}`);
}

export async function atenderItemRequisicaoSetorialAction(fd: FormData) {
  const { supabase } = await getAssistencialContext();
  const itemId = text(fd, "item_id");
  const loteId = text(fd, "estoque_lote_id");
  const quantidade = numberValue(fd, "quantidade");
  if (!itemId || !loteId || !quantidade || quantidade <= 0) go("/almoxarifado/requisicoes?erro=atendimento");

  const { error } = await supabase.rpc("atender_requisicao_setorial_item", {
    p_item_id: itemId,
    p_estoque_lote_id: loteId,
    p_quantidade: quantidade,
  });

  if (error) {
    console.error("[almoxarifado] atender item", { code: error.code, message: error.message });
    go(`/almoxarifado/requisicoes?erro=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/almoxarifado");
  revalidatePath("/almoxarifado/requisicoes");
  go("/almoxarifado/requisicoes?sucesso=item_atendido");
}

export async function receberRequisicaoSetorialAction(fd: FormData) {
  const { supabase } = await getAssistencialContext();
  const requisicaoId = text(fd, "requisicao_id");
  if (!requisicaoId) go("/almoxarifado/requisicoes?erro=requisicao");

  const { error } = await supabase.rpc("receber_requisicao_setorial", {
    p_requisicao_id: requisicaoId,
  });

  if (error) {
    console.error("[almoxarifado] receber requisição", { code: error.code, message: error.message });
    go(`/almoxarifado/requisicoes?erro=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/almoxarifado");
  revalidatePath("/almoxarifado/requisicoes");
  go("/almoxarifado/requisicoes?sucesso=recebida");
}
