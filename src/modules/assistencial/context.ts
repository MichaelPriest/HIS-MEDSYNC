import { redirect } from "next/navigation";
import { getRequestAuthContext } from "@/lib/auth/request-context";

export async function getAssistencialContext() {
  const { supabase, user, empresaId, unidadeId } = await getRequestAuthContext();

  if (!user) redirect("/login");
  if (!empresaId || !unidadeId) redirect("/painel?erro=sem-unidade");

  return { supabase, user, empresaId, unidadeId };
}
