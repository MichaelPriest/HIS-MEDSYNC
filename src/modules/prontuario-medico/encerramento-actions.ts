"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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

function detalhePendencias(message: string) {
  const marker = "ALTA_PENDENCIAS_BLOQUEANTES:";
  const index = message.indexOf(marker);
  if (index < 0) return "";
  return message.slice(index + marker.length).trim();
}

export async function finalizarAtendimentoMedico(formData: FormData) {
  const { supabase } = await getAssistencialContext();
  const atendimentoId = texto(formData, "atendimento_id");
  const desfecho = texto(formData, "desfecho");
  const orientacoes = texto(formData, "orientacoes");

  if (!atendimentoId) redirect("/prontuario?erro=atendimento");
  if (!desfecho || !orientacoes) redirect(`/prontuario/${atendimentoId}/alta?erro=alta-campos`);

  const { error } = await supabase.rpc("finalizar_atendimento_medico", {
    p_atendimento_id: atendimentoId,
    p_desfecho: desfecho,
    p_orientacoes: orientacoes,
  });

  if (error) {
    console.error("[prontuario] alta medica", { code: error.code, message: error.message });
    const codigo = erroAlta(error.message);
    const detalhe = detalhePendencias(error.message);
    const qs = detalhe ? `erro=${codigo}&detalhe=${encodeURIComponent(detalhe)}` : `erro=${codigo}`;
    redirect(`/prontuario/${atendimentoId}/alta?${qs}`);
  }

  revalidatePath(`/prontuario/${atendimentoId}`);
  revalidatePath(`/prontuario/${atendimentoId}/clinico`);
  revalidatePath(`/prontuario/${atendimentoId}/prescricao`);
  revalidatePath(`/prontuario/${atendimentoId}/alta`);
  revalidatePath("/fila-medica");
  revalidatePath("/atendimentos");
  redirect(`/prontuario/${atendimentoId}/alta?sucesso=alta`);
}
