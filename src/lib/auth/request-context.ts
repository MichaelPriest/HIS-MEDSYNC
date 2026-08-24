import { cache } from "react";
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
 * React cache() deduplica Auth + unidade dentro da mesma renderização/request,
 * sem reaproveitar sessão entre usuários ou requisições diferentes.
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
      empresaId: null as string | null,
      unidadeId: null as string | null,
    };
  }

  const { data: unidade, error: unidadeError } = await supabase
    .from("usuario_unidades")
    .select("empresa_id,unidade_id,unidade:unidades(nome),empresa:empresas(nome_fantasia,razao_social)")
    .eq("usuario_id", user.id)
    .eq("ativo", true)
    .limit(1)
    .maybeSingle();

  if (unidadeError) {
    console.error("[auth-context] falha ao resolver unidade", {
      code: unidadeError.code,
    });
  }

  const normalized = (unidade ?? null) as RequestUnitContext | null;

  return {
    supabase,
    user,
    unidade: normalized,
    empresaId: normalized?.empresa_id ?? null,
    unidadeId: normalized?.unidade_id ?? null,
  };
});
