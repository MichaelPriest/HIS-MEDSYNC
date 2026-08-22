"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function digits(value: FormDataEntryValue | null) {
  return String(value ?? "").replace(/\D/g, "");
}

function optional(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

export async function criarPaciente(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: vinculo, error: vinculoError } = await supabase
    .from("usuario_empresas")
    .select("empresa_id")
    .eq("usuario_id", user.id)
    .eq("ativo", true)
    .limit(1)
    .maybeSingle();

  if (vinculoError || !vinculo) redirect("/pacientes/novo?erro=sem-empresa");

  const nomeCompleto = String(formData.get("nome_completo") ?? "").trim();
  const dataNascimento = String(formData.get("data_nascimento") ?? "");
  if (nomeCompleto.length < 2 || !dataNascimento) redirect("/pacientes/novo?erro=campos-obrigatorios");

  const { error } = await supabase.from("pacientes").insert({
    empresa_id: vinculo.empresa_id,
    nome_completo: nomeCompleto,
    nome_social: optional(formData.get("nome_social")),
    cpf: digits(formData.get("cpf")) || null,
    cns: digits(formData.get("cns")) || null,
    data_nascimento: dataNascimento,
    sexo: String(formData.get("sexo") ?? "nao_informado"),
    telefone: optional(formData.get("telefone")),
    email: optional(formData.get("email")),
    cep: digits(formData.get("cep")) || null,
    logradouro: optional(formData.get("logradouro")),
    numero: optional(formData.get("numero")),
    complemento: optional(formData.get("complemento")),
    bairro: optional(formData.get("bairro")),
    cidade: optional(formData.get("cidade")),
    uf: optional(formData.get("uf"))?.toUpperCase() ?? null,
    contato_emergencia_nome: optional(formData.get("contato_emergencia_nome")),
    contato_emergencia_telefone: optional(formData.get("contato_emergencia_telefone")),
    created_by: user.id,
    updated_by: user.id,
  });

  if (error) {
    const code = error.code === "23505" ? "documento-duplicado" : "falha-cadastro";
    redirect(`/pacientes/novo?erro=${code}`);
  }

  redirect("/pacientes?sucesso=cadastrado");
}
