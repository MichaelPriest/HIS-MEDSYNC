import type { SupabaseClient } from "@supabase/supabase-js";

export function destinoProntoSocorro(tipoAtendimento: string | null, classificacao: string | null) {
  const tipo = String(tipoAtendimento ?? "").toLowerCase();
  return ["vermelho", "laranja"].includes(String(classificacao ?? "").toLowerCase())
    || tipo.includes("pronto") || tipo.includes("urg") || tipo.includes("emerg");
}

export async function encaminharPosTriagem({
  supabase,
  userId,
  empresaId,
  unidadeId,
  atendimentoId,
  pacienteId,
  tipoAtendimento,
  especialidade,
  classificacao,
  queixaPrincipal,
}: {
  supabase: SupabaseClient;
  userId: string;
  empresaId: string;
  unidadeId: string;
  atendimentoId: string;
  pacienteId: string;
  tipoAtendimento: string | null;
  especialidade: string;
  classificacao: string | null;
  queixaPrincipal: string | null;
}) {
  const now = new Date().toISOString();
  const prontoSocorro = destinoProntoSocorro(tipoAtendimento, classificacao);
  const setorDestino = prontoSocorro ? "pronto_socorro" : "consultorio";
  const prioridade = classificacao === "vermelho" ? "emergencia" : classificacao === "laranja" || classificacao === "amarelo" ? "preferencial" : "normal";

  const { error: atendimentoError } = await supabase.from("atendimentos").update({
    especialidade_destino: especialidade,
    status: "em_espera",
    setor_atual: setorDestino,
    ultima_movimentacao_em: now,
    updated_at: now,
    updated_by: userId,
  }).eq("id", atendimentoId).eq("unidade_id", unidadeId);
  if (atendimentoError) throw atendimentoError;

  const { data: encaminhamentoExistente } = await supabase.from("encaminhamentos_assistenciais").select("id")
    .eq("atendimento_id", atendimentoId).eq("origem", "triagem")
    .in("status", ["aguardando_profissional", "chamado", "em_atendimento"]).limit(1).maybeSingle();

  const encaminhamentoPayload = {
    empresa_id: empresaId,
    unidade_id: unidadeId,
    atendimento_id: atendimentoId,
    paciente_id: pacienteId,
    origem: "triagem",
    tipo_solicitacao: "encaminhamento",
    especialidade,
    status: "aguardando_profissional",
    prioridade,
    motivo: queixaPrincipal,
    updated_by: userId,
    updated_at: now,
  };
  const encaminhamentoResult = encaminhamentoExistente
    ? await supabase.from("encaminhamentos_assistenciais").update(encaminhamentoPayload).eq("id", encaminhamentoExistente.id)
    : await supabase.from("encaminhamentos_assistenciais").insert({ ...encaminhamentoPayload, created_by: userId });
  if (encaminhamentoResult.error) throw encaminhamentoResult.error;

  // Mantém uma única fila setorial ativa para o destino clínico. Além de organizar o
  // fluxo interno, esta fila é a fonte usada pelo painel público quando o médico chama.
  const { data: filaSetorialExistente, error: filaConsultaError } = await supabase.from("filas_setoriais").select("id")
    .eq("atendimento_id", atendimentoId)
    .eq("unidade_id", unidadeId)
    .eq("setor_codigo", setorDestino)
    .in("status", ["aguardando", "chamado", "em_atendimento"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (filaConsultaError) throw filaConsultaError;

  const filaPayload = {
    prioridade,
    motivo: prontoSocorro
      ? `Atendimento no Pronto-Socorro · risco ${classificacao ?? "não informado"}`
      : `Consulta médica · ${especialidade}`,
    updated_by: userId,
    updated_at: now,
  };

  const filaResult = filaSetorialExistente
    ? await supabase.from("filas_setoriais").update(filaPayload).eq("id", filaSetorialExistente.id)
    : await supabase.from("filas_setoriais").insert({
      empresa_id: empresaId,
      unidade_id: unidadeId,
      atendimento_id: atendimentoId,
      paciente_id: pacienteId,
      setor_codigo: setorDestino,
      origem: "triagem",
      status: "aguardando",
      created_by: userId,
      ...filaPayload,
    });
  if (filaResult.error) throw filaResult.error;

  return { prontoSocorro, setorDestino };
}
