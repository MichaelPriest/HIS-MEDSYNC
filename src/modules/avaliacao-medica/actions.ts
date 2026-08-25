"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAssistencialContext } from "@/modules/assistencial/context";

function text(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

async function resolveProfissional(
  supabase: Awaited<ReturnType<typeof getAssistencialContext>>["supabase"],
  userId: string,
  email: string | null | undefined,
  empresaId: string,
) {
  let { data } = await supabase.from("profissionais").select("id,nome_completo,especialidade")
    .eq("empresa_id", empresaId).eq("usuario_id", userId).eq("ativo", true).limit(1).maybeSingle();
  if (!data && email) {
    data = (await supabase.from("profissionais").select("id,nome_completo,especialidade")
      .eq("empresa_id", empresaId).ilike("email", email).eq("ativo", true).limit(1).maybeSingle()).data;
  }
  return data;
}

export async function solicitarAvaliacaoMedica(formData: FormData) {
  const { supabase, user, empresaId, unidadeId } = await getAssistencialContext();
  const atendimentoId = text(formData, "atendimento_id");
  const especialidade = text(formData, "especialidade");
  const prioridade = text(formData, "prioridade") ?? "normal";
  const motivo = text(formData, "motivo");
  if (!atendimentoId || !especialidade || !motivo) redirect("/prontuario?erro=avaliacao-medica");

  const [atendimentoRes, profissional] = await Promise.all([
    supabase.from("atendimentos").select("id,paciente_id,status").eq("id", atendimentoId).eq("empresa_id", empresaId).eq("unidade_id", unidadeId).maybeSingle(),
    resolveProfissional(supabase, user.id, user.email, empresaId),
  ]);
  const atendimento = atendimentoRes.data;
  if (!atendimento || ["alta", "cancelado", "encerrado"].includes(String(atendimento.status))) {
    redirect(`/prontuario/${atendimentoId}?erro=avaliacao-medica`);
  }
  if (!profissional) redirect(`/prontuario/${atendimentoId}?erro=profissional`);

  const { data: existente } = await supabase.from("encaminhamentos_assistenciais").select("id")
    .eq("atendimento_id", atendimentoId)
    .eq("especialidade", especialidade)
    .in("tipo_solicitacao", ["avaliacao_medica", "interconsulta"])
    .in("status", ["aguardando_profissional", "chamado", "em_atendimento"])
    .limit(1).maybeSingle();
  if (existente) redirect(`/prontuario/${atendimentoId}?erro=avaliacao-duplicada`);

  const now = new Date().toISOString();
  const { error } = await supabase.from("encaminhamentos_assistenciais").insert({
    empresa_id: empresaId,
    unidade_id: unidadeId,
    atendimento_id: atendimentoId,
    paciente_id: atendimento.paciente_id,
    origem: "interconsulta",
    tipo_solicitacao: "avaliacao_medica",
    especialidade,
    profissional_id: null,
    solicitante_profissional_id: profissional.id,
    status: "aguardando_profissional",
    prioridade,
    motivo,
    created_by: user.id,
    updated_by: user.id,
    updated_at: now,
  });
  if (error) {
    console.error("[avaliacao-medica] solicitar", { code: error.code });
    redirect(`/prontuario/${atendimentoId}?erro=avaliacao-medica`);
  }

  revalidatePath(`/prontuario/${atendimentoId}`);
  revalidatePath(`/prontuario/${atendimentoId}/clinico`);
  revalidatePath("/fila-medica");
  redirect(`/prontuario/${atendimentoId}?sucesso=avaliacao-medica`);
}
