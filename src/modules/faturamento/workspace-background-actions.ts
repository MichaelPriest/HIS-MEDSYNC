"use server";

import { revalidatePath } from "next/cache";
import type { BackgroundActionState } from "@/lib/actions/background-action";
import { getAssistencialContext } from "@/modules/assistencial/context";

export type BillingNavigationData = {
  redirectTo: string;
  id?: string;
};

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function money(formData: FormData, key: string) {
  const raw = text(formData, key).replace(/\./g, "").replace(",", ".");
  const value = Number(raw || 0);
  return Number.isFinite(value) ? value : 0;
}

function competenciaAtual() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  return `${year}-${month}`;
}

export async function abrirContaFaturamentoBackground(
  _previous: BackgroundActionState<BillingNavigationData>,
  formData: FormData,
): Promise<BackgroundActionState<BillingNavigationData>> {
  const { supabase, user, empresaId, unidadeId } = await getAssistencialContext();
  const atendimentoId = text(formData, "atendimento_id");

  if (!atendimentoId) {
    return { status: "error", code: "atendimento", message: "Selecione um atendimento para abrir a conta." };
  }

  const { data: atendimento } = await supabase
    .from("atendimentos")
    .select("id,paciente_id,cobertura,convenio_id,plano_id")
    .eq("id", atendimentoId)
    .eq("unidade_id", unidadeId)
    .maybeSingle();

  if (!atendimento) {
    return { status: "error", code: "atendimento", message: "O atendimento não está disponível na unidade ativa." };
  }

  const { data: existente } = await supabase
    .from("contas_faturamento")
    .select("id")
    .eq("atendimento_id", atendimentoId)
    .maybeSingle();

  if (existente?.id) {
    return {
      status: "success",
      code: "conta-existente",
      message: "A conta já existe. Abrindo o workspace da conta.",
      data: { id: existente.id, redirectTo: `/faturamento/${existente.id}` },
    };
  }

  const { data: conta, error } = await supabase
    .from("contas_faturamento")
    .insert({
      empresa_id: empresaId,
      unidade_id: unidadeId,
      atendimento_id: atendimento.id,
      paciente_id: atendimento.paciente_id,
      convenio_id: atendimento.convenio_id,
      plano_id: atendimento.plano_id,
      competencia: competenciaAtual(),
      tipo_cobranca: atendimento.cobertura === "convenio" ? "convenio" : "particular",
      auditoria_liberada: false,
      contas_medicas_liberada: false,
      created_by: user.id,
      updated_by: user.id,
    })
    .select("id")
    .single();

  if (error || !conta) {
    console.error("[faturamento.workspace] abrir conta", { code: error?.code });
    return {
      status: "error",
      code: "criar-conta",
      message: "Não foi possível abrir a conta. Os dados do atendimento foram preservados.",
    };
  }

  const { data: auditoriaId } = await supabase.rpc("encaminhar_conta_para_auditoria", {
    p_atendimento_id: atendimentoId,
  });
  if (auditoriaId) {
    await supabase.from("contas_faturamento").update({ auditoria_id: auditoriaId }).eq("id", conta.id);
  }

  revalidatePath("/faturamento");
  revalidatePath("/auditoria");
  revalidatePath("/contas-medicas");

  return {
    status: "success",
    code: "conta-criada",
    message: "Conta aberta. Abrindo o workspace de faturamento.",
    data: { id: conta.id, redirectTo: `/faturamento/${conta.id}` },
  };
}

function loteError(message?: string | null) {
  const value = String(message ?? "");
  if (value.includes("TISS_LOTE_SEM_GUIAS_ELEGIVEIS")) return ["sem-guias", "Não há guias elegíveis para esta operadora e competência."] as const;
  if (value.includes("TISS_LOTE_COMPETENCIA_INVALIDA")) return ["competencia", "A competência informada é inválida."] as const;
  if (value.includes("TISS_LOTE_VERSAO_INDISPONIVEL")) return ["versao", "Não há versão TISS disponível para criar o lote."] as const;
  if (value.includes("TISS_LOTE_CONVENIO_INVALIDO")) return ["convenio", "O convênio selecionado não está disponível."] as const;
  if (value.includes("TISS_LOTE_SEM_PERMISSAO") || value.includes("TISS_LOTE_SEM_ACESSO_UNIDADE") || value.includes("TISS_NAO_AUTENTICADO")) {
    return ["permissao", "Seu perfil não possui permissão para criar este lote."] as const;
  }
  return ["criar", "Não foi possível criar o lote TISS."] as const;
}

export async function criarLoteTissBackground(
  _previous: BackgroundActionState<BillingNavigationData>,
  formData: FormData,
): Promise<BackgroundActionState<BillingNavigationData>> {
  const { supabase, unidadeId } = await getAssistencialContext();
  const convenioId = text(formData, "convenio_id");
  const competencia = text(formData, "competencia");
  const previsaoPagamento = text(formData, "previsao_pagamento") || null;

  if (!convenioId || !competencia) {
    return { status: "error", code: "campos", message: "Informe convênio e competência." };
  }

  const { data, error } = await supabase.rpc("criar_lote_tiss_transacional", {
    p_unidade_id: unidadeId,
    p_convenio_id: convenioId,
    p_competencia: competencia,
    p_previsao_pagamento: previsaoPagamento,
  });

  if (error) {
    const [code, message] = loteError(error.message);
    console.error("[faturamento.workspace] criar lote", { code: error.code, category: code });
    return { status: "error", code, message };
  }

  const value = Array.isArray(data) ? data[0] : data;
  const result = (value ?? {}) as { lote_id?: string; numero_lote?: string };
  if (!result.lote_id) {
    return { status: "error", code: "criar", message: "O lote não retornou um identificador válido." };
  }

  revalidatePath("/faturamento");
  revalidatePath("/faturamento/lotes");
  revalidatePath("/financeiro");

  return {
    status: "success",
    code: "lote-criado",
    message: result.numero_lote ? `Lote ${result.numero_lote} criado.` : "Lote criado.",
    data: { id: result.lote_id, redirectTo: `/faturamento/lotes/${result.lote_id}` },
  };
}

function recursoError(message?: string | null) {
  const value = String(message ?? "");
  if (value.includes("VALOR_EXCEDE")) return ["valor", "O valor recursado excede o saldo elegível da glosa."] as const;
  if (value.includes("SEM_PERMISSAO") || value.includes("NAO_AUTENTICADO")) return ["permissao", "Seu perfil não possui permissão para abrir o recurso."] as const;
  if (value.includes("NAO_ELEGIVEL")) return ["status", "Esta glosa não está elegível para novo recurso."] as const;
  return ["recurso", "Não foi possível criar o recurso de glosa."] as const;
}

export async function criarRecursoGlosaBackground(
  _previous: BackgroundActionState<BillingNavigationData>,
  formData: FormData,
): Promise<BackgroundActionState<BillingNavigationData>> {
  const { supabase } = await getAssistencialContext();
  const glosaId = text(formData, "glosa_id");
  const justificativa = text(formData, "justificativa");
  const valor = money(formData, "valor_recursado");

  if (!glosaId || !justificativa || valor <= 0) {
    return { status: "error", code: "campos", message: "Informe valor recursado e justificativa." };
  }

  const { data, error } = await supabase.rpc("criar_recurso_glosa_tiss_transacional", {
    p_glosa_id: glosaId,
    p_justificativa: justificativa,
    p_valor_recursado: valor,
  });

  if (error) {
    const [code, message] = recursoError(error.message);
    console.error("[faturamento.workspace] criar recurso", { code: error.code, category: code });
    return { status: "error", code, message };
  }

  const recursoId = typeof data === "string" ? data : null;
  if (!recursoId) {
    return { status: "error", code: "recurso", message: "O recurso não retornou um identificador válido." };
  }

  revalidatePath("/faturamento");
  revalidatePath("/faturamento/glosas");
  revalidatePath("/faturamento/recursos");

  return {
    status: "success",
    code: "recurso-criado",
    message: "Recurso criado. Abrindo o acompanhamento.",
    data: { id: recursoId, redirectTo: `/faturamento/recursos/${recursoId}` },
  };
}
