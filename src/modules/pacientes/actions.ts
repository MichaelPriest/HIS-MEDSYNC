"use server";

import { redirect } from "next/navigation";
import { asRoute } from "@/lib/route-cast";
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

const sexosValidos = new Set(["feminino", "masculino", "nao_informado"]);
const nomeValido = /^[\p{L}\p{M}][\p{L}\p{M}\s'-]*$/u;

function idadeEmAnos(dataNascimento: string) {
  const birth = new Date(`${dataNascimento}T12:00:00`);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const beforeBirthday = today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

function erroCadastro(code?: string | null) {
  if (code === "23505") return "documento-duplicado";
  if (code === "42501") return "sem-permissao";
  if (code === "22P02" || code === "22007" || code === "23502" || code === "23514") return "dados-invalidos";
  return "falha-cadastro";
}

function senhaAdmissao(raw: FormDataEntryValue | null) {
  const value = String(raw ?? "").trim();
  if (!value) return null;
  try {
    const url = new URL(value, "https://medsync.local");
    const senha = url.searchParams.get("senha");
    if (url.pathname !== "/atendimentos/novo" || !senha || !/^[0-9a-f-]{36}$/i.test(senha)) return null;
    return senha;
  } catch {
    return null;
  }
}

function retornoAdmissaoSeguro(raw: FormDataEntryValue | null, pacienteId?: string, cadastro?: "parcial") {
  const senha = senhaAdmissao(raw);
  if (!senha) return null;
  const query = new URLSearchParams({ senha });
  if (pacienteId) query.set("paciente", pacienteId);
  if (cadastro) query.set("cadastro", cadastro);
  return asRoute(`/atendimentos/novo?${query.toString()}`);
}

function novoPacienteErro(erro: string, retorno: FormDataEntryValue | null) {
  const retornoSeguro = retornoAdmissaoSeguro(retorno);
  const query = new URLSearchParams({ erro });
  if (retornoSeguro) query.set("retorno", retornoSeguro);
  return asRoute(`/pacientes/novo?${query.toString()}`);
}

async function vincularPacienteNaSenhaEmAdmissao({
  supabase,
  retorno,
  pacienteId,
  userId,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  retorno: FormDataEntryValue | null;
  pacienteId: string;
  userId: string;
}) {
  const senhaId = senhaAdmissao(retorno);
  if (!senhaId) return;

  const { data: senha, error: senhaError } = await supabase
    .from("senhas_atendimento")
    .select("id,status,atendimento_id,paciente_id")
    .eq("id", senhaId)
    .maybeSingle();

  if (senhaError) {
    console.error("[pacientes.criar] falha ao consultar senha da admissao", { senhaId, pacienteId, code: senhaError.code });
    return;
  }
  if (!senha || senha.status !== "em_atendimento" || senha.atendimento_id || senha.paciente_id) return;

  const { error: vinculoError } = await supabase
    .from("senhas_atendimento")
    .update({ paciente_id: pacienteId, updated_by: userId, updated_at: new Date().toISOString() })
    .eq("id", senhaId)
    .eq("status", "em_atendimento")
    .is("atendimento_id", null)
    .is("paciente_id", null);

  if (vinculoError) console.error("[pacientes.criar] paciente criado, mas falhou vinculo com senha", { senhaId, pacienteId, code: vinculoError.code });
}

export async function criarPaciente(formData: FormData) {
  const supabase = await createClient();
  const retorno = formData.get("retorno");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: vinculo, error: vinculoError } = await supabase
    .from("usuario_empresas")
    .select("empresa_id")
    .eq("usuario_id", user.id)
    .eq("ativo", true)
    .limit(1)
    .maybeSingle();
  if (vinculoError || !vinculo) redirect(novoPacienteErro("sem-empresa", retorno));

  const { data: podeCriar, error: permissaoError } = await supabase.rpc("tem_permissao", {
    p_empresa: vinculo.empresa_id,
    p_unidade: null,
    p_codigo: "pacientes.criar",
  });
  if (permissaoError) {
    console.error("[pacientes.criar] falha ao verificar permissao", { code: permissaoError.code, message: permissaoError.message });
    redirect(novoPacienteErro("falha-permissao", retorno));
  }
  if (!podeCriar) redirect(novoPacienteErro("sem-permissao", retorno));

  const nomeCompleto = String(formData.get("nome_completo") ?? "").trim();
  const nomeSocial = optional(formData.get("nome_social"));
  const dataNascimento = String(formData.get("data_nascimento") ?? "");
  const cpf = digits(formData.get("cpf"));
  const cns = digits(formData.get("cns"));
  const emails = parseEmails(formData);
  const phones = parsePhones(formData);
  const addresses = parseAddresses(formData);

  if (nomeCompleto.length < 2 || !dataNascimento || !cpf || !validateRequiredContacts(emails, phones, addresses)) {
    redirect(novoPacienteErro("campos-obrigatorios", retorno));
  }
  if (!nomeValido.test(nomeCompleto) || (nomeSocial && !nomeValido.test(nomeSocial))) redirect(novoPacienteErro("nome-invalido", retorno));

  const [{ data: cpfValido }, cnsResult] = await Promise.all([
    supabase.rpc("validar_cpf_br", { p_cpf: cpf }),
    cns ? supabase.rpc("validar_cns_local", { p_cns: cns }) : Promise.resolve({ data: true, error: null }),
  ]);
  if (!cpfValido) redirect(novoPacienteErro("cpf-invalido", retorno));
  if (cns && !cnsResult.data) redirect(novoPacienteErro("cns-invalido", retorno));

  const age = idadeEmAnos(dataNascimento);
  if (age === null || age < 0) redirect(novoPacienteErro("dados-invalidos", retorno));
  const menor = age < 18;
  const responsavelNome = optional(formData.get("responsavel_nome"));
  const responsavelCpf = digits(formData.get("responsavel_cpf"));
  const responsavelParentesco = optional(formData.get("responsavel_parentesco"));
  if (menor && (!responsavelNome || !responsavelCpf || !responsavelParentesco)) redirect(novoPacienteErro("responsavel-obrigatorio", retorno));
  if (responsavelCpf) {
    const { data: responsavelCpfValido } = await supabase.rpc("validar_cpf_br", { p_cpf: responsavelCpf });
    if (!responsavelCpfValido) redirect(novoPacienteErro("responsavel-obrigatorio", retorno));
  }

  const pacienteConvenioId = optional(formData.get("paciente_convenio_id"));
  const pacientePlanoId = optional(formData.get("paciente_plano_id"));
  const pacienteCarteirinha = optional(formData.get("paciente_numero_carteirinha"));
  const pacienteValidade = optional(formData.get("paciente_validade_carteirinha"));
  let planoConfig: { convenio_id: string; carteirinha_regex: string | null; exige_validade_carteirinha: boolean } | null = null;
  if (pacienteConvenioId || pacientePlanoId || pacienteCarteirinha || pacienteValidade) {
    if (!pacienteConvenioId || !pacientePlanoId || !pacienteCarteirinha) redirect(novoPacienteErro("plano-invalido", retorno));
    const { data: plano } = await supabase
      .from("convenio_planos")
      .select("convenio_id,carteirinha_regex,exige_validade_carteirinha")
      .eq("id", pacientePlanoId)
      .eq("empresa_id", vinculo.empresa_id)
      .eq("ativo", true)
      .maybeSingle();
    if (!plano || plano.convenio_id !== pacienteConvenioId) redirect(novoPacienteErro("plano-invalido", retorno));
    planoConfig = plano;
    if (plano.exige_validade_carteirinha && !pacienteValidade) redirect(novoPacienteErro("plano-invalido", retorno));
    if (plano.carteirinha_regex) {
      try {
        if (!new RegExp(plano.carteirinha_regex).test(pacienteCarteirinha)) redirect(novoPacienteErro("plano-invalido", retorno));
      } catch {
        console.error("[pacientes.criar] regex de carteirinha invalida", { planoId: pacientePlanoId });
      }
    }
  }

  const sexoInformado = optional(formData.get("sexo")) || "nao_informado";
  const sexo = sexosValidos.has(sexoInformado) ? sexoInformado : "nao_informado";

  let fotoPath: string | null = null;
  try {
    fotoPath = await uploadFotoCadastro({ supabase, empresaId: vinculo.empresa_id, modulo: "pacientes", file: formData.get("foto") });
  } catch (error) {
    const code = error instanceof Error ? error.message : "foto-upload";
    redirect(novoPacienteErro(code, retorno));
  }

  const { data: paciente, error } = await supabase.from("pacientes").insert({
    empresa_id: vinculo.empresa_id,
    nome_completo: nomeCompleto,
    nome_social: nomeSocial,
    cpf,
    cns: cns || null,
    rg: optional(formData.get("rg")),
    data_nascimento: dataNascimento,
    nacionalidade: optional(formData.get("nacionalidade")),
    estado_civil: optional(formData.get("estado_civil")),
    sexo,
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
    console.error("[pacientes.criar] falha no insert", { code: error?.code, message: error?.message, details: error?.details });
    redirect(novoPacienteErro(erroCadastro(error?.code), retorno));
  }

  await vincularPacienteNaSenhaEmAdmissao({ supabase, retorno, pacienteId: paciente.id, userId: user.id });

  const complementares: Array<PromiseLike<{ error: { code?: string } | null }>> = [
    supabase.from("paciente_emails").insert(emails.map((item) => ({ paciente_id: paciente.id, ...item }))),
    supabase.from("paciente_telefones").insert(phones.map((item) => ({ paciente_id: paciente.id, ...item }))),
    supabase.from("paciente_enderecos").insert(addresses.map((item) => ({ paciente_id: paciente.id, ...item }))),
    supabase.from("paciente_comunicacao_consentimentos").insert([
      { empresa_id: vinculo.empresa_id, paciente_id: paciente.id, canal: "whatsapp", autorizado: String(formData.get("consentimento_whatsapp") ?? "") === "1", created_by: user.id },
      { empresa_id: vinculo.empresa_id, paciente_id: paciente.id, canal: "email", autorizado: String(formData.get("consentimento_email") ?? "") === "1", created_by: user.id },
    ]),
  ];

  if (pacienteConvenioId && pacientePlanoId && pacienteCarteirinha && planoConfig) {
    complementares.push(supabase.from("paciente_convenios").insert({
      empresa_id: vinculo.empresa_id,
      paciente_id: paciente.id,
      convenio_id: pacienteConvenioId,
      plano_id: pacientePlanoId,
      numero_carteirinha: pacienteCarteirinha,
      validade_carteirinha: pacienteValidade,
      principal: true,
      ativo: true,
      elegibilidade_status: "pendente",
      created_by: user.id,
      updated_by: user.id,
    }));
  }

  if (responsavelNome && responsavelCpf && responsavelParentesco) {
    complementares.push(supabase.from("paciente_responsaveis").insert({
      empresa_id: vinculo.empresa_id,
      paciente_id: paciente.id,
      nome: responsavelNome,
      cpf: responsavelCpf,
      parentesco: responsavelParentesco,
      responsavel_legal: true,
      responsavel_financeiro: true,
      created_by: user.id,
      updated_by: user.id,
    }));
  }

  const alerta = optional(formData.get("alerta_assistencial"));
  if (alerta) {
    complementares.push(supabase.from("paciente_alertas").insert({
      empresa_id: vinculo.empresa_id,
      paciente_id: paciente.id,
      tipo: "assistencial",
      severidade: "alta",
      descricao: alerta,
      created_by: user.id,
      updated_by: user.id,
    }));
  }

  const results = await Promise.all(complementares);
  if (results.some((result) => result.error)) {
    console.error("[pacientes.criar] paciente criado com falha em dados complementares", {
      pacienteId: paciente.id,
      codes: results.map((result) => result.error?.code).filter(Boolean),
    });
    const retornoParcial = retornoAdmissaoSeguro(retorno, paciente.id, "parcial");
    if (retornoParcial) redirect(retornoParcial);
    redirect("/pacientes?sucesso=parcial");
  }

  const retornoCompleto = retornoAdmissaoSeguro(retorno, paciente.id);
  if (retornoCompleto) redirect(retornoCompleto);
  redirect("/pacientes?sucesso=cadastrado");
}
