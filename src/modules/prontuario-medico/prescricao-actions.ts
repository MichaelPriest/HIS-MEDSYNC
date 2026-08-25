"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/permissions/server";
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
  supabase: Awaited<ReturnType<typeof requirePermission>>["supabase"],
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

function tipoPrescricao(categoria: string) {
  if (categoria === "medicamento") return "medicamento";
  if (categoria === "procedimento") return "procedimento";
  return "outro";
}

export async function criarPrescricaoMedica(formData: FormData) {
  const { supabase, user, empresaId, unidadeId } = await requirePermission("prescricao.criar");
  const atendimentoId = text(formData, "atendimento_id");
  const itemAssistencialId = text(formData, "item_assistencial_id");
  if (!atendimentoId) redirect("/prontuario?erro=atendimento");
  if (!itemAssistencialId || !unidadeId) go(atendimentoId, "erro=catalogo");

  const [{ data: atendimento }, profissional, { data: itemCatalogo }] = await Promise.all([
    supabase
      .from("atendimentos")
      .select("id")
      .eq("id", atendimentoId)
      .eq("empresa_id", empresaId)
      .eq("unidade_id", unidadeId)
      .in("status", ["aberto", "em_espera", "em_atendimento"])
      .maybeSingle(),
    resolveProfissional(supabase, user.id, user.email ?? undefined, empresaId),
    supabase
      .from("itens_assistenciais")
      .select("id,categoria,descricao,unidade_medida,apresentacao,concentracao,forma_farmaceutica")
      .eq("id", itemAssistencialId)
      .eq("empresa_id", empresaId)
      .eq("ativo", true)
      .in("categoria", ["medicamento", "material", "opme", "gas_medicinal", "procedimento", "outro"])
      .maybeSingle(),
  ]);

  if (!atendimento) go(atendimentoId, "erro=atendimento");
  if (!profissional) go(atendimentoId, "erro=profissional");
  if (!itemCatalogo) go(atendimentoId, "erro=catalogo");

  const { data: produtoEstoque } = await supabase
    .from("estoque_produtos")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("item_assistencial_id", itemCatalogo.id)
    .eq("ativo", true)
    .limit(1)
    .maybeSingle();

  const detalhes = [itemCatalogo.descricao, itemCatalogo.concentracao, itemCatalogo.apresentacao]
    .filter(Boolean)
    .join(" · ");

  const { error } = await supabase.from("prescricoes").insert({
    empresa_id: empresaId,
    unidade_id: unidadeId,
    atendimento_id: atendimentoId,
    profissional_id: profissional.id,
    tipo: tipoPrescricao(itemCatalogo.categoria),
    item: detalhes,
    item_assistencial_id: itemCatalogo.id,
    produto_id: produtoEstoque?.id ?? null,
    quantidade: numberValue(formData, "quantidade"),
    unidade_dose: text(formData, "unidade_dose") ?? itemCatalogo.unidade_medida,
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
    requer_validacao_farmaceutica: itemCatalogo.categoria === "medicamento" || formData.get("requer_validacao_farmaceutica") === "on",
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
  const { supabase, user, empresaId, unidadeId } = await requirePermission("prescricao.assinar");
  const atendimentoId = text(formData, "atendimento_id");
  const prescricaoId = text(formData, "prescricao_id");
  if (!atendimentoId) redirect("/prontuario?erro=atendimento");
  if (!prescricaoId || !unidadeId) go(atendimentoId, "erro=prescricao");

  const profissional = await resolveProfissional(supabase, user.id, user.email ?? undefined, empresaId);
  if (!profissional) go(atendimentoId, "erro=profissional");

  const { data: prescricao } = await supabase
    .from("prescricoes")
    .select("id,tipo,item,item_assistencial_id,atendimento_id,profissional_id,atendimento:atendimentos(paciente_id)")
    .eq("id", prescricaoId)
    .eq("atendimento_id", atendimentoId)
    .eq("empresa_id", empresaId)
    .eq("unidade_id", unidadeId)
    .eq("profissional_id", profissional.id)
    .eq("status", "rascunho")
    .not("item_assistencial_id", "is", null)
    .is("assinado_em", null)
    .maybeSingle();
  if (!prescricao) go(atendimentoId, "erro=prescricao");

  const { data: itemAtivo } = await supabase
    .from("itens_assistenciais")
    .select("id")
    .eq("id", prescricao.item_assistencial_id)
    .eq("empresa_id", empresaId)
    .eq("ativo", true)
    .maybeSingle();
  if (!itemAtivo) go(atendimentoId, "erro=catalogo");

  const { error } = await supabase.rpc("assinar_prescricao", { p_prescricao_id: prescricaoId });
  if (error) {
    console.error("[prontuario.prescricao] assinar", { code: error.code });
    go(atendimentoId, "erro=assinatura");
  }

  let aviso: "aprazamento" | "farmacia" | null = null;
  if (prescricao.tipo === "medicamento") {
    const { error: scheduleError } = await supabase.rpc("gerar_aprazamentos_prescricao", {
      p_prescricao_id: prescricaoId,
      p_horizonte_dias: 2,
    });
    if (scheduleError) {
      aviso = "aprazamento";
      console.error("[prontuario.prescricao] aprazamento", { code: scheduleError.code });
    }

    const encounter = Array.isArray(prescricao.atendimento) ? prescricao.atendimento[0] : prescricao.atendimento;
    const { data: fila, error: filaLookupError } = await supabase
      .from("filas_setoriais")
      .select("id")
      .eq("atendimento_id", atendimentoId)
      .eq("setor_codigo", "farmacia")
      .eq("origem", "prescricao")
      .in("status", ["aguardando", "chamado", "em_atendimento"])
      .limit(1)
      .maybeSingle();

    if (filaLookupError) {
      aviso = "farmacia";
      console.error("[prontuario.prescricao] consultar fila farmacia", { code: filaLookupError.code });
    } else if (!fila && encounter?.paciente_id) {
      const { error: filaInsertError } = await supabase.from("filas_setoriais").insert({
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
      if (filaInsertError) {
        aviso = "farmacia";
        console.error("[prontuario.prescricao] criar fila farmacia", { code: filaInsertError.code });
      }
    }
  }

  revalidatePath(`/prontuario/${atendimentoId}`);
  revalidatePath(`/prontuario/${atendimentoId}/prescricao`);
  revalidatePath("/setores/farmacia");
  revalidatePath("/assistencial/medicamentos");
  go(atendimentoId, `sucesso=assinada${aviso ? `&aviso=${aviso}` : ""}`);
}

export async function suspenderPrescricaoMedica(formData: FormData) {
  const { supabase, user, empresaId, unidadeId } = await requirePermission("prescricao.suspender");
  const atendimentoId = text(formData, "atendimento_id");
  const prescricaoId = text(formData, "prescricao_id");
  const motivo = text(formData, "motivo");
  if (!atendimentoId) redirect("/prontuario?erro=atendimento");
  if (!prescricaoId || !motivo || !unidadeId) go(atendimentoId, "erro=suspensao");

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
    .eq("status", "ativa")
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
  revalidatePath("/setores/farmacia");
  revalidatePath("/assistencial/medicamentos");
  go(atendimentoId, "sucesso=suspensa");
}
