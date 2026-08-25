"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/permissions/server";
import { asRoute } from "@/lib/route-cast";

function text(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function onlyDigits(value: string | null) {
  return value ? value.replace(/\D/g, "") : null;
}

export async function salvarConfiguracaoEmpresa(formData: FormData) {
  const { supabase, user, empresaId } = await requirePermission("empresas.administrar");
  const razaoSocial = text(formData, "razao_social");
  const nomeFantasia = text(formData, "nome_fantasia");
  const cnpj = onlyDigits(text(formData, "cnpj"));
  if (!razaoSocial || !nomeFantasia || !cnpj || cnpj.length !== 14) redirect("/configuracoes/empresa?erro=campos");

  const { data: atual } = await supabase.from("empresas").select("logo_path,logo_url").eq("id", empresaId).maybeSingle();
  let logoPath = atual?.logo_path ?? null;
  let logoUrl = atual?.logo_url ?? null;
  const logo = formData.get("logo");

  if (logo instanceof File && logo.size > 0) {
    const mimePermitidos = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
    if (!mimePermitidos.includes(logo.type) || logo.size > 2 * 1024 * 1024) redirect("/configuracoes/empresa?erro=logo");
    const extension = logo.type === "image/jpeg" ? "jpg" : logo.type === "image/svg+xml" ? "svg" : logo.type.split("/")[1] || "png";
    const path = `${empresaId}/logo-${Date.now()}.${extension}`;
    const buffer = await logo.arrayBuffer();
    const { error: uploadError } = await supabase.storage.from("branding").upload(path, buffer, {
      contentType: logo.type,
      cacheControl: "3600",
      upsert: false,
    });
    if (uploadError) {
      console.error("[empresa] upload logo", { code: uploadError.message });
      redirect("/configuracoes/empresa?erro=upload");
    }
    const publicUrl = supabase.storage.from("branding").getPublicUrl(path).data.publicUrl;
    if (logoPath && logoPath !== path) await supabase.storage.from("branding").remove([logoPath]);
    logoPath = path;
    logoUrl = publicUrl;
  }

  const now = new Date().toISOString();
  const { error } = await supabase.from("empresas").update({
    razao_social: razaoSocial,
    nome_fantasia: nomeFantasia,
    nome_curto: text(formData, "nome_curto"),
    cnpj,
    inscricao_estadual: text(formData, "inscricao_estadual"),
    inscricao_municipal: text(formData, "inscricao_municipal"),
    cnes: text(formData, "cnes"),
    telefone: text(formData, "telefone"),
    whatsapp: text(formData, "whatsapp"),
    email: text(formData, "email"),
    site: text(formData, "site"),
    cep: onlyDigits(text(formData, "cep")),
    logradouro: text(formData, "logradouro"),
    numero: text(formData, "numero"),
    complemento: text(formData, "complemento"),
    bairro: text(formData, "bairro"),
    cidade: text(formData, "cidade"),
    uf: text(formData, "uf")?.toUpperCase().slice(0, 2) ?? null,
    logo_path: logoPath,
    logo_url: logoUrl,
    rodape_documentos: text(formData, "rodape_documentos"),
    updated_at: now,
    updated_by: user.id,
  }).eq("id", empresaId);

  if (error) {
    console.error("[empresa] salvar configuracao", { code: error.code });
    redirect("/configuracoes/empresa?erro=salvar");
  }

  revalidatePath("/configuracoes/empresa");
  revalidatePath("/painel", "layout");
  redirect(asRoute("/configuracoes/empresa?sucesso=salvo"));
}
