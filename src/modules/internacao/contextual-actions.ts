"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { asRoute } from "@/lib/route-cast";
import { requireAnyPermission } from "@/lib/permissions/server";

function text(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function back(atendimentoId: string, query: string): never {
  redirect(asRoute(`/internacao/nova/${atendimentoId}?${query}`));
}

export async function admitirPacienteInternacao(formData: FormData) {
  const { supabase, user, empresaId, unidadeId } = await requireAnyPermission([
    "internacao.admitir",
    "internacao.criar",
  ]);
  const atendimentoId = text(formData, "atendimento_id");
  const setor = text(formData, "setor");
  if (!atendimentoId || !setor || !unidadeId) return back(atendimentoId ?? "invalido", "erro=campos");

  const { data: atendimento } = await supabase
    .from("atendimentos")
    .select("id,paciente_id,status")
    .eq("id", atendimentoId)
    .eq("empresa_id", empresaId)
    .eq("unidade_id", unidadeId)
    .maybeSingle();

  if (!atendimento || atendimento.status === "cancelado") return back(atendimentoId, "erro=atendimento");

  const { data: existente } = await supabase
    .from("internacoes")
    .select("id,status")
    .eq("atendimento_id", atendimento.id)
    .eq("empresa_id", empresaId)
    .eq("unidade_id", unidadeId)
    .in("status", ["aguardando_leito", "internado", "transferido"])
    .order("data_internacao", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existente) return back(atendimentoId, `erro=internacao-ativa&internacao=${existente.id}`);

  const leitoId = text(formData, "leito_id");
  const { data: internacao, error } = await supabase
    .from("internacoes")
    .insert({
      empresa_id: empresaId,
      unidade_id: unidadeId,
      atendimento_id: atendimento.id,
      profissional_responsavel_id: text(formData, "profissional_responsavel_id"),
      setor,
      acomodacao: text(formData, "acomodacao"),
      motivo: text(formData, "motivo"),
      previsao_alta: text(formData, "previsao_alta"),
      observacoes: text(formData, "observacoes"),
      status: leitoId ? "internado" : "aguardando_leito",
      created_by: user.id,
      updated_by: user.id,
    })
    .select("id")
    .single();

  if (error || !internacao) {
    console.error("[internacao] admissao contextual", { code: error?.code ?? "unknown" });
    return back(atendimentoId, "erro=salvar");
  }

  if (leitoId) {
    const { error: moveError } = await supabase.rpc("movimentar_internacao_leito", {
      p_internacao_id: internacao.id,
      p_leito_destino_id: leitoId,
      p_motivo: "Admissão pelo prontuário",
    });

    if (moveError) {
      console.error("[internacao] alocar leito na admissao", { code: moveError.code });
      return back(atendimentoId, `erro=leito&internacao=${internacao.id}`);
    }
  }

  revalidatePath("/internacao");
  revalidatePath(`/prontuario/${atendimento.id}`);
  redirect(asRoute(`/prontuario/${atendimento.id}?sucesso=internacao`));
}
