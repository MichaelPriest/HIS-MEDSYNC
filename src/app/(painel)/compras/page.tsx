import Link from "next/link";
import { FileText, GitCompareArrows, PackageCheck, Plus, ShoppingCart } from "lucide-react";
import { ActionPanel } from "@/components/painel/action-panel";
import { SectionPage } from "@/components/painel/section-page";
import { asRoute } from "@/lib/route-cast";
import { requireAnyPermission } from "@/lib/permissions/server";
import { criarSolicitacaoCompra } from "@/modules/compras/actions";

function one<T>(value: T | T[] | null) { return Array.isArray(value) ? value[0] ?? null : value; }

export default async function ComprasPage({ searchParams }: { searchParams: Promise<{ pedido?: string; erro?: string }> }) {
  const sp = await searchParams;
  const { supabase, empresaId, unidadeId } = await requireAnyPermission([
    "compras.visualizar",
    "compras.solicitar",
    "compras.cotar",
    "compras.aprovar",
    "compras.gerenciar",
  ]);
  const [{ data: solicitacoes }, { data: cotacoes }, { data: pedidos }, solicitarGrant] = await Promise.all([
    supabase.from("compras_solicitacoes")
      .select("id,numero,setor,prioridade,status,justificativa,created_at,itens:compras_solicitacao_itens(id)")
      .eq("empresa_id", empresaId).eq("unidade_id", unidadeId)
      .order("created_at", { ascending: false }).limit(100),
    supabase.from("compras_cotacoes")
      .select("id,numero,status,validade,created_at,solicitacao:compras_solicitacoes(numero,setor),itens:compras_cotacao_itens(id),fornecedores:compras_cotacao_fornecedores(id,itens_cotados,itens_total,selecionado)")
      .eq("empresa_id", empresaId).eq("unidade_id", unidadeId)
      .order("created_at", { ascending: false }).limit(80),
    supabase.from("compras_pedidos")
      .select("id,numero,data_pedido,previsao_entrega,valor_total,status,fornecedor:fornecedores(nome_fantasia,razao_social)")
      .eq("empresa_id", empresaId).eq("unidade_id", unidadeId)
      .order("created_at", { ascending: false }).limit(80),
    supabase.rpc("tem_permissao", { p_empresa: empresaId, p_unidade: unidadeId, p_codigo: "compras.solicitar" }),
  ]);
  const canRequest = solicitarGrant.data === true && !solicitarGrant.error;
  const abertas = (solicitacoes ?? []).filter((item) => !["recebida", "cancelada"].includes(item.status)).length;
  const cotacoesAbertas = (cotacoes ?? []).filter((item) => !["convertida_pedido", "cancelada", "reprovada"].includes(item.status)).length;

  return (
    <SectionPage
      eyebrow="Gestão / Suprimentos"
      title="Compras"
      description="Solicitação por catálogo mestre → cotação item a item → comparação de fornecedores → aprovação → pedido."
    >
      {sp.pedido ? <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">Pedido {sp.pedido} gerado a partir da cotação aprovada.</div> : null}
      {sp.erro ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">Não foi possível concluir a operação de Compras.</div> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Solicitações abertas" value={abertas} icon={<FileText className="size-5" />} />
        <Kpi label="Cotações em andamento" value={cotacoesAbertas} icon={<GitCompareArrows className="size-5" />} />
        <Kpi label="Pedidos" value={pedidos?.length ?? 0} icon={<ShoppingCart className="size-5" />} />
        <Kpi label="Catálogo" value="MATMED" icon={<PackageCheck className="size-5" />} />
      </section>

      {canRequest ? <div className="mt-5">
        <ActionPanel title="Nova solicitação" description="Crie o cabeçalho e depois selecione materiais, medicamentos, OPME e gases diretamente do catálogo mestre.">
          <form action={criarSolicitacaoCompra} className="grid gap-3 md:grid-cols-[1fr_180px_2fr_auto]">
            <input name="setor" className="ui-input" placeholder="Setor solicitante" required />
            <select name="prioridade" className="ui-input" defaultValue="normal"><option value="normal">Normal</option><option value="alta">Alta</option><option value="urgente">Urgente</option></select>
            <input name="justificativa" className="ui-input" placeholder="Justificativa / necessidade" />
            <button className="ui-button-primary inline-flex items-center gap-2"><Plus className="size-4" />Criar</button>
          </form>
        </ActionPanel>
      </div> : null}

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.05fr_1fr]">
        <section className="ui-card overflow-hidden">
          <header className="border-b border-slate-100 px-5 py-4"><h2 className="font-black text-slate-900">Solicitações</h2><p className="mt-1 text-xs text-slate-500">Abra a solicitação para montar a lista com itens do catálogo.</p></header>
          <div className="divide-y divide-slate-100">
            {solicitacoes?.length ? solicitacoes.map((s) => {
              const itens = Array.isArray(s.itens) ? s.itens.length : 0;
              return <div key={s.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><strong>{s.numero}</strong><Status value={s.status} /></div><p className="mt-1 text-sm text-slate-500">{s.setor || "Sem setor"} · {itens} item(ns) · prioridade {s.prioridade}</p><p className="mt-1 line-clamp-1 text-xs text-slate-400">{s.justificativa || "Sem justificativa"}</p></div><Link href={asRoute(`/compras/solicitacoes/${s.id}`)} className="btn-secondary">Abrir solicitação</Link></div>;
            }) : <p className="p-6 text-sm text-slate-500">Nenhuma solicitação.</p>}
          </div>
        </section>

        <section className="ui-card overflow-hidden">
          <header className="border-b border-slate-100 px-5 py-4"><h2 className="font-black text-slate-900">Cotações</h2><p className="mt-1 text-xs text-slate-500">Comparativo item a item, cobertura e fornecedor vencedor.</p></header>
          <div className="divide-y divide-slate-100">
            {cotacoes?.length ? cotacoes.map((c) => {
              const solicitacao = one(c.solicitacao);
              const itens = Array.isArray(c.itens) ? c.itens.length : 0;
              const fornecedores = Array.isArray(c.fornecedores) ? c.fornecedores : [];
              const completos = fornecedores.filter((f) => f.itens_total > 0 && f.itens_cotados >= f.itens_total).length;
              return <div key={c.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><strong>{c.numero}</strong><Status value={c.status} /></div><p className="mt-1 text-sm text-slate-500">{solicitacao?.numero || "—"} · {itens} item(ns) · {fornecedores.length} fornecedor(es)</p><p className="mt-1 text-xs text-slate-400">{completos} proposta(s) com cobertura completa</p></div><Link href={asRoute(`/compras/cotacoes/${c.id}`)} className="btn-secondary">Abrir comparativo</Link></div>;
            }) : <p className="p-6 text-sm text-slate-500">Nenhuma cotação.</p>}
          </div>
        </section>
      </div>

      <section className="ui-card mt-5 overflow-hidden">
        <header className="border-b border-slate-100 px-5 py-4"><h2 className="font-black text-slate-900">Pedidos gerados</h2><p className="mt-1 text-xs text-slate-500">Pedidos convertidos das cotações aprovadas.</p></header>
        <div className="divide-y divide-slate-100">{pedidos?.length ? pedidos.map((p) => { const fornecedor = one(p.fornecedor); return <div key={p.id} className="grid gap-2 p-4 md:grid-cols-[1fr_1fr_auto_auto] md:items-center"><div><strong>{p.numero}</strong><p className="text-xs text-slate-500">{fornecedor?.nome_fantasia || fornecedor?.razao_social || "Fornecedor"}</p></div><div className="text-sm text-slate-600">Pedido {p.data_pedido || "—"} · entrega {p.previsao_entrega || "—"}</div><Status value={p.status} /><strong>R$ {Number(p.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></div>; }) : <p className="p-6 text-sm text-slate-500">Nenhum pedido.</p>}</div>
      </section>
    </SectionPage>
  );
}

function Kpi({ label, value, icon }: { label: string; value: number | string; icon: React.ReactNode }) {
  return <div className="his-kpi"><div className="flex items-center justify-between text-slate-400"><p className="text-xs font-bold uppercase tracking-wider">{label}</p>{icon}</div><p className="mt-2 text-3xl font-black text-slate-950">{value}</p></div>;
}
function Status({ value }: { value: string }) { return <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold capitalize text-slate-600">{value.replaceAll("_", " ")}</span>; }
