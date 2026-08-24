"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/permissions/server";
import { asRoute } from "@/lib/route-cast";

function text(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

export async function criarLeitoOperacional(formData: FormData) {
  const { supabase, user, empresaId, unidadeId } = await requirePermission("leitos.gerenciar");
  if (!unidadeId) redirect(asRoute("/internacao/leitos?erro=unidade"));

  const codigo = text(formData, "codigo")?.toUpperCase().replace(/\s+/g, "_");
  const estruturaId = text(formData, "estrutura_fisica_id");
  const quarto = text(formData, "quarto");
  const tipo = text(formData, "tipo") ?? "enfermaria";
  const acomodacao = text(formData, "acomodacao");
  const sexoRestricao = text(formData, "sexo_restricao");
  const isolamentoCapaz = formData.get("isolamento_capaz") === "on";

  if (!codigo || !estruturaId) redirect(asRoute("/internacao/leitos?erro=campos"));

  const { data: estrutura } = await supabase
    .from("estruturas_fisicas")
    .select("id,nome,tipo,permite_internacao")
    .eq("id", estruturaId)
    .eq("empresa_id", empresaId)
    .eq("unidade_id", unidadeId)
    .eq("ativo", true)
    .maybeSingle();

  if (!estrutura || !estrutura.permite_internacao) redirect(asRoute("/internacao/leitos?erro=estrutura"));

  const now = new Date().toISOString();
  const { error } = await supabase.from("leitos").insert({
    empresa_id: empresaId,
    unidade_id: unidadeId,
    estrutura_fisica_id: estrutura.id,
    setor: estrutura.nome,
    quarto,
    codigo,
    tipo,
    acomodacao,
    sexo_restricao: sexoRestricao,
    isolamento_capaz: isolamentoCapaz,
    status: "livre",
    ativo: true,
    created_by: user.id,
    updated_by: user.id,
    updated_at: now,
  });

  if (error) {
    console.error("[leitos.criar] falha", { code: error.code });
    redirect(asRoute(`/internacao/leitos?erro=${error.code === "23505" ? "codigo" : "salvar"}`));
  }

  revalidatePath("/internacao/leitos");
  revalidatePath("/internacao");
  revalidatePath("/internacao/nir");
  revalidatePath("/configuracoes/estrutura");
  redirect(asRoute("/internacao/leitos?sucesso=criado"));
}
