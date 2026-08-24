"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getAssistencialContext } from "@/modules/assistencial/context";

const SETORES = new Set(["enfermagem", "farmacia", "laboratorio", "imagem", "internacao"]);

function destinoSetor(setor: string, sufixo = "") {
  return `/setores/${setor}${sufixo}`;
}

export async function encaminharSetor(formData: FormData) {
  const { supabase, user, empresaId, unidadeId } = await getAssistencialContext();
  const atendimentoId = String(formData.get("atendimento_id") ?? "").trim();
  const setor = String(formData.get("setor_codigo") ?? "").trim();
  const motivo = String(formData.get("motivo") ?? "").trim() || null;
  const prioridade = String(formData.get("prioridade") ?? "normal").trim();
  if (!atendimentoId || !SETORES.has(setor)) redirect("/prontuario?erro=setor");

  const { data: atendimento } = await supabase
    .from("atendimentos")
    .select("id,paciente_id,profissional_id")
    .eq("id", atendimentoId)
    .eq("unidade_id", unidadeId)
    .maybeSingle();

  if (!atendimento) redirect("/prontuario?erro=atendimento");

  const { error } = await supabase.from("filas_setoriais").insert({
    empresa_id: empresaId,
    unidade_id: unidadeId,
    atendimento_id: atendimentoId,
    paciente_id: atendimento.paciente_id,
    setor_codigo: setor,
    motivo,
    prioridade,
    profissional_origem_id: atendimento.profissional_id,
    created_by: user.id,
    updated_by: user.id,
  });

  if (error) redirect(`/prontuario/${atendimentoId}?erro=encaminhamento`);

  await supabase
    .from("atendimentos")
    .update({ setor_atual: setor, ultima_movimentacao_em: new Date().toISOString(), updated_by: user.id })
    .eq("id", atendimentoId);

  revalidatePath(`/prontuario/${atendimentoId}`);
  revalidatePath(destinoSetor(setor));
  redirect(`/prontuario/${atendimentoId}?sucesso=encaminhado-${setor}`);
}

export async function chamarFilaSetorial(formData: FormData) {
  const { supabase, user, unidadeId } = await getAssistencialContext();
  const filaId = String(formData.get("fila_id") ?? "").trim();
  const setor = String(formData.get("setor_codigo") ?? "").trim();
  const ponto = String(formData.get("ponto_atendimento") ?? "").trim();

  if (!filaId || !SETORES.has(setor) || !ponto) redirect(destinoSetor(setor || "fila", "?erro=chamada"));

  const { data: item } = await supabase
    .from("filas_setoriais")
    .select("id,atendimento_id,status")
    .eq("id", filaId)
    .eq("unidade_id", unidadeId)
    .eq("setor_codigo", setor)
    .maybeSingle();

  if (!item || !["aguardando", "chamado"].includes(String(item.status))) {
    redirect(destinoSetor(setor, "?erro=chamada"));
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("filas_setoriais")
    .update({
      status: "chamado",
      ponto_atendimento: ponto,
      chamado_em: now,
      updated_by: user.id,
      updated_at: now,
    })
    .eq("id", filaId);

  if (error) redirect(destinoSetor(setor, "?erro=chamada"));

  revalidatePath(destinoSetor(setor));
  revalidatePath(`/painel-chamadas/${unidadeId}`);
  redirect(destinoSetor(setor, `?chamado=${encodeURIComponent(item.atendimento_id)}`));
}

export async function assumirFilaSetorial(formData: FormData) {
  const { supabase, user, unidadeId } = await getAssistencialContext();
  const filaId = String(formData.get("fila_id") ?? "").trim();
  const setor = String(formData.get("setor_codigo") ?? "").trim();
  if (!filaId || !SETORES.has(setor)) redirect(destinoSetor(setor || "fila", "?erro=1"));

  const { data: item } = await supabase
    .from("filas_setoriais")
    .select("id,atendimento_id,status")
    .eq("id", filaId)
    .eq("unidade_id", unidadeId)
    .eq("setor_codigo", setor)
    .maybeSingle();

  if (!item || !["aguardando", "chamado"].includes(String(item.status))) redirect(destinoSetor(setor, "?erro=1"));

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("filas_setoriais")
    .update({ status: "em_atendimento", iniciado_em: now, updated_by: user.id, updated_at: now })
    .eq("id", filaId);

  if (error) redirect(destinoSetor(setor, "?erro=1"));

  await supabase
    .from("atendimentos")
    .update({ setor_atual: setor, ultima_movimentacao_em: now, updated_by: user.id })
    .eq("id", item.atendimento_id);

  revalidatePath(destinoSetor(setor));
  redirect(destinoSetor(setor, `?atendimento=${encodeURIComponent(item.atendimento_id)}`));
}

export async function concluirFilaSetorial(formData: FormData) {
  const { supabase, user, unidadeId } = await getAssistencialContext();
  const filaId = String(formData.get("fila_id") ?? "").trim();
  const setor = String(formData.get("setor_codigo") ?? "").trim();
  if (!filaId || !SETORES.has(setor)) redirect(destinoSetor(setor || "fila", "?erro=1"));

  const { data: item } = await supabase
    .from("filas_setoriais")
    .select("id,atendimento_id,status")
    .eq("id", filaId)
    .eq("unidade_id", unidadeId)
    .eq("setor_codigo", setor)
    .maybeSingle();

  if (!item) redirect(destinoSetor(setor, "?erro=1"));

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("filas_setoriais")
    .update({ status: "concluido", concluido_em: now, updated_by: user.id, updated_at: now })
    .eq("id", filaId);

  if (error) redirect(destinoSetor(setor, "?erro=1"));

  await supabase
    .from("atendimentos")
    .update({ setor_atual: "consultorio", ultima_movimentacao_em: now, updated_by: user.id })
    .eq("id", item.atendimento_id);

  revalidatePath(destinoSetor(setor));
  redirect(destinoSetor(setor, "?sucesso=concluido"));
}
