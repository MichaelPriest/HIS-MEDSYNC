"use server";

import { redirect } from "next/navigation";
import { getCadastroContext, optional } from "@/modules/cadastros/context";

const tiposPermitidos = new Set(["especialidade", "cbo", "cid10", "tuss", "tipo_atendimento", "motivo_classificacao"]);

export async function criarCatalogo(formData: FormData) {
  const { supabase, user, empresaId } = await getCadastroContext();
  const tipo = String(formData.get("tipo") ?? "");
  const codigo = String(formData.get("codigo") ?? "").trim();
  const descricao = String(formData.get("descricao") ?? "").trim();
  if (!tiposPermitidos.has(tipo) || !codigo || !descricao) redirect("/catalogos/novo?erro=campos-obrigatorios");

  const { error } = await supabase.from("catalogos").insert({
    empresa_id: empresaId,
    tipo,
    codigo,
    descricao,
    vigencia_inicio: optional(formData.get("vigencia_inicio")),
    vigencia_fim: optional(formData.get("vigencia_fim")),
    created_by: user.id,
    updated_by: user.id,
  });

  if (error) redirect(`/catalogos/novo?erro=${error.code === "23505" ? "duplicado" : "falha-cadastro"}`);
  redirect("/catalogos?sucesso=cadastrado");
}
