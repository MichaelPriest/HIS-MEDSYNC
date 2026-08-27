import { cookies } from "next/headers";
import { getRequestAuthContext } from "@/lib/auth/request-context";
import type { ProfileNavigationMeta } from "@/config/navigation-map";

type PerfilRow = {
  id: string;
  nome: string;
  ativo: boolean;
  setor_chave: string | null;
  nivel_acesso: "operacional" | "supervisao" | "gestao" | "administrador";
  pagina_inicial: string | null;
};
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

export async function getCurrentNavigationAccess() {
  const context = await getRequestAuthContext();
  const { supabase, user, empresaId, unidadeId, unidadeSelection } = context;
  if (!user || !empresaId) {
    return { ...context, grantedPermissions: [] as string[], activeProfile: null as ProfileNavigationMeta | null };
  }

  const store = await cookies();
  const requestedProfileId = store.get("medsync_perfil")?.value ?? "all";
  const { data: linksData } = await supabase
    .from("usuario_perfis")
    .select("perfil_id,unidade_id,perfil:perfis(id,nome,ativo,setor_chave,nivel_acesso,pagina_inicial)")
    .eq("usuario_id", user.id)
    .eq("empresa_id", empresaId)
    .eq("ativo", true);

  const links = ((linksData ?? []) as unknown as PerfilLink[]).filter((item) => {
    const perfil = one(item.perfil);
    if (!perfil?.ativo) return false;
    if (unidadeSelection === "all") return true;
    return item.unidade_id === null || item.unidade_id === unidadeId;
  });
  const profileMap = new Map<string, PerfilRow>();
  for (const item of links) {
    const perfil = one(item.perfil);
    if (perfil) profileMap.set(perfil.id, perfil);
  }

  const selectedProfileId = requestedProfileId !== "all" && profileMap.has(requestedProfileId)
    ? requestedProfileId
    : "all";
  const permissionProfileIds = selectedProfileId === "all"
    ? [...profileMap.keys()]
    : [selectedProfileId];

  const { data: permissionRowsData } = permissionProfileIds.length
    ? await supabase
        .from("perfil_permissoes")
        .select("perfil_id,permissao:permissoes(codigo,ativo)")
        .in("perfil_id", permissionProfileIds)
    : { data: [] };

  const permissionRows = (permissionRowsData ?? []) as unknown as PermissaoRow[];
  const grantedPermissions = [...new Set(permissionRows.flatMap((item) => {
    const permissao = one(item.permissao);
    return permissao?.ativo && permissao.codigo ? [permissao.codigo] : [];
  }))].sort();

  const selected = selectedProfileId === "all" ? null : profileMap.get(selectedProfileId) ?? null;
  const activeProfile: ProfileNavigationMeta | null = selected
    ? {
        id: selected.id,
        nome: selected.nome,
        setorChave: selected.setor_chave,
        nivelAcesso: selected.nivel_acesso,
        paginaInicial: selected.pagina_inicial,
      }
    : null;

  return { ...context, grantedPermissions, activeProfile };
}
