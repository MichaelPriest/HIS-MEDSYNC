import Link from "next/link";
import { ArrowLeft, CheckCircle2, CircleDollarSign, PackageCheck } from "lucide-react";
import { notFound } from "next/navigation";
import { ActionPanel } from "@/components/painel/action-panel";
import { SectionPage } from "@/components/painel/section-page";
import { requireAnyPermission } from "@/lib/permissions/server";
import { adicionarFornecedorCotacao, aprovarFornecedorCotacao, gerarPedidoDaCotacao, salvarPropostaItemCotacao } from "@/modules/compras/actions";

function one<T>(value: T | T[] | null) { return Array.isArray(value) ? value[0] ?? null : value; }
const disponibilidadeLabel: Record<string, string> = { pronta_entrega: "Pronta entrega", parcial: "Parcial", sob_encomenda: "Sob encomenda", indisponivel: "Indisponível" };

export default async function CotacaoCompraPage({ params, searchParams }: {
  params: Promise<{ cotacaoId: string }>;
  searchParams: Promise<{ erro?: string; sucesso?: string }>;
}) {
  const { cotacaoId } = await params;
  const sp = await searchParams;
  const { supabase, empresaId, unidadeId } = await requireAnyPermission([
    "compras.visualizar", "compras.cotar", "compras.aprovar", "compras.gerenciar",
  ]);

  const [{ data: cotacao }, { data: fornecedores }, cotarGrant, aprovarGrant] = await Promise.all([
    supabase.from("compras_cotacoes")
      .select("id,numero,status,validade,observacoes,solicitacao_id,solicitacao:compras_solicitacoes(numero,setor,prioridade),itens:compras_cotacao_itens(id,item_assistencial_id,categoria_item,codigo_interno,descricao,quantidade,unidade_medida,tabela_tiss_codigo,codigo_tuss,codigo_tabela_propria,codigo_brasindice,codigo_simpro,codigo_anvisa,fabricante,apresentacao,observacoes,propostas:compras_cotacao_item_propostas(id,fornecedor_id,quantidade_ofertada,valor_unitario,marca_ofertada,fabricante_ofertado,codigo_anvisa_ofertado,prazo_entrega_dias,disponibilidade,observacoes)),fornecedores:compras_cotacao_fornecedores(id,fornecedor_id,valor_total,prazo_entrega_dias,condicao_pagamento,frete,selecionado,observacoes,itens_cotados,itens_total,atualizado_em,fornecedor:fornecedores(nome_fantasia,razao_social))")
      .eq("id", cotacaoId).eq("empresa_id", empresaId).eq("unidade_id", unidadeId).maybeSingle(),
    supabase.from("fornecedores").select("id,nome_fantasia,razao_social,cnpj").eq("empresa_id", empresaId).eq("ativo", true).order("nome_fantasia"),
    supabase.rpc("tem_permissao", { p_empresa: empresaId, p_unidade: unidadeId, p_codigo: "compras.cotar" }),
    supabase.rpc("tem_permissao", { p_empresa: empresaId, p_unidade: unidadeId, p_codigo: "compras.aprovar" }),
  ]);
  if (!cotacao) notFound();

  const canQuote = cotarGrant.data === true && ["aberta", "em_analise"].includes(cotacao.status);
  const canApprove = aprovarGrant.data === true;
  const solicitacao = one(cotacao.solicitacao);
  const itens = Array.isArray(cotacao.itens) ? cotacao.itens : [];
  const fornecedoresCotacao = Array.isArray(cotacao.fornecedores) ? cotacao.fornecedores : [];
  const selecionado = fornecedoresCotacao.find((item) => item.selecionado);

  const melhorPreco = new Map<string, number>();
  for (const item of itens) {
    const propostas = Array.isArray(item.propostas) ? item.propostas : [];
    const precos = propostas.filter((p) => p.disponibilidade !== "indisponivel").map((p) => Number(p.valor_unitario)).filter((v) => Number.isFinite(v) && v >= 0);
    if (precos.length) melhorPreco.set(item.id, Math.min(...precos));
  }

  return <SectionPage eyebrow="Compras / Cotação" title={`${cotacao.numero} · Comparativo`} description={`Solicitação ${solicitacao?.numero || "—"} · ${solicitacao?.setor || "Sem setor"}. Compare preço, cobertura, marca, ANVISA e prazo por item.`} actions={<Link href="/compras" className="btn-secondary"><ArrowLeft className="size-4" />Compras</Link>}>
    {sp.sucesso ? <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">Operação concluída: {sp.sucesso.replaceAll("-", " ")}.</div> : null}
    {sp.erro ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">Não foi possível concluir: {sp.erro.replaceAll("-", " ")}.</div> : null}

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <Kpi label="Status" value={cotacao.status.replaceAll("_", " ")} />
      <Kpi label="Itens" value={String(itens.length)} />
      <Kpi label="Fornecedores" value={String(fornecedoresCotacao.length)} />
      <Kpi label="Completos" value={String(fornecedoresCotacao.filter((f) => f.itens_total > 0 && f.itens_cotados >= f.itens_total).length)} />
      <Kpi label="Vencedor" value={selecionado ? "Selecionado" : "Pendente"} />
    </section>

    {canQuote ? <div className="mt-5"><ActionPanel title="Adicionar fornecedor" description="Cadastre as condições gerais; os preços serão informados item a item abaixo."><form action={adicionarFornecedorCotacao} className="grid gap-3 lg:grid-cols-[1.4fr_120px_160px_180px_1fr_auto]"><input type="hidden" name="cotacao_id" value={cotacao.id} /><select name="fornecedor_id" required defaultValue="" className="ui-input"><option value="">Selecione o fornecedor</option>{fornecedores?.map((f) => <option key={f.id} value={f.id}>{f.nome_fantasia || f.razao_social}{f.cnpj ? ` · ${f.cnpj}` : ""}</option>)}</select><input name="frete" className="ui-input" placeholder="Frete" /><input name="prazo_entrega_dias" type="number" min="0" className="ui-input" placeholder="Prazo dias" /><input name="condicao_pagamento" className="ui-input" placeholder="Pagamento" /><input name="observacoes" className="ui-input" placeholder="Observações" /><button className="ui-button-primary">Adicionar</button></form></ActionPanel></div> : null}

    <section className="ui-card mt-5 overflow-hidden"><header className="border-b border-slate-100 px-5 py-4"><h2 className="font-black text-slate-900">Comparativo por fornecedor</h2><p className="mt-1 text-xs text-slate-500">A aprovação só é liberada quando o fornecedor possui proposta para todos os itens.</p></header><div className="grid gap-4 p-5 lg:grid-cols-2 xl:grid-cols-3">{fornecedoresCotacao.length ? fornecedoresCotacao.map((f) => { const fornecedor = one(f.fornecedor); const completo = f.itens_total > 0 && f.itens_cotados >= f.itens_total; const total = Number(f.valor_total || 0) + Number(f.frete || 0); return <article key={f.id} className={`rounded-2xl border p-4 ${f.selecionado ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white"}`}><div className="flex items-start justify-between gap-3"><div><h3 className="font-black text-slate-900">{fornecedor?.nome_fantasia || fornecedor?.razao_social || "Fornecedor"}</h3><p className="mt-1 text-xs text-slate-500">Cobertura {f.itens_cotados}/{f.itens_total} · frete R$ {Number(f.frete || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p></div>{f.selecionado ? <CheckCircle2 className="size-5 text-emerald-600" /> : null}</div><p className="mt-4 text-2xl font-black text-slate-950">R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p><p className={`mt-2 text-xs font-bold ${completo ? "text-emerald-700" : "text-amber-700"}`}>{completo ? "Proposta completa" : "Proposta incompleta"}</p>{canApprove && completo && !f.selecionado && cotacao.status !== "convertida_pedido" ? <form action={aprovarFornecedorCotacao} className="mt-4"><input type="hidden" name="cotacao_id" value={cotacao.id} /><input type="hidden" name="fornecedor_id" value={f.fornecedor_id} /><button className="btn-secondary w-full">Selecionar fornecedor</button></form> : null}</article>; }) : <p className="text-sm text-slate-500">Nenhum fornecedor adicionado.</p>}</div></section>

    <section className="mt-5 space-y-4">{itens.map((item, index) => { const propostas = Array.isArray(item.propostas) ? item.propostas : []; const best = melhorPreco.get(item.id); return <article key={item.id} className="ui-card overflow-hidden"><header className="border-b border-slate-100 bg-slate-50/70 px-5 py-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-brand-700">Item {index + 1} · {item.categoria_item.replaceAll("_", " ")}</p><h3 className="mt-1 font-black text-slate-900">{item.descricao}</h3><p className="mt-1 text-xs text-slate-500">{item.codigo_interno || "—"} · TISS {item.tabela_tiss_codigo || "—"} · {item.codigo_tuss ? `TUSS ${item.codigo_tuss}` : `próprio ${item.codigo_tabela_propria || "—"}`} · {Number(item.quantidade).toLocaleString("pt-BR")} {item.unidade_medida}</p><p className="mt-1 text-xs text-slate-400">{item.fabricante || "Fabricante não informado"}{item.apresentacao ? ` · ${item.apresentacao}` : ""} · ANVISA {item.codigo_anvisa || "—"} · Brasíndice {item.codigo_brasindice || "—"} · SIMPRO {item.codigo_simpro || "—"}</p></div>{best !== undefined ? <span className="rounded-xl bg-emerald-100 px-3 py-2 text-xs font-black text-emerald-800">Melhor R$ {best.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span> : null}</div></header><div className="grid gap-4 p-5 xl:grid-cols-2">{fornecedoresCotacao.map((fc) => { const fornecedor = one(fc.fornecedor); const prop = propostas.find((p) => p.fornecedor_id === fc.fornecedor_id); const valor = Number(prop?.valor_unitario || 0); const isBest = prop && prop.disponibilidade !== "indisponivel" && best !== undefined && valor === best; return <div key={fc.id} className={`rounded-2xl border p-4 ${isBest ? "border-emerald-300 bg-emerald-50/60" : "border-slate-200"}`}><div className="flex items-center justify-between gap-3"><strong>{fornecedor?.nome_fantasia || fornecedor?.razao_social || "Fornecedor"}</strong>{isBest ? <span className="text-xs font-bold text-emerald-700">Melhor preço</span> : null}</div>{canQuote ? <form action={salvarPropostaItemCotacao} className="mt-3 grid gap-2 sm:grid-cols-2"><input type="hidden" name="cotacao_id" value={cotacao.id} /><input type="hidden" name="cotacao_item_id" value={item.id} /><input type="hidden" name="fornecedor_id" value={fc.fornecedor_id} /><input name="valor_unitario" defaultValue={prop ? String(prop.valor_unitario) : ""} className="ui-input" placeholder="Valor unitário" required /><input name="quantidade_ofertada" defaultValue={prop?.quantidade_ofertada ? String(prop.quantidade_ofertada) : String(item.quantidade)} className="ui-input" placeholder="Qtd. ofertada" /><input name="marca" defaultValue={prop?.marca_ofertada || ""} className="ui-input" placeholder="Marca ofertada" /><input name="fabricante" defaultValue={prop?.fabricante_ofertado || ""} className="ui-input" placeholder="Fabricante" /><input name="codigo_anvisa" defaultValue={prop?.codigo_anvisa_ofertado || ""} className="ui-input" placeholder="Registro ANVISA" /><input name="prazo_entrega_dias" type="number" min="0" defaultValue={prop?.prazo_entrega_dias ?? fc.prazo_entrega_dias ?? ""} className="ui-input" placeholder="Prazo dias" /><select name="disponibilidade" defaultValue={prop?.disponibilidade || "pronta_entrega"} className="ui-input">{Object.entries(disponibilidadeLabel).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><input name="observacoes" defaultValue={prop?.observacoes || ""} className="ui-input" placeholder="Observação" /><button className="ui-button-primary sm:col-span-2">Salvar proposta do item</button></form> : <div className="mt-3 text-sm text-slate-600">{prop ? <><p className="font-bold">R$ {valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} / {item.unidade_medida}</p><p className="mt-1 text-xs">{disponibilidadeLabel[prop.disponibilidade] || prop.disponibilidade} · prazo {prop.prazo_entrega_dias ?? "—"} dias</p><p className="mt-1 text-xs">{prop.marca_ofertada || "Marca não informada"} · ANVISA {prop.codigo_anvisa_ofertado || "—"}</p></> : "Sem proposta para este item."}</div>}</div>; })}</div></article>; })}</section>

    {selecionado && canApprove && cotacao.status === "aprovada" ? <div className="mt-5"><ActionPanel title="Gerar pedido" description="Converte a cotação aprovada em pedido, preservando os itens do catálogo e os preços vencedores."><form action={gerarPedidoDaCotacao} className="flex flex-wrap items-center justify-between gap-3"><input type="hidden" name="cotacao_id" value={cotacao.id} /><div className="flex items-center gap-3"><PackageCheck className="size-6 text-emerald-600" /><div><p className="font-bold text-slate-900">Fornecedor selecionado</p><p className="text-sm text-slate-500">A geração é bloqueada se a proposta estiver incompleta.</p></div></div><button className="ui-button-primary"><CircleDollarSign className="size-4" />Gerar pedido de compra</button></form></ActionPanel></div> : null}
  </SectionPage>;
}

function Kpi({ label, value }: { label: string; value: string }) { return <div className="his-kpi"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-2 text-xl font-black capitalize text-slate-950">{value}</p></div>; }
