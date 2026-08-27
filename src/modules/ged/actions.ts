"use server";

import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getRequestAuthContext } from "@/lib/auth/request-context";

const GED_BUCKET = "ged-documentos";
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "text/xml",
  "application/xml",
]);

type GedAssociations = {
  atendimentoId?: string | null;
  pacienteId?: string | null;
  profissionalId?: string | null;
  convenioId?: string | null;
  loteTissId?: string | null;
  contaFaturamentoId?: string | null;
  solicitacaoExameId?: string | null;
  laboratorioLaudoId?: string | null;
  imagemLaudoId?: string | null;
  substituiDocumentoId?: string | null;
  corporativo?: boolean;
};

type PrepareUploadInput = GedAssociations & {
  nomeArquivo: string;
  mimeType: string;
  tamanhoBytes: number;
};

type FinalizeUploadInput = GedAssociations & {
  titulo: string;
  categoria: string;
  subcategoria?: string | null;
  observacoes?: string | null;
  confidencial?: boolean;
  nomeArquivo: string;
  mimeType: string;
  tamanhoBytes: number;
  hashSha256: string;
  storagePath: string;
};

function safeFilename(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(-140);
  return normalized || "documento";
}

function cleanId(value?: string | null) {
  const v = value?.trim();
  return v || null;
}

async function resolveGedScope(
  associations: GedAssociations,
  empresaId: string,
  unidadeId: string | null,
  supabase: Awaited<ReturnType<typeof getRequestAuthContext>>["supabase"],
) {
  const substituiDocumentoId = cleanId(associations.substituiDocumentoId);
  if (substituiDocumentoId) {
    const { data, error } = await supabase
      .from("ged_documentos")
      .select("id,empresa_id,unidade_id")
      .eq("id", substituiDocumentoId)
      .maybeSingle();
    if (error || !data || data.empresa_id !== empresaId) {
      throw new Error("Documento base não encontrado no escopo atual.");
    }
    return data.unidade_id as string | null;
  }

  const laboratorioLaudoId = cleanId(associations.laboratorioLaudoId);
  if (laboratorioLaudoId) {
    const { data, error } = await supabase
      .from("laboratorio_laudos")
      .select("empresa_id,unidade_id")
      .eq("id", laboratorioLaudoId)
      .maybeSingle();
    if (error || !data || data.empresa_id !== empresaId) {
      throw new Error("Laudo laboratorial não encontrado no escopo atual.");
    }
    return data.unidade_id as string;
  }

  const imagemLaudoId = cleanId(associations.imagemLaudoId);
  if (imagemLaudoId) {
    const { data, error } = await supabase
      .from("imagem_laudos")
      .select("empresa_id,unidade_id")
      .eq("id", imagemLaudoId)
      .maybeSingle();
    if (error || !data || data.empresa_id !== empresaId) {
      throw new Error("Laudo de imagem não encontrado no escopo atual.");
    }
    return data.unidade_id as string;
  }

  const solicitacaoExameId = cleanId(associations.solicitacaoExameId);
  if (solicitacaoExameId) {
    const { data, error } = await supabase
      .from("solicitacoes_exames")
      .select("empresa_id,unidade_id")
      .eq("id", solicitacaoExameId)
      .maybeSingle();
    if (error || !data || data.empresa_id !== empresaId) {
      throw new Error("Solicitação de exame não encontrada no escopo atual.");
    }
    return data.unidade_id as string;
  }

  const atendimentoId = cleanId(associations.atendimentoId);
  if (atendimentoId) {
    const { data, error } = await supabase
      .from("atendimentos")
      .select("empresa_id,unidade_id")
      .eq("id", atendimentoId)
      .maybeSingle();
    if (error || !data || data.empresa_id !== empresaId) {
      throw new Error("Atendimento não encontrado no escopo atual.");
    }
    return data.unidade_id as string;
  }

  if (associations.corporativo) return null;
  if (!unidadeId) throw new Error("Selecione uma unidade para enviar o documento.");
  return unidadeId;
}

async function canUseGed(
  supabase: Awaited<ReturnType<typeof getRequestAuthContext>>["supabase"],
  empresaId: string,
  unidadeId: string | null,
  codes: string[],
) {
  for (const code of codes) {
    const { data, error } = await supabase.rpc("tem_permissao", {
      p_empresa: empresaId,
      p_unidade: unidadeId,
      p_codigo: code,
    });
    if (!error && data === true) return true;
  }
  return false;
}

function validateFileMeta(nomeArquivo: string, mimeType: string, tamanhoBytes: number) {
  if (!nomeArquivo.trim()) throw new Error("Selecione um arquivo válido.");
  if (!Number.isFinite(tamanhoBytes) || tamanhoBytes <= 0) throw new Error("O arquivo está vazio.");
  if (tamanhoBytes > MAX_FILE_SIZE) throw new Error("O arquivo excede o limite de 10 MB.");
  if (!ALLOWED_MIME_TYPES.has(mimeType.toLowerCase())) {
    throw new Error("Formato não permitido. Use PDF, JPG, PNG ou XML.");
  }
}

export async function prepararUploadGed(input: PrepareUploadInput) {
  try {
    const { supabase, user, empresaId, unidadeId } = await getRequestAuthContext();
    if (!user || !empresaId) return { ok: false as const, erro: "Sessão inválida." };

    validateFileMeta(input.nomeArquivo, input.mimeType, input.tamanhoBytes);
    const targetUnit = await resolveGedScope(input, empresaId, unidadeId, supabase);
    const allowed = await canUseGed(supabase, empresaId, targetUnit, [
      "ged.enviar",
      "ged.gerenciar",
      "ged.administrar",
    ]);
    if (!allowed) return { ok: false as const, erro: "Sem permissão para enviar documentos ao GED." };

    const scope = targetUnit ?? "corporativo";
    const context = cleanId(input.atendimentoId)
      ?? cleanId(input.laboratorioLaudoId)
      ?? cleanId(input.imagemLaudoId)
      ?? cleanId(input.solicitacaoExameId)
      ?? "geral";
    const path = `${empresaId}/${scope}/${context}/${randomUUID()}-${safeFilename(input.nomeArquivo)}`;

    const { data, error } = await supabase.storage.from(GED_BUCKET).createSignedUploadUrl(path);
    const token = data && "token" in data ? data.token : null;
    if (error || !data || !token) {
      return { ok: false as const, erro: error?.message ?? "Não foi possível preparar o envio ao Storage." };
    }

    return {
      ok: true as const,
      bucket: GED_BUCKET,
      path,
      token,
      unidadeId: targetUnit,
    };
  } catch (error) {
    return { ok: false as const, erro: error instanceof Error ? error.message : "Falha ao preparar upload." };
  }
}

export async function finalizarUploadGed(input: FinalizeUploadInput) {
  try {
    const { supabase, user, empresaId, unidadeId } = await getRequestAuthContext();
    if (!user || !empresaId) return { ok: false as const, erro: "Sessão inválida." };

    validateFileMeta(input.nomeArquivo, input.mimeType, input.tamanhoBytes);
    if (!/^[0-9a-f]{64}$/i.test(input.hashSha256)) {
      return { ok: false as const, erro: "Hash SHA-256 inválido." };
    }
    if (!input.titulo.trim() || !input.categoria.trim()) {
      return { ok: false as const, erro: "Título e categoria são obrigatórios." };
    }

    const targetUnit = await resolveGedScope(input, empresaId, unidadeId, supabase);
    const scope = targetUnit ?? "corporativo";
    if (!input.storagePath.startsWith(`${empresaId}/${scope}/`)) {
      return { ok: false as const, erro: "Caminho de Storage fora do escopo autorizado." };
    }

    const allowed = await canUseGed(supabase, empresaId, targetUnit, [
      "ged.enviar",
      "ged.gerenciar",
      "ged.administrar",
    ]);
    if (!allowed) return { ok: false as const, erro: "Sem permissão para registrar documento no GED." };

    const payload = {
      empresa_id: empresaId,
      unidade_id: targetUnit,
      atendimento_id: cleanId(input.atendimentoId),
      paciente_id: cleanId(input.pacienteId),
      profissional_id: cleanId(input.profissionalId),
      convenio_id: cleanId(input.convenioId),
      lote_tiss_id: cleanId(input.loteTissId),
      conta_faturamento_id: cleanId(input.contaFaturamentoId),
      solicitacao_exame_id: cleanId(input.solicitacaoExameId),
      laboratorio_laudo_id: cleanId(input.laboratorioLaudoId),
      imagem_laudo_id: cleanId(input.imagemLaudoId),
      substitui_documento_id: cleanId(input.substituiDocumentoId),
      categoria: input.categoria.trim(),
      subcategoria: input.subcategoria?.trim() || null,
      titulo: input.titulo.trim(),
      nome_arquivo: input.nomeArquivo.trim(),
      storage_bucket: GED_BUCKET,
      storage_path: input.storagePath,
      mime_type: input.mimeType.toLowerCase(),
      tamanho_bytes: input.tamanhoBytes,
      hash_sha256: input.hashSha256.toLowerCase(),
      confidencial: Boolean(input.confidencial),
      observacoes: input.observacoes?.trim() || null,
    };

    const { data, error } = await supabase.rpc("registrar_documento_ged", { p_payload: payload });
    if (error || !data) {
      await supabase.storage.from(GED_BUCKET).remove([input.storagePath]);
      return { ok: false as const, erro: error?.message ?? "Não foi possível registrar o documento." };
    }

    revalidatePath("/ged");
    revalidatePath(`/ged/${String(data)}`);
    return { ok: true as const, documentoId: String(data) };
  } catch (error) {
    return { ok: false as const, erro: error instanceof Error ? error.message : "Falha ao finalizar upload." };
  }
}

export async function cancelarUploadGed(storagePath: string) {
  const { supabase, user, empresaId } = await getRequestAuthContext();
  if (!user || !empresaId || !storagePath.startsWith(`${empresaId}/`)) return;
  await supabase.storage.from(GED_BUCKET).remove([storagePath]);
}

export async function atualizarStatusDocumentoGed(formData: FormData) {
  const documentoId = String(formData.get("documento_id") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  const { supabase, user } = await getRequestAuthContext();
  if (!user || !documentoId) redirect("/login");

  const { error } = await supabase.rpc("atualizar_status_documento_ged", {
    p_documento: documentoId,
    p_status: status,
  });
  if (error) redirect(`/ged/${documentoId}?erro=${encodeURIComponent(error.message)}` as never);
  revalidatePath("/ged");
  revalidatePath(`/ged/${documentoId}`);
  redirect(`/ged/${documentoId}?sucesso=status` as never);
}

export async function assinarDocumentoGed(formData: FormData) {
  const documentoId = String(formData.get("documento_id") ?? "").trim();
  const observacao = String(formData.get("observacao") ?? "").trim();
  const { supabase, user } = await getRequestAuthContext();
  if (!user || !documentoId) redirect("/login");

  const { data: doc, error: docError } = await supabase
    .from("ged_documentos")
    .select("id,storage_bucket,storage_path,hash_sha256")
    .eq("id", documentoId)
    .maybeSingle();
  if (docError || !doc) redirect(`/ged/${documentoId}?erro=documento-nao-encontrado` as never);

  const { data: file, error: downloadError } = await supabase.storage
    .from(doc.storage_bucket)
    .download(doc.storage_path);
  if (downloadError || !file) {
    redirect(`/ged/${documentoId}?erro=${encodeURIComponent(downloadError?.message ?? "arquivo-indisponivel")}` as never);
  }

  const digest = createHash("sha256").update(Buffer.from(await file.arrayBuffer())).digest("hex");
  if (!doc.hash_sha256 || digest.toLowerCase() !== doc.hash_sha256.toLowerCase()) {
    redirect(`/ged/${documentoId}?erro=integridade-divergente` as never);
  }

  const { error } = await supabase.rpc("assinar_documento_ged", {
    p_documento: documentoId,
    p_hash_sha256: digest,
    p_observacao: observacao || null,
  });
  if (error) redirect(`/ged/${documentoId}?erro=${encodeURIComponent(error.message)}` as never);

  revalidatePath("/ged");
  revalidatePath(`/ged/${documentoId}`);
  redirect(`/ged/${documentoId}?sucesso=assinado` as never);
}
