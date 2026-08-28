"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAssistencialContext } from "@/modules/assistencial/context";

function text(fd: FormData, key: string) {
  const value = String(fd.get(key) ?? "").trim();
  return value || null;
}

function numberValue(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim().replace(",", ".");
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function go(url: string): never {
  redirect(url as Route);
}

function errorUrl(base: string, error: { message?: string | null }) {
  return `${base}?erro=${encodeURIComponent(error.message || "operacao")}`;
}

export async function movimentarEstoqueOperacionalAction(fd: FormData) {
  const { supabase } = await getAssistencialContext();
  const loteId = text(fd, "lote_id");
  const tipo = text(fd, "tipo") ?? "saida";
  const quantidade = numberValue(fd.get("quantidade"));
  if (!loteId || !quantidade || quantidade <= 0) go("/almoxarifado?erro=campos");

  const { error } = await supabase.rpc("movimentar_estoque_operacional", {
    p_lote_id: loteId,
    p_tipo: tipo,
    p_quantidade: quantidade,
    p_local_destino_id: text(fd, "local_destino_id"),
    p_atendimento_id: text(fd, "atendimento_id"),
    p_motivo: text(fd, "motivo"),
  });

  if (error) {
    console.error("[estoque] movimentar", { code: error.code, message: error.message });
    go(errorUrl("/almoxarifado", error));
  }
  revalidatePath("/almoxarifado");
  revalidatePath("/almoxarifado/reposicao");
  go("/almoxarifado?sucesso=movimento_registrado");
}

export async function abrirInventarioEstoqueAction(fd: FormData) {
  const { supabase } = await getAssistencialContext();
  const localId = text(fd, "local_id");
  if (!localId) go("/almoxarifado/inventarios?erro=local");

  const { data, error } = await supabase.rpc("abrir_inventario_estoque", {
    p_local_id: localId,
    p_motivo: text(fd, "motivo"),
  });
  if (error || !data) {
    console.error("[estoque] abrir inventario", { code: error?.code, message: error?.message });
    go(errorUrl("/almoxarifado/inventarios", error ?? { message: "inventario" }));
  }
  revalidatePath("/almoxarifado/inventarios");
  go(`/almoxarifado/inventarios/${data}`);
}

export async function registrarContagemInventarioAction(fd: FormData) {
  const { supabase } = await getAssistencialContext();
  const inventarioId = text(fd, "inventario_id");
  if (!inventarioId) go("/almoxarifado/inventarios?erro=inventario");

  const ids = fd.getAll("item_id");
  const quantidades = fd.getAll("quantidade_contada");
  const observacoes = fd.getAll("observacoes");
  const itens = ids.map((id, index) => ({
    item_id: String(id),
    quantidade_contada: numberValue(quantidades[index]),
    observacoes: String(observacoes[index] ?? "").trim() || null,
  })).filter((item) => item.item_id && item.quantidade_contada !== null && item.quantidade_contada >= 0);

  if (!itens.length) go(`/almoxarifado/inventarios/${inventarioId}?erro=contagem`);
  const { error } = await supabase.rpc("registrar_contagem_inventario_estoque", {
    p_inventario_id: inventarioId,
    p_itens: itens,
  });
  if (error) {
    console.error("[estoque] registrar contagem", { code: error.code, message: error.message });
    go(errorUrl(`/almoxarifado/inventarios/${inventarioId}`, error));
  }
  revalidatePath(`/almoxarifado/inventarios/${inventarioId}`);
  revalidatePath("/almoxarifado/inventarios");
  go(`/almoxarifado/inventarios/${inventarioId}?sucesso=contagem_salva`);
}

export async function concluirInventarioEstoqueAction(fd: FormData) {
  const { supabase } = await getAssistencialContext();
  const inventarioId = text(fd, "inventario_id");
  if (!inventarioId) go("/almoxarifado/inventarios?erro=inventario");

  const { data, error } = await supabase.rpc("concluir_inventario_estoque", {
    p_inventario_id: inventarioId,
    p_observacoes: text(fd, "observacoes_finais"),
  });
  if (error) {
    console.error("[estoque] concluir inventario", { code: error.code, message: error.message });
    go(errorUrl(`/almoxarifado/inventarios/${inventarioId}`, error));
  }
  revalidatePath("/almoxarifado");
  revalidatePath("/almoxarifado/inventarios");
  revalidatePath("/almoxarifado/reposicao");
  go(`/almoxarifado/inventarios/${inventarioId}?sucesso=conciliado&ajustes=${encodeURIComponent(String(data ?? 0))}`);
}

export async function cancelarInventarioEstoqueAction(fd: FormData) {
  const { supabase } = await getAssistencialContext();
  const inventarioId = text(fd, "inventario_id");
  const motivo = text(fd, "motivo_cancelamento");
  if (!inventarioId || !motivo) go(`/almoxarifado/inventarios/${inventarioId ?? ""}?erro=motivo_cancelamento`);

  const { error } = await supabase.rpc("cancelar_inventario_estoque", {
    p_inventario_id: inventarioId,
    p_motivo: motivo,
  });
  if (error) {
    console.error("[estoque] cancelar inventario", { code: error.code, message: error.message });
    go(errorUrl(`/almoxarifado/inventarios/${inventarioId}`, error));
  }
  revalidatePath("/almoxarifado/inventarios");
  go(`/almoxarifado/inventarios/${inventarioId}?sucesso=cancelado`);
}

export async function configurarParametroReposicaoAction(fd: FormData) {
  const { supabase } = await getAssistencialContext();
  const localId = text(fd, "local_id");
  const produtoId = text(fd, "produto_id");
  const minimo = numberValue(fd.get("estoque_minimo"));
  const ponto = numberValue(fd.get("ponto_reposicao"));
  const maximo = numberValue(fd.get("estoque_maximo"));
  if (!localId || !produtoId || minimo === null || ponto === null || maximo === null) go("/almoxarifado/reposicao?erro=parametros");

  const { error } = await supabase.rpc("configurar_parametro_reposicao_estoque", {
    p_local_id: localId,
    p_produto_id: produtoId,
    p_estoque_minimo: minimo,
    p_ponto_reposicao: ponto,
    p_estoque_maximo: maximo,
  });
  if (error) {
    console.error("[estoque] configurar reposicao", { code: error.code, message: error.message });
    go(errorUrl("/almoxarifado/reposicao", error));
  }
  revalidatePath("/almoxarifado/reposicao");
  go("/almoxarifado/reposicao?sucesso=parametro_salvo");
}

export async function gerarRequisicaoReposicaoAction(fd: FormData) {
  const { supabase } = await getAssistencialContext();
  const localId = text(fd, "local_destino_id");
  if (!localId) go("/almoxarifado/reposicao?erro=local");

  const produtos = fd.getAll("produto_id");
  const quantidades = fd.getAll("quantidade");
  const itens = produtos.map((produto, index) => ({
    produto_id: String(produto),
    quantidade: numberValue(quantidades[index]),
  })).filter((item) => item.produto_id && item.quantidade !== null && item.quantidade > 0);
  if (!itens.length) go("/almoxarifado/reposicao?erro=itens");

  const { data, error } = await supabase.rpc("gerar_requisicao_reposicao_estoque", {
    p_local_destino_id: localId,
    p_itens: itens,
    p_justificativa: text(fd, "justificativa"),
  });
  if (error) {
    console.error("[estoque] gerar reposicao", { code: error.code, message: error.message });
    go(errorUrl("/almoxarifado/reposicao", error));
  }
  revalidatePath("/almoxarifado/reposicao");
  revalidatePath("/almoxarifado/requisicoes");
  go(`/almoxarifado/requisicoes?sucesso=reposicao_gerada&id=${encodeURIComponent(String(data ?? ""))}`);
}
