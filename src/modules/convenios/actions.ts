"use server";

import { redirect } from "next/navigation";
import { digits, getCadastroContext, optional } from "@/modules/cadastros/context";

export async function criarConvenio(formData: FormData) {
  const { supabase, user, empresaId } = await getCadastroContext();
  const razaoSocial = String(formData.get("razao_social") ?? "").trim();
  const nomeFantasia = String(formData.get("nome_fantasia") ?? "").trim();
  if (!razaoSocial || !nomeFantasia) redirect("/convenios/novo?erro=campos-obrigatorios");

  const { error } = await supabase.from("convenios").insert({
    empresa_id: empresaId,
    registro_ans: digits(formData.get("registro_ans")) || null,
    razao_social: razaoSocial,
    nome_fantasia: nomeFantasia,
    cnpj: digits(formData.get("cnpj")) || null,
    telefone: optional(formData.get("telefone")),
    email: optional(formData.get("email")),
    created_by: user.id,
    updated_by: user.id,
  });

  if (error) redirect(`/convenios/novo?erro=${error.code === "23505" ? "duplicado" : "falha-cadastro"}`);
  redirect("/convenios?sucesso=cadastrado");
}
