"use server";

import { revalidatePath } from "next/cache";
import type { BackgroundActionState } from "@/lib/actions/background-action";
import { getAssistencialContext } from "@/modules/assistencial/context";

export type CommercialWorkspaceActionData = { id: string };

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const nullable = (value: string) => value || null;
const checkbox = (fd: FormData, key: string) => fd.get(key) === "on" || fd.get(key) === "true";
const numeric = (value: string) => {
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

function refreshCommercialWorkspace() {
  revalidatePath("/comercial");
  revalidatePath("/comercial/regras");
  revalidatePath("/comercial/tabelas");
  revalidatePath("/faturamento");
}

function friendlyRpcMessage(message: string, fallback: string) {
  if (message.includes("COMERCIAL_BASE_PRECO_OBRIGATORIA")) {
    return "Selecione a base de preço prevista no contrato para Brasíndice, CMED ou SIMPRO.";
  }
  if (message.includes("COMERCIAL_EDICAO_FIXA_OBRIGATORIA")) {
    return "Selecione a edição fixa ou altere o modo para edição vigente na data.";
  }
  if (message.includes("COMERCIAL_EDICAO_INCOMPATIVEL")) {
    return "A edição selecionada não pertence à tabela comercial escolhida.";
  }
  if (message.includes("COMERCIAL_PLANO_INCOMPATIVEL")) {
    return "O plano selecionado não pertence ao mesmo convênio/empresa deste contrato ou está inativo.";
  }
  if (message.includes("COMERCIAL_VIGENCIA_INVALIDA")) {
    return "A data final da vigência não pode ser anterior à data inicial.";
  }
  if (message.includes("COMERCIAL_SEM_PERMISSAO_EDITAR")) {
    return "Seu perfil não possui permissão para alterar esta negociação comercial.";
  }
  return message || fallback;
}

export async function atualizarContratoComercialBackground(
  _previous: BackgroundActionState<CommercialWorkspaceActionData>,
  formData: FormData,
): Promise<BackgroundActionState<CommercialWorkspaceActionData>> {
  const { supabase } = await getAssistencialContext();
  const contratoId = text(formData, "contrato_id");
  if (!contratoId) {
    return { status: "error", code: "contrato-obrigatorio", message: "Contrato não informado." };
  }

  const { data, error } = await supabase.rpc("comercial_atualizar_contrato_contextual", {
    p_contrato_id: contratoId,
    p_plano_id: nullable(text(formData, "plano_id")),
    p_numero_contrato: text(formData, "numero_contrato"),
    p_status: text(formData, "status") || "negociacao",
    p_data_inicio: nullable(text(formData, "data_inicio")),
    p_data_fim: nullable(text(formData, "data_fim")),
    p_prazo_pagamento_dias: integer(text(formData, "prazo_pagamento_dias")),
    p_reajuste_indice: nullable(text(formData, "reajuste_indice")),
    p_data_base_reajuste: nullable(text(formData, "data_base_reajuste")),
    p_contato_comercial: nullable(text(formData, "contato_comercial")),
    p_email_comercial: nullable(text(formData, "email_comercial")),
    p_observacoes: nullable(text(formData, "observacoes")),
  });

  if (error || !data) {
    return {
      status: "error",
      code: "contrato-salvar",
      message: friendlyRpcMessage(error?.message ?? "", "Não foi possível atualizar o contrato."),
    };
  }

  refreshCommercialWorkspace();
  return {
    status: "success",
    code: "contrato-atualizado",
    message: "Contrato atualizado em segundo plano.",
    data: { id: String(data) },
  };
}

function negotiationParams(formData: FormData) {
  return {
    p_modo_edicao: text(formData, "modo_edicao") || "vigente_na_data",
    p_edicao_fixa_id: nullable(text(formData, "edicao_fixa_id")),
    p_percentual_ajuste: numeric(text(formData, "percentual_ajuste")) ?? 0,
    p_valor_ch: numeric(text(formData, "valor_ch")),
    p_valor_hm: numeric(text(formData, "valor_hm")),
    p_valor_sadt: numeric(text(formData, "valor_sadt")),
    p_valor_uco: numeric(text(formData, "valor_uco_contratual")),
    p_valor_filme_m2: numeric(text(formData, "valor_filme_m2")),
    p_base_preco: nullable(text(formData, "base_preco")),
    p_prioridade: integer(text(formData, "prioridade")) ?? 100,
    p_urgencia_percentual: numeric(text(formData, "urgencia_percentual")) ?? 0,
    p_apartamento_percentual: numeric(text(formData, "apartamento_percentual")) ?? 0,
    p_horario_especial_percentual: numeric(text(formData, "horario_especial_percentual")) ?? 0,
    p_arredondamento_casas: integer(text(formData, "arredondamento_casas")) ?? 2,
    p_observacoes: nullable(text(formData, "observacoes")),
  };
}

export async function vincularTabelaContratoBackground(
  _previous: BackgroundActionState<CommercialWorkspaceActionData>,
  formData: FormData,
): Promise<BackgroundActionState<CommercialWorkspaceActionData>> {
  const { supabase } = await getAssistencialContext();
  const contratoId = text(formData, "contrato_id");
  const fonteId = text(formData, "fonte_id");
  const categoria = text(formData, "categoria") || "geral";
  const params = negotiationParams(formData);

  if (!contratoId || !fonteId) {
    return { status: "error", code: "vinculo-campos", message: "Informe contrato e tabela comercial." };
  }
  if (params.p_modo_edicao === "edicao_fixa" && !params.p_edicao_fixa_id) {
    return { status: "error", code: "edicao-fixa-obrigatoria", message: "Selecione a edição fixa que será usada pelo contrato." };
  }

  const { data, error } = await supabase.rpc("comercial_salvar_vinculo_tabela", {
    p_contrato_id: contratoId,
    p_fonte_id: fonteId,
    p_categoria: categoria,
    ...params,
  });

  if (error || !data) {
    return {
      status: "error",
      code: "vinculo-salvar",
      message: friendlyRpcMessage(error?.message ?? "", "Não foi possível vincular a tabela ao contrato."),
    };
  }

  refreshCommercialWorkspace();
  return {
    status: "success",
    code: "tabela-vinculada",
    message: "Tabela vinculada e negociação salva em segundo plano.",
    data: { id: String(data) },
  };
}

export async function atualizarNegociacaoTabelaBackground(
  _previous: BackgroundActionState<CommercialWorkspaceActionData>,
  formData: FormData,
): Promise<BackgroundActionState<CommercialWorkspaceActionData>> {
  const { supabase } = await getAssistencialContext();
  const vinculoId = text(formData, "vinculo_id");
  const params = negotiationParams(formData);
  if (!vinculoId) {
    return { status: "error", code: "vinculo-obrigatorio", message: "Vínculo comercial não informado." };
  }
  if (params.p_modo_edicao === "edicao_fixa" && !params.p_edicao_fixa_id) {
    return { status: "error", code: "edicao-fixa-obrigatoria", message: "Selecione a edição fixa que será usada pelo contrato." };
  }

  const { data, error } = await supabase.rpc("comercial_salvar_negociacao_tabela_v2", {
    p_vinculo_id: vinculoId,
    ...params,
    p_ativo: checkbox(formData, "ativo"),
  });

  if (error || !data) {
    return {
      status: "error",
      code: "negociacao-salvar",
      message: friendlyRpcMessage(error?.message ?? "", "Não foi possível atualizar a negociação."),
    };
  }

  refreshCommercialWorkspace();
  return {
    status: "success",
    code: "negociacao-atualizada",
    message: "Negociação contratual atualizada em segundo plano.",
    data: { id: String(data) },
  };
}
