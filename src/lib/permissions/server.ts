import { redirect } from "next/navigation";
import type { Permission } from "./catalog";
import { createClient } from "@/lib/supabase/server";

export async function requirePermission(required: Permission) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: unidade } = await supabase
    .from("usuario_unidades")
    .select("empresa_id,unidade_id")
    .eq("usuario_id", user.id)
    .eq("ativo", true)
    .limit(1)
    .maybeSingle();

  const { data: empresa } = unidade
    ? { data: { empresa_id: unidade.empresa_id } }
    : await supabase
        .from("usuario_empresas")
        .select("empresa_id")
        .eq("usuario_id", user.id)
        .eq("ativo", true)
        .limit(1)
        .maybeSingle();

  const empresaId = unidade?.empresa_id ?? empresa?.empresa_id ?? null;
  const unidadeId = unidade?.unidade_id ?? null;
  if (!empresaId) redirect("/painel");

  const { data: allowed, error } = await supabase.rpc("tem_permissao", {
    p_empresa: empresaId,
    p_unidade: unidadeId,
    p_codigo: required,
  });

  if (error || allowed !== true) redirect("/painel?erro=acesso-negado");

  return { supabase, user, empresaId, unidadeId };
}
