"use server";

import { redirect } from "next/navigation";
import { getAssistencialContext } from "@/modules/assistencial/context";

function normalizar(value: string | null | undefined) {
  return (value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export async function assumirPaciente(formData: FormData) {
  const { supabase, user, unidadeId } = await getAssistencialContext();
  const encaminhamentoId = String(formData.get("encaminhamento_id") ?? "").trim();
  if (!encaminhamentoId) redirect("/fila-medica?erro=encaminhamento");

  let { data: profissional } = await supabase.from("profissionais").select("id,nome_completo,especialidade").eq("usuario_id", user.id).eq("ativo", true).maybeSingle();
  if (!profissional && user.email) {
    const fallback = await supabase.from("profissionais").select("id,nome_completo,especialidade").ilike("email", user.email).eq("ativo", true).limit(1).maybeSingle();
    profissional = fallback.data;
  }
  if (!profissional) redirect("/fila-medica?erro=perfil-profissional");

  const { data: encaminhamento } = await supabase.from("encaminhamentos_assistenciais").select("id,atendimento_id,especialidade,status").eq("id", encaminhamentoId).eq("unidade_id", unidadeId).maybeSingle();
  if (!encaminhamento || encaminhamento.status !== "aguardando_profissional") redirect("/fila-medica?erro=indisponivel");

  const especialidadeProf = normalizar(profissional.especialidade);
  const especialidadeFila = normalizar(encaminhamento.especialidade);
  if (!especialidadeProf || (!especialidadeProf.includes(especialidadeFila) && !especialidadeFila.includes(especialidadeProf))) redirect("/fila-medica?erro=especialidade");

  const now = new Date().toISOString();
  const { error: filaError } = await supabase.from("encaminhamentos_assistenciais").update({
    profissional_id: profissional.id,
    status: "em_atendimento",
    chamado_em: now,
    iniciado_em: now,
    updated_at: now,
    updated_by: user.id,
  }).eq("id", encaminhamentoId).eq("status", "aguardando_profissional");
  if (filaError) redirect("/fila-medica?erro=assumir");

  const { error: atendimentoError } = await supabase.from("atendimentos").update({
    profissional_id: profissional.id,
    status: "em_atendimento",
    updated_at: now,
    updated_by: user.id,
  }).eq("id", encaminhamento.atendimento_id).eq("unidade_id", unidadeId);
  if (atendimentoError) redirect("/fila-medica?erro=atendimento");

  redirect(`/prontuario/${encaminhamento.atendimento_id}/clinico`);
}
