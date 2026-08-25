"use server";

import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { getAssistencialContext } from "@/modules/assistencial/context";

function optional(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? "").trim();
  return value || null;
}

function hashRef(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function metodoPermitido(config: string, metodo: string | null) {
  if (!metodo) return false;
  if (config === "biometria_ou_token") return metodo === "biometria_digital" || metodo === "token";
  return config === metodo;
}

function errorCode(message?: string | null) {
  const value = String(message ?? "");
  if (value.includes("ADMISSAO_SENHA_INVALIDA") || value.includes("ADMISSAO_SENHA_CONCORRENTE") || value.includes("ADMISSAO_SENHA_JA_UTILIZADA")) return "senha-invalida";
  if (value.includes("ADMISSAO_AGENDAMENTO_INVALIDO") || value.includes("ADMISSAO_AGENDAMENTO_JA_UTILIZADO")) return "agendamento-invalido";
  if (value.includes("ADMISSAO_AGENDAMENTO_CIRURGICO")) return "agendamento-cirurgico";
  if (value.includes("ADMISSAO_SEM_PERMISSAO") || value.includes("ADMISSAO_NAO_AUTENTICADA")) return "permissao";
  if (value.includes("ADMISSAO_PACIENTE_INVALIDO") || value.includes("ADMISSAO_PACIENTE_DIVERGENTE")) return "paciente";
  if (value.includes("ADMISSAO_PROFISSIONAL_INVALIDO")) return "profissional";
  if (value.includes("ADMISSAO_PLANO_INVALIDO") || value.includes("ADMISSAO_COBERTURA_INVALIDA") || value.includes("ADMISSAO_COBERTURA_INCOMPLETA")) return "cobertura";
  if (value.includes("ADMISSAO_CAMPOS_OBRIGATORIOS") || value.includes("ADMISSAO_DADOS_INVALIDOS")) return "campos-obrigatorios";
  return "falha-cadastro";
}

function admissionInput(formData: FormData) {
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
  const convenioId = cobertura === "convenio" ? optional(formData, "convenio_id") : null;
  const planoId = cobertura === "convenio" ? optional(formData, "plano_id") : null;
  const carteirinha = cobertura === "convenio" ? optional(formData, "numero_carteirinha") : null;
  const identificacaoMetodo = cobertura === "convenio" ? optional(formData, "identificacao_metodo") : null;
  const identificacaoReferencia = cobertura === "convenio" ? optional(formData, "identificacao_referencia") : null;
  const identificacaoDispositivo = cobertura === "convenio" ? optional(formData, "identificacao_dispositivo") : null;

  const camposValidos = Boolean(
    pacienteId && tipoAtendimento && pacienteNome && pacienteNascimento && pacienteTelefone &&
    pacienteEndereco && pacienteNumero && pacienteBairro && pacienteCidade && pacienteEstado.length === 2
  );
  const coberturaValida = cobertura === "particular" || cobertura === "convenio";
  const convenioCompleto = cobertura !== "convenio" || Boolean(convenioId && planoId && carteirinha);

  return {
    camposValidos,
    coberturaValida,
    convenioCompleto,
    cobertura,
    convenioId,
    pacienteId,
    identificacaoMetodo,
    identificacaoReferencia,
    identificacaoDispositivo,
    payload: {
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
    },
  };
}

async function validarIdentificacaoExigida(
  contexto: Awaited<ReturnType<typeof getAssistencialContext>>,
  input: ReturnType<typeof admissionInput>,
  retorno: string,
) {
  if (input.cobertura !== "convenio" || !input.convenioId) return null;
  const { data: config } = await contexto.supabase.from("convenio_identificacao_config")
    .select("metodo,provedor,exige_no_atendimento,ativo")
    .eq("empresa_id", contexto.empresaId).eq("convenio_id", input.convenioId).eq("ativo", true).maybeSingle();
  if (!config?.exige_no_atendimento || config.metodo === "nenhum") return config ?? null;
  if (!input.identificacaoReferencia || !metodoPermitido(config.metodo, input.identificacaoMetodo)) {
    redirect(`${retorno}&erro=identificacao-obrigatoria`);
  }
  return config;
}

async function registrarIdentificacaoAtendimento(
  contexto: Awaited<ReturnType<typeof getAssistencialContext>>,
  atendimentoId: string,
  input: ReturnType<typeof admissionInput>,
  config: { provedor?: string | null; exige_no_atendimento?: boolean } | null,
) {
  if (!input.convenioId || !input.identificacaoMetodo || !input.identificacaoReferencia) return;
  const { error } = await contexto.supabase.from("atendimento_identificacao_eventos").insert({
    empresa_id: contexto.empresaId,
    unidade_id: contexto.unidadeId,
    atendimento_id: atendimentoId,
    paciente_id: input.pacienteId,
    convenio_id: input.convenioId,
    metodo: input.identificacaoMetodo,
    referencia_hash: hashRef(input.identificacaoReferencia),
    provedor: config?.provedor ?? null,
    dispositivo: input.identificacaoDispositivo,
    validado: true,
    validado_em: new Date().toISOString(),
    created_by: contexto.user.id,
  });
  if (error) console.error("[admissao.identificacao] falha ao registrar evidência", { code: error.code });
}

export async function abrirAtendimento(senhaId: string, formData: FormData) {
  const contexto = await getAssistencialContext();
  if (!senhaId) redirect("/senhas?erro=senha-obrigatoria");

  const input = admissionInput(formData);
  if (!input.camposValidos) redirect(`/atendimentos/novo?senha=${senhaId}&erro=campos-obrigatorios`);
  if (!input.coberturaValida || !input.convenioCompleto) redirect(`/atendimentos/novo?senha=${senhaId}&erro=cobertura`);
  const config = await validarIdentificacaoExigida(contexto, input, `/atendimentos/novo?senha=${encodeURIComponent(senhaId)}`);

  const { data: atendimentoId, error } = await contexto.supabase.rpc("abrir_atendimento_por_senha", {
    p_senha_id: senhaId,
    p_payload: input.payload,
  });

  if (error || !atendimentoId) {
    console.error("[admissao] falha na transacao de abertura", { code: error?.code ?? "SEM_ID", operation: "abrir_atendimento_por_senha" });
    redirect(`/atendimentos/novo?senha=${senhaId}&erro=${errorCode(error?.message)}`);
  }

  const id = String(atendimentoId);
  await registrarIdentificacaoAtendimento(contexto, id, input, config);
  redirect(input.cobertura === "convenio" ? `/autorizacoes?atendimento=${id}` : `/triagem?sucesso=admissao&atendimento=${id}`);
}

export async function abrirAtendimentoAgendado(agendamentoId: string, formData: FormData) {
  const contexto = await getAssistencialContext();
  if (!agendamentoId) redirect("/agenda?erro=agendamento-invalido");

  const input = admissionInput(formData);
  if (!input.camposValidos) redirect(`/atendimentos/novo?agendamento=${agendamentoId}&erro=campos-obrigatorios`);
  if (!input.coberturaValida || !input.convenioCompleto) redirect(`/atendimentos/novo?agendamento=${agendamentoId}&erro=cobertura`);
  const config = await validarIdentificacaoExigida(contexto, input, `/atendimentos/novo?agendamento=${encodeURIComponent(agendamentoId)}`);

  const { data: atendimentoId, error } = await contexto.supabase.rpc("abrir_atendimento_por_agendamento", {
    p_agendamento_id: agendamentoId,
    p_payload: input.payload,
  });

  if (error || !atendimentoId) {
    console.error("[admissao.agenda] falha na transacao de abertura", { code: error?.code ?? "SEM_ID", operation: "abrir_atendimento_por_agendamento" });
    redirect(`/atendimentos/novo?agendamento=${agendamentoId}&erro=${errorCode(error?.message)}`);
  }

  const id = String(atendimentoId);
  await registrarIdentificacaoAtendimento(contexto, id, input, config);
  redirect(input.cobertura === "convenio" ? `/autorizacoes?atendimento=${id}` : `/triagem?sucesso=admissao&atendimento=${id}`);
}
