import { redirect } from "next/navigation";
import { AppShell } from "@/components/painel/app-shell";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/modules/auth/actions";

type NamedRow = { nome: string | null };
type CompanyRow = { nome_fantasia: string | null; razao_social: string | null };

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: usuario }, { data: unidade }] = await Promise.all([
    supabase.from("usuarios").select("nome").eq("id", user.id).maybeSingle(),
    supabase
      .from("usuario_unidades")
      .select("empresa_id,unidade_id,unidade:unidades(nome),empresa:empresas(nome_fantasia,razao_social)")
      .eq("usuario_id", user.id)
      .eq("ativo", true)
      .limit(1)
      .maybeSingle(),
  ]);

  let grantedPermissions: string[] | null = null;
  let profileNames: string[] = [];

  if (unidade?.empresa_id) {
    const perfisQuery = supabase
      .from("usuario_perfis")
      .select("perfil_id,perfil:perfis(nome)")
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

    if (!perfisError) {
      profileNames = [...new Set((perfis ?? []).flatMap((item) => {
        const perfil = one(item.perfil as NamedRow | NamedRow[] | null);
        return perfil?.nome ? [perfil.nome] : [];
      }))];
    }

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

  const unidadeAtual = one(unidade?.unidade as NamedRow | NamedRow[] | null);
  const empresaAtual = one(unidade?.empresa as CompanyRow | CompanyRow[] | null);

  return (
    <AppShell
      email={user.email}
      userName={usuario?.nome ?? user.email?.split("@")[0] ?? "Usuário"}
      unidadeId={unidade?.unidade_id ?? null}
      unidadeNome={unidadeAtual?.nome ?? null}
      empresaNome={empresaAtual?.nome_fantasia ?? empresaAtual?.razao_social ?? null}
      profileNames={profileNames}
      grantedPermissions={grantedPermissions}
      logoutAction={logout}
    >
      {children}
    </AppShell>
  );
}
