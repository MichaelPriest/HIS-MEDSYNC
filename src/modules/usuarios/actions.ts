"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCadastroContext, optional } from "@/modules/cadastros/context";
import { uploadFotoCadastro } from "@/modules/cadastros/fotos";

export async function atualizarMeuPerfil(formData: FormData) {
  const { supabase, user, empresaId } = await getCadastroContext();
  const nome = String(formData.get("nome") ?? "").trim();
  if (nome.length < 2) redirect("/meu-perfil?erro=nome");

  const { data: atual } = await supabase.from("usuarios").select("foto_path").eq("id", user.id).maybeSingle();
  let fotoPath = atual?.foto_path ?? null;
  const foto = formData.get("foto");
  if (foto instanceof File && foto.size > 0) {
    try {
      const novaFoto = await uploadFotoCadastro({ supabase, empresaId, modulo: "usuarios", file: foto });
      if (fotoPath) await supabase.storage.from("cadastros-fotos").remove([fotoPath]);
      fotoPath = novaFoto;
    } catch (error) {
      const code = error instanceof Error ? error.message : "foto-upload";
      redirect(`/meu-perfil?erro=${code}`);
    }
  }

  const { error } = await supabase.from("usuarios").update({
    nome,
    telefone: optional(formData.get("telefone")),
    cargo: optional(formData.get("cargo")),
    foto_path: fotoPath,
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  }).eq("id", user.id);

  if (error) redirect("/meu-perfil?erro=salvar");
  revalidatePath("/meu-perfil");
  redirect("/meu-perfil?sucesso=1");
}
