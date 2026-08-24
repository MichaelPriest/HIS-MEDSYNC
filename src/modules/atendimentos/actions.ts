"use server";

import { redirect } from "next/navigation";
import { getAssistencialContext } from "@/modules/assistencial/context";

function optional(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? "").trim();
  return value || null;
}
function digits(value: string | null) { return value?.replace(/\D/g, "") || null; }

export async function abrirAtendimento(senhaId: string, formData: FormData) {
  const { supabase, user, empresaId, unidadeId } = await getAssistencialContext();
  if (!senhaId) redirect("/senhas?erro=senha-obrigatoria");
  const { data: senha } = await supabase.from("senhas_atendimento").select("id,status,atendimento_id,paciente_id").eq("id", senhaId).eq("unidade_id", unidadeId).maybeSingle();
  if (!senha || senha.atendimento_id || senha.status !== "em_atendimento") redirect("/senhas?erro=senha-invalida");

  const pacienteId = String(formData.get("paciente_id") ?? "").trim();
  const profissionalId = optional(formData, "profissional_id");
  const tipoAtendimento = String(formData.get("tipo_atendimento") ?? "").trim();
  const cobertura = String(formData.get("cobertura") ?? "particular").trim();
  const convenioId = cobertura === "convenio" ? optional(formData, "convenio_id") : null;
  const planoId = cobertura === "convenio" ? optional(formData, "plano_id") : null;
  const carteirinha = cobertura === "convenio" ? optional(formData, "numero_carteirinha") : null;
  const atendimentoRn = cobertura === "convenio" && String(formData.get("atendimento_rn") ?? "") === "true";
  const pacienteNome = String(formData.get("paciente_nome") ?? "").trim();
  const pacienteNascimento = String(formData.get("paciente_data_nascimento") ?? "").trim();
  const pacienteTelefone = String(formData.get("paciente_telefone") ?? "").trim();
  const pacienteEndereco = String(formData.get("paciente_endereco") ?? "").trim();
  const pacienteNumero = String(formData.get("paciente_numero") ?? "").trim();
  const pacienteBairro = String(formData.get("paciente_bairro") ?? "").trim();
  const pacienteCidade = String(formData.get("paciente_cidade") ?? "").trim();
  const pacienteEstado = String(formData.get("paciente_estado") ?? "").trim().toUpperCase();

  if (!pacienteId || !tipoAtendimento || !pacienteNome || !pacienteNascimento || !pacienteTelefone || !pacienteEndereco || !pacienteNumero || !pacienteBairro || !pacienteCidade || pacienteEstado.length !== 2) redirect(`/atendimentos/novo?senha=${senhaId}&erro=campos-obrigatorios`);
  if (cobertura !== "particular" && cobertura !== "convenio") redirect(`/atendimentos/novo?senha=${senhaId}&erro=cobertura`);
  if (cobertura === "convenio" && (!convenioId || !planoId || !carteirinha)) redirect(`/atendimentos/novo?senha=${senhaId}&erro=cobertura`);

  const { data: paciente } = await supabase.from("pacientes").select("id").eq("id", pacienteId).eq("ativo", true).maybeSingle();
  if (!paciente) redirect(`/atendimentos/novo?senha=${senhaId}&erro=paciente`);
  if (cobertura === "convenio") {
    const { data: plano } = await supabase.from("convenio_planos").select("id").eq("id", planoId).eq("convenio_id", convenioId).eq("ativo", true).maybeSingle();
    if (!plano) redirect(`/atendimentos/novo?senha=${senhaId}&erro=plano`);
  }

  const now = new Date().toISOString();
  const { data: atendimento, error } = await supabase.from("atendimentos").insert({
    empresa_id: empresaId, unidade_id: unidadeId, senha_id: senhaId, paciente_id: pacienteId, profissional_id: profissionalId,
    tipo_atendimento: tipoAtendimento, origem: optional(formData, "origem"), observacoes: optional(formData, "observacoes"), cobertura,
    convenio_id: convenioId, plano_id: planoId, numero_carteirinha: carteirinha, atendimento_rn: atendimentoRn,
    validade_carteirinha: cobertura === "convenio" ? optional(formData, "validade_carteirinha") : null,
    numero_autorizacao: cobertura === "convenio" ? optional(formData, "numero_autorizacao") : null,
    senha_autorizacao: cobertura === "convenio" ? optional(formData, "senha_autorizacao") : null,
    paciente_nome: pacienteNome, paciente_cpf: digits(optional(formData, "paciente_cpf")), paciente_rg: optional(formData, "paciente_rg"),
    paciente_cns: digits(optional(formData, "paciente_cns")), paciente_data_nascimento: pacienteNascimento,
    paciente_nacionalidade: optional(formData, "paciente_nacionalidade"), paciente_estado_civil: optional(formData, "paciente_estado_civil"),
    paciente_sexo: optional(formData, "paciente_sexo"), paciente_telefone: pacienteTelefone, paciente_email: optional(formData, "paciente_email"),
    paciente_cep: digits(optional(formData, "paciente_cep")), paciente_endereco: pacienteEndereco, paciente_numero: pacienteNumero,
    paciente_complemento: optional(formData, "paciente_complemento"), paciente_bairro: pacienteBairro, paciente_cidade: pacienteCidade, paciente_estado: pacienteEstado,
    setor_atual: "triagem", ultima_movimentacao_em: now, created_by: user.id, updated_by: user.id,
  }).select("id").single();
  if (error || !atendimento) redirect(`/atendimentos/novo?senha=${senhaId}&erro=falha-cadastro`);

  const { error: filaTriagemError } = await supabase.from("filas_setoriais").insert({
    empresa_id: empresaId,
    unidade_id: unidadeId,
    atendimento_id: atendimento.id,
    paciente_id: pacienteId,
    setor_codigo: "triagem",
    origem: "recepcao",
    motivo: "Triagem inicial",
    prioridade: "normal",
    status: "aguardando",
    created_by: user.id,
    updated_by: user.id,
  });
  if (filaTriagemError) redirect(`/triagem?atendimento=${atendimento.id}&erro=fila-triagem`);

  if (cobertura === "convenio") {
    const { error: autorizacaoError } = await supabase.from("autorizacoes_atendimento").insert({
      empresa_id: empresaId, unidade_id: unidadeId, atendimento_id: atendimento.id, paciente_id: pacienteId,
      convenio_id: convenioId, plano_id: planoId, numero_guia_operadora: optional(formData, "numero_autorizacao"),
      senha_autorizacao: optional(formData, "senha_autorizacao"), status: optional(formData, "numero_autorizacao") ? "solicitada" : "pendente",
      created_by: user.id, updated_by: user.id,
    });
    if (autorizacaoError) redirect(`/autorizacoes?atendimento=${atendimento.id}&erro=criar`);
  }

  const { error: senhaError } = await supabase.from("senhas_atendimento").update({ paciente_id: pacienteId, atendimento_id: atendimento.id, status: "finalizada", finalizado_em: now, updated_by: user.id }).eq("id", senhaId);
  if (senhaError) redirect(`/atendimentos?sucesso=aberto&alerta=senha`);
  redirect(cobertura === "convenio" ? `/autorizacoes?atendimento=${atendimento.id}` : `/triagem?sucesso=admissao&atendimento=${atendimento.id}`);
}
