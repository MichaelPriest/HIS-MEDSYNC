"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAssistencialContext } from "@/modules/assistencial/context";

function text(fd: FormData, key: string) {
  const value = String(fd.get(key) ?? "").trim();
  return value || null;
}
function go(url: string): never { redirect(url as Route); }
function retorno(fd: FormData, fallback = "/assistencial/enfermagem") {
  const value = text(fd, "retorno");
  return value && (value.startsWith("/assistencial/enfermagem") || value.startsWith("/prontuario/")) ? value : fallback;
}

function mensagemErroAdministracao(message: string) {
  const mensagens: Record<string, string> = {
    APRAZAMENTO_NAO_ENCONTRADO: "A dose aprazada não foi encontrada. Atualize a tela e tente novamente.",
    APRAZAMENTO_JA_CHECADO: "Esta dose já foi checada por outro profissional. Atualize a tela.",
    SEM_PERMISSAO: "Seu perfil não possui permissão para checagem de medicamentos à beira-leito.",
    PRESCRICAO_NAO_ATIVA_ASSINADA: "A prescrição não está ativa e assinada para administração.",
    VALIDACAO_FARMACEUTICA_PENDENTE: "A prescrição ainda aguarda validação/liberação da Farmácia.",
    PACIENTE_DIVERGENTE: "A pulseira ou identificação informada não corresponde ao paciente deste atendimento.",
    USUARIO_SEM_PROFISSIONAL: "Seu usuário não está vinculado a um profissional ativo.",
    DISPENSACAO_INVALIDA: "Selecione uma dispensação válida liberada pela Farmácia antes de administrar.",
    DISPENSACAO_SEM_LOTE: "A dispensação selecionada não possui lote rastreável. Corrija a dispensação na Farmácia.",
    DISPENSACAO_SEM_SALDO: "A dispensação selecionada já foi totalmente devolvida e não possui saldo disponível.",
    DISPENSACAO_LOTE_VENCIDO: "O lote da dispensação está vencido. Não administre; devolva o item à Farmácia.",
    DISPENSACAO_LOTE_BLOQUEADO: "O lote foi bloqueado ou colocado em quarentena após a dispensação. Não administre e contate a Farmácia.",
    PRODUTO_NAO_LOCALIZADO: "O produto da dispensação não foi localizado no estoque.",
    MEDICAMENTO_DIVERGENTE: "O código lido não corresponde ao medicamento dispensado.",
    MOTIVO_CONTINGENCIA_OBRIGATORIO: "Informe o motivo da confirmação manual quando o medicamento estiver sem etiqueta.",
    JUSTIFICATIVA_OBRIGATORIA: "Informe a justificativa para registrar recusa ou omissão.",
    SEGUNDO_PROFISSIONAL_INVALIDO: "Na dupla checagem, selecione um segundo profissional diferente do profissional logado.",
    STATUS_INVALIDO: "O status informado para a checagem é inválido.",
  };
  return mensagens[message] ?? "Não foi possível concluir a checagem. Atualize a tela e confira os dados informados.";
}

async function resolveProfissional(
  supabase: Awaited<ReturnType<typeof getAssistencialContext>>["supabase"],
  empresaId: string,
  userId: string,
  email?: string | null,
) {
  let { data } = await supabase.from("profissionais").select("id,nome_completo,especialidade").eq("empresa_id", empresaId).eq("usuario_id", userId).eq("ativo", true).limit(1).maybeSingle();
  if (!data && email) data = (await supabase.from("profissionais").select("id,nome_completo,especialidade").eq("empresa_id", empresaId).ilike("email", email).eq("ativo", true).limit(1).maybeSingle()).data;
  return data;
}

export async function checarAdministracaoEnfermagemAction(fd: FormData) {
  const { supabase } = await getAssistencialContext();
  const aprazamentoId = String(fd.get("aprazamento_id") ?? "").trim();
  const status = String(fd.get("status") ?? "administrado").trim();
  const voltar = retorno(fd);
  if (!aprazamentoId) go(`${voltar}${voltar.includes("?") ? "&" : "?"}erro=${encodeURIComponent("A dose aprazada não foi informada.")}`);

  const confirmacaoManualMedicamento = fd.get("confirmacao_manual_medicamento") === "on";
  const justificativaInformada = text(fd, "justificativa");
  const justificativa = confirmacaoManualMedicamento && !justificativaInformada
    ? "Confirmação manual do medicamento: etiqueta/código de barras indisponível no momento da administração. Medicamento conferido pela dispensação e lote liberados pela Farmácia."
    : justificativaInformada;

  const { error } = await supabase.rpc("registrar_administracao_beira_leito", {
    p_aprazamento_id: aprazamentoId,
    p_dispensacao_id: text(fd, "dispensacao_id"),
    p_codigo_paciente: String(fd.get("codigo_paciente") ?? "").trim(),
    p_codigo_medicamento: confirmacaoManualMedicamento
      ? "__MANUAL_SEM_ETIQUETA__"
      : String(fd.get("codigo_medicamento") ?? "").trim(),
    p_status: status,
    p_justificativa: justificativa,
    p_dose: text(fd, "dose"),
    p_via: text(fd, "via"),
    p_dupla_checagem: fd.get("dupla_checagem") === "on",
    p_segundo_profissional_id: text(fd, "segundo_profissional_id"),
  });

  if (error) {
    console.error("[enfermagem] checagem", { code: error.code, operation: "registrar_administracao_beira_leito" });
    go(`${voltar}${voltar.includes("?") ? "&" : "?"}erro=${encodeURIComponent(mensagemErroAdministracao(error.message))}`);
  }

  revalidatePath("/assistencial/enfermagem");
  revalidatePath("/assistencial/enfermagem/andares");
  revalidatePath("/assistencial/enfermagem/pronto-socorro");
  revalidatePath("/assistencial/medicamentos");
  go(`${voltar}${voltar.includes("?") ? "&" : "?"}sucesso=${encodeURIComponent(status)}`);
}

export async function registrarEvolucaoEnfermagemAction(fd: FormData) {
  const { supabase, user, empresaId, unidadeId } = await getAssistencialContext();
  const atendimentoId = text(fd, "atendimento_id");
  const voltar = retorno(fd, "/assistencial/enfermagem/andares");
  if (!atendimentoId || !unidadeId) go(`${voltar}?erro=atendimento`);

  const [profissional, atendimentoRes] = await Promise.all([
    resolveProfissional(supabase, empresaId, user.id, user.email),
    supabase.from("atendimentos").select("id,paciente_id").eq("id", atendimentoId).eq("empresa_id", empresaId).eq("unidade_id", unidadeId).maybeSingle(),
  ]);
  if (!profissional) go(`${voltar}?erro=profissional`);
  if (!atendimentoRes.data?.paciente_id) go(`${voltar}?erro=atendimento`);

  const avaliacao = text(fd, "avaliacao");
  const intervencoes = text(fd, "intervencoes");
  const resposta = text(fd, "resposta");
  const plano = text(fd, "plano");
  if (!avaliacao && !intervencoes && !resposta && !plano) go(`${voltar}?erro=evolucao_vazia`);

  const agora = new Date().toISOString();
  const { error } = await supabase.from("evolucoes_multiprofissionais").insert({
    empresa_id: empresaId,
    unidade_id: unidadeId,
    atendimento_id: atendimentoId,
    paciente_id: atendimentoRes.data.paciente_id,
    profissional_id: profissional.id,
    area: "enfermagem",
    avaliacao,
    objetivos: text(fd, "objetivos"),
    intervencoes,
    resposta,
    plano,
    escalas: {},
    anexos: [],
    assinado_em: agora,
    bloqueado: true,
    created_by: user.id,
    updated_by: user.id,
  });
  if (error) {
    console.error("[enfermagem] evolucao", { code: error.code, message: error.message });
    go(`${voltar}?erro=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/assistencial/enfermagem/andares");
  revalidatePath("/assistencial/enfermagem/pronto-socorro");
  revalidatePath(`/prontuario/${atendimentoId}`);
  go(`${voltar}?sucesso=evolucao`);
}
