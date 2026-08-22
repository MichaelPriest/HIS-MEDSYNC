"use server";

import { redirect } from "next/navigation";
import { digits, getCadastroContext } from "@/modules/cadastros/context";
import { uploadFotoCadastro } from "@/modules/cadastros/fotos";
import { parseAddresses, parseEmails, parsePhones, validateRequiredContacts } from "@/modules/cadastros/parse-contact-sections";

type PlanoInput = { nome: string; codigo: string | null; acomodacao: string | null };

function parsePlanos(formData: FormData): PlanoInput[] {
  const rows = new Map<string, Partial<PlanoInput>>();
  for (const [key, rawValue] of formData.entries()) {
    const match = key.match(/^planos\[(.+?)\]\.(nome|codigo|acomodacao)$/);
    if (!match) continue;
    const [, id, field] = match;
    const row = rows.get(id) ?? {};
    row[field as keyof PlanoInput] = String(rawValue).trim() || null as never;
    rows.set(id, row);
  }
  return [...rows.values()].filter((row) => row.nome).map((row) => ({ nome: String(row.nome), codigo: row.codigo ? String(row.codigo) : null, acomodacao: row.acomodacao ? String(row.acomodacao) : null }));
}

export async function criarConvenio(formData: FormData) {
  const { supabase, user, empresaId } = await getCadastroContext();
  const razaoSocial = String(formData.get("razao_social") ?? "").trim();
  const nomeFantasia = String(formData.get("nome_fantasia") ?? "").trim();
  const emails = parseEmails(formData);
  const phones = parsePhones(formData);
  const addresses = parseAddresses(formData);
  const planos = parsePlanos(formData);
  if (!razaoSocial || !nomeFantasia || !validateRequiredContacts(emails, phones, addresses)) redirect("/convenios/novo?erro=campos-obrigatorios");

  let logoPath: string | null = null;
  try {
    logoPath = await uploadFotoCadastro({ supabase, empresaId, modulo: "convenios", file: formData.get("logo") });
  } catch (error) {
    const code = error instanceof Error ? error.message : "foto-upload";
    redirect(`/convenios/novo?erro=${code}`);
  }

  const { data: convenio, error } = await supabase.from("convenios").insert({
    empresa_id: empresaId,
    registro_ans: digits(formData.get("registro_ans")) || null,
    razao_social: razaoSocial,
    nome_fantasia: nomeFantasia,
    cnpj: digits(formData.get("cnpj")) || null,
    telefone: phones[0]?.telefone ?? null,
    email: emails[0]?.email ?? null,
    logo_path: logoPath,
    created_by: user.id,
    updated_by: user.id,
  }).select("id").single();

  if (error || !convenio) {
    if (logoPath) await supabase.storage.from("cadastros-fotos").remove([logoPath]);
    redirect(`/convenios/novo?erro=${error?.code === "23505" ? "duplicado" : "falha-cadastro"}`);
  }

  const inserts: PromiseLike<{ error: unknown }>[] = [
    supabase.from("convenio_emails").insert(emails.map((item) => ({ convenio_id: convenio.id, ...item }))),
    supabase.from("convenio_telefones").insert(phones.map((item) => ({ convenio_id: convenio.id, ...item }))),
    supabase.from("convenio_enderecos").insert(addresses.map((item) => ({ convenio_id: convenio.id, ...item }))),
  ];
  if (planos.length) inserts.push(supabase.from("convenio_planos").insert(planos.map((item) => ({ empresa_id: empresaId, convenio_id: convenio.id, ...item, created_by: user.id, updated_by: user.id }))));

  const results = await Promise.all(inserts);
  if (results.some((result) => result.error)) redirect("/convenios?sucesso=parcial");
  redirect("/convenios?sucesso=cadastrado");
}
