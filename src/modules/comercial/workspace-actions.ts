"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAssistencialContext } from "@/modules/assistencial/context";

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const bool = (fd: FormData, key: string) => fd.get(key) === "on";
const numeric = (value: string) => {
  if (!value) return null;
  const normalized = value.replace(/\s/g, "").replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};
const integer = (value: string) => {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) ? parsed : null;
};
const nullable = (value: string) => value || null;

function target(fd: FormData, extra?: Record<string, string | null | undefined>) {
  const params = new URLSearchParams();
  const contrato = text(fd, "retorno_contrato");
  const vinculo = text(fd, "retorno_vinculo");
  const edicao = text(fd, "retorno_edicao");
  const aba = text(fd, "retorno_aba");
  if (contrato) params.set("contrato", contrato);
  if (vinculo) params.set("vinculo", vinculo);
  if (edicao) params.set("edicao", edicao);
  if (aba) params.set("aba", aba);
  for (const [key, value] of Object.entries(extra ?? {})) if (value) params.set(key, value);
  return `/comercial${params.size ? `?${params.toString()}` : ""}`;
}

function fail(fd: FormData, message: string): never {
  redirect(target(fd, { erro: encodeURIComponent(message) }) as never);
}

export async function atualizarContratoComercial(formData: FormData) {
  const { supabase } = await getAssistencialContext();
  const contratoId = text(formData, "contrato_id");
  if (!contratoId) return fail(formData, "Contrato não informado.");
  const { error } = await supabase.rpc("comercial_atualizar_contrato", {
    p_contrato_id: contratoId,
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
  if (error) return fail(formData, error.message);
  revalidatePath("/comercial");
  redirect(target(formData, { sucesso: "contrato-atualizado" }) as never);
}

export async function vincularTabelaContratoWorkspace(formData: FormData) {
  const { supabase, empresaId, unidadeId } = await getAssistencialContext();
  const contratoId = text(formData, "contrato_id");
  const fonteId = text(formData, "fonte_id");
  const categoria = text(formData, "categoria") || "geral";
  const modoEdicao = text(formData, "modo_edicao") || "edicao_fixa";
  const edicaoFixaId = nullable(text(formData, "edicao_fixa_id"));
  if (!contratoId || !fonteId) return fail(formData, "Informe contrato e tabela comercial.");
  if (modoEdicao === "edicao_fixa" && !edicaoFixaId) return fail(formData, "Selecione a edição fixa que será usada pelo contrato.");

  const [{ data: contrato }, { data: fonte }] = await Promise.all([
    supabase.from("credenciamento_contratos").select("id,empresa_id,unidade_id").eq("id", contratoId).maybeSingle(),
    supabase.from("tabelas_comerciais_fontes").select("id,empresa_id").eq("id", fonteId).maybeSingle(),
  ]);
  if (!contrato || contrato.empresa_id !== empresaId || (contrato.unidade_id && contrato.unidade_id !== unidadeId)) {
    return fail(formData, "Contrato não localizado ou fora da unidade atual.");
  }
  if (!fonte || fonte.empresa_id !== empresaId) return fail(formData, "Tabela comercial não localizada nesta empresa.");

  if (edicaoFixaId) {
    const { data: edicao } = await supabase
      .from("tabelas_comerciais_edicoes")
      .select("id,fonte_id")
      .eq("id", edicaoFixaId)
      .maybeSingle();
    if (!edicao || edicao.fonte_id !== fonteId) return fail(formData, "A edição selecionada não pertence à tabela informada.");
  }

  const payload = {
    contrato_id: contratoId,
    fonte_id: fonteId,
    edicao_fixa_id: modoEdicao === "edicao_fixa" ? edicaoFixaId : null,
    categoria,
    modo_edicao: modoEdicao,
    percentual_ajuste: numeric(text(formData, "percentual_ajuste")) ?? 0,
    prioridade: integer(text(formData, "prioridade")) ?? 100,
    valor_ch: numeric(text(formData, "valor_ch")),
    valor_hm: numeric(text(formData, "valor_hm")),
    valor_sadt: numeric(text(formData, "valor_sadt")),
    valor_uco_contratual: numeric(text(formData, "valor_uco_contratual")),
    regras_adicionais: {
      urgencia_percentual: numeric(text(formData, "urgencia_percentual")) ?? 0,
      apartamento_percentual: numeric(text(formData, "apartamento_percentual")) ?? 0,
      horario_especial_regra: nullable(text(formData, "horario_especial_regra")),
    },
    arredondamento_casas: integer(text(formData, "arredondamento_casas")) ?? 2,
    ativo: true,
    observacoes: nullable(text(formData, "observacoes")),
  };
  const { data, error } = await supabase
    .from("contrato_tabelas_comerciais")
    .upsert(payload, { onConflict: "contrato_id,fonte_id,categoria" })
    .select("id")
    .single();
  if (error || !data?.id) return fail(formData, error?.message || "Não foi possível vincular a tabela ao contrato.");
  revalidatePath("/comercial");
  revalidatePath("/comercial/tabelas");
  redirect(target(formData, { vinculo: String(data.id), aba: "negociacao", sucesso: "tabela-vinculada" }) as never);
}

export async function atualizarNegociacaoTabela(formData: FormData) {
  const { supabase } = await getAssistencialContext();
  const vinculoId = text(formData, "vinculo_id");
  if (!vinculoId) return fail(formData, "Vínculo comercial não informado.");
  const { error } = await supabase.rpc("comercial_salvar_negociacao_tabela", {
    p_vinculo_id: vinculoId,
    p_modo_edicao: text(formData, "modo_edicao") || "vigente_na_data",
    p_edicao_fixa_id: nullable(text(formData, "edicao_fixa_id")),
    p_percentual_ajuste: numeric(text(formData, "percentual_ajuste")) ?? 0,
    p_valor_ch: numeric(text(formData, "valor_ch")),
    p_valor_hm: numeric(text(formData, "valor_hm")),
    p_valor_sadt: numeric(text(formData, "valor_sadt")),
    p_valor_uco: numeric(text(formData, "valor_uco_contratual")),
    p_prioridade: integer(text(formData, "prioridade")) ?? 100,
    p_urgencia_percentual: numeric(text(formData, "urgencia_percentual")) ?? 0,
    p_apartamento_percentual: numeric(text(formData, "apartamento_percentual")) ?? 0,
    p_horario_especial_regra: nullable(text(formData, "horario_especial_regra")),
    p_arredondamento_casas: integer(text(formData, "arredondamento_casas")) ?? 2,
    p_ativo: bool(formData, "ativo"),
    p_observacoes: nullable(text(formData, "observacoes")),
  });
  if (error) return fail(formData, error.message);
  revalidatePath("/comercial");
  redirect(target(formData, { sucesso: "negociacao-atualizada" }) as never);
}

export async function criarVersaoNegociacao(formData: FormData) {
  const { supabase } = await getAssistencialContext();
  const edicaoId = text(formData, "edicao_origem_id");
  const nome = text(formData, "nome_edicao");
  const inicio = text(formData, "vigencia_inicio");
  if (!edicaoId || !nome || !inicio) return fail(formData, "Informe edição de origem, nome e início da nova vigência.");
  const { data, error } = await supabase.rpc("comercial_clonar_edicao", {
    p_edicao_id: edicaoId,
    p_nome_edicao: nome,
    p_vigencia_inicio: inicio,
    p_observacoes: nullable(text(formData, "observacoes")),
  });
  if (error || !data) return fail(formData, error?.message || "Não foi possível criar a nova versão.");
  revalidatePath("/comercial");
  revalidatePath("/comercial/tabelas");
  redirect(target(formData, { edicao: String(data), aba: "itens", sucesso: "versao-criada" }) as never);
}

export async function salvarItemEdicaoComercial(formData: FormData) {
  const { supabase } = await getAssistencialContext();
  const edicaoId = text(formData, "edicao_id");
  if (!edicaoId) return fail(formData, "Edição não informada.");
  const itemId = nullable(text(formData, "item_id"));
  const payload = {
    codigo: text(formData, "codigo"),
    descricao: text(formData, "descricao"),
    valor_referencia: numeric(text(formData, "valor_referencia")) ?? 0,
    codigo_tuss: nullable(text(formData, "codigo_tuss")),
    porte: nullable(text(formData, "porte")),
    porte_anestesico: nullable(text(formData, "porte_anestesico")),
    pontos_ch: numeric(text(formData, "pontos_ch")),
    pontos_hm: numeric(text(formData, "pontos_hm")),
    pontos_sadt: numeric(text(formData, "pontos_sadt")),
    quantidade_uco: numeric(text(formData, "quantidade_uco")),
    exige_autorizacao: bool(formData, "exige_autorizacao"),
    ativo: bool(formData, "ativo"),
    categoria_item: text(formData, "categoria_item") || "outro",
    tabela_tiss_codigo: nullable(text(formData, "tabela_tiss_codigo")),
    codigo_tabela_propria: nullable(text(formData, "codigo_tabela_propria")),
  };
  const { error } = await supabase.rpc("comercial_salvar_item_edicao", {
    p_edicao_id: edicaoId,
    p_item_id: itemId,
    p_payload: payload,
  });
  if (error) return fail(formData, error.message);
  revalidatePath("/comercial");
  redirect(target(formData, { edicao: edicaoId, aba: "itens", sucesso: itemId ? "item-atualizado" : "item-incluido" }) as never);
}

export async function publicarEdicaoComercial(formData: FormData) {
  const { supabase } = await getAssistencialContext();
  const edicaoId = text(formData, "edicao_id");
  if (!edicaoId) return fail(formData, "Edição não informada.");
  const { error } = await supabase.rpc("comercial_publicar_edicao", { p_edicao_id: edicaoId });
  if (error) return fail(formData, error.message);
  revalidatePath("/comercial");
  revalidatePath("/comercial/tabelas");
  redirect(target(formData, { edicao: edicaoId, aba: "itens", sucesso: "edicao-publicada" }) as never);
}
