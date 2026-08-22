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

  return (
    <AppShell email={user.email} logoutAction={logout}>
      {children}
    </AppShell>
  );
}
