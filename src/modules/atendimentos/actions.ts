"use server";

import { createHash, randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import type { BackgroundActionState } from "@/lib/actions/background-action";
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

const ADMISSION_ERRORS: Record<string, string> = {
  "campos-obrigatorios": "Preencha os campos obrigatórios do paciente e do atendimento.",
  cobertura: "Revise o convênio, plano e os dados da carteirinha.",
  paciente: "O paciente selecionado não está mais disponível para esta admissão.",
  profissional: "Selecione um profissional válido. Para convênio, o profissional é obrigatório.",
  "conselho-incompleto": "O profissional está com conselho, número ou UF incompletos. Corrija o cadastro profissional antes de faturar.",
  "cbo-ausente": "O profissional selecionado não possui CBO cadastrado. A abertura por convênio foi bloqueada para evitar glosa.",
  "cnes-ausente": "A unidade não possui CNES cadastrado. Corrija a estrutura da unidade antes da abertura por convênio.",
  "registro-ans-ausente": "A operadora selecionada não possui Registro ANS cadastrado.",
  "carteira-vencida": "A carteirinha está vencida. Atualize o vínculo do beneficiário antes de abrir o atendimento.",
  "validade-carteira": "O plano exige validade da carteirinha. Informe a data de validade.",
  "carteirinha-padrao": "A carteirinha não corresponde ao padrão configurado para o plano selecionado.",
  tuss: "Selecione um procedimento TUSS válido para este atendimento.",
  "indicacao-clinica": "A indicação clínica é obrigatória para SADT, exames, pequena cirurgia e sessão de terapia.",
  "classificacao-tiss": "Revise os domínios regulatórios ANS/TISS e a classificação operacional do atendimento.",
  permissao: "Seu perfil não possui permissão para abrir atendimentos nesta unidade.",
  "senha-invalida": "Esta senha não está mais disponível para admissão. Ela pode ter sido processada por outro guichê.",
  "agendamento-invalido": "Este agendamento não está mais disponível para abertura de atendimento. Verifique o check-in ou se ele já foi admitido.",
  "agendamento-cirurgico": "Cirurgia eletiva deve seguir pelo fluxo de pré-admissão/centro cirúrgico.",
  "identificacao-obrigatoria": "Este convênio exige biometria ou token para concluir a admissão. Informe a identificação do beneficiário na aba Cobertura / Autorização.",
  "falha-cadastro": "Não foi possível concluir a admissão. Revise os dados e tente novamente.",
};

function failure(code: string): BackgroundActionState {
  return {
    status: "error",
    code,
    message: ADMISSION_ERRORS[code] ?? ADMISSION_ERRORS["falha-cadastro"],
  };
}

function errorCode(message?: string | null) {
  const value = String(message ?? "");
  if (value.includes("ADMISSAO_SENHA_INVALIDA") || value.includes("ADMISSAO_SENHA_CONCORRENTE") || value.includes("ADMISSAO_SENHA_JA_UTILIZADA")) return "senha-invalida";
  if (value.includes("ADMISSAO_AGENDAMENTO_INVALIDO") || value.includes("ADMISSAO_AGENDAMENTO_JA_UTILIZADO")) return "agendamento-invalido";
  if (value.includes("ADMISSAO_AGENDAMENTO_CIRURGICO")) return "agendamento-cirurgico";
  if (value.includes("ADMISSAO_SEM_PERMISSAO") || value.includes("ADMISSAO_NAO_AUTENTICADA")) return "permissao";
  if (value.includes("ADMISSAO_PACIENTE_INVALIDO") || value.includes("ADMISSAO_PACIENTE_DIVERGENTE")) return "paciente";
  if (value.includes("ADMISSAO_PROFISSIONAL_INVALIDO") || value.includes("ADMISSAO_PROFISSIONAL_OBRIGATORIO_CONVENIO")) return "profissional";
  if (value.includes("ADMISSAO_CONSELHO_INCOMPLETO")) return "conselho-incompleto";
  if (value.includes("ADMISSAO_CBO_AUSENTE")) return "cbo-ausente";
  if (value.includes("ADMISSAO_CNES_AUSENTE")) return "cnes-ausente";
  if (value.includes("ADMISSAO_REGISTRO_ANS_AUSENTE")) return "registro-ans-ausente";
  if (value.includes("ADMISSAO_CARTEIRA_VENCIDA")) return "carteira-vencida";
  if (value.includes("ADMISSAO_VALIDADE_CARTEIRA_OBRIGATORIA")) return "validade-carteira";
  if (value.includes("ADMISSAO_CARTEIRINHA_PADRAO_INVALIDO")) return "carteirinha-padrao";
  if (value.includes("ADMISSAO_TUSS_OBRIGATORIO") || value.includes("ADMISSAO_TUSS_NAO_CADASTRADO")) return "tuss";
  if (value.includes("ADMISSAO_INDICACAO_OBRIGATORIA")) return "indicacao-clinica";
  if (value.includes("ADMISSAO_REGIME_TISS_INVALIDO") || value.includes("ADMISSAO_TIPO_TISS_INVALIDO") || value.includes("ADMISSAO_TUSS50_") || value.includes("ADMISSAO_TUSS52_")) return "classificacao-tiss";
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
      paciente_nome_social: optional(formData, "paciente_nome_social"),
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
      regime_atendimento: optional(formData, "regime_atendimento"),
      tipo_atendimento_tiss: optional(formData, "tipo_atendimento_tiss"),
      tipo_atendimento_tuss50_codigo: optional(formData, "tipo_atendimento_tuss50_codigo"),
      tipo_consulta_tuss52_codigo: optional(formData, "tipo_consulta_tuss52_codigo"),
      codigo_tuss_principal: optional(formData, "codigo_tuss_principal"),
      descricao_tuss_principal: optional(formData, "descricao_tuss_principal"),
      tabela_tiss_principal: optional(formData, "tabela_tiss_principal"),
      item_assistencial_id_principal: optional(formData, "item_assistencial_id_principal"),
      indicacao_clinica: optional(formData, "indicacao_clinica"),
    },
  };
}

type IdentificacaoConfig = {
  metodo?: string | null;
  provedor?: string | null;
  exige_no_atendimento?: boolean | null;
  ativo?: boolean | null;
};

async function validarIdentificacaoExigida(
  contexto: Awaited<ReturnType<typeof getAssistencialContext>>,
  input: ReturnType<typeof admissionInput>,
): Promise<{ config: IdentificacaoConfig | null; error: BackgroundActionState | null }> {
  if (input.cobertura !== "convenio" || !input.convenioId) return { config: null, error: null };
  const { data: config } = await contexto.supabase.from("convenio_identificacao_config")
    .select("metodo,provedor,exige_no_atendimento,ativo")
    .eq("empresa_id", contexto.empresaId).eq("convenio_id", input.convenioId).eq("ativo", true).maybeSingle();
  if (!config?.exige_no_atendimento || config.metodo === "nenhum") return { config: config ?? null, error: null };
  if (!input.identificacaoReferencia || !metodoPermitido(config.metodo, input.identificacaoMetodo)) {
    return { config, error: failure("identificacao-obrigatoria") };
  }
  return { config, error: null };
}

async function registrarIdentificacaoAtendimento(
  contexto: Awaited<ReturnType<typeof getAssistencialContext>>,
  atendimentoId: string,
  input: ReturnType<typeof admissionInput>,
  config: IdentificacaoConfig | null,
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

async function anexarDocumentosAdmissao(
  contexto: Awaited<ReturnType<typeof getAssistencialContext>>,
  atendimentoId: string,
  pacienteId: string,
  formData: FormData,
) {
  const files = formData.getAll("documentos").filter((value): value is File => value instanceof File && value.size > 0);
  for (const file of files.slice(0, 10)) {
    if (file.size > 10 * 1024 * 1024 || !["application/pdf", "image/jpeg", "image/png"].includes(file.type)) continue;
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-120) || "documento";
    const storagePath = `${contexto.empresaId}/${contexto.unidadeId}/${atendimentoId}/${randomUUID()}-${safeName}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const sha256 = createHash("sha256").update(buffer).digest("hex");
    const { error: uploadError } = await contexto.supabase.storage.from("documentos-pacientes").upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    });
    if (uploadError) {
      console.error("[admissao.documentos] falha no upload", { code: uploadError.message, atendimentoId });
      continue;
    }
    const { error: gedError } = await contexto.supabase.from("ged_documentos").insert({
      empresa_id: contexto.empresaId,
      unidade_id: contexto.unidadeId,
      atendimento_id: atendimentoId,
      paciente_id: pacienteId,
      categoria: "admissao",
      subcategoria: "documento_origem",
      titulo: `Documento da admissão · ${file.name}`,
      nome_arquivo: file.name,
      storage_path: storagePath,
      mime_type: file.type,
      tamanho_bytes: file.size,
      hash_sha256: sha256,
      confidencial: true,
      created_by: contexto.user.id,
    });
    if (gedError) {
      console.error("[admissao.documentos] upload concluído, mas falhou registro GED", { code: gedError.code, atendimentoId });
    }
  }
}

async function concluirPosAbertura(
  contexto: Awaited<ReturnType<typeof getAssistencialContext>>,
  atendimentoId: string,
  input: ReturnType<typeof admissionInput>,
  config: IdentificacaoConfig | null,
  formData: FormData,
) {
  await Promise.all([
    registrarIdentificacaoAtendimento(contexto, atendimentoId, input, config),
    anexarDocumentosAdmissao(contexto, atendimentoId, input.pacienteId, formData),
  ]);
}

function destinoPosAdmissao(cobertura: string, atendimentoId: string) {
  return cobertura === "convenio"
    ? `/autorizacoes?atendimento=${atendimentoId}`
    : `/triagem?sucesso=admissao&atendimento=${atendimentoId}`;
}

export async function abrirAtendimento(
  senhaId: string,
  _previousState: BackgroundActionState,
  formData: FormData,
): Promise<BackgroundActionState> {
  const contexto = await getAssistencialContext();
  if (!senhaId) return failure("senha-invalida");

  const input = admissionInput(formData);
  if (!input.camposValidos) return failure("campos-obrigatorios");
  if (!input.coberturaValida || !input.convenioCompleto) return failure("cobertura");

  const identificacao = await validarIdentificacaoExigida(contexto, input);
  if (identificacao.error) return identificacao.error;

  const { data: atendimentoId, error } = await contexto.supabase.rpc("abrir_atendimento_por_senha_v2", {
    p_senha_id: senhaId,
    p_payload: input.payload,
  });

  if (error || !atendimentoId) {
    console.error("[admissao] falha na transacao de abertura", { code: error?.code ?? "SEM_ID", operation: "abrir_atendimento_por_senha_v2" });
    return failure(errorCode(error?.message));
  }

  const id = String(atendimentoId);
  await concluirPosAbertura(contexto, id, input, identificacao.config, formData);
  redirect(destinoPosAdmissao(input.cobertura, id));
}

export async function abrirAtendimentoAgendado(
  agendamentoId: string,
  _previousState: BackgroundActionState,
  formData: FormData,
): Promise<BackgroundActionState> {
  const contexto = await getAssistencialContext();
  if (!agendamentoId) return failure("agendamento-invalido");

  const input = admissionInput(formData);
  if (!input.camposValidos) return failure("campos-obrigatorios");
  if (!input.coberturaValida || !input.convenioCompleto) return failure("cobertura");

  const identificacao = await validarIdentificacaoExigida(contexto, input);
  if (identificacao.error) return identificacao.error;

  const { data: atendimentoId, error } = await contexto.supabase.rpc("abrir_atendimento_por_agendamento_v2", {
    p_agendamento_id: agendamentoId,
    p_payload: input.payload,
  });

  if (error || !atendimentoId) {
    console.error("[admissao.agenda] falha na transacao de abertura", { code: error?.code ?? "SEM_ID", operation: "abrir_atendimento_por_agendamento_v2" });
    return failure(errorCode(error?.message));
  }

  const id = String(atendimentoId);
  await concluirPosAbertura(contexto, id, input, identificacao.config, formData);
  redirect(destinoPosAdmissao(input.cobertura, id));
}
