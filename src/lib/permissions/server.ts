import { redirect } from "next/navigation";
import type { Permission } from "./catalog";
import { createClient } from "@/lib/supabase/server";

async function resolvePermissionContext() {
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

  return { supabase, user, empresaId, unidadeId };
}

export async function requireAnyPermission(required: readonly Permission[]) {
  const context = await resolvePermissionContext();
  if (!required.length) redirect("/painel?erro=acesso-negado");

  const checks = await Promise.all(
    required.map((permission) =>
      context.supabase.rpc("tem_permissao", {
        p_empresa: context.empresaId,
        p_unidade: context.unidadeId,
        p_codigo: permission,
      }),
    ),
  );

  if (!checks.some(({ data, error }) => !error && data === true)) {
    redirect("/painel?erro=acesso-negado");
  }

  return context;
}

export async function requirePermission(required: Permission) {
  return requireAnyPermission([required]);
}
