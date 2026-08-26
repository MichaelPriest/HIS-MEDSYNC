import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShellContextual } from "@/components/painel/app-shell-contextual";
import { getRequestAuthContext } from "@/lib/auth/request-context";
import { logout } from "@/modules/auth/actions";
import { criarUrlFotoAssinada } from "@/modules/cadastros/fotos";

type NamedRow = { nome: string | null };
type CompanyRow = { nome_fantasia: string | null; razao_social: string | null };
type PerfilRow = { id: string; nome: string; ativo: boolean };
type PerfilLink = {
  perfil_id: string;
  unidade_id: string | null;
  perfil: PerfilRow | PerfilRow[] | null;
};
type PermissaoRow = {
  perfil_id: string;
  permissao: { codigo: string; ativo: boolean } | Array<{ codigo: string; ativo: boolean }> | null;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const {
    supabase,
    user,
    unidade,
    unidades,
    empresaId,
    unidadeId,
    unidadeSelection,
  } = await getRequestAuthContext();

  if (!user) redirect("/login");

  const store = await cookies();
  const requestedProfileId = store.get("medsync_perfil")?.value ?? "all";

  const usuarioPromise = supabase
    .from("usuarios")
    .select("nome,foto_path")
    .eq("id", user.id)
    .maybeSingle();

  const perfisPromise = empresaId
    ? supabase
        .from("usuario_perfis")
        .select("perfil_id,unidade_id,perfil:perfis(id,nome,ativo)")
        .eq("usuario_id", user.id)
        .eq("empresa_id", empresaId)
        .eq("ativo", true)
    : Promise.resolve({ data: [], error: null });

  const [{ data: usuario }, perfisResult] = await Promise.all([usuarioPromise, perfisPromise]);
  const links = (perfisResult.data ?? []) as unknown as PerfilLink[];

  const linksNoContexto = links.filter((item) => {
    const perfil = one(item.perfil);
    if (!perfil?.ativo) return false;
    if (unidadeSelection === "all") return true;
    return item.unidade_id === null || item.unidade_id === unidadeId;
  });

  const profileMap = new Map<string, PerfilRow>();
  for (const item of linksNoContexto) {
    const perfil = one(item.perfil);
    if (perfil) profileMap.set(perfil.id, perfil);
  }
  const profileOptions = [...profileMap.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const selectedProfileId = requestedProfileId !== "all" && profileMap.has(requestedProfileId)
    ? requestedProfileId
    : "all";

  const permissionProfileIds = selectedProfileId === "all"
    ? profileOptions.map((item) => item.id)
    : [selectedProfileId];

  const { data: permissionRowsData, error: permissionError } = permissionProfileIds.length
    ? await supabase
        .from("perfil_permissoes")
        .select("perfil_id,permissao:permissoes(codigo,ativo)")
        .in("perfil_id", permissionProfileIds)
    : { data: [], error: null };

  if (permissionError) {
    console.error("[layout] falha ao carregar permissões do contexto", { code: permissionError.code });
  }

  const permissionRows = (permissionRowsData ?? []) as unknown as PermissaoRow[];
  const grantedPermissions = [...new Set(permissionRows.flatMap((item) => {
    const permissao = one(item.permissao);
    return permissao?.ativo && permissao.codigo ? [permissao.codigo] : [];
  }))].sort();

  const profileNames = selectedProfileId === "all"
    ? profileOptions.map((item) => item.nome)
    : [profileMap.get(selectedProfileId)?.nome ?? "Perfil"];

  const unidadeAtual = one(unidade?.unidade as NamedRow | NamedRow[] | null);
  const empresaAtual = one(unidade?.empresa as CompanyRow | CompanyRow[] | null);
  const unitOptions = unidades
    .filter((item) => !empresaId || item.empresa_id === empresaId)
    .map((item) => ({ id: item.unidade_id, nome: one(item.unidade as NamedRow | NamedRow[] | null)?.nome ?? "Unidade" }))
    .filter((item, index, array) => array.findIndex((candidate) => candidate.id === item.id) === index)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const userPhotoUrl = await criarUrlFotoAssinada(supabase, usuario?.foto_path ?? null);

  return (
    <AppShellContextual
      email={user.email}
      userName={usuario?.nome ?? user.email?.split("@")[0] ?? "Usuário"}
      userPhotoUrl={userPhotoUrl}
      unidadeId={unidadeId}
      unidadeNome={unidadeAtual?.nome ?? null}
      empresaNome={empresaAtual?.nome_fantasia ?? empresaAtual?.razao_social ?? null}
      profileNames={profileNames}
      grantedPermissions={grantedPermissions}
      profileOptions={profileOptions.map((item) => ({ id: item.id, nome: item.nome }))}
      unitOptions={unitOptions}
      selectedProfileId={selectedProfileId}
      selectedUnitId={unidadeSelection}
      logoutAction={logout}
    >
      {children}
    </AppShellContextual>
  );
}
