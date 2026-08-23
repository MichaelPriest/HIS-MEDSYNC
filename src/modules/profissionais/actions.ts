"use server";

import { redirect } from "next/navigation";
import { digits, getCadastroContext, optional } from "@/modules/cadastros/context";
import { uploadFotoCadastro } from "@/modules/cadastros/fotos";
import { parseAddresses, parseEmails, parsePhones, validateRequiredContacts } from "@/modules/cadastros/parse-contact-sections";

export async function criarProfissional(formData: FormData) {
  const { supabase, user, empresaId } = await getCadastroContext();
  const nomeCompleto = String(formData.get("nome_completo") ?? "").trim();
  const tipoProfissionalRef = String(formData.get("tipo_profissional_ref") ?? "").trim();
  const emails = parseEmails(formData);
  const phones = parsePhones(formData);
  const addresses = parseAddresses(formData);
  const tipoContrato = String(formData.get("tipo_contrato") ?? "").trim();
  const dataInicio = String(formData.get("data_inicio_contrato") ?? "").trim();

  if (nomeCompleto.length < 2 || !tipoProfissionalRef || !validateRequiredContacts(emails, phones, addresses) || !tipoContrato || !dataInicio) {
    redirect("/profissionais/novo?erro=campos-obrigatorios");
  }

  const { data: podeCriar, error: permissaoError } = await supabase.rpc("tem_permissao", {
    p_empresa: empresaId,
    p_unidade: null,
    p_codigo: "profissionais.criar",
  });
  if (permissaoError || !podeCriar) redirect("/profissionais/novo?erro=sem-permissao");

  let tipoProfissionalCatalogoId: string | null = null;
  let tipoProfissionalLegadoId: string | null = null;

  if (tipoProfissionalRef.startsWith("catalogo:")) {
    const catalogoId = tipoProfissionalRef.slice("catalogo:".length);
    const { data: tipoCatalogo, error: tipoError } = await supabase
      .from("catalogos")
      .select("id,codigo")
      .eq("id", catalogoId)
      .eq("empresa_id", empresaId)
      .eq("tipo", "tipo_profissional")
      .eq("ativo", true)
      .maybeSingle();

    if (tipoError || !tipoCatalogo) redirect("/profissionais/novo?erro=tipo-invalido");
    tipoProfissionalCatalogoId = tipoCatalogo.id;

    // Mantém a coluna legada preenchida quando o código empresarial coincide com
    // um tipo global antigo. Tipos personalizados continuam válidos apenas pelo catálogo.
    const { data: legado } = await supabase
      .from("tipos_profissional")
      .select("id")
      .eq("codigo", tipoCatalogo.codigo)
      .eq("ativo", true)
      .maybeSingle();
    tipoProfissionalLegadoId = legado?.id ?? null;
  } else if (tipoProfissionalRef.startsWith("legado:")) {
    const legadoId = tipoProfissionalRef.slice("legado:".length);
    const { data: legado, error: legadoError } = await supabase
      .from("tipos_profissional")
      .select("id")
      .eq("id", legadoId)
      .eq("ativo", true)
      .maybeSingle();
    if (legadoError || !legado) redirect("/profissionais/novo?erro=tipo-invalido");
    tipoProfissionalLegadoId = legado.id;
  } else {
    redirect("/profissionais/novo?erro=tipo-invalido");
  }

  let fotoPath: string | null = null;
  try {
    fotoPath = await uploadFotoCadastro({ supabase, empresaId, modulo: "profissionais", file: formData.get("foto") });
  } catch (error) {
    const code = error instanceof Error ? error.message : "foto-upload";
    redirect(`/profissionais/novo?erro=${code}`);
  }

  const { data: profissional, error } = await supabase.from("profissionais").insert({
    empresa_id: empresaId,
    nome_completo: nomeCompleto,
    cpf: digits(formData.get("cpf")) || null,
    rg: optional(formData.get("rg")),
    data_nascimento: optional(formData.get("data_nascimento")),
    nacionalidade: optional(formData.get("nacionalidade")),
    estado_civil: optional(formData.get("estado_civil")),
    sexo: optional(formData.get("sexo")),
    tipo_profissional_id: tipoProfissionalLegadoId,
    tipo_profissional_catalogo_id: tipoProfissionalCatalogoId,
    conselho: optional(formData.get("conselho"))?.toUpperCase() ?? null,
    numero_conselho: optional(formData.get("numero_conselho")),
    uf_conselho: optional(formData.get("uf_conselho"))?.toUpperCase() ?? null,
    especialidade: optional(formData.get("especialidade")),
    cbo: digits(formData.get("cbo")) || null,
    telefone: phones[0]?.telefone ?? null,
    email: emails[0]?.email ?? null,
    foto_path: fotoPath,
    created_by: user.id,
    updated_by: user.id,
  }).select("id").single();

  if (error || !profissional) {
    console.error("[profissionais.criar] Falha no INSERT", {
      userId: user.id,
      empresaId,
      code: error?.code,
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
    });
    if (fotoPath) await supabase.storage.from("cadastros-fotos").remove([fotoPath]);
    redirect(`/profissionais/novo?erro=${error?.code === "23505" ? "duplicado" : error?.code === "42501" ? "sem-permissao" : "falha-cadastro"}`);
  }

  const valorRaw = String(formData.get("valor_remuneracao") ?? "").replace(/\./g, "").replace(",", ".");
  const cargaRaw = String(formData.get("carga_horaria_semanal") ?? "").replace(",", ".");

  const [emailResult, phoneResult, addressResult, contractResult] = await Promise.all([
    supabase.from("profissional_emails").insert(emails.map((item) => ({ profissional_id: profissional.id, ...item }))),
    supabase.from("profissional_telefones").insert(phones.map((item) => ({ profissional_id: profissional.id, ...item }))),
    supabase.from("profissional_enderecos").insert(addresses.map((item) => ({ profissional_id: profissional.id, ...item }))),
    supabase.from("profissional_contratos").insert({
      empresa_id: empresaId,
      profissional_id: profissional.id,
      tipo_contrato: tipoContrato,
      matricula: optional(formData.get("matricula")),
      data_inicio: dataInicio,
      data_fim: optional(formData.get("data_fim_contrato")),
      carga_horaria_semanal: cargaRaw ? Number(cargaRaw) : null,
      tipo_remuneracao: optional(formData.get("tipo_remuneracao")),
      valor_remuneracao: valorRaw ? Number(valorRaw) : null,
      observacoes: optional(formData.get("observacoes_contrato")),
      created_by: user.id,
      updated_by: user.id,
    }),
  ]);

  if (emailResult.error || phoneResult.error || addressResult.error || contractResult.error) redirect("/profissionais?sucesso=parcial");
  redirect("/profissionais?sucesso=cadastrado");
}
