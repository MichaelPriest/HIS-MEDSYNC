"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAnyPermission } from "@/lib/permissions/server";
import { asRoute } from "@/lib/route-cast";

const texto = (fd: FormData, nome: string) => String(fd.get(nome) ?? "").trim();

export async function solicitarAvaliacaoMedicaAction(formData: FormData) {
  const atendimentoId = texto(formData, "atendimento_id");
  const especialidade = texto(formData, "especialidade");
  const prioridade = texto(formData, "prioridade") || "rotina";
  const motivo = texto(formData, "motivo");
  const observacoes = texto(formData, "observacoes") || null;
  if (!atendimentoId || !especialidade || !motivo || !["rotina", "urgente", "emergencia"].includes(prioridade)) {
    redirect(asRoute(`/prontuario/${atendimentoId}/avaliacoes?erro=campos`));
  }

  const { supabase, user, empresaId, unidadeId } = await requireAnyPermission(["prontuario.visualizar", "prescricao.criar"]);
  if (!unidadeId) redirect(asRoute(`/prontuario/${atendimentoId}/avaliacoes?erro=unidade`));

  const [{ data: atendimento }, { data: profissional }] = await Promise.all([
    supabase.from("atendimentos").select("id,paciente_id,status").eq("id", atendimentoId).eq("empresa_id", empresaId).eq("unidade_id", unidadeId).maybeSingle(),
    supabase.from("profissionais").select("id").eq("empresa_id", empresaId).eq("usuario_id", user.id).eq("ativo", true).limit(1).maybeSingle(),
  ]);
  if (!atendimento?.paciente_id) redirect(asRoute(`/prontuario/${atendimentoId}/avaliacoes?erro=atendimento`));
  if (!profissional?.id) redirect(asRoute(`/prontuario/${atendimentoId}/avaliacoes?erro=profissional`));

  const { error } = await supabase.from("solicitacoes_avaliacao_medica").insert({
    empresa_id: empresaId,
    unidade_id: unidadeId,
    atendimento_id: atendimentoId,
    paciente_id: atendimento.paciente_id,
    solicitante_profissional_id: profissional.id,
    especialidade,
    prioridade,
    motivo,
    observacoes,
    status: "solicitada",
    created_by: user.id,
    updated_by: user.id,
  });
  if (error) {
    console.error("[avaliacao-medica] falha ao solicitar", { code: error.code, message: error.message, atendimentoId });
    redirect(asRoute(`/prontuario/${atendimentoId}/avaliacoes?erro=salvar`));
  }

  revalidatePath(`/prontuario/${atendimentoId}/avaliacoes`);
  redirect(asRoute(`/prontuario/${atendimentoId}/avaliacoes?sucesso=solicitada`));
}
