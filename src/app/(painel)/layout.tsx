import { redirect } from "next/navigation";
import { AppShell } from "@/components/painel/app-shell";
import { getRequestAuthContext } from "@/lib/auth/request-context";
import { logout } from "@/modules/auth/actions";
import { criarUrlFotoAssinada } from "@/modules/cadastros/fotos";

type NamedRow = { nome: string | null };
type CompanyRow = { nome_fantasia: string | null; razao_social: string | null };
type AccessPayload = { perfis?: unknown; permissoes?: unknown };

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function strings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string" && item.length > 0))];
}

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user, unidade, empresaId, unidadeId } = await getRequestAuthContext();

  if (!user) redirect("/login");

  const usuarioPromise = supabase
    .from("usuarios")
    .select("nome,foto_path")
    .eq("id", user.id)
    .maybeSingle();

  const accessPromise = empresaId && unidadeId
    ? supabase.rpc("obter_contexto_acesso_usuario", {
        p_empresa: empresaId,
        p_unidade: unidadeId,
      })
    : Promise.resolve({ data: null, error: null });

  const [{ data: usuario }, accessResult] = await Promise.all([
    usuarioPromise,
    accessPromise,
  ]);

  let grantedPermissions: string[] | null = null;
  let profileNames: string[] = [];

  if (empresaId && unidadeId) {
    if (accessResult.error) {
      console.error("[layout] falha ao carregar contexto de acesso", {
        code: accessResult.error.code,
      });
    } else {
      const payload = (accessResult.data ?? {}) as AccessPayload;
      profileNames = strings(payload.perfis);
      grantedPermissions = strings(payload.permissoes);
    }
  }

  const unidadeAtual = one(unidade?.unidade as NamedRow | NamedRow[] | null);
  const empresaAtual = one(unidade?.empresa as CompanyRow | CompanyRow[] | null);
  const userPhotoUrl = await criarUrlFotoAssinada(supabase, usuario?.foto_path ?? null);

  return (
    <AppShell
      email={user.email}
      userName={usuario?.nome ?? user.email?.split("@")[0] ?? "Usuário"}
      userPhotoUrl={userPhotoUrl}
      unidadeId={unidadeId}
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
