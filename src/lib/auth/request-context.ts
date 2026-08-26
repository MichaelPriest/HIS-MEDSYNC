import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

type NamedRelation = { nome: string | null };
type CompanyRelation = { nome_fantasia: string | null; razao_social: string | null };

export type RequestUnitContext = {
  empresa_id: string;
  unidade_id: string;
  unidade: NamedRelation | NamedRelation[] | null;
  empresa: CompanyRelation | CompanyRelation[] | null;
};

/**
 * Contexto autenticado compartilhado entre layout e páginas Server Components.
 * A unidade selecionada no topbar é persistida em cookie. O modo "all" mantém
 * uma unidade operacional válida como fallback para telas transacionais que
 * ainda exigem um único escopo, enquanto a navegação pode exibir a visão agregada.
 */
export const getRequestAuthContext = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      supabase,
      user: null,
      unidade: null as RequestUnitContext | null,
      unidades: [] as RequestUnitContext[],
      empresaId: null as string | null,
      unidadeId: null as string | null,
      unidadeSelection: "all",
    };
  }

  const { data: unidadesData, error: unidadesError } = await supabase
    .from("usuario_unidades")
    .select("empresa_id,unidade_id,unidade:unidades(nome),empresa:empresas(nome_fantasia,razao_social),created_at")
    .eq("usuario_id", user.id)
    .eq("ativo", true)
    .order("created_at", { ascending: true });

  if (unidadesError) {
    console.error("[auth-context] falha ao resolver unidades", {
      code: unidadesError.code,
    });
  }

  const unidades = (unidadesData ?? []) as unknown as Array<RequestUnitContext & { created_at?: string }>;
  const store = await cookies();
  const requestedUnit = store.get("medsync_unidade")?.value ?? "all";
  const requested = requestedUnit !== "all"
    ? unidades.find((item) => item.unidade_id === requestedUnit) ?? null
    : null;
  const unidade = requested ?? unidades[0] ?? null;

  let empresaId = unidade?.empresa_id ?? null;
  if (!empresaId) {
    const { data: empresa } = await supabase
      .from("usuario_empresas")
      .select("empresa_id")
      .eq("usuario_id", user.id)
      .eq("ativo", true)
      .limit(1)
      .maybeSingle();
    empresaId = empresa?.empresa_id ?? null;
  }

  const unidadeSelection = requestedUnit === "all"
    ? "all"
    : requested?.unidade_id ?? "all";

  return {
    supabase,
    user,
    unidade: unidade as RequestUnitContext | null,
    unidades: unidades as RequestUnitContext[],
    empresaId,
    unidadeId: unidade?.unidade_id ?? null,
    unidadeSelection,
  };
});
