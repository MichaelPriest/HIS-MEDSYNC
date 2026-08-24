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
    .select("empresa_id,unidade_id")
    .eq("usuario_id", user.id)
    .eq("ativo", true)
    .limit(1)
    .maybeSingle();

  let grantedPermissions: string[] | null = null;

  if (unidade?.empresa_id) {
    const perfisQuery = supabase
      .from("usuario_perfis")
      .select("perfil_id")
      .eq("usuario_id", user.id)
      .eq("empresa_id", unidade.empresa_id)
      .eq("ativo", true);

    if (unidade.unidade_id) {
      perfisQuery.or(`unidade_id.is.null,unidade_id.eq.${unidade.unidade_id}`);
    } else {
      perfisQuery.is("unidade_id", null);
    }

    const { data: perfis, error: perfisError } = await perfisQuery;
    const perfilIds = [...new Set((perfis ?? []).map((item) => item.perfil_id))];

    if (!perfisError && perfilIds.length > 0) {
      const { data: grants, error: grantsError } = await supabase
        .from("perfil_permissoes")
        .select("permissao:permissoes(codigo,ativo)")
        .in("perfil_id", perfilIds);

      if (!grantsError) {
        grantedPermissions = [...new Set((grants ?? []).flatMap((grant) => {
          const permissao = Array.isArray(grant.permissao)
            ? grant.permissao[0]
            : grant.permissao;
          return permissao?.ativo && permissao.codigo ? [permissao.codigo] : [];
        }))];
      }
    } else if (!perfisError) {
      grantedPermissions = [];
    }
  }

  return (
    <AppShell
      email={user.email}
      unidadeId={unidade?.unidade_id ?? null}
      grantedPermissions={grantedPermissions}
      logoutAction={logout}
    >
      {children}
    </AppShell>
  );
}
