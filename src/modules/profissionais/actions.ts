"use server";

import { redirect } from "next/navigation";
import { digits, getCadastroContext, optional } from "@/modules/cadastros/context";
import { uploadFotoCadastro } from "@/modules/cadastros/fotos";

export async function criarProfissional(formData: FormData) {
  const { supabase, user, empresaId } = await getCadastroContext();
  const nomeCompleto = String(formData.get("nome_completo") ?? "").trim();
  if (nomeCompleto.length < 2) redirect("/profissionais/novo?erro=campos-obrigatorios");

  let fotoPath: string | null = null;
  try {
    fotoPath = await uploadFotoCadastro({ supabase, empresaId, modulo: "profissionais", file: formData.get("foto") });
  } catch (error) {
    const code = error instanceof Error ? error.message : "foto-upload";
    redirect(`/profissionais/novo?erro=${code}`);
  }

  const { error } = await supabase.from("profissionais").insert({
    empresa_id: empresaId,
    nome_completo: nomeCompleto,
    cpf: digits(formData.get("cpf")) || null,
    conselho: optional(formData.get("conselho"))?.toUpperCase() ?? null,
    numero_conselho: optional(formData.get("numero_conselho")),
    uf_conselho: optional(formData.get("uf_conselho"))?.toUpperCase() ?? null,
    especialidade: optional(formData.get("especialidade")),
    cbo: digits(formData.get("cbo")) || null,
    telefone: optional(formData.get("telefone")),
    email: optional(formData.get("email")),
    foto_path: fotoPath,
    created_by: user.id,
    updated_by: user.id,
  });

  if (error) {
    if (fotoPath) await supabase.storage.from("cadastros-fotos").remove([fotoPath]);
    redirect(`/profissionais/novo?erro=${error.code === "23505" ? "duplicado" : "falha-cadastro"}`);
  }
  redirect("/profissionais?sucesso=cadastrado");
}
