import { redirect } from "next/navigation";
import type { Permission } from "./catalog";
import { getRequestAuthContext } from "@/lib/auth/request-context";

async function resolvePermissionContext() {
  const context = await getRequestAuthContext();
  if (!context.user) redirect("/login");
  if (!context.empresaId) redirect("/painel");

  return {
    supabase: context.supabase,
    user: context.user,
    empresaId: context.empresaId,
    unidadeId: context.unidadeId,
  };
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
