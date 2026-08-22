import type { SupabaseClient } from "@supabase/supabase-js";

const FOTO_BUCKET = "cadastros-fotos";
const MAX_BYTES = 5 * 1024 * 1024;
const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function uploadFotoCadastro({
  supabase,
  empresaId,
  modulo,
  file,
}: {
  supabase: SupabaseClient;
  empresaId: string;
  modulo: "pacientes" | "profissionais";
  file: FormDataEntryValue | null;
}) {
  if (!(file instanceof File) || file.size === 0) return null;
  if (file.size > MAX_BYTES) throw new Error("foto-tamanho");

  const ext = MIME_EXT[file.type];
  if (!ext) throw new Error("foto-formato");

  const path = `${empresaId}/${modulo}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(FOTO_BUCKET).upload(path, file, {
    contentType: file.type,
    cacheControl: "3600",
    upsert: false,
  });

  if (error) throw new Error("foto-upload");
  return path;
}

export async function criarUrlFotoAssinada(supabase: SupabaseClient, path: string | null) {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(FOTO_BUCKET).createSignedUrl(path, 60 * 10);
  return error ? null : data.signedUrl;
}
