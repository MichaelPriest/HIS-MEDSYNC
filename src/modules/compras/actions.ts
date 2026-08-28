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
const comprasRoute = "/compras";
const alcadasRoute = "/compras/alcadas";
const solicitacaoRoute = (id: string, suffix = "") => asRoute(`/compras/solicitacoes/${id}${suffix}`);
const cotacaoRoute = (id: string, suffix = "") => asRoute(`/compras/cotacoes/${id}${suffix}`);

function comprasErrorKey(error: unknown, fallback: string) {
  const value = error && typeof error === "object"
    ? `${String((error as { code?: unknown }).code ?? "")} ${String((error as { message?: unknown }).message ?? "")}`
    : String(error ?? "");
  const known: Array<[string, string]> = [
    ["COMPRAS_ALCADA_NAO_CONFIGURADA", "alcada-nao-configurada"],
    ["COMPRAS_APROVADOR_FORA_DA_ALCADA", "fora-da-alcada"],
    ["COMPRAS_SEGREGACAO_SOLICITANTE_APROVADOR", "segregacao"],
    ["COMPRAS_APROVADOR_JA_DECIDIU", "ja-decidiu"],
    ["COMPRAS_ALCADA_FAIXA_SOBREPOSTA", "faixa-sobreposta"],
    ["COMPRAS_ALCADA_PERFIL_SEM_PERMISSAO_APROVAR", "perfil-sem-aprovacao"],
    ["COMPRAS_ALCADA_SEM_PERFIS", "sem-perfis"],
    ["COMPRAS_VALOR_ALTERADO_APOS_APROVACAO", "valor-alterado"],
    ["COMPRAS_APROVACAO_INSUFICIENTE", "aprovacao-insuficiente"],
    ["COMPRAS_COTACAO_JA_CONVERTIDA_PEDIDO", "pedido-ja-emitido"],
  ];
  return known.find(([needle]) => value.includes(needle))?.[1] ?? fallback;
}

export async function criarSolicitacaoCompra(formData: FormData) {
  const { supabase, user, empresaId, unidadeId } = await requireAnyPermission(["compras.solicitar", "compras.gerenciar"]);
  const numero = `SC${new Date().toISOString().slice(2, 10).replaceAll("-", "")}${String(Date.now()).slice(-5)}`;
  const { data, error } = await supabase.from("compras_solicitacoes").insert({
    empresa_id: empresaId,
    unidade_id: unidadeId,
    numero,
    solicitante_id: user.id,
    setor: text(formData, "setor") || null,
    justificativa: text(formData, "justificativa") || null,
    prioridade: text(formData, "prioridade") || "normal",
    status: "solicitada",
  }).select("id").single();
  if (error || !data) redirect(asRoute(`${comprasRoute}?erro=solicitacao`));
  redirect(solicitacaoRoute(data.id));
}

export async function adicionarItemSolicitacaoCompra(formData: FormData) {
  const { supabase, empresaId, unidadeId } = await requireAnyPermission(["compras.solicitar", "compras.gerenciar"]);
  const solicitacaoId = text(formData, "solicitacao_id");
  const itemId = text(formData, "item_assistencial_id");
  const quantidade = decimal(text(formData, "quantidade"));
  if (!solicitacaoId || !itemId || quantidade <= 0) redirect(solicitacaoRoute(solicitacaoId || "invalida", "?erro=item"));

  const [{ data: solicitacao }, { data: item }] = await Promise.all([
    supabase.from("compras_solicitacoes").select("id,status").eq("id", solicitacaoId).eq("empresa_id", empresaId).eq("unidade_id", unidadeId).maybeSingle(),
    supabase.from("itens_assistenciais").select("id,codigo_interno,categoria,tabela_tiss_codigo,codigo_tuss,codigo_tabela_propria,descricao,unidade_medida,fabricante,apresentacao,codigo_anvisa,codigo_brasindice,codigo_simpro").eq("id", itemId).eq("empresa_id", empresaId).eq("ativo", true).maybeSingle(),
  ]);
  if (!solicitacao || !["rascunho", "solicitada", "aprovada"].includes(solicitacao.status)) redirect(solicitacaoRoute(solicitacaoId, "?erro=status"));
  if (!item || !["material", "medicamento", "opme", "gas_medicinal"].includes(item.categoria)) redirect(solicitacaoRoute(solicitacaoId, "?erro=item-catalogo"));

  const { data: produto } = await supabase.from("estoque_produtos").select("id").eq("empresa_id", empresaId).eq("item_assistencial_id", item.id).eq("ativo", true).limit(1).maybeSingle();
  const { data: existente } = await supabase.from("compras_solicitacao_itens").select("id").eq("solicitacao_id", solicitacaoId).eq("item_assistencial_id", item.id).maybeSingle();
  const payload = {
    produto_id: produto?.id ?? null,
    item_assistencial_id: item.id,
    categoria_item: item.categoria,
    codigo_interno: item.codigo_interno,
    tabela_tiss_codigo: item.tabela_tiss_codigo,
    codigo_tuss: item.codigo_tuss,
    codigo_tabela_propria: item.codigo_tabela_propria,
    codigo_brasindice: item.codigo_brasindice,
    codigo_simpro: item.codigo_simpro,
    codigo_anvisa: item.codigo_anvisa,
    fabricante: item.fabricante,
    apresentacao: item.apresentacao,
    descricao: item.descricao,
    quantidade,
    unidade_medida: item.unidade_medida || "UN",
    observacoes: text(formData, "observacoes") || null,
  };
  const result = existente
    ? await supabase.from("compras_solicitacao_itens").update(payload).eq("id", existente.id)
    : await supabase.from("compras_solicitacao_itens").insert({ solicitacao_id: solicitacaoId, ...payload });
  if (result.error) {
    console.error("[compras] adicionar item", { code: result.error.code });
    redirect(solicitacaoRoute(solicitacaoId, "?erro=salvar-item"));
  }
  revalidatePath(`/compras/solicitacoes/${solicitacaoId}`);
  revalidatePath(comprasRoute);
  redirect(solicitacaoRoute(solicitacaoId, "?sucesso=item"));
}

export async function removerItemSolicitacaoCompra(formData: FormData) {
  const { supabase, empresaId, unidadeId } = await requireAnyPermission(["compras.solicitar", "compras.gerenciar"]);
  const solicitacaoId = text(formData, "solicitacao_id");
  const itemId = text(formData, "item_id");
  if (!solicitacaoId || !itemId) redirect(asRoute(comprasRoute));
  const { data: solicitacao } = await supabase.from("compras_solicitacoes").select("id,status").eq("id", solicitacaoId).eq("empresa_id", empresaId).eq("unidade_id", unidadeId).maybeSingle();
  if (!solicitacao || !["rascunho", "solicitada", "aprovada"].includes(solicitacao.status)) redirect(solicitacaoRoute(solicitacaoId, "?erro=status"));
  const { error } = await supabase.from("compras_solicitacao_itens").delete().eq("id", itemId).eq("solicitacao_id", solicitacaoId);
  if (error) redirect(solicitacaoRoute(solicitacaoId, "?erro=remover"));
  revalidatePath(`/compras/solicitacoes/${solicitacaoId}`);
  revalidatePath(comprasRoute);
  redirect(solicitacaoRoute(solicitacaoId, "?sucesso=removido"));
}

export async function gerarCotacaoDaSolicitacao(formData: FormData) {
  const { supabase } = await requireAnyPermission(["compras.cotar", "compras.gerenciar"]);
  const solicitacaoId = text(formData, "solicitacao_id");
  if (!solicitacaoId) redirect(asRoute(`${comprasRoute}?erro=solicitacao`));
  const { data, error } = await supabase.rpc("gerar_cotacao_compra_catalogo", {
    p_solicitacao_id: solicitacaoId,
    p_validade: text(formData, "validade") || null,
    p_observacoes: text(formData, "observacoes") || null,
  });
  if (error || !data) {
    console.error("[compras] gerar cotacao", { code: error?.code });
    redirect(solicitacaoRoute(solicitacaoId, "?erro=cotacao"));
  }
  revalidatePath(comprasRoute);
  redirect(cotacaoRoute(String(data)));
}

export async function adicionarFornecedorCotacao(formData: FormData) {
  const { supabase } = await requireAnyPermission(["compras.cotar", "compras.gerenciar"]);
  const cotacaoId = text(formData, "cotacao_id");
  const fornecedorId = text(formData, "fornecedor_id");
  if (!cotacaoId || !fornecedorId) redirect(asRoute(comprasRoute));
  const { error } = await supabase.rpc("adicionar_fornecedor_cotacao_operacional", {
    p_cotacao_id: cotacaoId,
    p_fornecedor_id: fornecedorId,
    p_frete: decimal(text(formData, "frete")),
    p_prazo_entrega_dias: Number(text(formData, "prazo_entrega_dias") || 0) || null,
    p_condicao_pagamento: text(formData, "condicao_pagamento") || null,
    p_observacoes: text(formData, "observacoes") || null,
  });
  if (error) {
    console.error("[compras] adicionar fornecedor", { code: error.code });
    redirect(cotacaoRoute(cotacaoId, "?erro=fornecedor"));
  }
  revalidatePath(`/compras/cotacoes/${cotacaoId}`);
  revalidatePath(comprasRoute);
  redirect(cotacaoRoute(cotacaoId, "?sucesso=fornecedor"));
}

export async function salvarPropostaItemCotacao(formData: FormData) {
  const { supabase } = await requireAnyPermission(["compras.cotar", "compras.gerenciar"]);
  const cotacaoId = text(formData, "cotacao_id");
  const cotacaoItemId = text(formData, "cotacao_item_id");
  const fornecedorId = text(formData, "fornecedor_id");
  const valorUnitario = decimal(text(formData, "valor_unitario"));
  if (!cotacaoId || !cotacaoItemId || !fornecedorId || valorUnitario < 0) redirect(asRoute(comprasRoute));
  const quantidade = decimal(text(formData, "quantidade_ofertada"));
  const { error } = await supabase.rpc("salvar_proposta_item_cotacao", {
    p_cotacao_item_id: cotacaoItemId,
    p_fornecedor_id: fornecedorId,
    p_valor_unitario: valorUnitario,
    p_quantidade_ofertada: quantidade > 0 ? quantidade : null,
    p_marca: text(formData, "marca") || null,
    p_fabricante: text(formData, "fabricante") || null,
    p_codigo_anvisa: text(formData, "codigo_anvisa") || null,
    p_prazo_entrega_dias: Number(text(formData, "prazo_entrega_dias") || 0) || null,
    p_disponibilidade: text(formData, "disponibilidade") || "pronta_entrega",
    p_observacoes: text(formData, "observacoes") || null,
  });
  if (error) {
    console.error("[compras] salvar proposta item", { code: error.code });
    redirect(cotacaoRoute(cotacaoId, "?erro=proposta"));
  }
  revalidatePath(`/compras/cotacoes/${cotacaoId}`);
  revalidatePath(comprasRoute);
  redirect(cotacaoRoute(cotacaoId, "?sucesso=proposta"));
}

export async function salvarAlcadaCompra(formData: FormData) {
  const { supabase, empresaId, unidadeId } = await requireAnyPermission(["compras.gerenciar"]);
  const id = text(formData, "alcada_id") || null;
  const valorMaxRaw = text(formData, "valor_max");
  const perfis = formData.getAll("perfil_id").map((item) => String(item).trim()).filter(Boolean);
  const { error } = await supabase.rpc("salvar_alcada_compra_operacional", {
    p_id: id,
    p_empresa: empresaId,
    p_unidade: unidadeId,
    p_nome: text(formData, "nome"),
    p_valor_min: decimal(text(formData, "valor_min")),
    p_valor_max: valorMaxRaw ? decimal(valorMaxRaw) : null,
    p_aprovacoes_necessarias: Number(text(formData, "aprovacoes_necessarias") || 0),
    p_perfis: perfis,
    p_ativa: formData.has("ativa"),
  });
  if (error) {
    console.error("[compras] salvar alcada", { code: error.code });
    redirect(asRoute(`${alcadasRoute}?erro=${comprasErrorKey(error, "salvar")}`));
  }
  revalidatePath(alcadasRoute);
  revalidatePath(comprasRoute);
  redirect(asRoute(`${alcadasRoute}?sucesso=salva`));
}

export async function aprovarFornecedorCotacao(formData: FormData) {
  const { supabase } = await requireAnyPermission(["compras.aprovar"]);
  const cotacaoId = text(formData, "cotacao_id");
  const fornecedorId = text(formData, "fornecedor_id");
  if (!cotacaoId || !fornecedorId) redirect(asRoute(comprasRoute));
  const { error } = await supabase.rpc("aprovar_fornecedor_cotacao_operacional", { p_cotacao_id: cotacaoId, p_fornecedor_id: fornecedorId });
  if (error) {
    console.error("[compras] aprovar fornecedor", { code: error.code });
    redirect(cotacaoRoute(cotacaoId, `?erro=${comprasErrorKey(error, "aprovar")}`));
  }
  revalidatePath(`/compras/cotacoes/${cotacaoId}`);
  revalidatePath(comprasRoute);
  redirect(cotacaoRoute(cotacaoId, "?sucesso=aprovacao-registrada"));
}

export async function rejeitarCotacaoCompra(formData: FormData) {
  const { supabase } = await requireAnyPermission(["compras.aprovar"]);
  const cotacaoId = text(formData, "cotacao_id");
  if (!cotacaoId) redirect(asRoute(comprasRoute));
  const { error } = await supabase.rpc("rejeitar_cotacao_compra_operacional", {
    p_cotacao_id: cotacaoId,
    p_observacoes: text(formData, "observacoes"),
  });
  if (error) {
    console.error("[compras] rejeitar cotacao", { code: error.code });
    redirect(cotacaoRoute(cotacaoId, `?erro=${comprasErrorKey(error, "rejeitar")}`));
  }
  revalidatePath(`/compras/cotacoes/${cotacaoId}`);
  revalidatePath(comprasRoute);
  redirect(cotacaoRoute(cotacaoId, "?sucesso=rejeitada"));
}

export async function reiniciarAprovacaoCotacao(formData: FormData) {
  const { supabase } = await requireAnyPermission(["compras.gerenciar"]);
  const cotacaoId = text(formData, "cotacao_id");
  if (!cotacaoId) redirect(asRoute(comprasRoute));
  const { error } = await supabase.rpc("reiniciar_aprovacao_cotacao_operacional", {
    p_cotacao_id: cotacaoId,
    p_motivo: text(formData, "motivo"),
  });
  if (error) {
    console.error("[compras] reiniciar aprovacao", { code: error.code });
    redirect(cotacaoRoute(cotacaoId, `?erro=${comprasErrorKey(error, "reiniciar")}`));
  }
  revalidatePath(`/compras/cotacoes/${cotacaoId}`);
  revalidatePath(comprasRoute);
  redirect(cotacaoRoute(cotacaoId, "?sucesso=aprovacao-reiniciada"));
}

export async function gerarPedidoDaCotacao(formData: FormData) {
  const { supabase } = await requireAnyPermission(["compras.aprovar"]);
  const cotacaoId = text(formData, "cotacao_id");
  if (!cotacaoId) redirect(asRoute(comprasRoute));
  const { data, error } = await supabase.rpc("gerar_pedido_cotacao_aprovada", { p_cotacao_id: cotacaoId });
  if (error || !data) {
    console.error("[compras] gerar pedido", { code: error?.code });
    redirect(cotacaoRoute(cotacaoId, `?erro=${comprasErrorKey(error, "pedido")}`));
  }
  revalidatePath(comprasRoute);
  revalidatePath(`/compras/cotacoes/${cotacaoId}`);
  redirect(asRoute(`${comprasRoute}?pedido=${data}`));
}
