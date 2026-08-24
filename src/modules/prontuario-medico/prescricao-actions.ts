"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAnyPermission } from "@/lib/permissions/server";
import { asRoute } from "@/lib/route-cast";

function text(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function numberValue(formData: FormData, key: string) {
  const raw = text(formData, key);
  if (!raw) return null;
  const value = Number(raw.replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

function listValue(formData: FormData, key: string) {
  const raw = text(formData, key);
  return raw ? raw.split(/[;,\n]/).map((item) => item.trim()).filter(Boolean) : [];
}

function go(atendimentoId: string, query: string): never {
  redirect(asRoute(`/prontuario/${atendimentoId}/prescricao?${query}`));
}

async function resolveProfissional(
  supabase: Awaited<ReturnType<typeof requireAnyPermission>>["supabase"],
  userId: string,
  email: string | undefined,
  empresaId: string,
) {
  let { data } = await supabase
    .from("profissionais")
    .select("id,nome_completo")
    .eq("empresa_id", empresaId)
    .eq("usuario_id", userId)
    .eq("ativo", true)
    .limit(1)
    .maybeSingle();

  if (!data && email) {
    const fallback = await supabase
      .from("profissionais")
      .select("id,nome_completo")
      .eq("empresa_id", empresaId)
      .ilike("email", email)
      .eq("ativo", true)
      .limit(1)
      .maybeSingle();
    data = fallback.data;
  }

  return data;
}

export async function criarPrescricaoMedica(formData: FormData) {
  const { supabase, user, empresaId, unidadeId } = await requireAnyPermission([
    "prescricao.criar",
    "prontuario.evoluir",
  ]);
  const atendimentoId = text(formData, "atendimento_id");
  const item = text(formData, "item");
  if (!atendimentoId || !item || !unidadeId) go(atendimentoId ?? "", "erro=campos");

  const [{ data: atendimento }, profissional] = await Promise.all([
    supabase
      .from("atendimentos")
      .select("id,status")
      .eq("id", atendimentoId)
      .eq("empresa_id", empresaId)
      .eq("unidade_id", unidadeId)
      .in("status", ["aberto", "em_espera", "em_atendimento"])
      .maybeSingle(),
    resolveProfissional(supabase, user.id, user.email ?? undefined, empresaId),
  ]);

  if (!atendimento) go(atendimentoId, "erro=atendimento");
  if (!profissional) go(atendimentoId, "erro=profissional");

  const { error } = await supabase.from("prescricoes").insert({
    empresa_id: empresaId,
    unidade_id: unidadeId,
    atendimento_id: atendimentoId,
    profissional_id: profissional.id,
    tipo: text(formData, "tipo") ?? "medicamento",
    item,
    produto_id: text(formData, "produto_id"),
    quantidade: numberValue(formData, "quantidade"),
    unidade_dose: text(formData, "unidade_dose"),
    dose: text(formData, "dose"),
    via: text(formData, "via"),
    frequencia: text(formData, "frequencia"),
    duracao: text(formData, "duracao"),
    inicio_em: text(formData, "inicio_em"),
    fim_em: text(formData, "fim_em"),
    horarios: listValue(formData, "horarios"),
    aprazamento: listValue(formData, "aprazamento"),
    se_necessario: formData.get("se_necessario") === "on",
    diluente: text(formData, "diluente"),
    velocidade_infusao: text(formData, "velocidade_infusao"),
    instrucoes: text(formData, "instrucoes"),
    orientacoes: text(formData, "orientacoes"),
    requer_validacao_farmaceutica: formData.get("requer_validacao_farmaceutica") === "on",
    status: "rascunho",
    created_by: user.id,
    updated_by: user.id,
  });

  if (error) {
    console.error("[prontuario.prescricao] criar", { code: error.code });
    go(atendimentoId, "erro=salvar");
  }

  revalidatePath(`/prontuario/${atendimentoId}`);
  revalidatePath(`/prontuario/${atendimentoId}/prescricao`);
  go(atendimentoId, "sucesso=rascunho");
}

export async function assinarPrescricaoMedica(formData: FormData) {
  const { supabase, user, empresaId, unidadeId } = await requireAnyPermission([
    "prescricao.assinar",
    "prontuario.assinar",
  ]);
  const atendimentoId = text(formData, "atendimento_id");
  const prescricaoId = text(formData, "prescricao_id");
  if (!atendimentoId || !prescricaoId || !unidadeId) go(atendimentoId ?? "", "erro=prescricao");

  const profissional = await resolveProfissional(supabase, user.id, user.email ?? undefined, empresaId);
  if (!profissional) go(atendimentoId, "erro=profissional");

  const { data: prescricao } = await supabase
    .from("prescricoes")
    .select("id,tipo,item,atendimento_id,profissional_id,atendimento:atendimentos(paciente_id)")
    .eq("id", prescricaoId)
    .eq("atendimento_id", atendimentoId)
    .eq("empresa_id", empresaId)
    .eq("unidade_id", unidadeId)
    .eq("profissional_id", profissional.id)
    .maybeSingle();
  if (!prescricao) go(atendimentoId, "erro=prescricao");

  const { error } = await supabase.rpc("assinar_prescricao", { p_prescricao_id: prescricaoId });
  if (error) {
    console.error("[prontuario.prescricao] assinar", { code: error.code });
    go(atendimentoId, "erro=assinatura");
  }

  if (prescricao.tipo === "medicamento") {
    const { error: scheduleError } = await supabase.rpc("gerar_aprazamentos_prescricao", {
      p_prescricao_id: prescricaoId,
      p_horizonte_dias: 2,
    });
    if (scheduleError) console.error("[prontuario.prescricao] aprazamento", { code: scheduleError.code });

    const encounter = Array.isArray(prescricao.atendimento) ? prescricao.atendimento[0] : prescricao.atendimento;
    const { data: fila } = await supabase
      .from("filas_setoriais")
      .select("id")
      .eq("atendimento_id", atendimentoId)
      .eq("setor_codigo", "farmacia")
      .eq("origem", "prescricao")
      .in("status", ["aguardando", "chamado", "em_atendimento"])
      .limit(1)
      .maybeSingle();

    if (!fila && encounter?.paciente_id) {
      await supabase.from("filas_setoriais").insert({
        empresa_id: empresaId,
        unidade_id: unidadeId,
        atendimento_id: atendimentoId,
        paciente_id: encounter.paciente_id,
        setor_codigo: "farmacia",
        origem: "prescricao",
        motivo: `Dispensação da prescrição assinada: ${prescricao.item}`,
        prioridade: "normal",
        profissional_origem_id: profissional.id,
        created_by: user.id,
        updated_by: user.id,
      });
    }
  }

  revalidatePath(`/prontuario/${atendimentoId}`);
  revalidatePath(`/prontuario/${atendimentoId}/prescricao`);
  revalidatePath("/setores/farmacia");
  go(atendimentoId, "sucesso=assinada");
}

export async function suspenderPrescricaoMedica(formData: FormData) {
  const { supabase, user, empresaId, unidadeId } = await requireAnyPermission([
    "prescricao.suspender",
    "prontuario.evoluir",
  ]);
  const atendimentoId = text(formData, "atendimento_id");
  const prescricaoId = text(formData, "prescricao_id");
  const motivo = text(formData, "motivo");
  if (!atendimentoId || !prescricaoId || !motivo || !unidadeId) go(atendimentoId ?? "", "erro=suspensao");

  const profissional = await resolveProfissional(supabase, user.id, user.email ?? undefined, empresaId);
  if (!profissional) go(atendimentoId, "erro=profissional");

  const { data: prescricao } = await supabase
    .from("prescricoes")
    .select("id")
    .eq("id", prescricaoId)
    .eq("atendimento_id", atendimentoId)
    .eq("empresa_id", empresaId)
    .eq("unidade_id", unidadeId)
    .eq("profissional_id", profissional.id)
    .maybeSingle();
  if (!prescricao) go(atendimentoId, "erro=prescricao");

  const { error } = await supabase.rpc("suspender_prescricao", {
    p_prescricao_id: prescricaoId,
    p_motivo: motivo,
  });
  if (error) {
    console.error("[prontuario.prescricao] suspender", { code: error.code });
    go(atendimentoId, "erro=suspensao");
  }

  revalidatePath(`/prontuario/${atendimentoId}`);
  revalidatePath(`/prontuario/${atendimentoId}/prescricao`);
  go(atendimentoId, "sucesso=suspensa");
}
