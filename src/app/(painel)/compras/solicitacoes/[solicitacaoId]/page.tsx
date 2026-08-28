import Link from "next/link";
import { ArrowLeft, PackagePlus, Search, Trash2 } from "lucide-react";
import { notFound } from "next/navigation";
import { ActionPanel } from "@/components/painel/action-panel";
import { SectionPage } from "@/components/painel/section-page";
import { requireAnyPermission } from "@/lib/permissions/server";
import { adicionarItemSolicitacaoCompra, gerarCotacaoDaSolicitacao, removerItemSolicitacaoCompra } from "@/modules/compras/actions";

const categoryLabel: Record<string, string> = { material: "Material", medicamento: "Medicamento", opme: "OPME", gas_medicinal: "Gás medicinal" };
function clean(value: string) { return value.replace(/[,%()]/g, " ").trim().slice(0, 80); }

export default async function SolicitacaoCompraPage({ params, searchParams }: {
  params: Promise<{ solicitacaoId: string }>;
  searchParams: Promise<{ q?: string; categoria?: string; erro?: string; sucesso?: string }>;
}) {
  const { solicitacaoId } = await params;
  const sp = await searchParams;
  const { supabase, empresaId, unidadeId } = await requireAnyPermission(["compras.visualizar", "compras.solicitar", "compras.cotar", "compras.aprovar", "compras.gerenciar", "compras.receber"]);
  const q = clean(String(sp.q ?? ""));
  const categoria = String(sp.categoria ?? "");
  const [{ data: solicitacao }, solicitarGrant, cotarGrant, gerenciarGrant] = await Promise.all([
    supabase.from("compras_solicitacoes").select("id,numero,setor,prioridade,status,justificativa,created_at,itens:compras_solicitacao_itens(id,item_assistencial_id,categoria_item,codigo_interno,tabela_tiss_codigo,codigo_tuss,codigo_tabela_propria,codigo_brasindice,codigo_simpro,codigo_anvisa,fabricante,apresentacao,descricao,quantidade,unidade_medida,observacoes)").eq("id", solicitacaoId).eq("empresa_id", empresaId).eq("unidade_id", unidadeId).maybeSingle(),
    supabase.rpc("tem_permissao", { p_empresa: empresaId, p_unidade: unidadeId, p_codigo: "compras.solicitar" }),
    supabase.rpc("tem_permissao", { p_empresa: empresaId, p_unidade: unidadeId, p_codigo: "compras.cotar" }),
    supabase.rpc("tem_permissao", { p_empresa: empresaId, p_unidade: unidadeId, p_codigo: "compras.gerenciar" }),
  ]);
  if (!solicitacao) notFound();
  const canManage = gerenciarGrant.data === true;
  const canEdit = (solicitarGrant.data === true || canManage) && ["rascunho", "solicitada", "aprovada"].includes(solicitacao.status);
  const canQuote = (cotarGrant.data === true || canManage) && ["solicitada", "aprovada", "em_cotacao", "cotacao"].includes(solicitacao.status);
  const itensSelecionados = Array.isArray(solicitacao.itens) ? solicitacao.itens : [];

  let catalogQuery = supabase.from("itens_assistenciais").select("id,codigo_interno,categoria,tabela_tiss_codigo,codigo_tuss,codigo_tabela_propria,descricao,unidade_medida,fabricante,apresentacao,codigo_anvisa,codigo_brasindice,codigo_simpro").eq("empresa_id", empresaId).eq("ativo", true).in("categoria", ["material", "medicamento", "opme", "gas_medicinal"]).order("descricao").limit(40);
  if (categoria && categoryLabel[categoria]) catalogQuery = catalogQuery.eq("categoria", categoria);
  if (q.length >= 2) catalogQuery = catalogQuery.or(`descricao.ilike.%${q}%,codigo_interno.ilike.%${q}%,codigo_tuss.ilike.%${q}%,codigo_tabela_propria.ilike.%${q}%,codigo_brasindice.ilike.%${q}%,codigo_simpro.ilike.%${q}%`);
  const { data: catalogo } = await catalogQuery;

  return <SectionPage eyebrow="Compras / Solicitação" title={`${solicitacao.numero} · ${solicitacao.setor || "Sem setor"}`} description="Monte a necessidade usando o catálogo mestre. Códigos e dados regulatórios seguem como snapshot auditável até o pedido." actions={<Link href="/compras" className="btn-secondary"><ArrowLeft className="size-4" />Compras</Link>}>
    {sp.sucesso ? <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">Operação concluída.</div> : null}
    {sp.erro ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">Não foi possível concluir: {sp.erro.replaceAll("-", " ")}.</div> : null}
    <section className="grid gap-3 md:grid-cols-4"><Info label="Status" value={solicitacao.status.replaceAll("_", " ")} /><Info label="Prioridade" value={solicitacao.prioridade} /><Info label="Itens" value={String(itensSelecionados.length)} /><Info label="Justificativa" value={solicitacao.justificativa || "—"} /></section>

    <section className="ui-card mt-5 overflow-hidden"><header className="border-b border-slate-100 px-5 py-4"><h2 className="font-black text-slate-900">Itens solicitados</h2><p className="mt-1 text-xs text-slate-500">Material, medicamento, OPME e gás medicinal usam o mesmo catálogo do Estoque e Faturamento.</p></header>{itensSelecionados.length ? <div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Item</th><th className="px-4 py-3">Referência</th><th className="px-4 py-3">Qtd.</th><th className="px-4 py-3">Regulatório</th><th className="px-4 py-3"></th></tr></thead><tbody className="divide-y divide-slate-100">{itensSelecionados.map((item) => <tr key={item.id}><td className="px-4 py-4"><b>{item.descricao}</b><p className="mt-1 text-xs text-slate-400">{categoryLabel[item.categoria_item || ""] || item.categoria_item || "Item"} · {item.codigo_interno || "—"}{item.fabricante ? ` · ${item.fabricante}` : ""}{item.apresentacao ? ` · ${item.apresentacao}` : ""}</p></td><td className="px-4 py-4 text-xs text-slate-600"><div>TISS {item.tabela_tiss_codigo || "—"} · {item.codigo_tuss ? `TUSS ${item.codigo_tuss}` : `Próprio ${item.codigo_tabela_propria || "—"}`}</div><div>Brasíndice {item.codigo_brasindice || "—"} · SIMPRO {item.codigo_simpro || "—"}</div></td><td className="px-4 py-4 font-bold">{Number(item.quantidade).toLocaleString("pt-BR")} {item.unidade_medida}</td><td className="px-4 py-4 text-xs text-slate-600">ANVISA {item.codigo_anvisa || "—"}</td><td className="px-4 py-4 text-right">{canEdit ? <form action={removerItemSolicitacaoCompra}><input type="hidden" name="solicitacao_id" value={solicitacao.id} /><input type="hidden" name="item_id" value={item.id} /><button className="btn-secondary text-xs"><Trash2 className="size-3" />Remover</button></form> : null}</td></tr>)}</tbody></table></div> : <p className="p-8 text-center text-sm text-slate-500">Nenhum item incluído.</p>}</section>

    {canEdit ? <section className="mt-5"><ActionPanel title="Adicionar do catálogo" description="Pesquise por descrição, código interno, TUSS, código próprio, Brasíndice ou SIMPRO."><form method="get" className="grid gap-3 md:grid-cols-[1fr_220px_auto]"><label className="relative"><Search className="absolute left-3 top-3 size-4 text-slate-400" /><input name="q" defaultValue={q} className="ui-input pl-9" placeholder="Buscar item" /></label><select name="categoria" defaultValue={categoria} className="ui-input"><option value="">Todas as categorias</option>{Object.entries(categoryLabel).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><button className="btn-secondary">Pesquisar</button></form><div className="mt-4 grid gap-3 lg:grid-cols-2">{catalogo?.map((item) => <form key={item.id} action={adicionarItemSolicitacaoCompra} className="rounded-2xl border border-slate-200 bg-white p-4"><input type="hidden" name="solicitacao_id" value={solicitacao.id} /><input type="hidden" name="item_assistencial_id" value={item.id} /><div className="flex items-start justify-between gap-3"><div><span className="text-xs font-bold uppercase text-brand-700">{categoryLabel[item.categoria] || item.categoria}</span><h3 className="mt-1 font-bold text-slate-900">{item.descricao}</h3><p className="mt-1 text-xs text-slate-500">{item.codigo_interno} · TISS {item.tabela_tiss_codigo} · {item.codigo_tuss ? `TUSS ${item.codigo_tuss}` : `próprio ${item.codigo_tabela_propria || "—"}`}</p><p className="mt-1 text-xs text-slate-400">{item.fabricante || "Fabricante não informado"}{item.apresentacao ? ` · ${item.apresentacao}` : ""} · ANVISA {item.codigo_anvisa || "—"}</p></div><PackagePlus className="size-5 text-slate-300" /></div><div className="mt-3 grid gap-2 sm:grid-cols-[120px_1fr_auto]"><input name="quantidade" required defaultValue="1" className="ui-input" placeholder="Quantidade" /><input name="observacoes" className="ui-input" placeholder="Observação / especificação" /><button className="ui-button-primary">Adicionar</button></div></form>)}</div></ActionPanel></section> : <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">A lista está bloqueada porque a solicitação já entrou no processo de cotação.</div>}

    {canQuote ? <section className="mt-5"><ActionPanel title="Gerar ou abrir cotação" description="A operação é idempotente: se já houver cotação aberta para esta solicitação, ela será reaberta em vez de duplicada."><form action={gerarCotacaoDaSolicitacao} className="grid gap-3 md:grid-cols-[180px_1fr_auto]"><input type="hidden" name="solicitacao_id" value={solicitacao.id} /><input type="date" name="validade" className="ui-input" /><input name="observacoes" className="ui-input" placeholder="Condições ou observações gerais" /><button disabled={!itensSelecionados.length} className="ui-button-primary disabled:cursor-not-allowed disabled:opacity-50">Gerar / abrir cotação</button></form></ActionPanel></section> : null}
  </SectionPage>;
}

function Info({ label, value }: { label: string; value: string }) { return <div className="his-card p-4"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-2 font-bold capitalize text-slate-900">{value}</p></div>; }
