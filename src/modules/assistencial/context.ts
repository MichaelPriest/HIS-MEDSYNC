import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function getAssistencialContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: unidade } = await supabase.from("usuario_unidades").select("empresa_id,unidade_id").eq("usuario_id", user.id).eq("ativo", true).limit(1).maybeSingle();
  if (!unidade) redirect("/painel?erro=sem-unidade");
  return { supabase, user, empresaId: unidade.empresa_id, unidadeId: unidade.unidade_id };
}
