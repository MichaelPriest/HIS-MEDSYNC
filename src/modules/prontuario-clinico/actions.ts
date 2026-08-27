"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAssistencialContext } from "@/modules/assistencial/context";

function texto(formData: FormData, campo: string) {
  const valor = String(formData.get(campo) ?? "").trim();
  return valor || null;
}

function atendimentoId(formData: FormData) {
  return String(formData.get("atendimento_id") ?? "").trim();
}

function hashRegistro(payload: unknown, usuarioId: string, instante: string) {
  return createHash("sha256").update(JSON.stringify({ payload, usuarioId, instante })).digest("hex");
}

async function contextoClinico(formData: FormData) {
  const ctx = await getAssistencialContext();
  const id = atendimentoId(formData);
  if (!id) redirect("/prontuario?erro=atendimento");

  const [{ data: atendimento }, { data: profissional }] = await Promise.all([
    ctx.supabase.from("atendimentos").select("id,paciente_id,status").eq("id", id).eq("empresa_id", ctx.empresaId).eq("unidade_id", ctx.unidadeId).maybeSingle(),
    ctx.supabase.from("profissionais").select("id,nome_completo").eq("usuario_id", ctx.user.id).eq("empresa_id", ctx.empresaId).eq("ativo", true).limit(1).maybeSingle(),
  ]);

  if (!atendimento) redirect("/prontuario?erro=atendimento");
  if (atendimento.status === "alta" || atendimento.status === "cancelado") redirect(`/prontuario/${id}/clinico?erro=atendimento-encerrado`);
  if (!profissional) redirect(`/prontuario/${id}/clinico?erro=profissional`);

  return { ...ctx, atendimentoId: id, pacienteId: atendimento.paciente_id, profissional };
}

async function contextoClinicoAutosave(formData: FormData) {
  const ctx = await getAssistencialContext();
  const id = atendimentoId(formData);
  if (!id) return null;

  const [{ data: atendimento }, { data: profissional }] = await Promise.all([
    ctx.supabase.from("atendimentos").select("id,paciente_id,status").eq("id", id).eq("empresa_id", ctx.empresaId).eq("unidade_id", ctx.unidadeId).maybeSingle(),
    ctx.supabase.from("profissionais").select("id,nome_completo").eq("usuario_id", ctx.user.id).eq("empresa_id", ctx.empresaId).eq("ativo", true).limit(1).maybeSingle(),
  ]);

  if (!atendimento || !profissional || atendimento.status === "alta" || atendimento.status === "cancelado") return null;
  return { ...ctx, atendimentoId: id, pacienteId: atendimento.paciente_id, profissional };
}

function dadosAnamnese(formData: FormData) {
  return {
    queixa_principal: texto(formData, "queixa_principal"),
    historia_doenca_atual: texto(formData, "historia_doenca_atual"),
    antecedentes_pessoais: texto(formData, "antecedentes_pessoais"),
    antecedentes_familiares: texto(formData, "antecedentes_familiares"),
    habitos_vida: texto(formData, "habitos_vida"),
    medicacoes_uso: texto(formData, "medicacoes_uso"),
    exame_fisico_geral: texto(formData, "exame_fisico_geral"),
    hipotese_diagnostica: texto(formData, "hipotese_diagnostica"),
    conduta_inicial: texto(formData, "conduta_inicial"),
    revisao_sistemas: {
      cardiovascular: texto(formData, "rs_cardio"),
      respiratorio: texto(formData, "rs_resp"),
      gastrointestinal: texto(formData, "rs_gastro"),
      geniturinario: texto(formData, "rs_genito"),
      neurologico: texto(formData, "rs_neuro"),
      musculoesqueletico: texto(formData, "rs_musculo"),
      pele: texto(formData, "rs_pele"),
    },
  };
}

function dadosSoap(formData: FormData) {
  return {
    tipo_evolucao: "soap",
    subjetivo: texto(formData, "subjetivo"),
    objetivo: texto(formData, "objetivo"),
    avaliacao: texto(formData, "avaliacao"),
    plano: texto(formData, "plano"),
    exame_fisico: texto(formData, "exame_fisico"),
    conduta: texto(formData, "conduta"),
    conteudo_estruturado: {
      cid10: texto(formData, "cid10"),
      retorno: texto(formData, "retorno"),
    },
  };
}

async function localizarRascunhoAnamnese(
  ctx: Awaited<ReturnType<typeof contextoClinicoAutosave>> | Awaited<ReturnType<typeof contextoClinico>>,
  formData: FormData,
) {
  if (!ctx) return null;
  const solicitado = texto(formData, "registro_id");
  let query = ctx.supabase.from("prontuario_anamneses").select("id")
    .eq("atendimento_id", ctx.atendimentoId)
    .eq("profissional_id", ctx.profissional.id)
    .is("assinado_em", null)
    .eq("bloqueado", false);

  if (solicitado) {
    const { data } = await query.eq("id", solicitado).maybeSingle();
    if (!data) throw new Error("Rascunho de anamnese não disponível para edição.");
    return data.id;
  }

  const { data } = await query.order("updated_at", { ascending: false }).limit(1).maybeSingle();
  return data?.id ?? null;
}

async function localizarRascunhoSoap(
  ctx: Awaited<ReturnType<typeof contextoClinicoAutosave>> | Awaited<ReturnType<typeof contextoClinico>>,
  formData: FormData,
) {
  if (!ctx) return null;
  const solicitado = texto(formData, "registro_id");
  let query = ctx.supabase.from("prontuario_evolucoes").select("id")
    .eq("atendimento_id", ctx.atendimentoId)
    .eq("profissional_id", ctx.profissional.id)
    .eq("tipo_evolucao", "soap")
    .is("assinado_em", null)
    .eq("bloqueado", false);

  if (solicitado) {
    const { data } = await query.eq("id", solicitado).maybeSingle();
    if (!data) throw new Error("Rascunho SOAP não disponível para edição.");
    return data.id;
  }

  const { data } = await query.order("updated_at", { ascending: false }).limit(1).maybeSingle();
  return data?.id ?? null;
}

async function persistirAnamnese(
  ctx: NonNullable<Awaited<ReturnType<typeof contextoClinicoAutosave>>> | Awaited<ReturnType<typeof contextoClinico>>,
  formData: FormData,
  assinar: boolean,
) {
  const instante = new Date().toISOString();
  const rascunhoId = await localizarRascunhoAnamnese(ctx, formData);
  const assinatura = assinar ? {
    assinado_em: instante,
    assinatura_usuario_id: ctx.user.id,
    assinatura_hash: hashRegistro(Object.fromEntries(formData.entries()), ctx.user.id, instante),
    bloqueado: true,
  } : {
    assinado_em: null,
    assinatura_usuario_id: null,
    assinatura_hash: null,
    bloqueado: false,
  };
  const payload = {
    ...dadosAnamnese(formData),
    ...assinatura,
    updated_at: instante,
    updated_by: ctx.user.id,
  };

  if (rascunhoId) {
    const { data, error } = await ctx.supabase.from("prontuario_anamneses").update(payload)
      .eq("id", rascunhoId)
      .eq("atendimento_id", ctx.atendimentoId)
      .eq("profissional_id", ctx.profissional.id)
      .is("assinado_em", null)
      .eq("bloqueado", false)
      .select("id")
      .single();
    if (error || !data) throw error ?? new Error("Não foi possível atualizar a anamnese.");
    return { id: data.id, savedAt: instante };
  }

  const { data, error } = await ctx.supabase.from("prontuario_anamneses").insert({
    empresa_id: ctx.empresaId,
    unidade_id: ctx.unidadeId,
    atendimento_id: ctx.atendimentoId,
    paciente_id: ctx.pacienteId,
    profissional_id: ctx.profissional.id,
    ...payload,
    created_by: ctx.user.id,
  }).select("id").single();
  if (error || !data) throw error ?? new Error("Não foi possível criar a anamnese.");
  return { id: data.id, savedAt: instante };
}

async function persistirSoap(
  ctx: NonNullable<Awaited<ReturnType<typeof contextoClinicoAutosave>>> | Awaited<ReturnType<typeof contextoClinico>>,
  formData: FormData,
  assinar: boolean,
) {
  const instante = new Date().toISOString();
  const rascunhoId = await localizarRascunhoSoap(ctx, formData);
  const assinatura = assinar ? {
    assinado_em: instante,
    assinatura_usuario_id: ctx.user.id,
    assinatura_hash: hashRegistro(Object.fromEntries(formData.entries()), ctx.user.id, instante),
    bloqueado: true,
  } : {
    assinado_em: null,
    assinatura_usuario_id: null,
    assinatura_hash: null,
    bloqueado: false,
  };
  const payload = {
    ...dadosSoap(formData),
    ...assinatura,
    updated_at: instante,
    updated_by: ctx.user.id,
  };

  if (rascunhoId) {
    const { data, error } = await ctx.supabase.from("prontuario_evolucoes").update(payload)
      .eq("id", rascunhoId)
      .eq("atendimento_id", ctx.atendimentoId)
      .eq("profissional_id", ctx.profissional.id)
      .eq("tipo_evolucao", "soap")
      .is("assinado_em", null)
      .eq("bloqueado", false)
      .select("id")
      .single();
    if (error || !data) throw error ?? new Error("Não foi possível atualizar a evolução SOAP.");
    return { id: data.id, savedAt: instante };
  }

  const { data, error } = await ctx.supabase.from("prontuario_evolucoes").insert({
    empresa_id: ctx.empresaId,
    unidade_id: ctx.unidadeId,
    atendimento_id: ctx.atendimentoId,
    profissional_id: ctx.profissional.id,
    ...payload,
    created_by: ctx.user.id,
  }).select("id").single();
  if (error || !data) throw error ?? new Error("Não foi possível criar a evolução SOAP.");
  return { id: data.id, savedAt: instante };
}

export async function autosalvarAnamnese(formData: FormData) {
  try {
    const ctx = await contextoClinicoAutosave(formData);
    if (!ctx) return { ok: false as const, id: null, savedAt: null };
    const registro = await persistirAnamnese(ctx, formData, false);
    return { ok: true as const, ...registro };
  } catch (error) {
    console.error("[prontuario] autosave anamnese", error);
    return { ok: false as const, id: null, savedAt: null };
  }
}

export async function autosalvarEvolucaoSoap(formData: FormData) {
  try {
    const ctx = await contextoClinicoAutosave(formData);
    if (!ctx) return { ok: false as const, id: null, savedAt: null };
    const registro = await persistirSoap(ctx, formData, false);
    return { ok: true as const, ...registro };
  } catch (error) {
    console.error("[prontuario] autosave soap", error);
    return { ok: false as const, id: null, savedAt: null };
  }
}

export async function salvarAnamnese(formData: FormData) {
  const ctx = await contextoClinico(formData);
  const acao = String(formData.get("acao") ?? "salvar");
  const assinar = acao === "assinar";
  try {
    await persistirAnamnese(ctx, formData, assinar);
  } catch (error) {
    console.error("[prontuario] anamnese", error);
    redirect(`/prontuario/${ctx.atendimentoId}/clinico?erro=anamnese`);
  }
  revalidatePath(`/prontuario/${ctx.atendimentoId}`);
  redirect(`/prontuario/${ctx.atendimentoId}/clinico?sucesso=${assinar ? "anamnese-assinada" : "anamnese"}`);
}

export async function adicionarAlergia(formData: FormData) {
  const ctx = await contextoClinico(formData);
  const substancia = texto(formData, "substancia");
  if (!substancia) redirect(`/prontuario/${ctx.atendimentoId}/clinico?erro=alergia`);
  const { error } = await ctx.supabase.from("paciente_alergias").insert({
    empresa_id: ctx.empresaId, unidade_id: ctx.unidadeId, paciente_id: ctx.pacienteId,
    substancia, tipo: texto(formData, "tipo") ?? "medicamento", reacao: texto(formData, "reacao"), gravidade: texto(formData, "gravidade"), observacoes: texto(formData, "observacoes"),
    created_by: ctx.user.id, updated_by: ctx.user.id,
  });
  if (error) redirect(`/prontuario/${ctx.atendimentoId}/clinico?erro=alergia`);
  revalidatePath(`/prontuario/${ctx.atendimentoId}/clinico`);
  redirect(`/prontuario/${ctx.atendimentoId}/clinico?sucesso=alergia`);
}

export async function adicionarProblema(formData: FormData) {
  const ctx = await contextoClinico(formData);
  const descricao = texto(formData, "descricao");
  if (!descricao) redirect(`/prontuario/${ctx.atendimentoId}/clinico?erro=problema`);
  const { error } = await ctx.supabase.from("paciente_problemas").insert({
    empresa_id: ctx.empresaId, unidade_id: ctx.unidadeId, paciente_id: ctx.pacienteId, atendimento_id: ctx.atendimentoId,
    descricao, cid10: texto(formData, "cid10"), status: "ativo", principal: formData.get("principal") === "on", observacoes: texto(formData, "observacoes"),
    created_by: ctx.user.id, updated_by: ctx.user.id,
  });
  if (error) redirect(`/prontuario/${ctx.atendimentoId}/clinico?erro=problema`);
  revalidatePath(`/prontuario/${ctx.atendimentoId}/clinico`);
  redirect(`/prontuario/${ctx.atendimentoId}/clinico?sucesso=problema`);
}

export async function adicionarDiagnostico(formData: FormData) {
  const ctx = await contextoClinico(formData);
  const descricao = texto(formData, "descricao");
  if (!descricao) redirect(`/prontuario/${ctx.atendimentoId}/clinico?erro=diagnostico`);
  const { error } = await ctx.supabase.from("prontuario_diagnosticos").insert({
    empresa_id: ctx.empresaId, unidade_id: ctx.unidadeId, atendimento_id: ctx.atendimentoId, paciente_id: ctx.pacienteId, profissional_id: ctx.profissional.id,
    cid10: texto(formData, "cid10"), descricao, tipo: texto(formData, "tipo") ?? "hipotese", principal: formData.get("principal") === "on", confirmado: formData.get("confirmado") === "on",
    created_by: ctx.user.id, updated_by: ctx.user.id,
  });
  if (error) redirect(`/prontuario/${ctx.atendimentoId}/clinico?erro=diagnostico`);
  revalidatePath(`/prontuario/${ctx.atendimentoId}/clinico`);
  redirect(`/prontuario/${ctx.atendimentoId}/clinico?sucesso=diagnostico`);
}

export async function registrarEscala(formData: FormData) {
  const ctx = await contextoClinico(formData);
  const escala = texto(formData, "escala");
  if (!escala) redirect(`/prontuario/${ctx.atendimentoId}/clinico?erro=escala`);
  const pontuacaoBruta = texto(formData, "pontuacao");
  const pontuacao = pontuacaoBruta && Number.isFinite(Number(pontuacaoBruta)) ? Number(pontuacaoBruta) : null;
  const { error } = await ctx.supabase.from("prontuario_escalas").insert({
    empresa_id: ctx.empresaId, unidade_id: ctx.unidadeId, atendimento_id: ctx.atendimentoId, paciente_id: ctx.pacienteId, profissional_id: ctx.profissional.id,
    escala, pontuacao, classificacao: texto(formData, "classificacao"), observacoes: texto(formData, "observacoes"), created_by: ctx.user.id, updated_by: ctx.user.id,
  });
  if (error) redirect(`/prontuario/${ctx.atendimentoId}/clinico?erro=escala`);
  revalidatePath(`/prontuario/${ctx.atendimentoId}/clinico`);
  redirect(`/prontuario/${ctx.atendimentoId}/clinico?sucesso=escala`);
}

export async function registrarEvolucaoSoap(formData: FormData) {
  const ctx = await contextoClinico(formData);
  const acao = String(formData.get("acao") ?? "salvar");
  const assinar = acao === "assinar";
  try {
    await persistirSoap(ctx, formData, assinar);
  } catch (error) {
    console.error("[prontuario] soap", error);
    redirect(`/prontuario/${ctx.atendimentoId}/clinico?erro=soap`);
  }
  revalidatePath(`/prontuario/${ctx.atendimentoId}`);
  redirect(`/prontuario/${ctx.atendimentoId}/clinico?sucesso=${assinar ? "soap-assinado" : "soap"}`);
}
