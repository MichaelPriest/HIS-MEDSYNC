"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAssistencialContext } from "@/modules/assistencial/context";

export async function emitirSenhaTotem(formData: FormData) {
  const supabase = await createClient();
  const unidadeId = String(formData.get("unidade_id") ?? "").trim();
  const setorCodigo = String(formData.get("setor_codigo") ?? "").trim();
  const prioridade = String(formData.get("prioridade") ?? "normal").trim();
  if (!unidadeId || !setorCodigo) redirect(`/totem/${unidadeId || "invalido"}?erro=1`);
  const { data, error } = await supabase.rpc("emitir_senha_totem", { p_unidade_id: unidadeId, p_setor_codigo: setorCodigo, p_prioridade: prioridade });
  const senha = Array.isArray(data) ? data[0]?.senha : null;
  if (error || !senha) redirect(`/totem/${unidadeId}?erro=1`);
  redirect(`/totem/${unidadeId}?senha=${encodeURIComponent(senha)}`);
}

async function efetivarChamada(senhaId: string, ponto: string) {
  const { supabase, user, unidadeId } = await getAssistencialContext();
  const { data: atual } = await supabase.from("senhas_atendimento").select("id,primeira_chamada_em").eq("id", senhaId).eq("unidade_id", unidadeId).maybeSingle();
  if (!atual) redirect("/senhas?erro=1");
  const now = new Date().toISOString();
  const { error } = await supabase.from("senhas_atendimento").update({ status: "chamada", ponto_atendimento: ponto, primeira_chamada_em: atual.primeira_chamada_em || now, ultima_chamada_em: now, chamado_por: user.id, updated_by: user.id, updated_at: now }).eq("id", senhaId);
  if (error) redirect("/senhas?erro=1");
  revalidatePath("/senhas");
}

export async function chamarSenha(formData: FormData) {
  const senhaId = String(formData.get("senha_id") ?? "").trim();
  const ponto = String(formData.get("ponto_atendimento") ?? "").trim();
  if (!senhaId || !ponto) redirect("/senhas?erro=1");
  await efetivarChamada(senhaId, ponto);
}

export async function chamarProximaSenha(formData: FormData) {
  const { supabase, unidadeId } = await getAssistencialContext();
  const ponto = String(formData.get("ponto_atendimento") ?? "").trim();
  const setorId = String(formData.get("setor_id") ?? "").trim();
  if (!ponto || !setorId) redirect("/senhas?erro=1");
  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const { data: fila } = await supabase.from("senhas_atendimento").select("id,prioridade,sequencial").eq("unidade_id", unidadeId).eq("setor_id", setorId).eq("data_referencia", hoje).eq("status", "aguardando").limit(200);
  const peso: Record<string, number> = { emergencia: 0, preferencial: 1, normal: 2 };
  const proxima = (fila ?? []).sort((a, b) => (peso[String(a.prioridade)] ?? 9) - (peso[String(b.prioridade)] ?? 9) || Number(a.sequencial) - Number(b.sequencial))[0];
  if (!proxima) redirect("/senhas?erro=sem-fila");
  await efetivarChamada(proxima.id, ponto);
}

export async function iniciarAtendimentoSenha(formData: FormData) {
  const { supabase, user, unidadeId } = await getAssistencialContext();
  const senhaId = String(formData.get("senha_id") ?? "").trim();
  if (!senhaId) redirect("/senhas?erro=1");
  const { data: senha } = await supabase.from("senhas_atendimento").select("id,status").eq("id", senhaId).eq("unidade_id", unidadeId).maybeSingle();
  if (!senha || !["chamada","aguardando"].includes(String(senha.status))) redirect("/senhas?erro=1");
  const { error } = await supabase.from("senhas_atendimento").update({ status: "em_atendimento", iniciado_em: new Date().toISOString(), updated_by: user.id }).eq("id", senhaId);
  if (error) redirect("/senhas?erro=1");
  redirect(`/atendimentos/novo?senha=${encodeURIComponent(senhaId)}`);
}
