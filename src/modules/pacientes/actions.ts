"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { uploadFotoCadastro } from "@/modules/cadastros/fotos";
import { parseAddresses, parseEmails, parsePhones, validateRequiredContacts } from "@/modules/cadastros/parse-contact-sections";

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

  const { data: vinculo, error: vinculoError } = await supabase.from("usuario_empresas").select("empresa_id").eq("usuario_id", user.id).eq("ativo", true).limit(1).maybeSingle();
  if (vinculoError || !vinculo) redirect("/pacientes/novo?erro=sem-empresa");

  const nomeCompleto = String(formData.get("nome_completo") ?? "").trim();
  const dataNascimento = String(formData.get("data_nascimento") ?? "");
  const emails = parseEmails(formData);
  const phones = parsePhones(formData);
  const addresses = parseAddresses(formData);
  if (nomeCompleto.length < 2 || !dataNascimento || !validateRequiredContacts(emails, phones, addresses)) redirect("/pacientes/novo?erro=campos-obrigatorios");

  let fotoPath: string | null = null;
  try {
    fotoPath = await uploadFotoCadastro({ supabase, empresaId: vinculo.empresa_id, modulo: "pacientes", file: formData.get("foto") });
  } catch (error) {
    const code = error instanceof Error ? error.message : "foto-upload";
    redirect(`/pacientes/novo?erro=${code}`);
  }

  const { data: paciente, error } = await supabase.from("pacientes").insert({
    empresa_id: vinculo.empresa_id,
    nome_completo: nomeCompleto,
    cpf: digits(formData.get("cpf")) || null,
    rg: optional(formData.get("rg")),
    data_nascimento: dataNascimento,
    nacionalidade: optional(formData.get("nacionalidade")),
    estado_civil: optional(formData.get("estado_civil")),
    sexo: optional(formData.get("sexo")) || "nao_informado",
    email: emails[0]?.email ?? null,
    telefone: phones[0]?.telefone ?? null,
    cep: addresses[0]?.cep ?? null,
    logradouro: addresses[0]?.endereco ?? null,
    numero: addresses[0]?.numero ?? null,
    complemento: addresses[0]?.complemento ?? null,
    bairro: addresses[0]?.bairro ?? null,
    cidade: addresses[0]?.cidade ?? null,
    uf: addresses[0]?.estado ?? null,
    foto_path: fotoPath,
    created_by: user.id,
    updated_by: user.id,
  }).select("id").single();

  if (error || !paciente) {
    if (fotoPath) await supabase.storage.from("cadastros-fotos").remove([fotoPath]);
    redirect(`/pacientes/novo?erro=${error?.code === "23505" ? "documento-duplicado" : "falha-cadastro"}`);
  }

  const [emailResult, phoneResult, addressResult] = await Promise.all([
    supabase.from("paciente_emails").insert(emails.map((item) => ({ paciente_id: paciente.id, ...item }))),
    supabase.from("paciente_telefones").insert(phones.map((item) => ({ paciente_id: paciente.id, ...item }))),
    supabase.from("paciente_enderecos").insert(addresses.map((item) => ({ paciente_id: paciente.id, ...item }))),
  ]);

  if (emailResult.error || phoneResult.error || addressResult.error) redirect("/pacientes?sucesso=parcial");
  redirect("/pacientes?sucesso=cadastrado");
}
