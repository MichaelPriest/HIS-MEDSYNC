"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { asRoute } from "@/lib/route-cast";
import { requireAnyPermission } from "@/lib/permissions/server";

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const decimal = (value: string) => {
  const raw = value.trim();
  if (!raw) return 0;
  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};
const pedidoRoute = (id: string, suffix = "") => asRoute(`/compras/pedidos/${id}${suffix}`);

export async function receberPedidoCompra(formData: FormData) {
  const { supabase } = await requireAnyPermission(["compras.receber", "compras.gerenciar"]);
  const pedidoId = text(formData, "pedido_id");
  if (!pedidoId) redirect(asRoute("/compras?erro=pedido"));

  const ids = formData.getAll("pedido_item_id").map((value) => String(value));
  const quantidades = formData.getAll("quantidade").map((value) => String(value));
  const locais = formData.getAll("local_estoque_id").map((value) => String(value));
  const lotes = formData.getAll("numero_lote").map((value) => String(value));
  const validades = formData.getAll("validade").map((value) => String(value));
  const valores = formData.getAll("valor_unitario").map((value) => String(value));
  const divergencias = formData.getAll("divergencia_observacao").map((value) => String(value));

  const itens = ids
    .map((pedidoItemId, index) => ({
      pedido_item_id: pedidoItemId,
      quantidade: decimal(quantidades[index] ?? "0"),
      local_estoque_id: (locais[index] ?? "").trim() || null,
      numero_lote: (lotes[index] ?? "").trim() || null,
      validade: (validades[index] ?? "").trim() || null,
      valor_unitario: decimal(valores[index] ?? "0"),
      divergencia_observacao: (divergencias[index] ?? "").trim() || null,
    }))
    .filter((item) => item.pedido_item_id && item.quantidade > 0);

  if (!itens.length) redirect(pedidoRoute(pedidoId, "?erro=itens"));
  if (itens.some((item) => !item.local_estoque_id)) redirect(pedidoRoute(pedidoId, "?erro=local"));

  const valorDocumentoRaw = text(formData, "valor_documento");
  const { data, error } = await supabase.rpc("receber_pedido_compra_operacional", {
    p_pedido_id: pedidoId,
    p_itens: itens,
    p_numero_documento: text(formData, "numero_documento") || null,
    p_serie_documento: text(formData, "serie_documento") || null,
    p_data_emissao: text(formData, "data_emissao") || null,
    p_vencimento: text(formData, "vencimento") || null,
    p_valor_documento: valorDocumentoRaw ? decimal(valorDocumentoRaw) : null,
    p_observacoes: text(formData, "observacoes") || null,
  });

  if (error || !data) {
    console.error("[compras] receber pedido", { code: error?.code, message: error?.message });
    redirect(pedidoRoute(pedidoId, `?erro=${encodeURIComponent(error?.message || "recebimento")}`));
  }

  revalidatePath("/compras");
  revalidatePath(`/compras/pedidos/${pedidoId}`);
  revalidatePath("/almoxarifado");
  revalidatePath("/financeiro");
  redirect(pedidoRoute(pedidoId, `?recebimento=${encodeURIComponent(String(data))}`));
}
