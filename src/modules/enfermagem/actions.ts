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
  return value && value.startsWith("/assistencial/enfermagem") ? value : fallback;
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
  if (!aprazamentoId) go(`${voltar}${voltar.includes("?") ? "&" : "?"}erro=aprazamento`);

  const { error } = await supabase.rpc("registrar_administracao_beira_leito", {
    p_aprazamento_id: aprazamentoId,
    p_dispensacao_id: text(fd, "dispensacao_id"),
    p_codigo_paciente: String(fd.get("codigo_paciente") ?? "").trim(),
    p_codigo_medicamento: String(fd.get("codigo_medicamento") ?? "").trim(),
    p_status: status,
    p_justificativa: text(fd, "justificativa"),
    p_dose: text(fd, "dose"),
    p_via: text(fd, "via"),
    p_dupla_checagem: fd.get("dupla_checagem") === "on",
    p_segundo_profissional_id: text(fd, "segundo_profissional_id"),
  });

  if (error) {
    console.error("[enfermagem] checagem", { code: error.code, message: error.message });
    go(`${voltar}${voltar.includes("?") ? "&" : "?"}erro=${encodeURIComponent(error.message)}`);
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
