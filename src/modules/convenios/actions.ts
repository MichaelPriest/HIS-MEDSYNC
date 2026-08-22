"use server";

import { redirect } from "next/navigation";
import { digits, getCadastroContext } from "@/modules/cadastros/context";
import { parseAddresses, parseEmails, parsePhones, validateRequiredContacts } from "@/modules/cadastros/parse-contact-sections";

export async function criarConvenio(formData: FormData) {
  const { supabase, user, empresaId } = await getCadastroContext();
  const razaoSocial = String(formData.get("razao_social") ?? "").trim();
  const nomeFantasia = String(formData.get("nome_fantasia") ?? "").trim();
  const emails = parseEmails(formData);
  const phones = parsePhones(formData);
  const addresses = parseAddresses(formData);
  if (!razaoSocial || !nomeFantasia || !validateRequiredContacts(emails, phones, addresses)) redirect("/convenios/novo?erro=campos-obrigatorios");

  const { data: convenio, error } = await supabase.from("convenios").insert({
    empresa_id: empresaId,
    registro_ans: digits(formData.get("registro_ans")) || null,
    razao_social: razaoSocial,
    nome_fantasia: nomeFantasia,
    cnpj: digits(formData.get("cnpj")) || null,
    telefone: phones[0]?.telefone ?? null,
    email: emails[0]?.email ?? null,
    created_by: user.id,
    updated_by: user.id,
  }).select("id").single();

  if (error || !convenio) redirect(`/convenios/novo?erro=${error?.code === "23505" ? "duplicado" : "falha-cadastro"}`);

  const [emailResult, phoneResult, addressResult] = await Promise.all([
    supabase.from("convenio_emails").insert(emails.map((item) => ({ convenio_id: convenio.id, ...item }))),
    supabase.from("convenio_telefones").insert(phones.map((item) => ({ convenio_id: convenio.id, ...item }))),
    supabase.from("convenio_enderecos").insert(addresses.map((item) => ({ convenio_id: convenio.id, ...item }))),
  ]);
  if (emailResult.error || phoneResult.error || addressResult.error) redirect("/convenios?sucesso=parcial");
  redirect("/convenios?sucesso=cadastrado");
}
