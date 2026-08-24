"use server";

import { redirect } from "next/navigation";
import { getAssistencialContext } from "@/modules/assistencial/context";

function optional(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? "").trim();
  return value || null;
}

function errorCode(message?: string | null) {
  const value = String(message ?? "");
  if (value.includes("ADMISSAO_SENHA_INVALIDA") || value.includes("ADMISSAO_SENHA_CONCORRENTE") || value.includes("ADMISSAO_SENHA_JA_UTILIZADA")) return "senha-invalida";
  if (value.includes("ADMISSAO_SEM_PERMISSAO") || value.includes("ADMISSAO_NAO_AUTENTICADA")) return "permissao";
  if (value.includes("ADMISSAO_PACIENTE_INVALIDO") || value.includes("ADMISSAO_PACIENTE_DIVERGENTE")) return "paciente";
  if (value.includes("ADMISSAO_PROFISSIONAL_INVALIDO")) return "profissional";
  if (value.includes("ADMISSAO_PLANO_INVALIDO") || value.includes("ADMISSAO_COBERTURA_INVALIDA") || value.includes("ADMISSAO_COBERTURA_INCOMPLETA")) return "cobertura";
  if (value.includes("ADMISSAO_CAMPOS_OBRIGATORIOS") || value.includes("ADMISSAO_DADOS_INVALIDOS")) return "campos-obrigatorios";
  return "falha-cadastro";
}

export async function abrirAtendimento(senhaId: string, formData: FormData) {
  const { supabase } = await getAssistencialContext();
  if (!senhaId) redirect("/senhas?erro=senha-obrigatoria");

  const pacienteId = String(formData.get("paciente_id") ?? "").trim();
  const tipoAtendimento = String(formData.get("tipo_atendimento") ?? "").trim();
  const cobertura = String(formData.get("cobertura") ?? "particular").trim();
  const pacienteNome = String(formData.get("paciente_nome") ?? "").trim();
  const pacienteNascimento = String(formData.get("paciente_data_nascimento") ?? "").trim();
  const pacienteTelefone = String(formData.get("paciente_telefone") ?? "").trim();
  const pacienteEndereco = String(formData.get("paciente_endereco") ?? "").trim();
  const pacienteNumero = String(formData.get("paciente_numero") ?? "").trim();
  const pacienteBairro = String(formData.get("paciente_bairro") ?? "").trim();
  const pacienteCidade = String(formData.get("paciente_cidade") ?? "").trim();
  const pacienteEstado = String(formData.get("paciente_estado") ?? "").trim().toUpperCase();

  if (!pacienteId || !tipoAtendimento || !pacienteNome || !pacienteNascimento || !pacienteTelefone || !pacienteEndereco || !pacienteNumero || !pacienteBairro || !pacienteCidade || pacienteEstado.length !== 2) {
    redirect(`/atendimentos/novo?senha=${senhaId}&erro=campos-obrigatorios`);
  }
  if (cobertura !== "particular" && cobertura !== "convenio") {
    redirect(`/atendimentos/novo?senha=${senhaId}&erro=cobertura`);
  }

  const convenioId = cobertura === "convenio" ? optional(formData, "convenio_id") : null;
  const planoId = cobertura === "convenio" ? optional(formData, "plano_id") : null;
  const carteirinha = cobertura === "convenio" ? optional(formData, "numero_carteirinha") : null;
  if (cobertura === "convenio" && (!convenioId || !planoId || !carteirinha)) {
    redirect(`/atendimentos/novo?senha=${senhaId}&erro=cobertura`);
  }

  const payload = {
    paciente_id: pacienteId,
    profissional_id: optional(formData, "profissional_id"),
    tipo_atendimento: tipoAtendimento,
    cobertura,
    convenio_id: convenioId,
    plano_id: planoId,
    numero_carteirinha: carteirinha,
    atendimento_rn: cobertura === "convenio" && String(formData.get("atendimento_rn") ?? "") === "true",
    validade_carteirinha: cobertura === "convenio" ? optional(formData, "validade_carteirinha") : null,
    numero_autorizacao: cobertura === "convenio" ? optional(formData, "numero_autorizacao") : null,
    senha_autorizacao: cobertura === "convenio" ? optional(formData, "senha_autorizacao") : null,
    paciente_nome: pacienteNome,
    paciente_cpf: optional(formData, "paciente_cpf"),
    paciente_rg: optional(formData, "paciente_rg"),
    paciente_cns: optional(formData, "paciente_cns"),
    paciente_data_nascimento: pacienteNascimento,
    paciente_nacionalidade: optional(formData, "paciente_nacionalidade"),
    paciente_estado_civil: optional(formData, "paciente_estado_civil"),
    paciente_sexo: optional(formData, "paciente_sexo"),
    paciente_telefone: pacienteTelefone,
    paciente_email: optional(formData, "paciente_email"),
    paciente_cep: optional(formData, "paciente_cep"),
    paciente_endereco: pacienteEndereco,
    paciente_numero: pacienteNumero,
    paciente_complemento: optional(formData, "paciente_complemento"),
    paciente_bairro: pacienteBairro,
    paciente_cidade: pacienteCidade,
    paciente_estado: pacienteEstado,
    origem: optional(formData, "origem"),
    observacoes: optional(formData, "observacoes"),
  };

  const { data: atendimentoId, error } = await supabase.rpc("abrir_atendimento_por_senha", {
    p_senha_id: senhaId,
    p_payload: payload,
  });

  if (error || !atendimentoId) {
    console.error("[admissao] falha na transacao de abertura", {
      code: error?.code ?? "SEM_ID",
      operation: "abrir_atendimento_por_senha",
    });
    redirect(`/atendimentos/novo?senha=${senhaId}&erro=${errorCode(error?.message)}`);
  }

  const id = String(atendimentoId);
  redirect(cobertura === "convenio" ? `/autorizacoes?atendimento=${id}` : `/triagem?sucesso=admissao&atendimento=${id}`);
}
