"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/permissions/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PrecoComercial = {
  valor: number;
  metodologia: string;
  edicao_id: string | null;
  item_id: string | null;
  memoria: Record<string, unknown>;
};

function text(fd: FormData, key: string) {
  return String(fd.get(key) ?? "").trim();
}

function decimal(fd: FormData, key: string, fallback = 0) {
  const raw = text(fd, key);
  if (!raw) return fallback;
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : fallback;
}

function checked(fd: FormData, key: string) {
  return fd.get(key) === "on" || fd.get(key) === "true";
}

function origemPorCategoria(categoria: string) {
  if (["medicamento", "material", "opme", "gas_medicinal", "pacote", "taxa", "diaria", "procedimento"].includes(categoria)) return categoria;
  return "outro";
}

function categoriaContrato(categoria: string) {
  if (categoria === "medicamento") return "medicamentos";
  if (categoria === "material") return "materiais";
  if (categoria === "opme") return "opme";
  if (categoria === "gas_medicinal") return "gases";
  if (categoria === "pacote") return "pacotes";
  if (categoria === "taxa") return "taxas";
  if (categoria === "diaria") return "diarias";
  return "procedimentos";
}

function erroLancamento(message = "") {
  if (message.includes("FAT_CONTA_COM_GUIA_TISS_ATIVA")) return "guia-tiss-ativa";
  if (message.includes("FAT_CONTA_NAO_EDITAVEL")) return "conta-nao-editavel";
  if (message.includes("FAT_ITEM_SEM_PERMISSAO")) return "acesso-negado";
  if (message.includes("FAT_ITEM_QUANTIDADE_INVALIDA")) return "quantidade-invalida";
  if (message.includes("FAT_ITEM_VALOR_INVALIDO")) return "valor-invalido";
  if (message.includes("FAT_ITEM_PERCENTUAL_INVALIDO")) return "percentual-invalido";
  if (message.includes("FAT_DESCONTO_MAIOR_QUE_BRUTO")) return "desconto-invalido";
  return "lancamento";
}

export async function salvarLancamentoConta(contaId: string, formData: FormData) {
  const { supabase, empresaId } = await requirePermission("faturamento.criar");
  if (!UUID.test(contaId)) redirect("/faturamento?erro=conta");

  const itemId = text(formData, "item_id") || null;
  const itemAssistencialId = text(formData, "item_assistencial_id") || null;
  if (itemId && !UUID.test(itemId)) redirect(`/faturamento/${contaId}?erro=item-invalido`);
  if (itemAssistencialId && !UUID.test(itemAssistencialId)) redirect(`/faturamento/${contaId}?erro=item-catalogo`);

  const { data: conta } = await supabase
    .from("contas_faturamento")
    .select("id,empresa_id,convenio_id")
    .eq("id", contaId)
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (!conta) redirect("/faturamento?erro=conta");

  let origemTipo = text(formData, "origem_tipo") || "procedimento";
  let tabela = text(formData, "tabela") || null;
  let codigo = text(formData, "codigo") || null;
  let descricao = text(formData, "descricao");
  let valorUnitario = decimal(formData, "valor_unitario", 0);

  if (!itemId && itemAssistencialId) {
    const { data: master } = await supabase
      .from("itens_assistenciais")
      .select("id,categoria,tabela_tiss_codigo,codigo_tuss,codigo_tabela_propria,descricao")
      .eq("id", itemAssistencialId)
      .eq("empresa_id", empresaId)
      .eq("ativo", true)
      .maybeSingle();
    if (!master) redirect(`/faturamento/${contaId}?erro=item-catalogo`);
    origemTipo = origemPorCategoria(master.categoria);
    tabela = master.tabela_tiss_codigo;
    codigo = ["00", "98"].includes(master.tabela_tiss_codigo) ? master.codigo_tabela_propria : master.codigo_tuss;
    descricao = master.descricao;
    if (!codigo) redirect(`/faturamento/${contaId}?erro=codigo-tiss`);

    if (valorUnitario === 0 && conta.convenio_id) {
      const dataExecucao = text(formData, "data_execucao") || new Date().toISOString();
      const { data: precos, error: precoError } = await supabase.rpc("obter_valor_item_comercial", {
        p_convenio_id: conta.convenio_id,
        p_item_assistencial_id: master.id,
        p_codigo: codigo,
        p_data: dataExecucao.slice(0, 10),
        p_categoria: categoriaContrato(master.categoria),
      });
      const lista = Array.isArray(precos) ? (precos as unknown as PrecoComercial[]) : [];
      if (!precoError && lista[0]?.valor !== undefined) valorUnitario = Number(lista[0].valor);
    }
  }

  const payload = {
    origem_tipo: origemTipo,
    data_execucao: text(formData, "data_execucao") || new Date().toISOString(),
    tabela,
    codigo,
    descricao,
    quantidade: decimal(formData, "quantidade", 1),
    valor_unitario: valorUnitario,
    percentual_reducao_acrescimo: decimal(formData, "percentual_reducao_acrescimo", 0),
    setor: text(formData, "setor"),
    cobravel: formData.has("cobravel") ? checked(formData, "cobravel") : true,
    observacao: text(formData, "observacao"),
    grupo_ato_id: text(formData, "grupo_ato_id"),
    sequencia_ato: text(formData, "sequencia_ato"),
    via_acesso: text(formData, "via_acesso"),
    urgencia: checked(formData, "urgencia"),
    horario_especial: checked(formData, "horario_especial"),
    acomodacao_individual: checked(formData, "acomodacao_individual"),
    anestesia: checked(formData, "anestesia"),
    numero_auxiliares: decimal(formData, "numero_auxiliares", 0),
    filme_m2: decimal(formData, "filme_m2", 0),
  };

  const { data: savedId, error } = await supabase.rpc("salvar_item_conta_faturamento", {
    p_conta_id: contaId,
    p_item_id: itemId,
    p_payload: payload,
  });
  if (error || !savedId) {
    console.error("[faturamento] falha ao salvar lançamento", { code: error?.code });
    redirect(`/faturamento/${contaId}?erro=${erroLancamento(error?.message)}`);
  }

  if (itemId && checked(formData, "recalcular_contrato")) {
    await supabase.rpc("recalcular_item_contratual_avancado", { p_item_id: itemId });
  }

  revalidatePath(`/faturamento/${contaId}`);
  revalidatePath(`/faturamento/${contaId}/catalogo`);
  redirect(`/faturamento/${contaId}?sucesso=${itemId ? "item-atualizado" : "item-adicionado"}#lancamentos`);
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
  const { error } = await supabase.rpc("sincronizar_producao_atendimento", { p_atendimento_id: conta.atendimento_id });
  if (error) redirect(`/faturamento/${contaId}?erro=sincronizacao-producao`);
  revalidatePath(`/faturamento/${contaId}`);
  revalidatePath("/faturamento/producao");
  redirect(`/faturamento/${contaId}?sucesso=producao-sincronizada#producao`);
}

export async function recalcularPrecosConta(contaId: string) {
  const { supabase } = await requirePermission("faturamento.criar");
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
