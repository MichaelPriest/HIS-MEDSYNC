"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const COOKIE_PERFIL = "medsync_perfil";
const COOKIE_UNIDADE = "medsync_unidade";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalize(value: string) {
  const trimmed = value.trim();
  return trimmed === "all" || UUID.test(trimmed) ? trimmed : "all";
}

export async function selecionarContextoTrabalho(perfilSolicitado: string, unidadeSolicitada: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false as const, perfil: "all", unidade: "all" };

  const perfil = normalize(perfilSolicitado);
  const unidade = normalize(unidadeSolicitada);

  const { data: unidades } = await supabase
    .from("usuario_unidades")
    .select("empresa_id,unidade_id")
    .eq("usuario_id", user.id)
    .eq("ativo", true);

  const unidadesAtivas = unidades ?? [];
  const unidadeValida = unidade === "all"
    ? null
    : unidadesAtivas.find((item) => item.unidade_id === unidade) ?? null;

  const unidadeEfetiva = unidadeValida?.unidade_id ?? unidadesAtivas[0]?.unidade_id ?? null;
  const empresaId = unidadeValida?.empresa_id ?? unidadesAtivas[0]?.empresa_id ?? null;
  const unidadePersistida = unidade === "all" ? "all" : unidadeValida?.unidade_id ?? "all";

  let perfilPersistido = perfil;
  if (perfil !== "all" && empresaId) {
    let query = supabase
      .from("usuario_perfis")
      .select("id")
      .eq("usuario_id", user.id)
      .eq("empresa_id", empresaId)
      .eq("perfil_id", perfil)
      .eq("ativo", true);

    if (unidade !== "all" && unidadeEfetiva) {
      query = query.or(`unidade_id.is.null,unidade_id.eq.${unidadeEfetiva}`);
    }

    const { data: vinculo } = await query.limit(1).maybeSingle();
    if (!vinculo) perfilPersistido = "all";
  }

  const store = await cookies();
  const options = {
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
  };

  store.set(COOKIE_PERFIL, perfilPersistido, options);
  store.set(COOKIE_UNIDADE, unidadePersistida, options);
  revalidatePath("/", "layout");

  return {
    ok: true as const,
    perfil: perfilPersistido,
    unidade: unidadePersistida,
  };
}
