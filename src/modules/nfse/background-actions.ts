"use server";

import { revalidatePath } from "next/cache";
import type { BackgroundActionState } from "@/lib/actions/background-action";
import { getAssistencialContext } from "@/modules/assistencial/context";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function messageForError(message = "") {
  if (message.includes("NFSE_CONFIG_SEM_PERMISSAO") || message.includes("NFSE_SEM_PERMISSAO") || message.includes("NFSE_NAO_AUTENTICADO")) {
    return "Seu perfil não possui permissão para registrar a emissão desta NFS-e.";
  }
  if (message.includes("NFSE_NUMERO_OBRIGATORIO")) return "Informe o número oficial da NFS-e.";
  return "Não foi possível registrar a emissão manual da NFS-e.";
}

export async function registrarEmissaoManualNfseBackground(
  notaId: string,
  _previousState: BackgroundActionState,
  formData: FormData,
): Promise<BackgroundActionState> {
  const numero = text(formData, "numero_nfse");
  if (!numero) return { status: "error", code: "numero", message: "Informe o número oficial da NFS-e." };

  const { supabase } = await getAssistencialContext();
  const dataEmissao = text(formData, "data_emissao") || new Date().toISOString();
  const { error } = await supabase.rpc("registrar_estado_nfse_operacional", {
    p_nota_id: notaId,
    p_status: "emitida",
    p_numero_nfse: numero,
    p_codigo_verificacao: text(formData, "codigo_verificacao") || null,
    p_protocolo_prefeitura: text(formData, "protocolo_prefeitura") || null,
    p_xml_retorno: null,
    p_data_emissao: dataEmissao,
  });

  if (error) {
    console.error("[nfse] registrar emissao manual background", {
      code: error.code,
      operation: "registrar_estado_nfse_operacional",
    });
    return { status: "error", code: "operacao", message: messageForError(error.message) };
  }

  revalidatePath(`/financeiro/notas-fiscais/${notaId}`);
  revalidatePath("/financeiro/notas-fiscais");
  revalidatePath("/financeiro");

  return {
    status: "success",
    code: "emitida-manual",
    message: "NFS-e registrada como emitida pelo fluxo auditável.",
  };
}
