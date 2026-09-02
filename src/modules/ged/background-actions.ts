"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import type { BackgroundActionState } from "@/lib/actions/background-action";
import { getRequestAuthContext } from "@/lib/auth/request-context";

export type GedActionState = BackgroundActionState;

function failure(code: string, message: string, detail?: string): GedActionState {
  return { status: "error", code, message, detail };
}

function success(documentoId: string, message: string): GedActionState {
  revalidatePath("/ged");
  revalidatePath(`/ged/${documentoId}`);
  return { status: "success", message };
}

export async function atualizarStatusDocumentoGedBackground(
  _previousState: GedActionState,
  formData: FormData,
): Promise<GedActionState> {
  const documentoId = String(formData.get("documento_id") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  if (!documentoId || !status) {
    return failure("dados-status", "Informe o documento e o novo status.");
  }

  const { supabase, user } = await getRequestAuthContext();
  if (!user) return failure("sessao", "Sua sessão não está disponível para alterar este documento.");

  const { error } = await supabase.rpc("atualizar_status_documento_ged", {
    p_documento: documentoId,
    p_status: status,
  });
  if (error) {
    console.error("[ged] atualizar status", {
      code: error.code,
      operation: "atualizar_status_documento_ged",
      documentoId,
    });
    return failure(
      "status-documento",
      "Não foi possível atualizar o status do documento.",
      error.code ? `Código técnico: ${error.code}` : undefined,
    );
  }

  const message = status === "arquivado"
    ? "Documento arquivado."
    : status === "ativo"
      ? "Documento reativado."
      : status === "cancelado"
        ? "Documento cancelado."
        : "Status do documento atualizado.";
  return success(documentoId, message);
}

export async function assinarDocumentoGedBackground(
  _previousState: GedActionState,
  formData: FormData,
): Promise<GedActionState> {
  const documentoId = String(formData.get("documento_id") ?? "").trim();
  const observacao = String(formData.get("observacao") ?? "").trim();
  if (!documentoId) return failure("documento", "O documento não foi informado para assinatura.");

  const { supabase, user } = await getRequestAuthContext();
  if (!user) return failure("sessao", "Sua sessão não está disponível para assinar este documento.");

  const { data: doc, error: docError } = await supabase
    .from("ged_documentos")
    .select("id,storage_bucket,storage_path,hash_sha256")
    .eq("id", documentoId)
    .maybeSingle();
  if (docError || !doc) {
    console.error("[ged] localizar documento para assinatura", {
      code: docError?.code,
      documentoId,
    });
    return failure(
      "documento-nao-encontrado",
      "Não foi possível localizar o documento no escopo autorizado.",
      docError?.code ? `Código técnico: ${docError.code}` : undefined,
    );
  }

  const { data: file, error: downloadError } = await supabase.storage
    .from(doc.storage_bucket)
    .download(doc.storage_path);
  if (downloadError || !file) {
    console.error("[ged] baixar arquivo para validação", {
      code: downloadError?.message,
      documentoId,
    });
    return failure(
      "arquivo-indisponivel",
      "Não foi possível acessar o arquivo para validar sua integridade.",
      downloadError?.message,
    );
  }

  const digest = createHash("sha256").update(Buffer.from(await file.arrayBuffer())).digest("hex");
  if (!doc.hash_sha256 || digest.toLowerCase() !== doc.hash_sha256.toLowerCase()) {
    return failure(
      "integridade-divergente",
      "A assinatura foi bloqueada porque o SHA-256 do arquivo não corresponde ao hash registrado no GED.",
    );
  }

  const { error } = await supabase.rpc("assinar_documento_ged", {
    p_documento: documentoId,
    p_hash_sha256: digest,
    p_observacao: observacao || null,
  });
  if (error) {
    console.error("[ged] assinar documento", {
      code: error.code,
      operation: "assinar_documento_ged",
      documentoId,
    });
    return failure(
      "assinatura-documento",
      "A integridade foi validada, mas não foi possível concluir a assinatura do documento.",
      error.code ? `Código técnico: ${error.code}` : undefined,
    );
  }

  return success(documentoId, "Integridade validada e documento assinado.");
}
