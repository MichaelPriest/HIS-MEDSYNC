"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createHash } from "node:crypto";
import { getAssistencialContext } from "@/modules/assistencial/context";

function text(fd: FormData, key: string) {
  const value = String(fd.get(key) ?? "").trim();
  return value || null;
}
function go(url: string): never { redirect(url as Route); }

async function profissionalLogado() {
  const ctx = await getAssistencialContext();
  const { data: profissional } = await ctx.supabase.from("profissionais").select("id").eq("usuario_id", ctx.user.id).eq("empresa_id", ctx.empresaId).eq("ativo", true).limit(1).maybeSingle();
  if (!profissional) go("/assistencial/sae?erro=profissional");
  return { ...ctx, profissionalId: profissional.id };
}

async function episodio(atendimentoId: string) {
  const ctx = await getAssistencialContext();
  const { data } = await ctx.supabase.from("atendimentos").select("id,paciente_id").eq("id", atendimentoId).eq("empresa_id", ctx.empresaId).eq("unidade_id", ctx.unidadeId).maybeSingle();
  if (!data) go("/assistencial/sae?erro=atendimento");
  return { ...ctx, atendimento: data };
}

export async function registrarAvaliacaoSAE(fd: FormData) {
  const atendimentoId = String(fd.get("atendimento_id") ?? "").trim();
  if (!atendimentoId) go("/assistencial/sae?erro=atendimento");
  const [{ profissionalId }, ep] = await Promise.all([profissionalLogado(), episodio(atendimentoId)]);
  const riscos = {
    queda: fd.get("risco_queda") === "on",
    lesao_pressao: fd.get("risco_lesao_pressao") === "on",
    broncoaspiracao: fd.get("risco_broncoaspiracao") === "on",
    flebite: fd.get("risco_flebite") === "on",
    outros: text(fd, "outros_riscos"),
  };
  const necessidades = {
    respiracao: text(fd, "necessidade_respiracao"),
    nutricao_hidratacao: text(fd, "necessidade_nutricao"),
    eliminacao: text(fd, "necessidade_eliminacao"),
    mobilidade: text(fd, "necessidade_mobilidade"),
    sono_repouso: text(fd, "necessidade_sono"),
    higiene_conforto: text(fd, "necessidade_higiene"),
    comunicacao: text(fd, "necessidade_comunicacao"),
  };
  const { error } = await ep.supabase.from("sae_avaliacoes").insert({
    empresa_id: ep.empresaId, unidade_id: ep.unidadeId, atendimento_id: atendimentoId, paciente_id: ep.atendimento.paciente_id,
    profissional_id: profissionalId, historico_enfermagem: text(fd,"historico_enfermagem"), exame_fisico: text(fd,"exame_fisico"),
    necessidades, riscos, observacoes: text(fd,"observacoes"), created_by: ep.user.id, updated_by: ep.user.id,
  });
  if (error) { console.error("[sae] avaliacao", error); go("/assistencial/sae?erro=avaliacao"); }
  revalidatePath("/assistencial/sae"); go(`/assistencial/sae?sucesso=avaliacao&atendimento=${atendimentoId}`);
}

export async function registrarDiagnosticoSAE(fd: FormData) {
  const atendimentoId = String(fd.get("atendimento_id") ?? "").trim();
  const diagnostico = String(fd.get("diagnostico") ?? "").trim();
  if (!atendimentoId || !diagnostico) go("/assistencial/sae?erro=diagnostico");
  const ep = await episodio(atendimentoId);
  const { error } = await ep.supabase.from("sae_diagnosticos").insert({
    empresa_id: ep.empresaId, unidade_id: ep.unidadeId, atendimento_id: atendimentoId,
    avaliacao_id: text(fd,"avaliacao_id"), terminologia_id: text(fd,"terminologia_id"), codigo: text(fd,"codigo"), diagnostico,
    dominio: text(fd,"dominio"), prioridade: text(fd,"prioridade") ?? "normal", status: "ativo", created_by: ep.user.id, updated_by: ep.user.id,
  });
  if (error) { console.error("[sae] diagnostico", error); go("/assistencial/sae?erro=diagnostico"); }
  revalidatePath("/assistencial/sae"); go(`/assistencial/sae?sucesso=diagnostico&atendimento=${atendimentoId}`);
}

export async function criarPlanoCuidadosSAE(fd: FormData) {
  const atendimentoId = String(fd.get("atendimento_id") ?? "").trim();
  if (!atendimentoId) go("/assistencial/sae?erro=plano");
  const [{ profissionalId }, ep] = await Promise.all([profissionalLogado(), episodio(atendimentoId)]);
  const { error } = await ep.supabase.from("sae_planos_cuidado").insert({
    empresa_id: ep.empresaId, unidade_id: ep.unidadeId, atendimento_id: atendimentoId, paciente_id: ep.atendimento.paciente_id,
    avaliacao_id: text(fd,"avaliacao_id"), profissional_id: profissionalId, objetivo_geral: text(fd,"objetivo_geral"),
    reavaliar_em: text(fd,"reavaliar_em"), status: "ativo", created_by: ep.user.id, updated_by: ep.user.id,
  });
  if (error) { console.error("[sae] plano", error); go("/assistencial/sae?erro=plano"); }
  revalidatePath("/assistencial/sae"); go(`/assistencial/sae?sucesso=plano&atendimento=${atendimentoId}`);
}

export async function adicionarItemPlanoSAE(fd: FormData) {
  const atendimentoId = String(fd.get("atendimento_id") ?? "").trim();
  const planoId = String(fd.get("plano_id") ?? "").trim();
  const descricao = String(fd.get("descricao") ?? "").trim();
  if (!atendimentoId || !planoId || !descricao) go("/assistencial/sae?erro=item-plano");
  const ep = await episodio(atendimentoId);
  const { error } = await ep.supabase.from("sae_planos_itens").insert({
    empresa_id: ep.empresaId, unidade_id: ep.unidadeId, atendimento_id: atendimentoId, paciente_id: ep.atendimento.paciente_id,
    plano_id: planoId, diagnostico_id: text(fd,"diagnostico_id"), terminologia_id: text(fd,"terminologia_id"),
    tipo: text(fd,"tipo") ?? "intervencao", codigo: text(fd,"codigo"), descricao, meta: text(fd,"meta"), valor_alvo: text(fd,"valor_alvo"),
    frequencia: text(fd,"frequencia"), horario_programado: text(fd,"horario_programado"), prazo_em: text(fd,"prazo_em"),
    responsavel_perfil: text(fd,"responsavel_perfil"), observacoes: text(fd,"observacoes"), created_by: ep.user.id, updated_by: ep.user.id,
  });
  if (error) { console.error("[sae] item plano", error); go("/assistencial/sae?erro=item-plano"); }
  revalidatePath("/assistencial/sae"); go(`/assistencial/sae?sucesso=item-plano&atendimento=${atendimentoId}`);
}

export async function registrarCuidadoSAE(fd: FormData) {
  const atendimentoId = String(fd.get("atendimento_id") ?? "").trim();
  const cuidado = String(fd.get("cuidado") ?? "").trim();
  if (!atendimentoId || !cuidado) go("/assistencial/sae?erro=cuidado");
  const ep = await episodio(atendimentoId);
  const { error } = await ep.supabase.from("sae_cuidados").insert({
    empresa_id: ep.empresaId, unidade_id: ep.unidadeId, atendimento_id: atendimentoId, diagnostico_id: text(fd,"diagnostico_id"),
    terminologia_id: text(fd,"terminologia_id"), cuidado, frequencia: text(fd,"frequencia"), horario_programado: text(fd,"horario_programado"),
    responsavel_perfil: text(fd,"responsavel_perfil") ?? "Enfermagem", resultado_esperado: text(fd,"resultado_esperado"), meta: text(fd,"meta"),
    proxima_checagem_em: text(fd,"proxima_checagem_em"), observacoes: text(fd,"observacoes"), status: "prescrito", created_by: ep.user.id, updated_by: ep.user.id,
  });
  if (error) { console.error("[sae] cuidado", error); go("/assistencial/sae?erro=cuidado"); }
  revalidatePath("/assistencial/sae"); go(`/assistencial/sae?sucesso=cuidado&atendimento=${atendimentoId}`);
}

export async function checarCuidadoSAE(fd: FormData) {
  const cuidadoId = String(fd.get("cuidado_id") ?? "").trim();
  const atendimentoId = String(fd.get("atendimento_id") ?? "").trim();
  const status = String(fd.get("status") ?? "realizado").trim();
  if (!cuidadoId || !atendimentoId) go("/assistencial/sae?erro=checagem");
  const { supabase, user, profissionalId } = await profissionalLogado();
  const { data: cuidado } = await supabase.from("sae_cuidados").select("empresa_id,unidade_id,atendimento_id").eq("id", cuidadoId).eq("atendimento_id", atendimentoId).maybeSingle();
  if (!cuidado) go("/assistencial/sae?erro=checagem");
  const { error } = await supabase.from("sae_checagens").insert({ empresa_id:cuidado.empresa_id, unidade_id:cuidado.unidade_id, atendimento_id:atendimentoId, cuidado_id:cuidadoId, profissional_id:profissionalId, status, justificativa:text(fd,"justificativa"), observacoes:text(fd,"observacoes"), created_by:user.id });
  if (error) { console.error("[sae] checagem", error); go("/assistencial/sae?erro=checagem"); }
  await supabase.from("sae_cuidados").update({ ultima_checagem_em:new Date().toISOString(), updated_by:user.id }).eq("id", cuidadoId);
  revalidatePath("/assistencial/sae"); go(`/assistencial/sae?sucesso=checagem&atendimento=${atendimentoId}`);
}

export async function registrarPassagemPlantao(fd: FormData) {
  const atendimentoId = String(fd.get("atendimento_id") ?? "").trim();
  if (!atendimentoId) go("/assistencial/sae?erro=plantao");
  const [{ profissionalId }, ep] = await Promise.all([profissionalLogado(), episodio(atendimentoId)]);
  const payload = {
    empresa_id:ep.empresaId, unidade_id:ep.unidadeId, atendimento_id:atendimentoId, paciente_id:ep.atendimento.paciente_id, profissional_id:profissionalId,
    turno:text(fd,"turno") ?? "Não informado", resumo_clinico:text(fd,"resumo_clinico"), pendencias:text(fd,"pendencias"), riscos:text(fd,"riscos"),
    isolamento:text(fd,"isolamento"), dieta:text(fd,"dieta"), plano_proximo_turno:text(fd,"plano_proximo_turno"), assinado_em:new Date().toISOString(), created_by:ep.user.id,
  };
  const assinaturaHash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  const { error } = await ep.supabase.from("sae_passagens_plantao").insert({ ...payload, assinatura_hash:assinaturaHash });
  if (error) { console.error("[sae] passagem", error); go("/assistencial/sae?erro=plantao"); }
  revalidatePath("/assistencial/sae"); go(`/assistencial/sae?sucesso=plantao&atendimento=${atendimentoId}`);
}
