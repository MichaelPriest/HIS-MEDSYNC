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
  let { data } = await supabase.from("profissionais").select("id,nome_completo")
    .eq("empresa_id", empresaId).eq("usuario_id", userId).eq("ativo", true).limit(1).maybeSingle();
  if (!data && email) {
    data = (await supabase.from("profissionais").select("id,nome_completo")
      .eq("empresa_id", empresaId).ilike("email", email).eq("ativo", true).limit(1).maybeSingle()).data;
  }
  return data;
}

async function criarFila(
  supabase: Awaited<ReturnType<typeof requirePermission>>["supabase"],
  args: { empresaId:string; unidadeId:string; atendimentoId:string; pacienteId:string; setor:string; origem:string; motivo:string; profissionalId:string; userId:string },
) {
  const { data: existente } = await supabase.from("filas_setoriais").select("id")
    .eq("atendimento_id", args.atendimentoId).eq("setor_codigo", args.setor).eq("origem", args.origem)
    .in("status", ["aguardando", "chamado", "em_atendimento"]).limit(1).maybeSingle();
  if (existente) return null;
  return (await supabase.from("filas_setoriais").insert({
    empresa_id: args.empresaId, unidade_id: args.unidadeId, atendimento_id: args.atendimentoId,
    paciente_id: args.pacienteId, setor_codigo: args.setor, origem: args.origem, motivo: args.motivo,
    prioridade: "normal", profissional_origem_id: args.profissionalId, created_by: args.userId, updated_by: args.userId,
  })).error;
}

function tipoExame(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>).tipo_exame;
  return typeof value === "string" ? value.toLowerCase() : null;
}
function destinoExame(tipo: string | null) {
  if (tipo === "laboratorio") return { modalidade: "laboratorio", setor: "laboratorio" } as const;
  if (["raio_x", "tomografia", "ressonancia", "ultrassonografia", "mamografia", "densitometria"].includes(tipo ?? "")) {
    return { modalidade: "imagem", setor: "imagem" } as const;
  }
  return null;
}

export async function criarPrescricaoMedica(formData: FormData) {
  const { supabase, user, empresaId, unidadeId } = await requirePermission("prescricao.criar");
  const atendimentoId = text(formData, "atendimento_id");
  const itemAssistencialId = text(formData, "item_assistencial_id");
  if (!atendimentoId) redirect("/prontuario?erro=atendimento");
  if (!itemAssistencialId || !unidadeId) go(atendimentoId, "erro=catalogo");

  const [{ data: atendimento }, profissional, { data: item }] = await Promise.all([
    supabase.from("atendimentos").select("id,paciente_id").eq("id", atendimentoId).eq("empresa_id", empresaId)
      .eq("unidade_id", unidadeId).in("status", ["aberto", "em_espera", "em_atendimento"]).maybeSingle(),
    resolveProfissional(supabase, user.id, user.email ?? undefined, empresaId),
    supabase.from("itens_assistenciais")
      .select("id,categoria,codigo_interno,codigo_tuss,descricao,unidade_medida,apresentacao,concentracao,forma_farmaceutica,metadata")
      .eq("id", itemAssistencialId).eq("empresa_id", empresaId).eq("ativo", true)
      .in("categoria", ["medicamento", "material", "opme", "gas_medicinal", "procedimento", "outro"]).maybeSingle(),
  ]);
  if (!atendimento?.paciente_id) go(atendimentoId, "erro=atendimento");
  if (!profissional) go(atendimentoId, "erro=profissional");
  if (!item) go(atendimentoId, "erro=catalogo");

  const { data: produtoEstoque } = await supabase.from("estoque_produtos").select("id")
    .eq("empresa_id", empresaId).eq("item_assistencial_id", item.id).eq("ativo", true).limit(1).maybeSingle();
  const quantidade = numberValue(formData, "quantidade") ?? 1;
  const observacoes = text(formData, "instrucoes") ?? text(formData, "orientacoes");

  if (["material", "opme", "gas_medicinal"].includes(item.categoria)) {
    const { error } = await supabase.from("solicitacoes_materiais_assistenciais").insert({
      empresa_id: empresaId, unidade_id: unidadeId, atendimento_id: atendimentoId, paciente_id: atendimento.paciente_id,
      profissional_id: profissional.id, item_assistencial_id: item.id, produto_id: produtoEstoque?.id ?? null,
      categoria: item.categoria, descricao: item.descricao, quantidade, unidade_medida: item.unidade_medida,
      observacoes, created_by: user.id, updated_by: user.id,
    });
    if (error) { console.error("[prescricao] material", { code: error.code }); go(atendimentoId, "erro=salvar"); }
    const filaError = await criarFila(supabase, { empresaId, unidadeId, atendimentoId, pacienteId: atendimento.paciente_id,
      setor: "almoxarifado", origem: "solicitacao_material", motivo: `Separar ${quantidade} ${item.unidade_medida ?? "un"} · ${item.descricao}`,
      profissionalId: profissional.id, userId: user.id });
    if (filaError) console.error("[prescricao] fila almoxarifado", { code: filaError.code });
    revalidatePath("/almoxarifado"); revalidatePath(`/prontuario/${atendimentoId}`);
    go(atendimentoId, "sucesso=material");
  }

  if (item.categoria === "procedimento") {
    const destino = destinoExame(tipoExame(item.metadata));
    if (destino) {
      const { error } = await supabase.from("solicitacoes_exames").insert({
        empresa_id: empresaId, unidade_id: unidadeId, atendimento_id: atendimentoId, profissional_id: profissional.id,
        modalidade: destino.modalidade, exame: item.descricao, codigo_tuss: item.codigo_tuss,
        indicacao_clinica: observacoes, status: "solicitado", prioridade: "rotina", created_by: user.id, updated_by: user.id,
      });
      if (error) { console.error("[prescricao] exame", { code: error.code }); go(atendimentoId, "erro=salvar"); }
      const filaError = await criarFila(supabase, { empresaId, unidadeId, atendimentoId, pacienteId: atendimento.paciente_id,
        setor: destino.setor, origem: "solicitacao_exame", motivo: item.descricao, profissionalId: profissional.id, userId: user.id });
      if (filaError) console.error("[prescricao] fila exame", { code: filaError.code });
      revalidatePath(destino.setor === "laboratorio" ? "/setores/laboratorio" : "/setores/imagem");
      revalidatePath(`/prontuario/${atendimentoId}`); go(atendimentoId, `sucesso=${destino.setor}`);
    }

    const { error } = await supabase.from("procedimentos_assistenciais").insert({
      empresa_id: empresaId, unidade_id: unidadeId, atendimento_id: atendimentoId, paciente_id: atendimento.paciente_id,
      profissional_id: profissional.id, area: "solicitacao_medica", codigo_tuss: item.codigo_tuss,
      codigo_interno: item.codigo_interno, procedimento: item.descricao, quantidade,
      unidade_medida: item.unidade_medida, resultado: observacoes, status: "programado", created_by: user.id, updated_by: user.id,
    });
    if (error) { console.error("[prescricao] procedimento", { code: error.code }); go(atendimentoId, "erro=salvar"); }
    revalidatePath(`/prontuario/${atendimentoId}`); go(atendimentoId, "sucesso=procedimento");
  }

  if (item.categoria !== "medicamento") go(atendimentoId, "erro=categoria");

  const detalhes = [item.descricao, item.concentracao, item.apresentacao].filter(Boolean).join(" · ");
  const { error } = await supabase.from("prescricoes").insert({
    empresa_id: empresaId, unidade_id: unidadeId, atendimento_id: atendimentoId, profissional_id: profissional.id,
    tipo: "medicamento", item: detalhes, item_assistencial_id: item.id, produto_id: produtoEstoque?.id ?? null,
    quantidade: numberValue(formData, "quantidade"), unidade_dose: text(formData, "unidade_dose") ?? item.unidade_medida,
    dose: text(formData, "dose"), via: text(formData, "via"), frequencia: text(formData, "frequencia"),
    duracao: text(formData, "duracao"), inicio_em: text(formData, "inicio_em"), fim_em: text(formData, "fim_em"),
    horarios: listValue(formData, "horarios"), aprazamento: listValue(formData, "aprazamento"),
    se_necessario: formData.get("se_necessario") === "on", diluente: text(formData, "diluente"),
    velocidade_infusao: text(formData, "velocidade_infusao"), instrucoes: text(formData, "instrucoes"),
    orientacoes: text(formData, "orientacoes"), requer_validacao_farmaceutica: true,
    status: "rascunho", created_by: user.id, updated_by: user.id,
  });
  if (error) { console.error("[prescricao] medicamento", { code: error.code }); go(atendimentoId, "erro=salvar"); }
  revalidatePath(`/prontuario/${atendimentoId}`); revalidatePath(`/prontuario/${atendimentoId}/prescricao`);
  go(atendimentoId, "sucesso=rascunho");
}

export async function assinarPrescricaoMedica(formData: FormData) {
  const { supabase, user, empresaId, unidadeId } = await requirePermission("prescricao.assinar");
  const atendimentoId = text(formData, "atendimento_id"); const prescricaoId = text(formData, "prescricao_id");
  if (!atendimentoId) redirect("/prontuario?erro=atendimento");
  if (!prescricaoId || !unidadeId) go(atendimentoId, "erro=prescricao");
  const profissional = await resolveProfissional(supabase, user.id, user.email ?? undefined, empresaId);
  if (!profissional) go(atendimentoId, "erro=profissional");
  const { data: prescricao } = await supabase.from("prescricoes")
    .select("id,tipo,item,item_assistencial_id,atendimento_id,profissional_id,atendimento:atendimentos(paciente_id)")
    .eq("id", prescricaoId).eq("atendimento_id", atendimentoId).eq("empresa_id", empresaId).eq("unidade_id", unidadeId)
    .eq("profissional_id", profissional.id).eq("status", "rascunho").not("item_assistencial_id", "is", null).is("assinado_em", null).maybeSingle();
  if (!prescricao || prescricao.tipo !== "medicamento") go(atendimentoId, "erro=prescricao");
  const { data: itemAtivo } = await supabase.from("itens_assistenciais").select("id,categoria")
    .eq("id", prescricao.item_assistencial_id).eq("empresa_id", empresaId).eq("ativo", true).eq("categoria", "medicamento").maybeSingle();
  if (!itemAtivo) go(atendimentoId, "erro=catalogo");
  const { error } = await supabase.rpc("assinar_prescricao", { p_prescricao_id: prescricaoId });
  if (error) { console.error("[prescricao] assinar", { code: error.code, message: error.message }); go(atendimentoId, "erro=assinatura"); }

  let aviso: "aprazamento" | "farmacia" | null = null;
  const { error: scheduleError } = await supabase.rpc("gerar_aprazamentos_prescricao", { p_prescricao_id: prescricaoId, p_horizonte_dias: 2 });
  if (scheduleError) { aviso = "aprazamento"; console.error("[prescricao] aprazamento", { code: scheduleError.code }); }
  const encounter = Array.isArray(prescricao.atendimento) ? prescricao.atendimento[0] : prescricao.atendimento;
  if (encounter?.paciente_id) {
    const filaError = await criarFila(supabase, { empresaId, unidadeId, atendimentoId, pacienteId: encounter.paciente_id,
      setor: "farmacia", origem: "prescricao", motivo: `Dispensação da prescrição assinada: ${prescricao.item}`,
      profissionalId: profissional.id, userId: user.id });
    if (filaError) { aviso = "farmacia"; console.error("[prescricao] fila farmacia", { code: filaError.code }); }
  }
  revalidatePath(`/prontuario/${atendimentoId}`); revalidatePath(`/prontuario/${atendimentoId}/prescricao`);
  revalidatePath("/setores/farmacia"); revalidatePath("/assistencial/medicamentos");
  go(atendimentoId, `sucesso=assinada${aviso ? `&aviso=${aviso}` : ""}`);
}

export async function suspenderPrescricaoMedica(formData: FormData) {
  const { supabase, user, empresaId, unidadeId } = await requirePermission("prescricao.suspender");
  const atendimentoId = text(formData, "atendimento_id"); const prescricaoId = text(formData, "prescricao_id"); const motivo = text(formData, "motivo");
  if (!atendimentoId) redirect("/prontuario?erro=atendimento");
  if (!prescricaoId || !motivo || !unidadeId) go(atendimentoId, "erro=suspensao");
  const profissional = await resolveProfissional(supabase, user.id, user.email ?? undefined, empresaId);
  if (!profissional) go(atendimentoId, "erro=profissional");
  const { data: prescricao } = await supabase.from("prescricoes").select("id").eq("id", prescricaoId)
    .eq("atendimento_id", atendimentoId).eq("empresa_id", empresaId).eq("unidade_id", unidadeId)
    .eq("profissional_id", profissional.id).eq("status", "ativa").maybeSingle();
  if (!prescricao) go(atendimentoId, "erro=prescricao");
  const { error } = await supabase.rpc("suspender_prescricao", { p_prescricao_id: prescricaoId, p_motivo: motivo });
  if (error) { console.error("[prescricao] suspender", { code: error.code }); go(atendimentoId, "erro=suspensao"); }
  revalidatePath(`/prontuario/${atendimentoId}`); revalidatePath(`/prontuario/${atendimentoId}/prescricao`);
  revalidatePath("/setores/farmacia"); revalidatePath("/assistencial/medicamentos"); go(atendimentoId, "sucesso=suspensa");
}
