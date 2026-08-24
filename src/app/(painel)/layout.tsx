import { redirect } from "next/navigation";
import { AppShell } from "@/components/painel/app-shell";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/modules/auth/actions";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: unidade } = await supabase
    .from("usuario_unidades")
    .select("unidade_id")
    .eq("usuario_id", user.id)
    .eq("ativo", true)
    .limit(1)
    .maybeSingle();

  return (
    <AppShell email={user.email} unidadeId={unidade?.unidade_id ?? null} logoutAction={logout}>
      {children}
    </AppShell>
  );
}
