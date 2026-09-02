"use server";

import { revalidatePath } from "next/cache";
import type { BackgroundActionState } from "@/lib/actions/background-action";
import { getAssistencialContext } from "@/modules/assistencial/context";

export type SurgicalActionData = {
  cirurgiaId?: string;
  action?: string;
};
export type SurgicalActionState = BackgroundActionState<SurgicalActionData>;

const txt = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const nullable = (value: string) => value || null;
const checked = (fd: FormData, key: string) => fd.get(key) === "on";
const numberOrNull = (value: string) => {
  if (value === "") return null;
  const number = Number(value.replace(",", "."));
  return Number.isFinite(number) ? number : null;
};
const lines = (value: string) => value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
const saoPauloTimestamp = (value: string) => {
  const normalized = value.length === 16 ? `${value}:00` : value;
  return `${normalized}-03:00`;
};

function failure(code: string, message: string, error?: { code?: string | null }, data?: SurgicalActionData): SurgicalActionState {
  return {
    status: "error",
    code,
    message,
    detail: error?.code ? `Código técnico: ${error.code}` : undefined,
    data,
  };
}

function refreshCore(cirurgiaId?: string) {
  revalidatePath("/assistencial/centro-cirurgico");
  revalidatePath("/assistencial/centro-cirurgico/agendadas");
  revalidatePath("/assistencial/centro-cirurgico/em-andamento");
  revalidatePath("/assistencial/centro-cirurgico/painel-salas");
  revalidatePath("/assistencial/centro-cirurgico/procedimentos");
  if (cirurgiaId) revalidatePath(`/assistencial/centro-cirurgico/suprimentos/${cirurgiaId}`);
}

function success(message: string, data?: SurgicalActionData): SurgicalActionState {
  refreshCore(data?.cirurgiaId);
  return { status: "success", message, data };
}

export async function agendarCirurgiaBackground(
  _previousState: SurgicalActionState,
  formData: FormData,
): Promise<SurgicalActionState> {
  const { supabase } = await getAssistencialContext();
  const atendimentoId = txt(formData, "atendimento_id");
  const procedimento = txt(formData, "procedimento");
  const inicioPrevisto = txt(formData, "inicio_previsto");
  const tipoInternacaoAnsCodigo = txt(formData, "tipo_internacao_ans_codigo");
  if (!atendimentoId || !procedimento || !inicioPrevisto || !tipoInternacaoAnsCodigo) {
    return failure("campos-obrigatorios", "Informe atendimento, procedimento, tipo de internação ANS e início previsto.");
  }

  const { error: classificacaoError } = await supabase.rpc("centro_cirurgico_classificar_internacao_ans", {
    p_atendimento_id: atendimentoId,
    p_codigo: tipoInternacaoAnsCodigo,
  });
  if (classificacaoError) {
    console.error("[centro-cirurgico] classificar internação", { code: classificacaoError.code, operation: "centro_cirurgico_classificar_internacao_ans" });
    return failure("classificacao-internacao", "Não foi possível confirmar o tipo de internação ANS.", classificacaoError);
  }

  const { data: cirurgiaIdRaw, error } = await supabase.rpc("centro_cirurgico_agendar_operacional", {
    p_atendimento_id: atendimentoId,
    p_cirurgia_id: nullable(txt(formData, "cirurgia_id")),
    p_procedimento: procedimento,
    p_codigo_tuss: nullable(txt(formData, "codigo_tuss")),
    p_cirurgia: nullable(txt(formData, "cirurgia")),
    p_lateralidade: nullable(txt(formData, "lateralidade")),
    p_sala: nullable(txt(formData, "sala")),
    p_classificacao: nullable(txt(formData, "classificacao")),
    p_porte: nullable(txt(formData, "porte")),
    p_inicio_previsto: saoPauloTimestamp(inicioPrevisto),
    p_cirurgiao_id: nullable(txt(formData, "cirurgiao_id")),
    p_anestesista_id: nullable(txt(formData, "anestesista_id")),
    p_diagnostico_pre: nullable(txt(formData, "diagnostico_pre")),
  });
  if (error || !cirurgiaIdRaw) {
    console.error("[centro-cirurgico] agendar cirurgia", { code: error?.code, operation: "centro_cirurgico_agendar_operacional" });
    return failure("agendamento", "Não foi possível registrar o agendamento cirúrgico.", error ?? undefined);
  }
  const cirurgiaId = String(cirurgiaIdRaw);

  const adicionaisContratuais = (() => {
    try {
      const parsed: unknown = JSON.parse(txt(formData, "procedimentos_adicionais") || "[]");
      return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string" && Boolean(id)) : [];
    } catch {
      return [];
    }
  })();
  const adicionaisLivres = lines(txt(formData, "procedimentos_adicionais_livres"));

  for (const tabelaItemId of adicionaisContratuais) {
    const { error: additionalError } = await supabase.rpc("centro_cirurgico_adicionar_procedimento_operacional", {
      p_cirurgia_id: cirurgiaId,
      p_tabela_item_id: tabelaItemId,
      p_codigo: null,
      p_descricao: null,
      p_porte: null,
      p_porte_anestesico: null,
      p_observacoes: null,
    });
    if (additionalError) {
      refreshCore(cirurgiaId);
      console.error("[centro-cirurgico] procedimento adicional contratual", { code: additionalError.code, operation: "centro_cirurgico_adicionar_procedimento_operacional" });
      return failure(
        "agendamento-parcial",
        "A cirurgia foi agendada, mas um procedimento adicional não pôde ser vinculado. Revise o ato cirúrgico antes de prosseguir.",
        additionalError,
        { cirurgiaId },
      );
    }
  }

  for (const descricao of adicionaisLivres) {
    const { error: additionalError } = await supabase.rpc("centro_cirurgico_adicionar_procedimento_operacional", {
      p_cirurgia_id: cirurgiaId,
      p_tabela_item_id: null,
      p_codigo: null,
      p_descricao: descricao,
      p_porte: null,
      p_porte_anestesico: null,
      p_observacoes: null,
    });
    if (additionalError) {
      refreshCore(cirurgiaId);
      console.error("[centro-cirurgico] procedimento adicional livre", { code: additionalError.code, operation: "centro_cirurgico_adicionar_procedimento_operacional" });
      return failure(
        "agendamento-parcial",
        "A cirurgia foi agendada, mas um procedimento adicional não pôde ser vinculado. Revise o ato cirúrgico antes de prosseguir.",
        additionalError,
        { cirurgiaId },
      );
    }
  }

  revalidatePath("/agenda");
  return success("Cirurgia agendada e vinculada ao atendimento.", { cirurgiaId, action: "schedule" });
}

export async function transicionarCirurgiaBackground(
  _previousState: SurgicalActionState,
  formData: FormData,
): Promise<SurgicalActionState> {
  const { supabase } = await getAssistencialContext();
  const cirurgiaId = txt(formData, "cirurgia_id");
  const novoStatus = txt(formData, "novo_status");
  if (!cirurgiaId || !novoStatus) return failure("transicao-invalida", "Informe a cirurgia e a transição desejada.");

  const { error } = await supabase.rpc("centro_cirurgico_transicionar_operacional", {
    p_cirurgia_id: cirurgiaId,
    p_novo_status: novoStatus,
    p_observacoes: nullable(txt(formData, "observacoes")),
  });
  if (error) {
    console.error("[centro-cirurgico] transição", { code: error.code, operation: "centro_cirurgico_transicionar_operacional" });
    return failure("transicao", "Não foi possível avançar o status da cirurgia.", error, { cirurgiaId });
  }

  const labels: Record<string, string> = {
    agendada: "Cirurgia retornada para agendada.",
    em_preparo: "Preparo cirúrgico iniciado.",
    em_andamento: "Cirurgia iniciada.",
    recuperacao: "Paciente encaminhado para recuperação pós-anestésica.",
    concluida: "Cirurgia concluída.",
    cancelada: "Cirurgia cancelada.",
  };
  return success(labels[novoStatus] ?? "Status da cirurgia atualizado.", { cirurgiaId, action: novoStatus });
}

const checklistKeys: Record<string, string[]> = {
  entrada: ["identidade", "procedimento", "lateralidade", "consentimento", "jejum", "alergias"],
  pausa: ["equipe", "procedimento_confirmado", "antibiotico", "equipamentos", "esterilidade"],
  saida: ["contagem", "amostras", "opme", "intercorrencias", "destino"],
};

export async function salvarChecklistCirurgicoBackground(
  _previousState: SurgicalActionState,
  formData: FormData,
): Promise<SurgicalActionState> {
  const { supabase } = await getAssistencialContext();
  const cirurgiaId = txt(formData, "cirurgia_id");
  const etapa = txt(formData, "etapa").toLowerCase();
  const keys = checklistKeys[etapa];
  if (!cirurgiaId || !keys) return failure("checklist-invalido", "Etapa do checklist cirúrgico inválida.");

  const itens = Object.fromEntries(keys.map((key) => [key, checked(formData, key)]));
  const { error } = await supabase.rpc("centro_cirurgico_salvar_checklist_operacional", {
    p_cirurgia_id: cirurgiaId,
    p_etapa: etapa,
    p_itens: itens,
    p_concluido: checked(formData, "concluido"),
    p_observacoes: nullable(txt(formData, "observacoes")),
  });
  if (error) {
    console.error("[centro-cirurgico] checklist", { code: error.code, operation: "centro_cirurgico_salvar_checklist_operacional" });
    return failure("checklist", "Não foi possível salvar a etapa do checklist cirúrgico.", error, { cirurgiaId });
  }
  return success("Checklist cirúrgico salvo.", { cirurgiaId, action: `checklist-${etapa}` });
}

export async function movimentarPosOperatorioParaAlaBackground(
  _previousState: SurgicalActionState,
  formData: FormData,
): Promise<SurgicalActionState> {
  const { supabase } = await getAssistencialContext();
  const cirurgiaId = txt(formData, "cirurgia_id");
  const leitoId = txt(formData, "leito_id");
  if (!cirurgiaId || !leitoId) return failure("movimentacao-ala-campos", "Selecione a cirurgia e o leito de destino.");

  const { error } = await supabase.rpc("centro_cirurgico_movimentar_para_ala_operacional", {
    p_cirurgia_id: cirurgiaId,
    p_leito_destino_id: leitoId,
    p_motivo: nullable(txt(formData, "motivo")),
  });
  if (error) {
    console.error("[centro-cirurgico] movimentar para ala", { code: error.code, operation: "centro_cirurgico_movimentar_para_ala_operacional" });
    return failure("movimentacao-ala", "Não foi possível movimentar o paciente para a ala.", error, { cirurgiaId });
  }
  revalidatePath("/internacao");
  revalidatePath("/internacao/leitos");
  revalidatePath("/internacao/mapa-leitos");
  return success("Movimentação pós-operatória para a ala registrada.", { cirurgiaId, action: "move-ward" });
}

export async function registrarOpmeBackground(
  _previousState: SurgicalActionState,
  formData: FormData,
): Promise<SurgicalActionState> {
  const { supabase } = await getAssistencialContext();
  const cirurgiaId = txt(formData, "cirurgia_id");
  const item = txt(formData, "item");
  const quantidade = numberOrNull(txt(formData, "quantidade") || "1");
  if (!cirurgiaId || !item || !quantidade || quantidade <= 0) return failure("opme-campos", "Informe o item OPME e uma quantidade válida.");

  const { error } = await supabase.rpc("centro_cirurgico_registrar_opme_operacional", {
    p_cirurgia_id: cirurgiaId,
    p_item: item,
    p_codigo: nullable(txt(formData, "codigo")),
    p_fabricante: nullable(txt(formData, "fabricante")),
    p_lote: nullable(txt(formData, "lote")),
    p_serie: nullable(txt(formData, "serie")),
    p_registro_anvisa: nullable(txt(formData, "registro_anvisa")),
    p_quantidade: quantidade,
    p_status: txt(formData, "status") || "previsto",
    p_observacoes: nullable(txt(formData, "observacoes")),
  });
  if (error) {
    console.error("[centro-cirurgico] OPME", { code: error.code, operation: "centro_cirurgico_registrar_opme_operacional" });
    return failure("opme", "Não foi possível registrar o OPME.", error, { cirurgiaId });
  }
  revalidatePath("/faturamento/producao");
  return success("OPME registrado com rastreabilidade.", { cirurgiaId, action: "opme" });
}

export async function vincularCicloCmeBackground(
  _previousState: SurgicalActionState,
  formData: FormData,
): Promise<SurgicalActionState> {
  const { supabase } = await getAssistencialContext();
  const cirurgiaId = txt(formData, "cirurgia_id");
  const cicloId = txt(formData, "ciclo_id");
  if (!cirurgiaId || !cicloId) return failure("cme-vinculo", "Selecione a cirurgia e um ciclo CME liberado.");

  const { error } = await supabase.rpc("centro_cirurgico_vincular_ciclo_cme_operacional", {
    p_cirurgia_id: cirurgiaId,
    p_ciclo_id: cicloId,
    p_observacoes: nullable(txt(formData, "observacoes")),
  });
  if (error) {
    console.error("[centro-cirurgico] vínculo CME", { code: error.code, operation: "centro_cirurgico_vincular_ciclo_cme_operacional" });
    return failure("cme-vinculo", "Não foi possível vincular o ciclo CME ao ato cirúrgico.", error, { cirurgiaId });
  }
  revalidatePath("/assistencial/centro-cirurgico/cme");
  return success("Ciclo CME liberado vinculado ao ato cirúrgico.", { cirurgiaId, action: "cme-link" });
}

export async function adicionarProcedimentoAoAtoBackground(
  _previousState: SurgicalActionState,
  formData: FormData,
): Promise<SurgicalActionState> {
  const { supabase } = await getAssistencialContext();
  const cirurgiaId = txt(formData, "cirurgia_id");
  if (!cirurgiaId) return failure("cirurgia-obrigatoria", "Selecione a cirurgia antes de adicionar um procedimento.");

  const { error } = await supabase.rpc("centro_cirurgico_adicionar_procedimento_operacional", {
    p_cirurgia_id: cirurgiaId,
    p_tabela_item_id: nullable(txt(formData, "tabela_item_id")),
    p_codigo: nullable(txt(formData, "codigo")),
    p_descricao: nullable(txt(formData, "descricao")),
    p_porte: nullable(txt(formData, "porte")),
    p_porte_anestesico: nullable(txt(formData, "porte_anestesico")),
    p_observacoes: nullable(txt(formData, "observacoes")),
  });
  if (error) {
    console.error("[centro-cirurgico] adicionar procedimento", { code: error.code, operation: "centro_cirurgico_adicionar_procedimento_operacional" });
    return failure("procedimento-adicionar", "Não foi possível adicionar o procedimento ao ato cirúrgico.", error, { cirurgiaId });
  }
  return success("Procedimento adicionado ao mesmo ato cirúrgico.", { cirurgiaId, action: "procedure-add" });
}

export async function salvarMembroEquipeProcedimentoBackground(
  _previousState: SurgicalActionState,
  formData: FormData,
): Promise<SurgicalActionState> {
  const { supabase } = await getAssistencialContext();
  const cirurgiaId = txt(formData, "cirurgia_id");
  const procedimentoId = txt(formData, "cirurgia_procedimento_id");
  const profissionalId = txt(formData, "profissional_id");
  const papel = txt(formData, "papel");
  if (!cirurgiaId || !procedimentoId || !profissionalId || !papel) {
    return failure("equipe-incompleta", "Informe profissional e papel para registrar a equipe do procedimento.", undefined, cirurgiaId ? { cirurgiaId } : undefined);
  }

  const { error } = await supabase.rpc("centro_cirurgico_salvar_membro_equipe_operacional", {
    p_cirurgia_procedimento_id: procedimentoId,
    p_profissional_id: profissionalId,
    p_papel: papel,
    p_ordem: numberOrNull(txt(formData, "ordem")),
    p_principal: checked(formData, "principal"),
    p_registrar_entrada: checked(formData, "registrar_entrada"),
    p_registrar_saida: checked(formData, "registrar_saida"),
    p_observacoes: nullable(txt(formData, "observacoes")),
  });
  if (error) {
    console.error("[centro-cirurgico] equipe procedimento", { code: error.code, operation: "centro_cirurgico_salvar_membro_equipe_operacional" });
    return failure("equipe", "Não foi possível adicionar ou atualizar o membro da equipe.", error, { cirurgiaId });
  }
  return success("Equipe do procedimento atualizada.", { cirurgiaId, action: "team" });
}

export async function acionarProcedimentoCirurgicoBackground(
  _previousState: SurgicalActionState,
  formData: FormData,
): Promise<SurgicalActionState> {
  const { supabase } = await getAssistencialContext();
  const cirurgiaId = txt(formData, "cirurgia_id");
  const procedimentoId = txt(formData, "cirurgia_procedimento_id");
  const acao = txt(formData, "acao");
  if (!cirurgiaId || !procedimentoId || !acao) {
    return failure("acao-procedimento-invalida", "Informe o procedimento e a ação desejada.", undefined, cirurgiaId ? { cirurgiaId } : undefined);
  }

  const { error } = await supabase.rpc("centro_cirurgico_acionar_procedimento_operacional", {
    p_cirurgia_procedimento_id: procedimentoId,
    p_acao: acao,
    p_observacoes: nullable(txt(formData, "observacoes")),
  });
  if (error) {
    console.error("[centro-cirurgico] ação procedimento", { code: error.code, operation: "centro_cirurgico_acionar_procedimento_operacional" });
    return failure("acao-procedimento", "Não foi possível atualizar o tempo/status do procedimento.", error, { cirurgiaId });
  }

  return success(acao === "iniciar" ? "Procedimento iniciado." : acao === "finalizar" ? "Procedimento finalizado." : "Procedimento atualizado.", { cirurgiaId, action: `procedure-${acao}` });
}
