"use server";

import { revalidatePath } from "next/cache";
import type { BackgroundActionState } from "@/lib/actions/background-action";
import { getAssistencialContext } from "@/modules/assistencial/context";

function texto(formData: FormData, campo: string) {
  return String(formData.get(campo) ?? "").trim();
}

function erroAlta(message: string) {
  if (message.includes("ALTA_INTERNACAO_ATIVA")) return "alta-internacao";
  if (message.includes("ALTA_PENDENCIAS_BLOQUEANTES")) return "alta-pendencias";
  if (message.includes("ALTA_SEM_REGISTRO_CLINICO_ASSINADO")) return "alta-sem-registro";
  if (message.includes("ALTA_ORIENTACOES_OBRIGATORIAS")) return "alta-orientacoes";
  if (message.includes("ALTA_DESFECHO_INVALIDO")) return "alta-desfecho";
  if (message.includes("ALTA_SEM_PERMISSAO") || message.includes("ALTA_USUARIO_SEM_PROFISSIONAL") || message.includes("ALTA_SEM_ACESSO_UNIDADE")) return "alta-permissao";
  if (message.includes("ALTA_ATENDIMENTO_CANCELADO") || message.includes("ALTA_ATENDIMENTO_NAO_ATIVO")) return "alta-atendimento";
  return "alta";
}

function mensagemAlta(codigo: string) {
  const mensagens: Record<string, string> = {
    "alta-campos": "Selecione o desfecho e preencha as orientações de alta.",
    "alta-internacao": "Este atendimento possui internação ativa. A conclusão deve ser feita pelo fluxo de alta hospitalar.",
    "alta-pendencias": "Ainda existem pendências assistenciais que impedem a alta.",
    "alta-sem-registro": "É necessário existir ao menos uma anamnese ou evolução clínica assinada antes da alta.",
    "alta-orientacoes": "As orientações de alta são obrigatórias.",
    "alta-desfecho": "O desfecho informado não é válido.",
    "alta-permissao": "Seu login precisa estar vinculado a um profissional autorizado a assinar e conceder alta.",
    "alta-atendimento": "Este atendimento não está em um estado que permita alta médica.",
    atendimento: "O atendimento não foi informado.",
    alta: "Não foi possível concluir o atendimento. Revise as pendências e tente novamente.",
  };
  return mensagens[codigo] ?? mensagens.alta;
}

function detalhePendencias(message: string) {
  const marker = "ALTA_PENDENCIAS_BLOQUEANTES:";
  const index = message.indexOf(marker);
  if (index < 0) return "";
  return message.slice(index + marker.length).trim();
}

export async function finalizarAtendimentoMedico(
  _previousState: BackgroundActionState,
  formData: FormData,
): Promise<BackgroundActionState> {
  const { supabase } = await getAssistencialContext();
  const atendimentoId = texto(formData, "atendimento_id");
  const desfecho = texto(formData, "desfecho");
  const orientacoes = texto(formData, "orientacoes");

  if (!atendimentoId) {
    return { status: "error", code: "atendimento", message: mensagemAlta("atendimento") };
  }
  if (!desfecho || !orientacoes) {
    return { status: "error", code: "alta-campos", message: mensagemAlta("alta-campos") };
  }

  const { error } = await supabase.rpc("finalizar_atendimento_medico", {
    p_atendimento_id: atendimentoId,
    p_desfecho: desfecho,
    p_orientacoes: orientacoes,
  });

  if (error) {
    console.error("[prontuario] alta medica", { code: error.code, message: error.message });
    const codigo = erroAlta(error.message);
    return {
      status: "error",
      code: codigo,
      message: mensagemAlta(codigo),
      detail: detalhePendencias(error.message) || undefined,
    };
  }

  revalidatePath(`/prontuario/${atendimentoId}`);
  revalidatePath(`/prontuario/${atendimentoId}/clinico`);
  revalidatePath(`/prontuario/${atendimentoId}/prescricao`);
  revalidatePath(`/prontuario/${atendimentoId}/alta`);
  revalidatePath("/fila-medica");
  revalidatePath("/atendimentos");

  return {
    status: "success",
    code: "alta",
    message: "Atendimento concluído e alta assinada com sucesso.",
  };
}
