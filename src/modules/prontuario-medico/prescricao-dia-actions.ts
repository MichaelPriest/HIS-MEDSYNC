"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/permissions/server";
import { asRoute } from "@/lib/route-cast";

function text(fd: FormData, key: string) {
  const value = String(fd.get(key) ?? "").trim();
  return value || null;
}
function numberValue(fd: FormData, key: string) {
  const raw = text(fd, key);
  if (!raw) return null;
  const value = Number(raw.replace(",", "."));
  return Number.isFinite(value) ? value : null;
}
function listValue(fd: FormData, key: string) {
  const raw = text(fd, key);
  return raw ? raw.split(/[;,\n]/).map((item) => item.trim()).filter(Boolean) : [];
}
function go(atendimentoId: string, query: string): never {
  redirect(asRoute(`/prontuario/${atendimentoId}/prescricao?${query}`));
}
function horariosPadrao(frequencia: string | null) {
  const f = (frequencia ?? "").toLowerCase().replace(/\s+/g, "");
  const mapa: Record<string, string[]> = {
    "24/24h": ["08:00"], "1x/dia": ["08:00"], "1xaodia": ["08:00"],
    "12/12h": ["08:00", "20:00"], "2x/dia": ["08:00", "20:00"], "2xaodia": ["08:00", "20:00"],
    "8/8h": ["06:00", "14:00", "22:00"], "3x/dia": ["06:00", "14:00", "22:00"], "3xaodia": ["06:00", "14:00", "22:00"],
    "6/6h": ["00:00", "06:00", "12:00", "18:00"], "4x/dia": ["00:00", "06:00", "12:00", "18:00"], "4xaodia": ["00:00", "06:00", "12:00", "18:00"],
    "4/4h": ["02:00", "06:00", "10:00", "14:00", "18:00", "22:00"],
    "2/2h": ["00:00", "02:00", "04:00", "06:00", "08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00", "22:00"],
  };
  return mapa[f] ?? [];
}
function tipoExame(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>).tipo_exame;
  return typeof value === "string" ? value.toLowerCase() : null;
}
function destinoExame(tipo: string | null) {
  if (tipo === "laboratorio") return "laboratorio" as const;
  if (["raio_x", "tomografia", "ressonancia", "ultrassonografia", "mamografia", "densitometria"].includes(tipo ?? "")) return "imagem" as const;
  return null;
}

async function resolveProfissional(
  supabase: Awaited<ReturnType<typeof requirePermission>>["supabase"],
  userId: string,
  email: string | undefined,
  empresaId: string,
) {
  let { data } = await supabase.from("profissionais").select("id,nome_completo").eq("empresa_id", empresaId).eq("usuario_id", userId).eq("ativo", true).limit(1).maybeSingle();
  if (!data && email) data = (await supabase.from("profissionais").select("id,nome_completo").eq("empresa_id", empresaId).ilike("email", email).eq("ativo", true).limit(1).maybeSingle()).data;
  return data;
}

export async function adicionarItemPrescricaoDiaAction(formData: FormData) {
  const { supabase, user, empresaId, unidadeId } = await requirePermission("prescricao.criar");
  const atendimentoId = text(formData, "atendimento_id");
  const aba = text(formData, "aba") ?? "medicamentos";
  if (!atendimentoId) redirect("/prontuario?erro=atendimento");
  if (!unidadeId) go(atendimentoId, "erro=atendimento");

  const [{ data: atendimento }, profissional] = await Promise.all([
    supabase.from("atendimentos").select("id,paciente_id").eq("id", atendimentoId).eq("empresa_id", empresaId).eq("unidade_id", unidadeId).in("status", ["aberto", "em_espera", "em_atendimento"]).maybeSingle(),
    resolveProfissional(supabase, user.id, user.email ?? undefined, empresaId),
  ]);
  if (!atendimento?.paciente_id) go(atendimentoId, "erro=atendimento");
  if (!profissional) go(atendimentoId, "erro=profissional");

  if (aba === "dieta") {
    const jejum = formData.get("jejum") === "on";
    const dieta = text(formData, "dieta");
    if (!jejum && !dieta) go(atendimentoId, "erro=campos&aba=dieta");
    const item = jejum ? "Jejum" : `Dieta ${dieta}`;
    const instrucoes = text(formData, "instrucoes");
    const { error } = await supabase.from("prescricoes").insert({
      empresa_id: empresaId, unidade_id: unidadeId, atendimento_id: atendimentoId, profissional_id: profissional.id,
      tipo: "dieta", item, instrucoes, status: "rascunho", requer_validacao_farmaceutica: false,
      created_by: user.id, updated_by: user.id,
    });
    if (error) { console.error("[prescricao-dia] dieta", { code: error.code, message: error.message }); go(atendimentoId, "erro=salvar&aba=dieta"); }
    revalidatePath(`/prontuario/${atendimentoId}/prescricao`);
    go(atendimentoId, "sucesso=item_adicionado&aba=dieta");
  }

  if (aba === "cuidados") {
    const cuidado = text(formData, "cuidado");
    if (!cuidado) go(atendimentoId, "erro=campos&aba=cuidados");
    const frequencia = text(formData, "frequencia");
    const horariosInformados = listValue(formData, "horarios");
    const horarios = horariosInformados.length ? horariosInformados : horariosPadrao(frequencia);
    const { error } = await supabase.from("prescricoes").insert({
      empresa_id: empresaId, unidade_id: unidadeId, atendimento_id: atendimentoId, profissional_id: profissional.id,
      tipo: "cuidado", item: cuidado, frequencia, horarios, aprazamento: horarios,
      instrucoes: text(formData, "instrucoes"), status: "rascunho", requer_validacao_farmaceutica: false,
      created_by: user.id, updated_by: user.id,
    });
    if (error) { console.error("[prescricao-dia] cuidado", { code: error.code, message: error.message }); go(atendimentoId, "erro=salvar&aba=cuidados"); }
    revalidatePath(`/prontuario/${atendimentoId}/prescricao`);
    go(atendimentoId, "sucesso=item_adicionado&aba=cuidados");
  }

  const itemAssistencialId = text(formData, "item_assistencial_id");
  if (!itemAssistencialId) go(atendimentoId, `erro=catalogo&aba=${encodeURIComponent(aba)}`);
  const { data: item } = await supabase.from("itens_assistenciais")
    .select("id,categoria,codigo_interno,codigo_tuss,descricao,unidade_medida,apresentacao,concentracao,metadata")
    .eq("id", itemAssistencialId).eq("empresa_id", empresaId).eq("ativo", true)
    .in("categoria", ["medicamento", "material", "opme", "gas_medicinal", "procedimento", "outro"]).maybeSingle();
  if (!item) go(atendimentoId, `erro=catalogo&aba=${encodeURIComponent(aba)}`);

  const { data: produtoEstoque } = await supabase.from("estoque_produtos").select("id").eq("empresa_id", empresaId).eq("item_assistencial_id", item.id).eq("ativo", true).limit(1).maybeSingle();
  const quantidade = numberValue(formData, "quantidade") ?? 1;
  const observacoes = text(formData, "instrucoes") ?? text(formData, "orientacoes");

  if (["material", "opme", "gas_medicinal"].includes(item.categoria)) {
    const { error } = await supabase.from("solicitacoes_materiais_assistenciais").insert({
      empresa_id: empresaId, unidade_id: unidadeId, atendimento_id: atendimentoId, paciente_id: atendimento.paciente_id,
      profissional_id: profissional.id, item_assistencial_id: item.id, produto_id: produtoEstoque?.id ?? null,
      categoria: item.categoria, descricao: item.descricao, quantidade, unidade_medida: item.unidade_medida,
      observacoes, status: "rascunho", created_by: user.id, updated_by: user.id,
    });
    if (error) { console.error("[prescricao-dia] material", { code: error.code, message: error.message }); go(atendimentoId, "erro=salvar&aba=materiais"); }
    revalidatePath(`/prontuario/${atendimentoId}/prescricao`);
    go(atendimentoId, "sucesso=item_adicionado&aba=materiais");
  }

  if (item.categoria === "procedimento") {
    const destino = destinoExame(tipoExame(item.metadata));
    if (aba === "exames") {
      if (!destino) go(atendimentoId, "erro=categoria&aba=exames");
      const { error } = await supabase.from("solicitacoes_exames").insert({
        empresa_id: empresaId, unidade_id: unidadeId, atendimento_id: atendimentoId, profissional_id: profissional.id,
        modalidade: destino, exame: item.descricao, codigo_tuss: item.codigo_tuss, indicacao_clinica: observacoes,
        status: "rascunho", prioridade: text(formData, "prioridade") ?? "rotina", created_by: user.id, updated_by: user.id,
      });
      if (error) { console.error("[prescricao-dia] exame", { code: error.code, message: error.message }); go(atendimentoId, "erro=salvar&aba=exames"); }
      revalidatePath(`/prontuario/${atendimentoId}/prescricao`);
      go(atendimentoId, "sucesso=item_adicionado&aba=exames");
    }
    if (destino) go(atendimentoId, "erro=categoria&aba=procedimentos");
    const { error } = await supabase.from("procedimentos_assistenciais").insert({
      empresa_id: empresaId, unidade_id: unidadeId, atendimento_id: atendimentoId, paciente_id: atendimento.paciente_id,
      profissional_id: profissional.id, area: "solicitacao_medica", codigo_tuss: item.codigo_tuss, codigo_interno: item.codigo_interno,
      procedimento: item.descricao, quantidade, unidade_medida: item.unidade_medida ?? "UN", lateralidade: text(formData, "lateralidade"),
      resultado: observacoes, status: "rascunho", created_by: user.id, updated_by: user.id,
    });
    if (error) { console.error("[prescricao-dia] procedimento", { code: error.code, message: error.message }); go(atendimentoId, "erro=salvar&aba=procedimentos"); }
    revalidatePath(`/prontuario/${atendimentoId}/prescricao`);
    go(atendimentoId, "sucesso=item_adicionado&aba=procedimentos");
  }

  if (item.categoria !== "medicamento" || aba !== "medicamentos") go(atendimentoId, `erro=categoria&aba=${encodeURIComponent(aba)}`);

  const frequencia = text(formData, "frequencia");
  const horariosInformados = listValue(formData, "horarios");
  const horarios = horariosInformados.length ? horariosInformados : horariosPadrao(frequencia);
  const detalhes = [item.descricao, item.concentracao, item.apresentacao].filter(Boolean).join(" · ");
  const { data: prescricao, error } = await supabase.from("prescricoes").insert({
    empresa_id: empresaId, unidade_id: unidadeId, atendimento_id: atendimentoId, profissional_id: profissional.id,
    tipo: "medicamento", item: detalhes, item_assistencial_id: item.id, produto_id: produtoEstoque?.id ?? null,
    quantidade: numberValue(formData, "quantidade"), unidade_dose: text(formData, "unidade_dose") ?? item.unidade_medida,
    dose: text(formData, "dose"), via: text(formData, "via"), frequencia, duracao: text(formData, "duracao"),
    inicio_em: text(formData, "inicio_em"), fim_em: text(formData, "fim_em"), horarios, aprazamento: horarios,
    se_necessario: formData.get("se_necessario") === "on", diluente: text(formData, "diluente"),
    velocidade_infusao: text(formData, "velocidade_infusao"), instrucoes: text(formData, "instrucoes"),
    orientacoes: text(formData, "orientacoes"), requer_validacao_farmaceutica: true, status: "rascunho",
    created_by: user.id, updated_by: user.id,
  }).select("id").single();
  if (error || !prescricao) { console.error("[prescricao-dia] medicamento", { code: error?.code, message: error?.message }); go(atendimentoId, "erro=salvar&aba=medicamentos"); }

  const componentes = [1, 2].map((n) => ({
    item_assistencial_id: text(formData, `componente_${n}_id`), dose: text(formData, `componente_${n}_dose`),
    quantidade: numberValue(formData, `componente_${n}_quantidade`), unidade_dose: text(formData, `componente_${n}_unidade`),
    observacoes: text(formData, `componente_${n}_observacao`), ordem: n,
  })).filter((c): c is typeof c & { item_assistencial_id: string } => Boolean(c.item_assistencial_id));
  const unicos = [...new Map(componentes.map((c) => [c.item_assistencial_id, c])).values()];
  if (unicos.length) {
    const ids = unicos.map((c) => c.item_assistencial_id);
    const { data: validos } = await supabase.from("itens_assistenciais").select("id").eq("empresa_id", empresaId).eq("ativo", true).eq("categoria", "medicamento").in("id", ids);
    if (new Set((validos ?? []).map((v) => v.id)).size !== ids.length) go(atendimentoId, "erro=catalogo&aba=medicamentos");
    const { error: componentError } = await supabase.from("prescricao_componentes").insert(unicos.map((c) => ({
      empresa_id: empresaId, unidade_id: unidadeId, atendimento_id: atendimentoId, prescricao_id: prescricao.id,
      item_assistencial_id: c.item_assistencial_id, papel: "aditivo", dose: c.dose, quantidade: c.quantidade,
      unidade_dose: c.unidade_dose, ordem: c.ordem, observacoes: c.observacoes, created_by: user.id,
    })));
    if (componentError) { console.error("[prescricao-dia] componentes", { code: componentError.code, message: componentError.message }); go(atendimentoId, "erro=salvar&aba=medicamentos"); }
  }

  revalidatePath(`/prontuario/${atendimentoId}/prescricao`);
  go(atendimentoId, "sucesso=item_adicionado&aba=medicamentos");
}

export async function finalizarPrescricaoDiaAction(formData: FormData) {
  const { supabase } = await requirePermission("prescricao.assinar");
  const atendimentoId = text(formData, "atendimento_id");
  if (!atendimentoId) redirect("/prontuario?erro=atendimento");
  const { data, error } = await supabase.rpc("finalizar_prescricao_dia", { p_atendimento_id: atendimentoId });
  if (error) {
    console.error("[prescricao-dia] finalizar", { code: error.code, message: error.message });
    go(atendimentoId, `erro=${encodeURIComponent(error.message)}`);
  }
  revalidatePath(`/prontuario/${atendimentoId}`);
  revalidatePath(`/prontuario/${atendimentoId}/prescricao`);
  revalidatePath("/assistencial/medicamentos");
  revalidatePath("/assistencial/enfermagem");
  revalidatePath("/setores/laboratorio");
  revalidatePath("/setores/imagem");
  revalidatePath("/almoxarifado");
  const resumo = encodeURIComponent(JSON.stringify(data ?? {}));
  go(atendimentoId, `sucesso=finalizada&resumo=${resumo}&aba=revisao`);
}
