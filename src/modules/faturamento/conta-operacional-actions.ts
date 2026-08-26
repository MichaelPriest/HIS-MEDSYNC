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

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
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

function tabelaTissPorCategoria(categoria: string, possuiTuss: boolean) {
  if (categoria === "pacote") return "98";
  if (!possuiTuss) return "00";
  if (["diaria", "taxa", "gas_medicinal"].includes(categoria)) return "18";
  if (["material", "opme"].includes(categoria)) return "19";
  if (categoria === "medicamento") return "20";
  if (categoria === "procedimento") return "22";
  return "00";
}

function subgrupoPadrao(origemTipo: string, categoria: string | null) {
  if (origemTipo === "honorario") return "Honorários";
  if (["laboratorio", "imagem"].includes(origemTipo)) return "Exames";
  if (categoria === "procedimento") return "Procedimentos";
  if (categoria === "material") return "Materiais";
  if (categoria === "opme") return "OPME";
  if (categoria === "medicamento") return "Medicamentos";
  if (categoria === "gas_medicinal") return "Gases medicinais";
  if (categoria === "diaria") return "Diárias";
  if (categoria === "taxa") return "Taxas";
  if (categoria === "pacote") return "Pacotes";
  return "Outros";
}

function memoriaString(preco: PrecoComercial | null, key: string) {
  const value = preco?.memoria?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function erroLancamento(message = "") {
  if (message.includes("FAT_CONTA_COM_GUIA_TISS_ATIVA")) return "guia-tiss-ativa";
  if (message.includes("FAT_CONTA_NAO_EDITAVEL")) return "conta-nao-editavel";
  if (message.includes("FAT_ITEM_SEM_PERMISSAO") || message.includes("FAT_CONTA_SEM_PERMISSAO")) return "acesso-negado";
  if (message.includes("FAT_ITEM_QUANTIDADE_INVALIDA")) return "quantidade-invalida";
  if (message.includes("FAT_ITEM_VALOR_INVALIDO")) return "valor-invalido";
  if (message.includes("FAT_ITEM_PERCENTUAL_INVALIDO")) return "percentual-invalido";
  if (message.includes("FAT_ITEM_PARCIAL_PERIODO_INVALIDO")) return "parcial-invalida";
  if (message.includes("FAT_DESCONTO_MAIOR_QUE_BRUTO")) return "desconto-invalido";
  return "lancamento";
}

export async function salvarLancamentoConta(contaId: string, formData: FormData) {
  const { supabase, empresaId } = await requirePermission("faturamento.criar");
  if (!UUID.test(contaId)) redirect("/faturamento?erro=conta");

  const itemId = text(formData, "item_id") || null;
  const itemAssistencialInformado = text(formData, "item_assistencial_id") || null;
  const tabelaComercialItemId = text(formData, "tabela_comercial_item_id") || null;
  if (itemId && !UUID.test(itemId)) redirect(`/faturamento/${contaId}?erro=item-invalido`);
  if (itemAssistencialInformado && !UUID.test(itemAssistencialInformado)) redirect(`/faturamento/${contaId}?erro=item-catalogo`);
  if (tabelaComercialItemId && !UUID.test(tabelaComercialItemId)) redirect(`/faturamento/${contaId}?erro=item-catalogo`);

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
  let codigoPesquisa = codigo;
  let descricao = text(formData, "descricao");
  let valorUnitario = decimal(formData, "valor_unitario", 0);
  let categoriaItem: string | null = null;
  let familiaTuss: number | null = null;
  let itemAssistencialId = itemAssistencialInformado;
  let edicaoComercialSelecionadaId: string | null = null;
  let preco: PrecoComercial | null = null;

  if (!itemId && tabelaComercialItemId) {
    const { data: comercial } = await supabase
      .from("tabelas_comerciais_itens")
      .select("id,item_assistencial_id,categoria_item,tabela_tiss_codigo,familia_tuss,codigo,codigo_tuss,codigo_tabela_propria,descricao,edicao_id,edicao:tabelas_comerciais_edicoes(fonte:tabelas_comerciais_fontes(empresa_id,codigo,tipo))")
      .eq("id", tabelaComercialItemId)
      .eq("ativo", true)
      .maybeSingle();
    const edicao = one(comercial?.edicao ?? null);
    const fonte = one(edicao?.fonte ?? null);
    if (!comercial || !edicao || !fonte || fonte.empresa_id !== empresaId) redirect(`/faturamento/${contaId}?erro=item-catalogo`);

    itemAssistencialId = comercial.item_assistencial_id ?? null;
    categoriaItem = comercial.categoria_item;
    familiaTuss = comercial.familia_tuss;
    origemTipo = origemPorCategoria(comercial.categoria_item);
    descricao = comercial.descricao;
    codigoPesquisa = comercial.codigo;
    codigo = comercial.codigo_tuss ?? comercial.codigo_tabela_propria ?? comercial.codigo;
    tabela = comercial.tabela_tiss_codigo ?? tabelaTissPorCategoria(comercial.categoria_item, Boolean(comercial.codigo_tuss));
    edicaoComercialSelecionadaId = comercial.edicao_id;
  } else if (!itemId && itemAssistencialId) {
    const { data: master } = await supabase
      .from("itens_assistenciais")
      .select("id,categoria,tabela_tiss_codigo,familia_tuss,codigo_tuss,codigo_tabela_propria,descricao")
      .eq("id", itemAssistencialId)
      .eq("empresa_id", empresaId)
      .eq("ativo", true)
      .maybeSingle();
    if (!master) redirect(`/faturamento/${contaId}?erro=item-catalogo`);

    origemTipo = origemPorCategoria(master.categoria);
    tabela = master.tabela_tiss_codigo;
    codigo = ["00", "98"].includes(master.tabela_tiss_codigo) ? master.codigo_tabela_propria : master.codigo_tuss;
    codigoPesquisa = codigo;
    descricao = master.descricao;
    categoriaItem = master.categoria;
    familiaTuss = master.familia_tuss;
    if (!codigo) redirect(`/faturamento/${contaId}?erro=codigo-tiss`);
  }

  if (!itemId && conta.convenio_id && (itemAssistencialId || tabelaComercialItemId) && codigoPesquisa) {
    const dataExecucao = text(formData, "data_execucao") || new Date().toISOString();
    const categoria = categoriaContrato(categoriaItem ?? origemTipo);
    const { data: precos, error: precoError } = await supabase.rpc("obter_valor_item_comercial", {
      p_convenio_id: conta.convenio_id,
      p_item_assistencial_id: itemAssistencialId,
      p_codigo: codigoPesquisa,
      p_data: dataExecucao.slice(0, 10),
      p_categoria: categoria,
    });
    const lista = Array.isArray(precos) ? (precos as unknown as PrecoComercial[]) : [];
    if (!precoError) preco = lista[0] ?? null;
    if (preco && valorUnitario === 0) valorUnitario = Number(preco.valor);

    const tussResolvido = memoriaString(preco, "codigo_tuss");
    if (tabelaComercialItemId && categoriaItem) {
      if (tussResolvido) {
        codigo = tussResolvido;
        familiaTuss = familiaTuss ?? Number(tabelaTissPorCategoria(categoriaItem, true));
        tabela = tabelaTissPorCategoria(categoriaItem, true);
      } else {
        tabela = tabela || tabelaTissPorCategoria(categoriaItem, false);
      }
    }
  }

  const subgrupoItem = text(formData, "subgrupo_item") || subgrupoPadrao(origemTipo, categoriaItem);
  const payload = {
    origem_tipo: origemTipo,
    item_assistencial_id: itemAssistencialId ?? "",
    categoria_item: categoriaItem ?? "",
    familia_tuss: familiaTuss ?? "",
    data_execucao: text(formData, "data_execucao") || new Date().toISOString(),
    tabela,
    codigo,
    descricao,
    quantidade: decimal(formData, "quantidade", 1),
    valor_unitario: valorUnitario,
    percentual_reducao_acrescimo: decimal(formData, "percentual_reducao_acrescimo", 0),
    setor: text(formData, "setor"),
    setor_subgrupo: text(formData, "setor_subgrupo"),
    subgrupo_item: subgrupoItem,
    parcial_numero: text(formData, "parcial_numero"),
    parcial_inicio: text(formData, "parcial_inicio"),
    parcial_fim: text(formData, "parcial_fim"),
    cobravel: formData.has("cobravel_presente") ? checked(formData, "cobravel") : true,
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
    valor_referencia: preco?.valor ?? "",
    valor_contratual_calculado: preco?.valor ?? "",
    origem_valor: preco ? "tabela_comercial_contrato" : tabelaComercialItemId ? "tabela_comercial_manual" : itemAssistencialId ? "catalogo_mestre_manual" : "lancamento_manual",
    metodologia_preco: preco?.metodologia ?? "",
    tabela_comercial_edicao_id: preco?.edicao_id ?? edicaoComercialSelecionadaId ?? "",
    tabela_comercial_item_id: preco?.item_id ?? tabelaComercialItemId ?? "",
    memoria_calculo_comercial: preco?.memoria ?? {},
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
