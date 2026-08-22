"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
const credentials = z.object({ email: z.string().email(), senha: z.string().min(8) });
export async function login(formData: FormData) {
  const parsed = credentials.safeParse({ email: formData.get("email"), senha: formData.get("senha") });
  if (!parsed.success) redirect("/login?erro=credenciais");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.senha });
  if (error) redirect("/login?erro=autenticacao");
  redirect("/painel");
}
export async function logout() { const supabase = await createClient(); await supabase.auth.signOut(); redirect("/login"); }
export async function requestPasswordReset(formData: FormData) {
  const email = z.string().email().safeParse(formData.get("email"));
  if (email.success) { const supabase = await createClient(); await supabase.auth.resetPasswordForEmail(email.data); }
  redirect("/recuperar-senha?enviado=1");
}
