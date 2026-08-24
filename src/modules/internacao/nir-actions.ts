"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { asRoute } from "@/lib/route-cast";
import { requireAnyPermission } from "@/lib/permissions/server";

function text(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function nirError(message?: string | null) {
  if (!message) return "alocacao";
  if (message.includes("LEITO_INCOMPATIVEL_ISOLAMENTO")) return "incompativel-isolamento";
  if (message.includes("LEITO_INCOMPATIVEL_SEXO")) return "incompativel-sexo";
  if (message.includes("LEITO_INCOMPATIVEL_ACOMODACAO")) return "incompativel-acomodacao";
  if (message.includes("LEITO_RESERVADO_PARA_OUTRO_ATENDIMENTO")) return "leito-reservado";
  if (message.includes("LEITO_DESTINO_OCUPADO") || message.includes("LEITO_DESTINO_INDISPONIVEL")) return "leito-indisponivel";
  if (message.includes("LEITO_SEM_PERMISSAO")) return "sem-permissao";
  return "alocacao";
}

export async function alocarLeitoNir(formData: FormData) {
  const { supabase, empresaId, unidadeId } = await requireAnyPermission([
    "internacao.movimentar",
    "internacao.gerenciar",
    "leitos.gerenciar",
  ]);
  const internacaoId = text(formData, "internacao_id");
  const leitoId = text(formData, "leito_id");
  if (!internacaoId || !leitoId || !unidadeId) redirect(asRoute("/internacao/nir?erro=campos"));

  const [{ data: internacao }, { data: leito }] = await Promise.all([
    supabase
      .from("internacoes")
      .select("id,atendimento_id,status,leito_id")
      .eq("id", internacaoId)
      .eq("empresa_id", empresaId)
      .eq("unidade_id", unidadeId)
      .maybeSingle(),
    supabase
      .from("leitos")
      .select("id,status,ativo")
      .eq("id", leitoId)
      .eq("empresa_id", empresaId)
      .eq("unidade_id", unidadeId)
      .maybeSingle(),
  ]);

  if (!internacao || !["aguardando_leito", "internado", "transferido"].includes(internacao.status)) {
    redirect(asRoute("/internacao/nir?erro=internacao"));
  }
  if (internacao.leito_id) redirect(asRoute("/internacao/nir?erro=internacao-ja-alocada"));
  if (!leito?.ativo || leito.status !== "livre") redirect(asRoute("/internacao/nir?erro=leito-indisponivel"));

  const { error } = await supabase.rpc("movimentar_internacao_leito", {
    p_internacao_id: internacao.id,
    p_leito_destino_id: leito.id,
    p_motivo: text(formData, "motivo") ?? "Alocação pelo NIR",
  });

  if (error) {
    console.error("[nir] alocar leito", { code: error.code, category: nirError(error.message) });
    redirect(asRoute(`/internacao/nir?erro=${nirError(error.message)}`));
  }

  revalidatePath("/internacao/nir");
  revalidatePath("/internacao");
  revalidatePath("/internacao/leitos");
  revalidatePath(`/prontuario/${internacao.atendimento_id}`);
  redirect(asRoute("/internacao/nir?sucesso=leito-alocado"));
}
