"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/permissions/server";
import { asRoute } from "@/lib/route-cast";

function text(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function goCadastro(query: string): never {
  redirect(asRoute(`/configuracoes/estrutura/leitos?${query}`));
}

function goMapa(query: string): never {
  redirect(asRoute(`/internacao/leitos?${query}`));
}

function revalidateLeitos() {
  revalidatePath("/internacao/leitos");
  revalidatePath("/internacao");
  revalidatePath("/internacao/nir");
  revalidatePath("/configuracoes/estrutura");
  revalidatePath("/configuracoes/estrutura/leitos");
}

export async function criarLeitoOperacional(formData: FormData) {
  const { supabase, user, empresaId, unidadeId } = await requirePermission("leitos.gerenciar");
  if (!unidadeId) goCadastro("erro=unidade");

  const codigo = text(formData, "codigo")?.toUpperCase().replace(/\s+/g, "_");
  const estruturaId = text(formData, "estrutura_fisica_id");
  const quarto = text(formData, "quarto");
  const tipo = text(formData, "tipo") ?? "enfermaria";
  const acomodacao = text(formData, "acomodacao");
  const sexoRestricao = text(formData, "sexo_restricao");
  const isolamentoCapaz = formData.get("isolamento_capaz") === "on";

  if (!codigo || !estruturaId) goCadastro("erro=campos");

  const { data: estrutura } = await supabase
    .from("estruturas_fisicas")
    .select("id,nome,tipo,permite_internacao")
    .eq("id", estruturaId)
    .eq("empresa_id", empresaId)
    .eq("unidade_id", unidadeId)
    .eq("ativo", true)
    .maybeSingle();

  if (!estrutura || !estrutura.permite_internacao) goCadastro("erro=estrutura");

  const now = new Date().toISOString();
  const { error } = await supabase.from("leitos").insert({
    empresa_id: empresaId,
    unidade_id: unidadeId,
    estrutura_fisica_id: estrutura.id,
    setor: estrutura.nome,
    quarto,
    codigo,
    tipo,
    acomodacao,
    sexo_restricao: sexoRestricao,
    isolamento_capaz: isolamentoCapaz,
    status: "livre",
    ativo: true,
    created_by: user.id,
    updated_by: user.id,
    updated_at: now,
  });

  if (error) {
    console.error("[leitos.criar] falha", { code: error.code });
    goCadastro(`erro=${error.code === "23505" ? "codigo" : "salvar"}`);
  }

  revalidateLeitos();
  goCadastro("sucesso=criado");
}

export async function bloquearLeitoOperacional(formData: FormData) {
  const { supabase } = await requirePermission("leitos.gerenciar");
  const leitoId = text(formData, "leito_id");
  const motivo = text(formData, "motivo");
  if (!leitoId || !motivo) goMapa("erro=campos-operacao");

  const { error } = await supabase.rpc("bloquear_leito", {
    p_leito_id: leitoId,
    p_motivo: motivo,
    p_tipo: text(formData, "tipo") ?? "operacional",
    p_previsto_ate: text(formData, "previsto_ate"),
  });

  if (error) {
    console.error("[leitos.bloquear] falha", { code: error.code });
    goMapa("erro=bloqueio");
  }

  revalidateLeitos();
  goMapa("sucesso=bloqueio");
}

export async function desbloquearLeitoOperacional(formData: FormData) {
  const { supabase } = await requirePermission("leitos.gerenciar");
  const bloqueioId = text(formData, "bloqueio_id");
  if (!bloqueioId) goMapa("erro=campos-operacao");

  const { error } = await supabase.rpc("desbloquear_leito", {
    p_bloqueio_id: bloqueioId,
    p_observacoes: text(formData, "observacoes"),
  });

  if (error) {
    console.error("[leitos.desbloquear] falha", { code: error.code });
    goMapa("erro=desbloqueio");
  }

  revalidateLeitos();
  goMapa("sucesso=desbloqueio");
}

export async function iniciarHigienizacaoOperacional(formData: FormData) {
  const { supabase } = await requirePermission("leitos.gerenciar");
  const leitoId = text(formData, "leito_id");
  if (!leitoId) goMapa("erro=campos-operacao");

  const { error } = await supabase.rpc("iniciar_higienizacao_leito", {
    p_leito_id: leitoId,
    p_observacoes: text(formData, "observacoes"),
  });

  if (error) {
    console.error("[leitos.higienizacao.iniciar] falha", { code: error.code });
    goMapa("erro=higienizacao");
  }

  revalidateLeitos();
  goMapa("sucesso=higienizacao-iniciada");
}

export async function concluirHigienizacaoOperacional(formData: FormData) {
  const { supabase } = await requirePermission("leitos.gerenciar");
  const leitoId = text(formData, "leito_id");
  if (!leitoId) goMapa("erro=campos-operacao");

  const { error } = await supabase.rpc("concluir_higienizacao_leito", {
    p_leito_id: leitoId,
    p_observacoes: text(formData, "observacoes"),
  });

  if (error) {
    console.error("[leitos.higienizacao.concluir] falha", { code: error.code });
    goMapa("erro=higienizacao");
  }

  revalidateLeitos();
  goMapa("sucesso=higienizacao-concluida");
}
