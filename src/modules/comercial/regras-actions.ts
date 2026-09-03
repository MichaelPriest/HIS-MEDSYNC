"use server";

import { revalidatePath } from "next/cache";
import type { BackgroundActionState } from "@/lib/actions/background-action";
import { getAssistencialContext } from "@/modules/assistencial/context";

export type ComercialRuleActionData = { id: string };
export type ComercialPackageActionData = { id: string };
export type ComercialPackageItemActionData = { id: string };
export type ComercialCbhpmPortActionData = { id: string };

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const nullable = (value: string) => value || null;
const decimal = (value: string) => {
  if (!value) return null;
  const compact = value.replace(/\s/g, "");
  const normalized = compact.includes(",")
    ? compact.replace(/\./g, "").replace(",", ".")
    : compact;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};
const integer = (value: string) => {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
};
const checkbox = (fd: FormData, key: string) => fd.get(key) === "on" || fd.get(key) === "true";

function refreshCommercialPaths() {
  revalidatePath("/comercial");
  revalidatePath("/comercial/regras");
  revalidatePath("/faturamento");
}

function conditionBoolean(fd: FormData, field: string) {
  const value = text(fd, field);
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

function buildConditions(formData: FormData): Record<string, string | number | boolean> {
  const conditions: Record<string, string | number | boolean> = {};
  const numberFields: Array<[string, string]> = [
    ["sequencia", "sequencia"],
    ["sequencia_min", "sequencia_min"],
    ["sequencia_max", "sequencia_max"],
    ["quantidade_auxiliares_min", "quantidade_auxiliares_min"],
  ];
  for (const [formField, targetField] of numberFields) {
    const value = integer(text(formData, formField));
    if (value !== null) conditions[targetField] = value;
  }

  const booleanFields: Array<[string, string]> = [
    ["urgencia_condicao", "urgencia"],
    ["horario_especial_condicao", "horario_especial"],
    ["acomodacao_individual_condicao", "acomodacao_individual"],
    ["anestesia_condicao", "anestesia"],
    ["mesma_via_condicao", "mesma_via"],
  ];
  for (const [formField, targetField] of booleanFields) {
    const value = conditionBoolean(formData, formField);
    if (value !== undefined) conditions[targetField] = value;
  }

  const textFields: Array<[string, string]> = [
    ["via_acesso", "via_acesso"],
    ["origem_tipo", "origem_tipo"],
    ["codigo_item", "codigo"],
  ];
  for (const [formField, targetField] of textFields) {
    const value = text(formData, formField);
    if (value) conditions[targetField] = value;
  }
  return conditions;
}

export async function salvarRegraFaturamentoBackground(
  _previous: BackgroundActionState<ComercialRuleActionData>,
  formData: FormData,
): Promise<BackgroundActionState<ComercialRuleActionData>> {
  const { supabase } = await getAssistencialContext();
  const contratoId = text(formData, "contrato_id");
  const categoria = text(formData, "categoria");
  const codigo = text(formData, "codigo_regra");
  const descricao = text(formData, "descricao");
  const operacao = text(formData, "operacao") || "multiplicar_percentual";
  const aplicaSobre = text(formData, "aplica_sobre") || "valor_atual";
  const prioridade = integer(text(formData, "prioridade")) ?? 100;
  if (!contratoId || !categoria || !codigo || !descricao) {
    return { status: "error", code: "campos-obrigatorios", message: "Informe contrato, categoria, código e descrição da regra." };
  }

  const { data, error } = await supabase.rpc("comercial_salvar_regra_faturamento", {
    p_id: nullable(text(formData, "regra_id")),
    p_contrato_id: contratoId,
    p_categoria: categoria,
    p_codigo_regra: codigo,
    p_descricao: descricao,
    p_operacao: operacao,
    p_aplica_sobre: aplicaSobre,
    p_percentual: decimal(text(formData, "percentual")),
    p_valor_fixo: decimal(text(formData, "valor_fixo")),
    p_prioridade: prioridade,
    p_condicoes: buildConditions(formData),
    p_vigencia_inicio: nullable(text(formData, "vigencia_inicio")),
    p_vigencia_fim: nullable(text(formData, "vigencia_fim")),
    p_encerra_processamento: checkbox(formData, "encerra_processamento"),
    p_ativo: true,
  });
  if (error || !data) {
    return { status: "error", code: "regra-salvar", message: error?.message || "Não foi possível salvar a regra contratual." };
  }

  refreshCommercialPaths();
  return {
    status: "success",
    code: text(formData, "regra_id") ? "regra-atualizada" : "regra-criada",
    message: text(formData, "regra_id") ? "Regra contratual atualizada." : "Regra contratual criada e pronta para o cálculo.",
    data: { id: String(data) },
  };
}

export async function salvarPacoteContratoBackground(
  _previous: BackgroundActionState<ComercialPackageActionData>,
  formData: FormData,
): Promise<BackgroundActionState<ComercialPackageActionData>> {
  const { supabase } = await getAssistencialContext();
  const contratoId = text(formData, "contrato_id");
  const codigo = text(formData, "codigo");
  const nome = text(formData, "nome");
  const valor = decimal(text(formData, "valor"));
  if (!contratoId || !codigo || !nome || valor === null) {
    return { status: "error", code: "pacote-campos", message: "Informe contrato, código, nome e valor do pacote." };
  }
  const parseList = (value: string) => value
    ? value.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean)
    : [];

  const { data, error } = await supabase.rpc("comercial_salvar_pacote", {
    p_id: nullable(text(formData, "pacote_id")),
    p_contrato_id: contratoId,
    p_codigo: codigo,
    p_nome: nome,
    p_valor: valor,
    p_vigencia_inicio: nullable(text(formData, "vigencia_inicio")),
    p_vigencia_fim: nullable(text(formData, "vigencia_fim")),
    p_inclusoes: parseList(text(formData, "inclusoes")),
    p_exclusoes: parseList(text(formData, "exclusoes")),
    p_observacoes: nullable(text(formData, "observacoes")),
    p_ativo: true,
  });
  if (error || !data) {
    return { status: "error", code: "pacote-salvar", message: error?.message || "Não foi possível salvar o pacote comercial." };
  }

  refreshCommercialPaths();
  return {
    status: "success",
    code: text(formData, "pacote_id") ? "pacote-atualizado" : "pacote-criado",
    message: text(formData, "pacote_id") ? "Pacote comercial atualizado." : "Pacote comercial criado.",
    data: { id: String(data) },
  };
}

export async function adicionarItemPacoteBackground(
  _previous: BackgroundActionState<ComercialPackageItemActionData>,
  formData: FormData,
): Promise<BackgroundActionState<ComercialPackageItemActionData>> {
  const { supabase } = await getAssistencialContext();
  const pacoteId = text(formData, "pacote_id");
  const codigo = text(formData, "codigo");
  const tabela = text(formData, "tabela");
  if (!pacoteId || !codigo) {
    return { status: "error", code: "item-pacote-campos", message: "Informe o código do item do pacote." };
  }

  let itemId = nullable(text(formData, "item_id"));
  if (!itemId) {
    let lookup = supabase
      .from("contrato_pacote_itens")
      .select("id")
      .eq("pacote_id", pacoteId)
      .eq("codigo", codigo);
    lookup = tabela ? lookup.eq("tabela", tabela) : lookup.is("tabela", null);
    const { data: existente, error: lookupError } = await lookup.limit(1).maybeSingle();
    if (lookupError) {
      return { status: "error", code: "item-pacote-consulta", message: lookupError.message };
    }
    itemId = existente?.id ?? null;
  }

  const { data, error } = await supabase.rpc("comercial_salvar_item_pacote", {
    p_id: itemId,
    p_pacote_id: pacoteId,
    p_codigo: codigo,
    p_tabela: nullable(tabela),
    p_quantidade_inclusa: decimal(text(formData, "quantidade_inclusa")),
    p_cobranca_excedente: checkbox(formData, "cobranca_excedente"),
  });
  if (error || !data) {
    return { status: "error", code: "item-pacote-salvar", message: error?.message || "Não foi possível salvar o item do pacote." };
  }

  refreshCommercialPaths();
  return {
    status: "success",
    code: itemId ? "item-pacote-atualizado" : "item-pacote-criado",
    message: itemId ? "Item do pacote atualizado." : "Item incluído no pacote.",
    data: { id: String(data) },
  };
}

export async function salvarPorteCbhpmBackground(
  _previous: BackgroundActionState<ComercialCbhpmPortActionData>,
  formData: FormData,
): Promise<BackgroundActionState<ComercialCbhpmPortActionData>> {
  const { supabase } = await getAssistencialContext();
  const vinculoId = text(formData, "vinculo_id");
  const tipo = text(formData, "tipo");
  const porte = text(formData, "porte");
  const valor = decimal(text(formData, "valor"));
  if (!vinculoId || !["procedimento", "anestesia"].includes(tipo) || !porte || valor === null || valor < 0) {
    return {
      status: "error",
      code: "porte-campos",
      message: "Informe vínculo CBHPM, tipo, porte e um valor contratual válido.",
    };
  }

  const { data, error } = await supabase.rpc("comercial_salvar_porte_cbhpm", {
    p_id: nullable(text(formData, "porte_id")),
    p_vinculo_id: vinculoId,
    p_tipo: tipo,
    p_porte: porte,
    p_valor: valor,
    p_vigencia_inicio: nullable(text(formData, "vigencia_inicio")),
    p_vigencia_fim: nullable(text(formData, "vigencia_fim")),
    p_observacoes: nullable(text(formData, "observacoes")),
    p_ativo: text(formData, "ativo") ? checkbox(formData, "ativo") : true,
  });
  if (error || !data) {
    const overlap = error?.message.includes("COMERCIAL_PORTE_VIGENCIA_SOBREPOSTA");
    return {
      status: "error",
      code: overlap ? "porte-vigencia-sobreposta" : "porte-salvar",
      message: overlap
        ? "Já existe um valor ativo para este porte com vigência sobreposta. Encerre a vigência anterior antes de criar a próxima."
        : error?.message || "Não foi possível salvar o valor do porte CBHPM.",
    };
  }

  refreshCommercialPaths();
  return {
    status: "success",
    code: text(formData, "porte_id") ? "porte-atualizado" : "porte-criado",
    message: text(formData, "porte_id")
      ? "Valor do porte CBHPM atualizado."
      : "Valor do porte CBHPM versionado e salvo.",
    data: { id: String(data) },
  };
}
