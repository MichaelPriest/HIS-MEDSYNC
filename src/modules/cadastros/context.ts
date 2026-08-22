import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function getCadastroContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: vinculo } = await supabase
    .from("usuario_empresas")
    .select("empresa_id")
    .eq("usuario_id", user.id)
    .eq("ativo", true)
    .limit(1)
    .maybeSingle();

  if (!vinculo) redirect("/painel");
  return { supabase, user, empresaId: vinculo.empresa_id };
}

export function optional(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

export function digits(value: FormDataEntryValue | null) {
  return String(value ?? "").replace(/\D/g, "");
}
