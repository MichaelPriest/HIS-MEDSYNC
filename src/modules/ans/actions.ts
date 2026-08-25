"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/permissions/server";
import { asRoute } from "@/lib/route-cast";
import { buscarConceitoTussExato } from "@/modules/ans/tuss";

function value(formData: FormData, key: string) {
  const result = String(formData.get(key) ?? "").trim();
  return result || null;
}

function allowedCategory(table: string, category: string) {
  const byTable: Record<string, string[]> = {
    "18": ["diaria", "taxa", "gas_medicinal"],
    "19": ["material", "opme"],
    "20": ["medicamento"],
    "22": ["procedimento"],
  };
  return byTable[table]?.includes(category) ?? false;
}

export async function importarConceitoTussAns(formData: FormData) {
  const { supabase, user, empresaId } = await requirePermission("catalogos.criar");
  const table = value(formData, "table");
  const code = value(formData, "code");
  const category = value(formData, "category");
  const query = value(formData, "query") ?? code ?? "";
  if (!table || !code || !category || !allowedCategory(table, category)) {
    redirect(asRoute(`/catalogos/ans?table=${encodeURIComponent(table ?? "22")}&q=${encodeURIComponent(query)}&erro=campos`));
  }

  let official;
  try {
    official = await buscarConceitoTussExato(table, code);
  } catch (error) {
    console.error("[ans.tuss] validar importacao", error);
    redirect(asRoute(`/catalogos/ans?table=${table}&q=${encodeURIComponent(query)}&erro=ans-indisponivel`));
  }
  if (!official) redirect(asRoute(`/catalogos/ans?table=${table}&q=${encodeURIComponent(query)}&erro=nao-encontrado`));

  const codigoInterno = `ANS-${table}-${official.code}`.slice(0, 120);
  const now = new Date().toISOString();
  const payload = {
    empresa_id: empresaId,
    codigo_interno: codigoInterno,
    categoria: category,
    tabela_tiss_codigo: table,
    familia_tuss: Number(table),
    codigo_tuss: official.code,
    descricao: official.description,
    ativo: true,
    metadata: {
      origem: "ANS_OCL",
      fonte_oficial: "Agência Nacional de Saúde Suplementar",
      tabela_tuss: table,
      sincronizado_em: now,
      conceito_ans: official.raw,
    },
    updated_at: now,
    updated_by: user.id,
  };

  const { data: existing } = await supabase.from("itens_assistenciais")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("codigo_interno", codigoInterno)
    .maybeSingle();

  const result = existing
    ? await supabase.from("itens_assistenciais").update(payload).eq("id", existing.id).eq("empresa_id", empresaId)
    : await supabase.from("itens_assistenciais").insert({ ...payload, created_by: user.id });

  if (result.error) {
    console.error("[ans.tuss] importar", { code: result.error.code });
    redirect(asRoute(`/catalogos/ans?table=${table}&q=${encodeURIComponent(query)}&erro=salvar`));
  }

  revalidatePath("/catalogos/ans");
  revalidatePath("/catalogos");
  revalidatePath("/prescricao");
  redirect(asRoute(`/catalogos/ans?table=${table}&q=${encodeURIComponent(query)}&sucesso=importado&codigo=${encodeURIComponent(official.code)}`));
}
