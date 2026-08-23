"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getAssistencialContext } from "@/modules/assistencial/context";

function competenciaAtual() {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date()).slice(0, 7);
}
function one<T>(rel: T | T[] | null): T | null { return Array.isArray(rel) ? rel[0] ?? null : rel; }

export async function criarContaAtendimento(formData: FormData) {
  const { supabase, user, empresaId, unidadeId } = await getAssistencialContext();
  const atendimentoId = String(formData.get("atendimento_id") ?? "").trim();
  if (!atendimentoId) redirect("/faturamento?erro=atendimento");
  const { data: atendimento } = await supabase.from("atendimentos").select("id,paciente_id,cobertura,convenio_id,plano_id").eq("id", atendimentoId).eq("unidade_id", unidadeId).maybeSingle();
  if (!atendimento) redirect("/faturamento?erro=atendimento");
  const { data: existente } = await supabase.from("contas_faturamento").select("id").eq("atendimento_id", atendimentoId).maybeSingle();
  if (existente) redirect(`/faturamento/${existente.id}`);
  const { data: conta, error } = await supabase.from("contas_faturamento").insert({ empresa_id: empresaId, unidade_id: unidadeId, atendimento_id: atendimento.id, paciente_id: atendimento.paciente_id, convenio_id: atendimento.convenio_id, plano_id: atendimento.plano_id, competencia: competenciaAtual(), tipo_cobranca: atendimento.cobertura === "convenio" ? "convenio" : "particular", auditoria_liberada:false, created_by: user.id, updated_by: user.id }).select("id").single();
  if (error || !conta) redirect("/faturamento?erro=criar-conta");
  const {data:auditoriaId}=await supabase.rpc("encaminhar_conta_para_auditoria",{p_atendimento_id:atendimentoId});
  if(auditoriaId) await supabase.from("contas_faturamento").update({auditoria_id:auditoriaId}).eq("id",conta.id);
  redirect(`/faturamento/${conta.id}`);
}

export async function adicionarItemConta(contaId: string, formData: FormData) {
  const { supabase } = await getAssistencialContext();
  const descricao = String(formData.get("descricao") ?? "").trim();
  const codigo = String(formData.get("codigo") ?? "").trim() || null;
  const tabela = String(formData.get("tabela") ?? "").trim() || null;
  const quantidade = Number(String(formData.get("quantidade") ?? "1").replace(",", "."));
  const valorUnitario = Number(String(formData.get("valor_unitario") ?? "0").replace(/\./g, "").replace(",", "."));
  if (!descricao || !Number.isFinite(quantidade) || quantidade <= 0 || !Number.isFinite(valorUnitario) || valorUnitario < 0) redirect(`/faturamento/${contaId}?erro=item`);
  const valorTotal = Number((quantidade * valorUnitario).toFixed(2));
  const { error } = await supabase.from("conta_faturamento_itens").insert({ conta_id: contaId, origem_tipo: String(formData.get("origem_tipo") ?? "procedimento"), data_execucao: String(formData.get("data_execucao") ?? "").trim() || new Date().toISOString(), tabela, codigo, descricao, quantidade, valor_unitario: valorUnitario, valor_total: valorTotal, setor: String(formData.get("setor") ?? "").trim() || null });
  if (error) redirect(`/faturamento/${contaId}?erro=item`);
  await recalcularConta(contaId);
  revalidatePath(`/faturamento/${contaId}`);
}

async function recalcularConta(contaId: string) {
  const { supabase, user } = await getAssistencialContext();
  const { data: itens } = await supabase.from("conta_faturamento_itens").select("valor_total,cobravel").eq("conta_id", contaId);
  const bruto = (itens ?? []).filter((i) => i.cobravel).reduce((s, i) => s + Number(i.valor_total || 0), 0);
  await supabase.from("contas_faturamento").update({ valor_bruto: bruto, valor_liquido: bruto, updated_by: user.id, updated_at: new Date().toISOString() }).eq("id", contaId);
}

export async function validarContaTiss(contaId: string) {
  const { supabase, user } = await getAssistencialContext();
  const { data: conta } = await supabase.from("contas_faturamento").select("id,tipo_cobranca,auditoria_liberada,atendimento_id,convenio_id,paciente_id,atendimento:atendimentos(numero_carteirinha,profissional_id),convenio:convenios(registro_ans),paciente:pacientes(cns),itens:conta_faturamento_itens(id,codigo,tabela,descricao,valor_total)").eq("id", contaId).maybeSingle();
  if (!conta) redirect("/faturamento?erro=conta");
  await supabase.from("conta_faturamento_criticas").delete().eq("conta_id", contaId).eq("resolvida", false);
  const criticas: Array<{ conta_id: string; item_id?: string | null; codigo: string; severidade: "erro" | "alerta"; campo?: string; mensagem: string }> = [];
  const atendimento = one(conta.atendimento);
  const convenio = one(conta.convenio);
  const paciente = one(conta.paciente);
  if (!conta.auditoria_liberada) criticas.push({ conta_id: contaId, codigo: "AUD-001", severidade: "erro", campo: "auditoria_liberada", mensagem: "Conta ainda não liberada pela Auditoria pós-alta." });
  if (conta.tipo_cobranca === "convenio" && !convenio?.registro_ans) criticas.push({ conta_id: contaId, codigo: "TISS-CONV-001", severidade: "erro", campo: "registro_ans", mensagem: "Convênio sem Registro ANS válido." });
  if (conta.tipo_cobranca === "convenio" && !atendimento?.numero_carteirinha) criticas.push({ conta_id: contaId, codigo: "TISS-BEN-001", severidade: "erro", campo: "numero_carteirinha", mensagem: "Número da carteirinha não informado no atendimento." });
  if (!paciente?.cns) criticas.push({ conta_id: contaId, codigo: "TISS-BEN-002", severidade: "alerta", campo: "cns", mensagem: "CNS do beneficiário não informado; confirme exigência da guia aplicável." });
  const itens = Array.isArray(conta.itens) ? conta.itens : [];
  if (!itens.length) criticas.push({ conta_id: contaId, codigo: "FAT-ITEM-001", severidade: "erro", mensagem: "Conta sem itens faturáveis." });
  for (const item of itens) {
    if (!item.codigo) criticas.push({ conta_id: contaId, item_id: item.id, codigo: "TISS-ITEM-001", severidade: "erro", campo: "codigo", mensagem: `Item ${item.descricao} sem código de procedimento/material/medicamento.` });
    if (!item.tabela) criticas.push({ conta_id: contaId, item_id: item.id, codigo: "TISS-ITEM-002", severidade: "erro", campo: "tabela", mensagem: `Item ${item.descricao} sem código de tabela TISS/TUSS.` });
  }
  if (criticas.length) await supabase.from("conta_faturamento_criticas").insert(criticas);
  const impeditivas = criticas.filter((c) => c.severidade === "erro").length;
  await supabase.from("contas_faturamento").update({ status: impeditivas ? "com_criticas" : "pronta", updated_by: user.id, updated_at: new Date().toISOString() }).eq("id", contaId);
  revalidatePath(`/faturamento/${contaId}`);
  redirect(`/faturamento/${contaId}?validado=1`);
}

export async function gerarGuiaTiss(contaId: string) {
  const { supabase, user, empresaId, unidadeId } = await getAssistencialContext();
  const { data: conta } = await supabase.from("contas_faturamento").select("id,status,auditoria_liberada,tipo_cobranca,valor_liquido,atendimento_id,paciente_id,convenio_id,plano_id,atendimento:atendimentos(numero_atendimento,data_abertura,tipo_atendimento,numero_carteirinha,validade_carteirinha,senha_autorizacao,numero_autorizacao,profissional_id,paciente_cns),convenio:convenios(registro_ans),itens:conta_faturamento_itens(id,data_execucao,tabela,codigo,descricao,quantidade,valor_unitario,valor_total)").eq("id", contaId).maybeSingle();
  if (!conta || !conta.auditoria_liberada || conta.status !== "pronta" || conta.tipo_cobranca !== "convenio" || !conta.convenio_id) redirect(`/faturamento/${contaId}?erro=auditoria-ou-guia-nao-pronta`);
  const { count: erros } = await supabase.from("conta_faturamento_criticas").select("id", { count: "exact", head: true }).eq("conta_id", contaId).eq("resolvida", false).eq("severidade", "erro");
  if ((erros ?? 0) > 0) redirect(`/faturamento/${contaId}?erro=criticas`);
  const { data: existente } = await supabase.from("tiss_guias").select("id").eq("conta_id", contaId).neq("status", "cancelada").limit(1).maybeSingle();
  if (existente) redirect(`/faturamento/guias/${existente.id}`);
  const { data: versao } = await supabase.from("tiss_versoes").select("id").eq("ativo", true).order("vigente_desde", { ascending: false }).limit(1).maybeSingle();
  if (!versao) redirect(`/faturamento/${contaId}?erro=versao-tiss`);
  const atendimento = one(conta.atendimento);
  const convenio = one(conta.convenio);
  const { count: internacoes } = await supabase.from("internacoes").select("id", { count: "exact", head: true }).eq("atendimento_id", conta.atendimento_id);
  const tipoTexto = String(atendimento?.tipo_atendimento ?? "").toLowerCase();
  const tipoGuia = (internacoes ?? 0) > 0 ? "resumo_internacao" : tipoTexto.includes("consulta") ? "consulta" : "sp_sadt";
  const numeroGuia = `G${Date.now()}${Math.floor(Math.random() * 900 + 100)}`;
  const dataAbertura = atendimento?.data_abertura ? new Date(atendimento.data_abertura) : new Date();
  const { data: guia, error } = await supabase.from("tiss_guias").insert({ empresa_id: empresaId, unidade_id: unidadeId, conta_id: contaId, atendimento_id: conta.atendimento_id, paciente_id: conta.paciente_id, convenio_id: conta.convenio_id, plano_id: conta.plano_id, profissional_id: atendimento?.profissional_id ?? null, versao_id: versao.id, tipo_guia: tipoGuia, numero_guia_prestador: numeroGuia, numero_guia_operadora: atendimento?.numero_autorizacao ?? null, registro_ans: convenio?.registro_ans ?? null, numero_carteirinha: atendimento?.numero_carteirinha ?? null, validade_carteirinha: atendimento?.validade_carteirinha ?? null, senha_autorizacao: atendimento?.senha_autorizacao ?? null, tipo_atendimento: atendimento?.tipo_atendimento ?? null, data_atendimento: dataAbertura.toISOString().slice(0,10), hora_inicio: dataAbertura.toISOString().slice(11,19), status: "rascunho", valor_total: Number(conta.valor_liquido ?? 0), created_by: user.id, updated_by: user.id }).select("id").single();
  if (error || !guia) redirect(`/faturamento/${contaId}?erro=gerar-guia`);
  const itens = Array.isArray(conta.itens) ? conta.itens : [];
  if (itens.length) {
    const linhas = itens.map((item, index) => ({ guia_id: guia.id, sequencial: index + 1, data_execucao: item.data_execucao ? String(item.data_execucao).slice(0,10) : null, tabela: item.tabela, codigo_procedimento: item.codigo, descricao: item.descricao, quantidade: item.quantidade, valor_unitario: item.valor_unitario, valor_total: item.valor_total }));
    const { error: itensError } = await supabase.from("tiss_guia_itens").insert(linhas);
    if (itensError) redirect(`/faturamento/guias/${guia.id}?erro=itens`);
  }
  revalidatePath("/faturamento");
  redirect(`/faturamento/guias/${guia.id}`);
}
