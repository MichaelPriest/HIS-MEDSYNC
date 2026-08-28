"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getAssistencialContext } from "@/modules/assistencial/context";

type PrecoComercial = {
  valor: number;
  metodologia: string;
  fonte_id: string | null;
  edicao_id: string | null;
  item_id: string | null;
  memoria: Record<string, unknown>;
};

type GuiaTransacionalResult = {
  guia_id?: string;
  existente?: boolean;
  validacao?: { status?: string; erros?: number; alertas?: number };
};

function competenciaAtual() {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date()).slice(0, 7);
}
function one<T>(rel: T | T[] | null): T | null { return Array.isArray(rel) ? rel[0] ?? null : rel; }
function parseMoney(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const number = Number(raw.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(number) ? number : null;
}
function origemPorCategoria(categoria: string) {
  if (["medicamento","material","opme","gas_medicinal","pacote","taxa","diaria","procedimento"].includes(categoria)) return categoria;
  return "outro";
}
function categoriaContrato(categoria: string) {
  if (categoria === "medicamento") return "medicamentos";
  if (categoria === "material") return "materiais";
  if (categoria === "opme") return "opme";
  if (categoria === "gas_medicinal") return "gases";
  if (categoria === "pacote") return "pacotes";
  if (categoria === "taxa") return "taxas";
  if (categoria === "diaria") return "diarias";
  return "procedimentos";
}

export async function criarContaAtendimento(formData: FormData) {
  const { supabase, user, empresaId, unidadeId } = await getAssistencialContext();
  const atendimentoId = String(formData.get("atendimento_id") ?? "").trim();
  if (!atendimentoId) redirect("/faturamento?erro=atendimento");
  const { data: atendimento } = await supabase.from("atendimentos").select("id,paciente_id,cobertura,convenio_id,plano_id").eq("id", atendimentoId).eq("unidade_id", unidadeId).maybeSingle();
  if (!atendimento) redirect("/faturamento?erro=atendimento");
  const { data: existente } = await supabase.from("contas_faturamento").select("id").eq("atendimento_id", atendimentoId).maybeSingle();
  if (existente) redirect(`/faturamento/${existente.id}`);
  const { data: conta, error } = await supabase.from("contas_faturamento").insert({ empresa_id: empresaId, unidade_id: unidadeId, atendimento_id: atendimento.id, paciente_id: atendimento.paciente_id, convenio_id: atendimento.convenio_id, plano_id: atendimento.plano_id, competencia: competenciaAtual(), tipo_cobranca: atendimento.cobertura === "convenio" ? "convenio" : "particular", auditoria_liberada:false, contas_medicas_liberada:false, created_by: user.id, updated_by: user.id }).select("id").single();
  if (error || !conta) redirect("/faturamento?erro=criar-conta");
  const {data:auditoriaId}=await supabase.rpc("encaminhar_conta_para_auditoria",{p_atendimento_id:atendimentoId});
  if(auditoriaId) await supabase.from("contas_faturamento").update({auditoria_id:auditoriaId}).eq("id",conta.id);
  redirect(`/faturamento/${conta.id}`);
}

export async function adicionarItemConta(contaId: string, formData: FormData) {
  const { supabase, empresaId } = await getAssistencialContext();
  const itemAssistencialId = String(formData.get("item_assistencial_id") ?? "").trim() || null;
  const quantidade = Number(String(formData.get("quantidade") ?? "1").replace(",", "."));
  const dataExecucao = String(formData.get("data_execucao") ?? "").trim() || new Date().toISOString();
  if (!Number.isFinite(quantidade) || quantidade <= 0) redirect(`/faturamento/${contaId}?erro=item`);

  const { data: conta } = await supabase.from("contas_faturamento").select("id,empresa_id,convenio_id,tipo_cobranca").eq("id",contaId).maybeSingle();
  if (!conta || conta.empresa_id !== empresaId) redirect("/faturamento?erro=conta");

  let origemTipo = String(formData.get("origem_tipo") ?? "procedimento");
  let tabela = String(formData.get("tabela") ?? "").trim() || null;
  let codigo = String(formData.get("codigo") ?? "").trim() || null;
  let descricao = String(formData.get("descricao") ?? "").trim();
  let categoriaItem: string | null = null;
  let familiaTuss: number | null = null;
  let valorUnitario = parseMoney(formData.get("valor_unitario"));
  let preco: PrecoComercial | null = null;

  if (itemAssistencialId) {
    const { data: master } = await supabase.from("itens_assistenciais")
      .select("id,categoria,tabela_tiss_codigo,familia_tuss,codigo_tuss,codigo_tabela_propria,descricao")
      .eq("id", itemAssistencialId).eq("empresa_id", empresaId).eq("ativo", true).maybeSingle();
    if (!master) redirect(`/faturamento/${contaId}?erro=item-catalogo`);
    origemTipo = origemPorCategoria(master.categoria);
    tabela = master.tabela_tiss_codigo;
    codigo = ["00","98"].includes(master.tabela_tiss_codigo) ? master.codigo_tabela_propria : master.codigo_tuss;
    descricao = master.descricao;
    categoriaItem = master.categoria;
    familiaTuss = master.familia_tuss;
    if (!codigo) redirect(`/faturamento/${contaId}?erro=codigo-tiss`);

    if ((valorUnitario === null || valorUnitario === 0) && conta.convenio_id) {
      const { data: precos, error: precoError } = await supabase.rpc("obter_valor_item_comercial", {
        p_convenio_id: conta.convenio_id,
        p_item_assistencial_id: master.id,
        p_codigo: codigo,
        p_data: dataExecucao.slice(0,10),
        p_categoria: categoriaContrato(master.categoria),
      });
      const precoLista = Array.isArray(precos) ? (precos as unknown as PrecoComercial[]) : [];
      if (!precoError) preco = precoLista[0] ?? null;
      if (preco?.valor !== undefined && preco.valor !== null) valorUnitario = Number(preco.valor);
    }
  }

  if (!descricao || valorUnitario === null || valorUnitario < 0) redirect(`/faturamento/${contaId}?erro=item`);
  const valorTotal = Number((quantidade * valorUnitario).toFixed(2));
  const { data: inserted, error } = await supabase.from("conta_faturamento_itens").insert({
    conta_id: contaId,
    origem_tipo: origemTipo,
    item_assistencial_id: itemAssistencialId,
    categoria_item: categoriaItem,
    familia_tuss: familiaTuss,
    data_execucao: dataExecucao,
    tabela,
    codigo,
    descricao,
    quantidade,
    valor_unitario: valorUnitario,
    valor_total: valorTotal,
    setor: String(formData.get("setor") ?? "").trim() || null,
    valor_referencia: preco ? Number(preco.valor) : null,
    valor_contratual_calculado: preco ? Number(preco.valor) : null,
    origem_valor: preco ? "tabela_comercial_contrato" : itemAssistencialId ? "catalogo_mestre_manual" : "lancamento_manual",
    metodologia_preco: preco?.metodologia ?? null,
    tabela_comercial_edicao_id: preco?.edicao_id ?? null,
    tabela_comercial_item_id: preco?.item_id ?? null,
    memoria_calculo_comercial: preco?.memoria ?? null,
  }).select("id").single();
  if (error || !inserted) {
    console.error("[faturamento] adicionar item", { code: error?.code });
    redirect(`/faturamento/${contaId}?erro=item`);
  }
  await recalcularConta(contaId);
  revalidatePath(`/faturamento/${contaId}`);
  revalidatePath(`/faturamento/${contaId}/catalogo`);
  redirect(`/faturamento/${contaId}?item_adicionado=1`);
}

async function recalcularConta(contaId: string) {
  const { supabase, user } = await getAssistencialContext();
  const { data: itens } = await supabase.from("conta_faturamento_itens").select("valor_total,cobravel").eq("conta_id", contaId);
  const bruto = (itens ?? []).filter((i) => i.cobravel).reduce((s, i) => s + Number(i.valor_total || 0), 0);
  await supabase.from("contas_faturamento").update({ valor_bruto: bruto, valor_liquido: bruto, updated_by: user.id, updated_at: new Date().toISOString() }).eq("id", contaId);
}

export async function validarContaTiss(contaId: string) {
  const { supabase, user } = await getAssistencialContext();
  const { data: conta } = await supabase.from("contas_faturamento").select("id,tipo_cobranca,auditoria_liberada,contas_medicas_liberada,atendimento_id,convenio_id,paciente_id,atendimento:atendimentos(numero_carteirinha,profissional_id,tipo_atendimento_tuss50_codigo,tipo_consulta_tuss52_codigo),convenio:convenios(registro_ans),paciente:pacientes(cns),itens:conta_faturamento_itens(id,origem_tipo,categoria_item,codigo,tabela,descricao,valor_total)").eq("id", contaId).maybeSingle();
  if (!conta) redirect("/faturamento?erro=conta");
  await supabase.from("conta_faturamento_criticas").delete().eq("conta_id", contaId).eq("resolvida", false);
  const criticas: Array<{ conta_id: string; item_id?: string | null; codigo: string; severidade: "erro" | "alerta"; campo?: string; mensagem: string }> = [];
  const atendimento = one(conta.atendimento);
  const convenio = one(conta.convenio);
  const paciente = one(conta.paciente);
  if (!conta.auditoria_liberada) criticas.push({ conta_id: contaId, codigo: "AUD-001", severidade: "erro", campo: "auditoria_liberada", mensagem: "Conta ainda não liberada pela Auditoria pós-alta." });
  if (!conta.contas_medicas_liberada) criticas.push({ conta_id: contaId, codigo: "CM-001", severidade: "erro", campo: "contas_medicas_liberada", mensagem: "Conta ainda não liberada por Contas Médicas." });
  if (conta.tipo_cobranca === "convenio" && !convenio?.registro_ans) criticas.push({ conta_id: contaId, codigo: "TISS-CONV-001", severidade: "erro", campo: "registro_ans", mensagem: "Convênio sem Registro ANS válido." });
  if (conta.tipo_cobranca === "convenio" && !atendimento?.numero_carteirinha) criticas.push({ conta_id: contaId, codigo: "TISS-BEN-001", severidade: "erro", campo: "numero_carteirinha", mensagem: "Número da carteirinha não informado no atendimento." });
  if (conta.tipo_cobranca === "convenio" && !atendimento?.tipo_atendimento_tuss50_codigo) criticas.push({ conta_id: contaId, codigo: "TISS-DOM-050", severidade: "erro", campo: "tipo_atendimento_tuss50_codigo", mensagem: "Tipo de atendimento ANS (Tabela 50) não foi fotografado na admissão." });
  if (conta.tipo_cobranca === "convenio" && atendimento?.tipo_atendimento_tuss50_codigo === "04" && !atendimento?.tipo_consulta_tuss52_codigo) criticas.push({ conta_id: contaId, codigo: "TISS-DOM-052", severidade: "erro", campo: "tipo_consulta_tuss52_codigo", mensagem: "Tipo de consulta ANS (Tabela 52) é obrigatório quando a Tabela 50 estiver classificada como Consulta (04)." });
  if (!paciente?.cns) criticas.push({ conta_id: contaId, codigo: "TISS-BEN-002", severidade: "alerta", campo: "cns", mensagem: "CNS do beneficiário não informado; confirme exigência da guia aplicável." });
  const itens = Array.isArray(conta.itens) ? conta.itens : [];
  if (!itens.length) criticas.push({ conta_id: contaId, codigo: "FAT-ITEM-001", severidade: "erro", mensagem: "Conta sem itens faturáveis." });
  for (const item of itens) {
    if (!item.codigo) criticas.push({ conta_id: contaId, item_id: item.id, codigo: "TISS-ITEM-001", severidade: "erro", campo: "codigo", mensagem: `Item ${item.descricao} sem código de procedimento/material/medicamento.` });
    if (!item.tabela) criticas.push({ conta_id: contaId, item_id: item.id, codigo: "TISS-ITEM-002", severidade: "erro", campo: "tabela", mensagem: `Item ${item.descricao} sem código de tabela TISS/TUSS.` });
    if (item.tabela === "00" && item.codigo && String(item.codigo).length > 10) criticas.push({ conta_id: contaId, item_id: item.id, codigo: "TISS-ITEM-003", severidade: "erro", campo: "codigo", mensagem: `Código próprio do item ${item.descricao} excede 10 caracteres.` });
    if (item.origem_tipo === "pacote" && item.tabela !== "98") criticas.push({ conta_id: contaId, item_id: item.id, codigo: "TISS-PAC-001", severidade: "erro", campo: "tabela", mensagem: `Pacote ${item.descricao} deve utilizar tabela 98.` });
    if (item.tabela === "98" && item.origem_tipo !== "pacote") criticas.push({ conta_id: contaId, item_id: item.id, codigo: "TISS-PAC-002", severidade: "erro", campo: "tabela", mensagem: `Tabela 98 é reservada aos pacotes.` });
  }
  if (criticas.length) await supabase.from("conta_faturamento_criticas").insert(criticas);
  const impeditivas = criticas.filter((c) => c.severidade === "erro").length;
  await supabase.from("contas_faturamento").update({ status: impeditivas ? "com_criticas" : "pronta", updated_by: user.id, updated_at: new Date().toISOString() }).eq("id", contaId);
  revalidatePath(`/faturamento/${contaId}`);
  redirect(`/faturamento/${contaId}?validado=1`);
}

export async function gerarGuiaTiss(contaId: string) {
  const { supabase } = await getAssistencialContext();
  const { data, error } = await supabase.rpc("criar_guia_tiss_conta_transacional", { p_conta_id: contaId });

  if (error) {
    console.error("[faturamento] gerar guia TISS transacional", { code: error.code, operation: "criar_guia_tiss_conta_transacional" });
    const message = String(error.message ?? "");
    const motivo = message.includes("TISS_GUIA_SEM_PERMISSAO") ? "acesso-negado"
      : message.includes("TISS_CONTA_COM_CRITICAS") ? "criticas"
      : message.includes("TISS_CONTA_NAO_LIBERADA") ? "auditoria-contas-medicas-ou-guia-nao-pronta"
      : message.includes("TISS_VERSAO_INDISPONIVEL") ? "versao-tiss"
      : message.includes("TISS_DOMINIO_ANS_INCOMPLETO") ? "dominio-ans"
      : "gerar-guia";
    redirect(`/faturamento/${contaId}?erro=${motivo}`);
  }

  const result = (data ?? {}) as GuiaTransacionalResult;
  if (!result.guia_id) redirect(`/faturamento/${contaId}?erro=gerar-guia`);
  revalidatePath("/faturamento");
  revalidatePath(`/faturamento/${contaId}`);
  redirect(`/faturamento/guias/${result.guia_id}`);
}
