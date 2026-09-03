import { requirePermission } from "@/lib/permissions/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PrecoComercial = {
  valor: number;
  metodologia: string;
  edicao_id: string | null;
  item_id: string | null;
  memoria: Record<string, unknown>;
};

export type BillingItemSaveResult =
  | { ok: true; itemId: string; mode: "created" | "updated" }
  | { ok: false; code: string; message: string };

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

function billingItemError(message = "") {
  if (message.includes("FAT_CONTA_COM_GUIA_TISS_ATIVA")) return { code: "guia-tiss-ativa", message: "A conta possui Guia TISS ativa e não aceita alteração de lançamentos." };
  if (message.includes("FAT_CONTA_NAO_EDITAVEL")) return { code: "conta-nao-editavel", message: "A conta não está mais editável nesta etapa." };
  if (message.includes("FAT_ITEM_SEM_PERMISSAO") || message.includes("FAT_CONTA_SEM_PERMISSAO")) return { code: "acesso-negado", message: "Seu perfil não possui permissão para alterar esta conta." };
  if (message.includes("FAT_ITEM_QUANTIDADE_INVALIDA")) return { code: "quantidade-invalida", message: "A quantidade deve ser maior que zero." };
  if (message.includes("FAT_ITEM_VALOR_INVALIDO")) return { code: "valor-invalido", message: "O valor unitário informado é inválido." };
  if (message.includes("FAT_ITEM_PERCENTUAL_INVALIDO")) return { code: "percentual-invalido", message: "O percentual de redução/acréscimo é inválido." };
  if (message.includes("FAT_ITEM_PARCIAL_PERIODO_INVALIDO")) return { code: "parcial-invalida", message: "O período da parcial é inválido." };
  if (message.includes("FAT_DESCONTO_MAIOR_QUE_BRUTO")) return { code: "desconto-invalido", message: "O desconto não pode ser maior que o valor bruto." };
  return { code: "lancamento", message: "Não foi possível salvar o lançamento. Revise os campos e tente novamente." };
}

export async function saveBillingAccountItem(contaId: string, formData: FormData): Promise<BillingItemSaveResult> {
  const { supabase, empresaId } = await requirePermission("faturamento.criar");
  if (!UUID.test(contaId)) return { ok: false, code: "conta", message: "Conta inválida." };

  const itemId = text(formData, "item_id") || null;
  const itemAssistencialInformado = text(formData, "item_assistencial_id") || null;
  const tabelaComercialItemId = text(formData, "tabela_comercial_item_id") || null;
  if (itemId && !UUID.test(itemId)) return { ok: false, code: "item-invalido", message: "Lançamento inválido." };
  if (itemAssistencialInformado && !UUID.test(itemAssistencialInformado)) return { ok: false, code: "item-catalogo", message: "Item assistencial inválido." };
  if (tabelaComercialItemId && !UUID.test(tabelaComercialItemId)) return { ok: false, code: "item-catalogo", message: "Item da tabela comercial inválido." };

  const { data: conta } = await supabase
    .from("contas_faturamento")
    .select("id,empresa_id,convenio_id")
    .eq("id", contaId)
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (!conta) return { ok: false, code: "conta", message: "Conta não localizada no seu escopo." };

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
    if (!comercial || !edicao || !fonte || fonte.empresa_id !== empresaId) {
      return { ok: false, code: "item-catalogo", message: "Item da tabela comercial não localizado no seu escopo." };
    }

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
    if (!master) return { ok: false, code: "item-catalogo", message: "Item do catálogo assistencial não localizado." };

    origemTipo = origemPorCategoria(master.categoria);
    tabela = master.tabela_tiss_codigo;
    codigo = ["00", "98"].includes(master.tabela_tiss_codigo) ? master.codigo_tabela_propria : master.codigo_tuss;
    codigoPesquisa = codigo;
    descricao = master.descricao;
    categoriaItem = master.categoria;
    familiaTuss = master.familia_tuss;
    if (!codigo) return { ok: false, code: "codigo-tiss", message: "O item não possui código compatível com a tabela TISS configurada." };
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
    console.error("[faturamento.item] falha ao salvar lançamento", { code: error?.code });
    const mapped = billingItemError(error?.message);
    return { ok: false, ...mapped };
  }

  if (itemId && checked(formData, "recalcular_contrato")) {
    const { error: repriceError } = await supabase.rpc("recalcular_item_contratual_avancado", { p_item_id: itemId });
    if (repriceError) {
      console.error("[faturamento.item] lançamento salvo, falha no recálculo", { code: repriceError.code });
      return { ok: false, code: "recalculo-contratual", message: "O lançamento foi salvo, mas o recálculo contratual não pôde ser concluído. Revise os valores da conta." };
    }
  }

  return { ok: true, itemId: String(savedId), mode: itemId ? "updated" : "created" };
}
