"use server";

import { revalidatePath } from "next/cache";
import type { BackgroundActionState } from "@/lib/actions/background-action";
import { requirePermission } from "@/lib/permissions/server";
import { councilAbbreviation, isBrazilUf } from "@/modules/cadastros/regulatory-domains";

export type ProfessionalTissProfileData = {
  ready: boolean;
  especialidade?: string;
};

function text(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function onlyDigits(value: string | null) {
  return value ? value.replace(/\D/g, "") : null;
}

export async function salvarHabilitacaoTissProfissional(
  profissionalId: string,
  _previous: BackgroundActionState<ProfessionalTissProfileData>,
  formData: FormData,
): Promise<BackgroundActionState<ProfessionalTissProfileData>> {
  const { supabase, user, empresaId } = await requirePermission("profissionais.editar");
  const habilitadoTiss = formData.get("habilitado_tiss") === "true";

  if (!habilitadoTiss) {
    const { data, error } = await supabase
      .from("profissionais")
      .update({ habilitado_tiss: false, updated_at: new Date().toISOString(), updated_by: user.id })
      .eq("id", profissionalId)
      .eq("empresa_id", empresaId)
      .select("id")
      .maybeSingle();
    if (error || !data) return { status: "error", code: "salvar", message: "Não foi possível desabilitar o uso TISS deste profissional." };
    revalidateProfessionalPaths(profissionalId);
    return { status: "success", code: "tiss-desabilitado", message: "Profissional mantido no cadastro, sem obrigatoriedade de habilitação TISS.", data: { ready: false } };
  }

  const numeroConselho = text(formData, "numero_conselho");
  const ufConselho = text(formData, "uf_conselho")?.toUpperCase() ?? null;
  const cbo = onlyDigits(text(formData, "cbo"));
  const codigoConselhoAns = onlyDigits(text(formData, "codigo_conselho_ans"));

  if (!numeroConselho || !ufConselho || !cbo || !codigoConselhoAns) {
    return { status: "error", code: "habilitacao-incompleta", message: "Para habilitar no TISS, selecione CBO, conselho, UF e informe o número do conselho." };
  }
  if (!isBrazilUf(ufConselho)) {
    return { status: "error", code: "uf-invalida", message: "Selecione uma UF brasileira válida para o conselho profissional." };
  }
  if (!/^\d{6}$/.test(cbo)) {
    return { status: "error", code: "cbo-invalido", message: "Selecione um CBO de 6 dígitos da TUSS 24." };
  }
  if (!/^\d{2}$/.test(codigoConselhoAns)) {
    return { status: "error", code: "conselho-invalido", message: "Selecione um conselho profissional da TUSS 26." };
  }

  const [{ data: cboRef, error: cboError }, { data: councilRef, error: councilError }] = await Promise.all([
    supabase.from("ans_fhir_dominios_ativos").select("codigo,display,versao").eq("tabela", 24).eq("codigo", cbo).maybeSingle(),
    supabase.from("ans_fhir_dominios_ativos").select("codigo,display,versao").eq("tabela", 26).eq("codigo", codigoConselhoAns).maybeSingle(),
  ]);

  if (cboError || !cboRef || cbo === "999999") {
    return { status: "error", code: "cbo-fora-tabela-24", message: "O CBO selecionado não está disponível na TUSS 24 ativa para cadastro profissional." };
  }
  if (councilError || !councilRef) {
    return { status: "error", code: "conselho-fora-tabela-26", message: "O conselho selecionado não está disponível na TUSS 26 ativa." };
  }

  const conselho = councilAbbreviation(codigoConselhoAns);
  if (!conselho) return { status: "error", code: "conselho-sem-mapeamento", message: "O conselho selecionado não possui abreviação regulatória configurada." };

  const { data: profissional, error } = await supabase
    .from("profissionais")
    .update({
      habilitado_tiss: true,
      codigo_conselho_ans: codigoConselhoAns,
      conselho,
      numero_conselho: numeroConselho,
      uf_conselho: ufConselho,
      cbo,
      especialidade: cboRef.display,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    })
    .eq("id", profissionalId)
    .eq("empresa_id", empresaId)
    .select("id")
    .maybeSingle();

  if (error || !profissional) {
    console.error("[profissionais.tiss] salvar habilitacao", { profissionalId, code: error?.code });
    return { status: "error", code: "salvar", message: "Não foi possível atualizar a habilitação do profissional." };
  }

  revalidateProfessionalPaths(profissionalId);
  return {
    status: "success",
    code: "pronto-tiss",
    message: `Habilitação atualizada: ${cbo} · ${cboRef.display}.`,
    data: { ready: true, especialidade: cboRef.display },
  };
}

function revalidateProfessionalPaths(profissionalId: string) {
  revalidatePath("/profissionais");
  revalidatePath(`/profissionais/${profissionalId}`);
  revalidatePath("/cadastros/tiss");
  revalidatePath("/faturamento/guias");
}
