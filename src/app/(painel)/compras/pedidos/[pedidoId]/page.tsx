import Link from "next/link";
import { ArrowLeft, CheckCircle2, PackageCheck, ReceiptText, TriangleAlert } from "lucide-react";
import { SectionPage } from "@/components/painel/section-page";
import { asRoute } from "@/lib/route-cast";
import { requireAnyPermission } from "@/lib/permissions/server";
import { receberPedidoCompra } from "@/modules/compras/recebimento-actions";

function one<T>(value: T | T[] | null) { return Array.isArray(value) ? value[0] ?? null : value; }
function brl(value: unknown) { return Number(value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
function decimal(value: unknown) { const n = Number(value ?? 0); return Number.isFinite(n) ? n : 0; }
function date(value: string | null | undefined) { return value ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—"; }

const receiptError: Record<string, string> = {
  itens: "Informe quantidade para pelo menos um item pendente.",
  local: "Selecione o local de estoque dos itens que serão recebidos.",
  COMPRAS_QUANTIDADE_SUPERA_SALDO_PEDIDO: "A quantidade recebida supera o saldo pendente do pedido.",
  COMPRAS_PEDIDO_NAO_RECEBIVEL: "Este pedido não está mais disponível para recebimento.",
  COMPRAS_SEM_PERMISSAO_RECEBER: "Seu perfil não possui permissão para receber compras.",
};

export default async function PedidoCompraPage({ params, searchParams }: { params: Promise<{ pedidoId: string }>; searchParams: Promise<{ erro?: string; recebimento?: string }> }) {
  const { pedidoId } = await params;
  const sp = await searchParams;
  const { supabase, empresaId, unidadeId } = await requireAnyPermission(["compras.visualizar", "compras.solicitar", "compras.cotar", "compras.aprovar", "compras.receber", "compras.gerenciar"]);

  const [receberGrant, gerenciarGrant, { data: pedido }, { data: locais }, { data: recebimentos }] = await Promise.all([
    supabase.rpc("tem_permissao", { p_empresa: empresaId, p_unidade: unidadeId, p_codigo: "compras.receber" }),
    supabase.rpc("tem_permissao", { p_empresa: empresaId, p_unidade: unidadeId, p_codigo: "compras.gerenciar" }),
    supabase.from("compras_pedidos").select("id,empresa_id,unidade_id,numero,cotacao_id,solicitacao_id,fornecedor_id,data_pedido,previsao_entrega,valor_total,status,fornecedor:fornecedores(nome_fantasia,razao_social),itens:compras_pedido_itens(id,produto_id,item_assistencial_id,cotacao_item_id,descricao,quantidade,quantidade_recebida,valor_unitario,valor_total,unidade_medida)").eq("id", pedidoId).eq("empresa_id", empresaId).eq("unidade_id", unidadeId).maybeSingle(),
    supabase.from("estoque_locais").select("id,nome,tipo,eh_farmacia").eq("empresa_id", empresaId).eq("unidade_id", unidadeId).eq("ativo", true).order("nome"),
    supabase.from("compras_recebimentos").select("id,numero_documento,serie_documento,data_emissao,data_recebimento,valor_documento,vencimento,status,recebimento_parcial,quantidade_itens_recebidos,quantidade_itens_pendentes,observacoes,itens:compras_recebimento_itens(id,pedido_item_id,produto_id,quantidade,valor_unitario,lote,validade,divergencia_tipo,divergencia_observacao,local:estoque_locais(nome),produto:estoque_produtos(codigo,descricao))").eq("pedido_id", pedidoId).order("data_recebimento", { ascending: false }),
  ]);

  if (!pedido) return <SectionPage eyebrow="Gestão / Suprimentos" title="Pedido não encontrado" description="O pedido não existe ou não pertence à unidade ativa."><Link href="/compras" className="btn-secondary"><ArrowLeft className="size-4" />Voltar para Compras</Link></SectionPage>;

  const fornecedor = one(pedido.fornecedor);
  const itens = Array.isArray(pedido.itens) ? pedido.itens : [];
  const pendentes = itens.filter((item) => decimal(item.quantidade_recebida) < decimal(item.quantidade));
  const quantidadePedida = itens.reduce((total, item) => total + decimal(item.quantidade), 0);
  const quantidadeRecebida = itens.reduce((total, item) => total + decimal(item.quantidade_recebida), 0);
  const quantidadePendente = Math.max(quantidadePedida - quantidadeRecebida, 0);
  const canReceive = (receberGrant.data === true || gerenciarGrant.data === true) && !["recebido", "cancelado"].includes(pedido.status);
  const localPadrao = locais?.[0]?.id ?? "";
  const erro = sp.erro ? receiptError[sp.erro] ?? `Não foi possível registrar o recebimento (${sp.erro}).` : null;

  return <SectionPage eyebrow="Gestão / Suprimentos / Compras" title={`Pedido ${pedido.numero}`} description="Recebimento transacional: cada item atualiza pedido, lote, movimento de estoque e financeiro na mesma operação." actions={<Link href="/compras" className="btn-secondary"><ArrowLeft className="size-4" />Compras</Link>}>
    {sp.recebimento ? <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700"><CheckCircle2 className="size-4" />Recebimento registrado e estoque atualizado.</div> : null}
    {erro ? <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700"><TriangleAlert className="size-4" />{erro}</div> : null}

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <Kpi label="Valor do pedido" value={brl(pedido.valor_total)} />
      <Kpi label="Qtd. pedida" value={quantidadePedida.toLocaleString("pt-BR")} />
      <Kpi label="Qtd. recebida" value={quantidadeRecebida.toLocaleString("pt-BR")} />
      <Kpi label="Qtd. pendente" value={quantidadePendente.toLocaleString("pt-BR")} />
      <Kpi label="Recebimentos" value={String(recebimentos?.length ?? 0)} />
    </section>

    <section className="ui-card mt-5 p-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Info label="Fornecedor" value={fornecedor?.nome_fantasia || fornecedor?.razao_social || "Fornecedor"} />
        <Info label="Status" value={pedido.status.replaceAll("_", " ")} />
        <Info label="Data do pedido" value={date(pedido.data_pedido)} />
        <Info label="Previsão de entrega" value={date(pedido.previsao_entrega)} />
      </div>
      <div className="mt-4 flex flex-wrap gap-3 text-xs font-bold">
        {pedido.cotacao_id ? <Link href={asRoute(`/compras/cotacoes/${pedido.cotacao_id}`)} className="text-brand-700 hover:underline">Cotação de origem</Link> : null}
        {pedido.solicitacao_id ? <Link href={asRoute(`/compras/solicitacoes/${pedido.solicitacao_id}`)} className="text-brand-700 hover:underline">Solicitação de origem</Link> : null}
      </div>
    </section>

    <section className="ui-card mt-5 overflow-hidden">
      <header className="border-b border-slate-100 px-5 py-4"><h2 className="font-black text-slate-900">Itens do pedido</h2><p className="mt-1 text-xs text-slate-500">O saldo pendente é calculado pela quantidade efetivamente recebida.</p></header>
      <div className="overflow-x-auto"><table className="w-full min-w-[880px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Item</th><th className="px-4 py-3">Pedido</th><th className="px-4 py-3">Recebido</th><th className="px-4 py-3">Pendente</th><th className="px-4 py-3">Unitário</th><th className="px-4 py-3">Situação</th></tr></thead><tbody className="divide-y divide-slate-100">{itens.map((item) => { const qtd = decimal(item.quantidade); const rec = decimal(item.quantidade_recebida); const restante = Math.max(qtd - rec, 0); return <tr key={item.id}><td className="px-4 py-3"><strong>{item.descricao}</strong><div className="mt-1 text-xs text-slate-400">{item.unidade_medida || "UN"}{item.item_assistencial_id ? " · catálogo assistencial" : item.produto_id ? " · estoque" : " · vínculo será resolvido no recebimento"}</div></td><td className="px-4 py-3 font-semibold">{qtd.toLocaleString("pt-BR")}</td><td className="px-4 py-3 font-semibold text-emerald-700">{rec.toLocaleString("pt-BR")}</td><td className="px-4 py-3 font-semibold text-amber-700">{restante.toLocaleString("pt-BR")}</td><td className="px-4 py-3">{brl(item.valor_unitario)}</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ${restante === 0 ? "bg-emerald-50 text-emerald-700" : rec > 0 ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{restante === 0 ? "recebido" : rec > 0 ? "parcial" : "pendente"}</span></td></tr>; })}</tbody></table></div>
    </section>

    {canReceive && pendentes.length > 0 ? <form action={receberPedidoCompra} className="ui-card mt-5 overflow-hidden">
      <input type="hidden" name="pedido_id" value={pedido.id} />
      <header className="border-b border-slate-100 px-5 py-4"><div className="flex items-center gap-2"><PackageCheck className="size-5 text-brand-700" /><h2 className="font-black text-slate-900">Registrar recebimento</h2></div><p className="mt-1 text-xs text-slate-500">Preencha somente as quantidades que chegaram agora. Quantidade zero mantém o item pendente para uma próxima entrega.</p></header>
      <div className="grid gap-3 border-b border-slate-100 p-5 md:grid-cols-2 xl:grid-cols-4">
        <input name="numero_documento" className="ui-input" placeholder="NF / documento" />
        <input name="serie_documento" className="ui-input" placeholder="Série" />
        <label className="text-xs font-bold text-slate-600">Emissão<input name="data_emissao" type="date" className="ui-input mt-1 w-full" /></label>
        <label className="text-xs font-bold text-slate-600">Vencimento<input name="vencimento" type="date" className="ui-input mt-1 w-full" /></label>
        <input name="valor_documento" inputMode="decimal" className="ui-input" placeholder="Valor total da NF (opcional)" />
        <input name="observacoes" className="ui-input md:col-span-1 xl:col-span-3" placeholder="Observações gerais do recebimento" />
      </div>
      <div className="divide-y divide-slate-100">{pendentes.map((item) => { const restante = Math.max(decimal(item.quantidade) - decimal(item.quantidade_recebida), 0); return <div key={item.id} className="p-5"><input type="hidden" name="pedido_item_id" value={item.id} /><div className="mb-3 flex flex-wrap items-start justify-between gap-2"><div><strong>{item.descricao}</strong><p className="mt-1 text-xs text-slate-500">Pendente: {restante.toLocaleString("pt-BR")} {item.unidade_medida || "UN"}</p></div><span className="text-sm font-black text-slate-900">{brl(item.valor_unitario)} / {item.unidade_medida || "UN"}</span></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6"><label className="text-xs font-bold text-slate-600">Quantidade<input name="quantidade" type="number" min="0" max={restante} step="0.0001" defaultValue="0" className="ui-input mt-1 w-full" /></label><label className="text-xs font-bold text-slate-600 xl:col-span-2">Local de estoque<select name="local_estoque_id" defaultValue={localPadrao} className="ui-input mt-1 w-full"><option value="">Selecione</option>{locais?.map((local) => <option key={local.id} value={local.id}>{local.nome}{local.eh_farmacia ? " · Farmácia" : ""}</option>)}</select></label><label className="text-xs font-bold text-slate-600">Lote<input name="numero_lote" className="ui-input mt-1 w-full" placeholder="Lote" /></label><label className="text-xs font-bold text-slate-600">Validade<input name="validade" type="date" className="ui-input mt-1 w-full" /></label><label className="text-xs font-bold text-slate-600">Valor unitário<input name="valor_unitario" inputMode="decimal" defaultValue={String(decimal(item.valor_unitario))} className="ui-input mt-1 w-full" /></label><input name="divergencia_observacao" className="ui-input md:col-span-2 xl:col-span-6" placeholder="Divergência/avaria/falta/observação deste item (opcional)" /></div></div>; })}</div>
      <div className="flex justify-end border-t border-slate-100 bg-slate-50 p-5"><button className="ui-button-primary"><PackageCheck className="size-4" />Confirmar recebimento e entrada no estoque</button></div>
    </form> : null}

    {!canReceive && pendentes.length > 0 ? <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Há itens pendentes, mas o perfil atual não possui <b>compras.receber</b> ou <b>compras.gerenciar</b>.</div> : null}
    {canReceive && pendentes.length > 0 && !locais?.length ? <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Cadastre ou ative um local de estoque nesta unidade antes do recebimento.</div> : null}

    <section className="ui-card mt-5 overflow-hidden">
      <header className="border-b border-slate-100 px-5 py-4"><div className="flex items-center gap-2"><ReceiptText className="size-5 text-brand-700" /><h2 className="font-black text-slate-900">Histórico de recebimentos</h2></div><p className="mt-1 text-xs text-slate-500">Rastreabilidade documental, quantitativa, financeira e por lote.</p></header>
      <div className="divide-y divide-slate-100">{recebimentos?.length ? recebimentos.map((r) => <div key={r.id} className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><strong>{r.numero_documento ? `Documento ${r.numero_documento}${r.serie_documento ? ` / ${r.serie_documento}` : ""}` : "Recebimento sem número de documento"}</strong><p className="mt-1 text-xs text-slate-500">Recebido em {new Date(r.data_recebimento).toLocaleString("pt-BR")} · emissão {date(r.data_emissao)} · vencimento {date(r.vencimento)}</p></div><div className="text-right"><p className="font-black text-slate-950">{brl(r.valor_documento)}</p><span className={`text-xs font-bold ${r.status === "divergente" ? "text-rose-700" : "text-emerald-700"}`}>{r.status.replaceAll("_", " ")}{r.recebimento_parcial ? " · parcial" : ""}</span></div></div><div className="mt-3 grid gap-2">{Array.isArray(r.itens) ? r.itens.map((ri) => { const produto = one(ri.produto); const local = one(ri.local); return <div key={ri.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><span><b>{produto?.descricao || "Produto"}</b> · {decimal(ri.quantidade).toLocaleString("pt-BR")} · lote {ri.lote || "—"} · validade {date(ri.validade)}</span><span className="font-semibold">{local?.nome || "Local"} · {brl(ri.valor_unitario)}/un.</span></div>{ri.divergencia_tipo ? <p className="mt-2 text-xs font-semibold text-rose-700">Divergência: {ri.divergencia_tipo.replaceAll("_", " ")}{ri.divergencia_observacao ? ` · ${ri.divergencia_observacao}` : ""}</p> : null}</div>; }) : null}</div>{r.observacoes ? <p className="mt-3 text-xs text-slate-500">{r.observacoes}</p> : null}</div>) : <p className="p-6 text-sm text-slate-500">Nenhum recebimento registrado.</p>}</div>
    </section>
  </SectionPage>;
}

function Kpi({ label, value }: { label: string; value: string }) { return <div className="his-kpi"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-2 text-2xl font-black text-slate-950">{value}</p></div>; }
function Info({ label, value }: { label: string; value: string }) { return <div><p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 font-semibold capitalize text-slate-900">{value}</p></div>; }
