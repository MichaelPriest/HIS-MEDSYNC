"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/permissions/server";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function permissionCode(value: FormDataEntryValue) {
  const code = String(value).trim();
  return /^[a-z]+[a-z0-9_.]+$/.test(code) ? code : null;
}

async function auditAccessChange({
  supabase,
  userId,
  empresaId,
  unidadeId,
  operacao,
  entidade,
  registroId,
  motivo,
  novos,
}: {
  supabase: Awaited<ReturnType<typeof requirePermission>>["supabase"];
  userId: string;
  empresaId: string;
  unidadeId: string | null;
  operacao: string;
  entidade: string;
  registroId?: string | null;
  motivo?: string | null;
  novos?: Record<string, unknown> | null;
}) {
  await supabase.from("auditoria_eventos").insert({
    empresa_id: empresaId,
    unidade_id: unidadeId,
    usuario_id: userId,
    operacao,
    entidade,
    registro_id: registroId ?? null,
    origem: "web",
    valores_novos: novos ?? null,
    motivo: motivo ?? null,
    correlation_id: crypto.randomUUID(),
  });
}

export async function criarPerfilAcesso(formData: FormData) {
  const { supabase, user, empresaId, unidadeId } = await requirePermission("usuarios.administrar");
  const nome = text(formData, "nome");
  if (nome.length < 2) redirect("/configuracoes/acessos?erro=nome-perfil");

  const { data: perfil, error } = await supabase
    .from("perfis")
    .insert({
      empresa_id: empresaId,
      nome,
      sistema: false,
      ativo: true,
      created_by: user.id,
      updated_by: user.id,
    })
    .select("id")
    .single();

  if (error || !perfil) redirect("/configuracoes/acessos?erro=criar-perfil");

  await auditAccessChange({
    supabase,
    userId: user.id,
    empresaId,
    unidadeId,
    operacao: "rbac.perfil.criar",
    entidade: "perfis",
    registroId: perfil.id,
    novos: { nome },
  });

  revalidatePath("/configuracoes/acessos");
  redirect(`/configuracoes/acessos?sucesso=perfil-criado#perfil-${perfil.id}`);
}

export async function atualizarPermissoesPerfil(formData: FormData) {
  const { supabase, user, empresaId, unidadeId } = await requirePermission("usuarios.administrar");
  const perfilId = text(formData, "perfil_id");
  if (!perfilId) redirect("/configuracoes/acessos?erro=perfil");

  const { data: perfil } = await supabase
    .from("perfis")
    .select("id,nome,sistema")
    .eq("id", perfilId)
    .eq("empresa_id", empresaId)
    .eq("ativo", true)
    .maybeSingle();

  if (!perfil) redirect("/configuracoes/acessos?erro=perfil");

  const selectedCodes = [...new Set(
    formData
      .getAll("permissoes")
      .map(permissionCode)
      .filter((code): code is string => Boolean(code)),
  )];

  const { data: resultado, error } = await supabase.rpc("salvar_permissoes_perfil", {
    p_perfil_id: perfilId,
    p_codigos: selectedCodes,
  });

  if (error) {
    console.error("[rbac] salvar matriz", { code: error.code, message: error.message });
    const code = error.message.includes("ACESSOS_PERMISSAO_INVALIDA")
      ? "permissao-invalida"
      : error.message.includes("ACESSOS_SEM_PERMISSAO")
        ? "acesso-negado"
        : "salvar-permissoes";
    redirect(`/configuracoes/acessos?erro=${code}#perfil-${perfilId}`);
  }

  const administrator = perfil.sistema && ["administrador", "admin"].includes(perfil.nome.toLowerCase());
  const payload = (resultado ?? {}) as { permissoes?: number };

  await auditAccessChange({
    supabase,
    userId: user.id,
    empresaId,
    unidadeId,
    operacao: administrator ? "rbac.admin.sincronizar" : "rbac.perfil.permissoes",
    entidade: "perfis",
    registroId: perfilId,
    novos: {
      permissoes: administrator ? "todas-ativas" : selectedCodes,
      total: payload.permissoes ?? selectedCodes.length,
    },
  });

  revalidatePath("/configuracoes/acessos");
  revalidatePath("/painel");
  redirect(`/configuracoes/acessos?sucesso=${administrator ? "admin-sincronizado" : "permissoes-atualizadas"}#perfil-${perfilId}`);
}

export async function vincularPerfilUsuario(formData: FormData) {
  const { supabase, user, empresaId, unidadeId } = await requirePermission("usuarios.administrar");
  const usuarioId = text(formData, "usuario_id");
  const perfilId = text(formData, "perfil_id");
  const unidadeSelecionada = text(formData, "unidade_id") || null;
  if (!usuarioId || !perfilId) redirect("/configuracoes/acessos?erro=vinculo-campos");

  const [{ data: usuarioEmpresa }, { data: perfil }, unidadeResult] = await Promise.all([
    supabase.from("usuario_empresas").select("id").eq("usuario_id", usuarioId).eq("empresa_id", empresaId).eq("ativo", true).maybeSingle(),
    supabase.from("perfis").select("id,nome").eq("id", perfilId).eq("empresa_id", empresaId).eq("ativo", true).maybeSingle(),
    unidadeSelecionada
      ? supabase.from("unidades").select("id").eq("id", unidadeSelecionada).eq("empresa_id", empresaId).eq("ativo", true).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (!usuarioEmpresa || !perfil || (unidadeSelecionada && !unidadeResult.data)) {
    redirect("/configuracoes/acessos?erro=vinculo-escopo");
  }

  let existenteQuery = supabase
    .from("usuario_perfis")
    .select("id,ativo")
    .eq("usuario_id", usuarioId)
    .eq("empresa_id", empresaId)
    .eq("perfil_id", perfilId);
  existenteQuery = unidadeSelecionada
    ? existenteQuery.eq("unidade_id", unidadeSelecionada)
    : existenteQuery.is("unidade_id", null);
  const { data: existente } = await existenteQuery.limit(1).maybeSingle();

  if (existente) {
    const { error } = await supabase
      .from("usuario_perfis")
      .update({ ativo: true, updated_by: user.id, updated_at: new Date().toISOString() })
      .eq("id", existente.id);
    if (error) redirect("/configuracoes/acessos?erro=reativar-vinculo");
  } else {
    const { error } = await supabase.from("usuario_perfis").insert({
      usuario_id: usuarioId,
      empresa_id: empresaId,
      unidade_id: unidadeSelecionada,
      perfil_id: perfilId,
      ativo: true,
      created_by: user.id,
      updated_by: user.id,
    });
    if (error) redirect("/configuracoes/acessos?erro=criar-vinculo");
  }

  await auditAccessChange({
    supabase,
    userId: user.id,
    empresaId,
    unidadeId,
    operacao: "rbac.usuario.vincular_perfil",
    entidade: "usuarios",
    registroId: usuarioId,
    novos: { perfil_id: perfilId, perfil: perfil.nome, unidade_id: unidadeSelecionada },
  });

  revalidatePath("/configuracoes/acessos");
  revalidatePath("/painel");
  redirect("/configuracoes/acessos?sucesso=vinculo-atualizado");
}

export async function removerVinculoPerfil(formData: FormData) {
  const { supabase, user, empresaId, unidadeId } = await requirePermission("usuarios.administrar");
  const vinculoId = text(formData, "vinculo_id");
  if (!vinculoId) redirect("/configuracoes/acessos?erro=vinculo");

  const { data: vinculo } = await supabase
    .from("usuario_perfis")
    .select("id,usuario_id,perfil_id,unidade_id,perfil:perfis(nome)")
    .eq("id", vinculoId)
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (!vinculo) redirect("/configuracoes/acessos?erro=vinculo");
  if (vinculo.usuario_id === user.id) redirect("/configuracoes/acessos?erro=auto-remocao-bloqueada");

  const { error } = await supabase.from("usuario_perfis").delete().eq("id", vinculoId);
  if (error) redirect("/configuracoes/acessos?erro=remover-vinculo");

  const perfil = Array.isArray(vinculo.perfil) ? vinculo.perfil[0] : vinculo.perfil;
  await auditAccessChange({
    supabase,
    userId: user.id,
    empresaId,
    unidadeId,
    operacao: "rbac.usuario.remover_perfil",
    entidade: "usuarios",
    registroId: vinculo.usuario_id,
    motivo: "Revogação manual de perfil",
    novos: { perfil_id: vinculo.perfil_id, perfil: perfil?.nome ?? null, unidade_id: vinculo.unidade_id },
  });

  revalidatePath("/configuracoes/acessos");
  revalidatePath("/painel");
  redirect("/configuracoes/acessos?sucesso=vinculo-removido");
}
