"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/permissions/server";

const TIPOS = new Set([
  "bloco",
  "andar",
  "ala",
  "setor",
  "uti",
  "centro_cirurgico",
  "centro_obstetrico",
  "pronto_socorro",
  "enfermaria",
  "ambulatorio",
  "consultorio",
  "sala",
  "posto_enfermagem",
  "apoio",
  "outro",
]);

const TIPOS_OPERACIONAIS = new Set([
  "setor",
  "uti",
  "centro_cirurgico",
  "centro_obstetrico",
  "pronto_socorro",
  "enfermaria",
  "ambulatorio",
]);

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function bool(formData: FormData, key: string) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

function codigoNormalizado(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

export async function criarEstruturaFisica(formData: FormData) {
  const { supabase, user, empresaId, unidadeId } = await requirePermission("estrutura.criar");
  if (!unidadeId) redirect("/configuracoes/estrutura?erro=unidade");

  const nome = text(formData, "nome");
  const tipo = text(formData, "tipo");
  const parentId = text(formData, "parent_id") || null;
  const codigo = codigoNormalizado(text(formData, "codigo") || nome);
  const capacidadeRaw = text(formData, "capacidade_leitos");
  const capacidade = capacidadeRaw ? Number(capacidadeRaw) : null;

  if (!nome || !codigo || !TIPOS.has(tipo)) redirect("/configuracoes/estrutura?erro=campos");
  if (capacidade !== null && (!Number.isInteger(capacidade) || capacidade < 0)) redirect("/configuracoes/estrutura?erro=capacidade");

  if (parentId) {
    const { data: parent } = await supabase
      .from("estruturas_fisicas")
      .select("id")
      .eq("id", parentId)
      .eq("unidade_id", unidadeId)
      .eq("ativo", true)
      .maybeSingle();
    if (!parent) redirect("/configuracoes/estrutura?erro=parent");
  }

  const permiteInternacao = bool(formData, "permite_internacao") || ["uti", "enfermaria"].includes(tipo);
  const permiteCirurgia = bool(formData, "permite_cirurgia") || ["centro_cirurgico", "centro_obstetrico"].includes(tipo);
  const permiteAtendimento = bool(formData, "permite_atendimento") || !["bloco", "andar", "ala"].includes(tipo);
  const now = new Date().toISOString();

  const { data: estrutura, error } = await supabase
    .from("estruturas_fisicas")
    .insert({
      empresa_id: empresaId,
      unidade_id: unidadeId,
      parent_id: parentId,
      codigo,
      nome,
      tipo,
      descricao: text(formData, "descricao") || null,
      capacidade_leitos: capacidade,
      permite_internacao: permiteInternacao,
      permite_cirurgia: permiteCirurgia,
      permite_atendimento: permiteAtendimento,
      ordem: Number(text(formData, "ordem") || 0) || 0,
      ativo: true,
      created_by: user.id,
      updated_by: user.id,
      updated_at: now,
    })
    .select("id")
    .single();

  if (error || !estrutura) redirect("/configuracoes/estrutura?erro=salvar");

  if (TIPOS_OPERACIONAIS.has(tipo) && bool(formData, "criar_setor_operacional")) {
    const { data: setorExistente } = await supabase
      .from("setores")
      .select("id,estrutura_fisica_id")
      .eq("unidade_id", unidadeId)
      .ilike("nome", nome)
      .limit(1)
      .maybeSingle();

    if (setorExistente) {
      const { error: vinculoError } = await supabase
        .from("setores")
        .update({ estrutura_fisica_id: estrutura.id, ativo: true, updated_by: user.id, updated_at: now })
        .eq("id", setorExistente.id);
      if (vinculoError) redirect(`/configuracoes/estrutura?erro=setor&estrutura=${estrutura.id}`);
    } else {
      const { error: setorError } = await supabase.from("setores").insert({
        empresa_id: empresaId,
        unidade_id: unidadeId,
        nome,
        estrutura_fisica_id: estrutura.id,
        ativo: true,
        created_by: user.id,
        updated_by: user.id,
      });
      if (setorError) redirect(`/configuracoes/estrutura?erro=setor&estrutura=${estrutura.id}`);
    }
  }

  revalidatePath("/configuracoes/estrutura");
  redirect("/configuracoes/estrutura?sucesso=criado");
}

export async function alternarEstruturaFisica(formData: FormData) {
  const { supabase, user, unidadeId } = await requirePermission("estrutura.editar");
  if (!unidadeId) redirect("/configuracoes/estrutura?erro=unidade");

  const id = text(formData, "estrutura_id");
  const ativo = text(formData, "ativo") === "true";
  if (!id) redirect("/configuracoes/estrutura?erro=estrutura");

  const now = new Date().toISOString();
  const { data: estrutura, error } = await supabase
    .from("estruturas_fisicas")
    .update({ ativo, updated_by: user.id, updated_at: now })
    .eq("id", id)
    .eq("unidade_id", unidadeId)
    .select("id")
    .maybeSingle();

  if (error || !estrutura) redirect("/configuracoes/estrutura?erro=editar");

  await supabase
    .from("setores")
    .update({ ativo, updated_by: user.id, updated_at: now })
    .eq("estrutura_fisica_id", id)
    .eq("unidade_id", unidadeId);

  revalidatePath("/configuracoes/estrutura");
  redirect("/configuracoes/estrutura?sucesso=atualizado");
}
