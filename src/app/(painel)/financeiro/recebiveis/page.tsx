import Link from "next/link";
import { AlertTriangle, ArrowRight, Banknote, CalendarClock, CheckCircle2, Search, WalletCards } from "lucide-react";
import { SectionPage } from "@/components/painel/section-page";
import { requireAnyPermission } from "@/lib/permissions/server";

function one<T>(rel: T | T[] | null): T | null {
  return Array.isArray(rel) ? rel[0] ?? null : rel;
}

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function brl(value: number) {
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(value?: string | null) {
  return value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(`${value}T12:00:00-03:00`)) : "—";
}

const statusStyle: Record<string, string> = {
  previsto: "bg-blue-50 text-blue-700",
  aberto: "bg-blue-50 text-blue-700",
  parcial: "bg-amber-50 text-amber-700",
  recebido: "bg-emerald-50 text-emerald-700",
  conciliado: "bg-emerald-50 text-emerald-700",
  cancelado: "bg-slate-100 text-slate-500",
};

export default async function RecebiveisPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; competencia?: string; vencidos?: string }>;
}) {
  const { q, status, competencia, vencidos } = await searchParams;
  const { supabase } = await requireAnyPermission(["financeiro.visualizar", "financeiro.receber", "financeiro.conciliar", "financeiro.gerenciar"]);
  const { data: recebiveis } = await supabase
    .from("financeiro_recebiveis")
    .select("id,competencia,previsao_pagamento,data_pagamento,valor_bruto,valor_glosa,valor_liquido_previsto,valor_recebido,status,lote:tiss_lotes(id,numero_lote,protocolo_envio_operadora,protocolo_operadora),convenio:convenios(nome_fantasia,registro_ans)")
    .order("previsao_pagamento", { ascending: true })
    .limit(500);

  const rows = recebiveis ?? [];
  const hoje = today();
  const statuses = [...new Set(rows.map((item) => String(item.status)).filter(Boolean))].sort();
  const query = q?.trim().toLocaleLowerCase("pt-BR") ?? "";

  const decorate = (item: (typeof rows)[number]) => {
    const saldo = Math.max(0, Number(item.valor_liquido_previsto ?? 0) - Number(item.valor_recebido ?? 0));
    const overdue = Boolean(item.previsao_pagamento && item.previsao_pagamento < hoje && saldo > 0.01 && !["recebido", "cancelado"].includes(String(item.status)));
    return { item, saldo, overdue };
  };
  const decorated = rows.map(decorate);
  const filtered = decorated.filter(({ item, overdue }) => {
    if (status && item.status !== status) return false;
    if (competencia && item.competencia !== competencia) return false;
    if (vencidos === "1" && !overdue) return false;
    if (!query) return true;
    const lote = one(item.lote);
    const convenio = one(item.convenio);
    const haystack = `${lote?.numero_lote ?? ""} ${lote?.protocolo_operadora ?? ""} ${lote?.protocolo_envio_operadora ?? ""} ${convenio?.nome_fantasia ?? ""} ${convenio?.registro_ans ?? ""} ${item.competencia ?? ""}`.toLocaleLowerCase("pt-BR");
    return haystack.includes(query);
  });

  const totalPrevisto = decorated.reduce((sum, row) => sum + Number(row.item.valor_liquido_previsto ?? 0), 0);
  const totalRecebido = decorated.reduce((sum, row) => sum + Number(row.item.valor_recebido ?? 0), 0);
  const totalSaldo = decorated.reduce((sum, row) => sum + row.saldo, 0);
  const overdueRows = decorated.filter((row) => row.overdue);
  const valorVencido = overdueRows.reduce((sum, row) => sum + row.saldo, 0);

  return <SectionPage
    eyebrow="Ciclo da Receita / Financeiro"
    title="Central de Recebíveis"
    description="Controle previsões de pagamento, títulos vencidos, baixas e conciliação a partir do lote TISS e da operadora."
    actions={<Link href="/financeiro/notas-fiscais" className="ui-button-primary">Notas fiscais <ArrowRight className="size-4" /></Link>}
  >
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Kpi icon={CalendarClock} label="Líquido previsto" value={brl(totalPrevisto)} detail={`${rows.length} título(s)`} />
      <Kpi icon={CheckCircle2} label="Recebido" value={brl(totalRecebido)} detail="Baixas registradas" tone="success" />
      <Kpi icon={WalletCards} label="Saldo em aberto" value={brl(totalSaldo)} detail="A receber" />
      <Kpi icon={AlertTriangle} label="Vencido" value={brl(valorVencido)} detail={`${overdueRows.length} título(s)`} tone={overdueRows.length ? "warning" : "success"} />
    </section>

    <section className="his-card mt-5 overflow-hidden">
      <div className="border-b border-slate-100 p-4 sm:p-5">
        <form className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_220px_190px_auto_auto]">
          <label className="relative"><Search className="absolute left-3 top-3 size-4 text-slate-400" /><input name="q" defaultValue={q ?? ""} className="ui-input pl-9" placeholder="Lote, protocolo, operadora, ANS ou competência..." /></label>
          <select name="status" defaultValue={status ?? ""} className="ui-input"><option value="">Todos os status</option>{statuses.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select>
          <input name="competencia" defaultValue={competencia ?? ""} type="month" className="ui-input" aria-label="Competência" />
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-black text-slate-600"><input type="checkbox" name="vencidos" value="1" defaultChecked={vencidos === "1"} />Somente vencidos</label>
          <button className="ui-button-secondary">Filtrar</button>
        </form>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1160px] text-left text-sm">
          <thead className="bg-slate-50 text-[11px] font-black uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Lote / Operadora</th><th className="px-4 py-3">Competência</th><th className="px-4 py-3">Previsão</th><th className="px-4 py-3 text-right">Previsto</th><th className="px-4 py-3 text-right">Baixado</th><th className="px-4 py-3 text-right">Saldo</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Ação</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length ? filtered.map(({ item, saldo, overdue }) => {
              const lote = one(item.lote);
              const convenio = one(item.convenio);
              return <tr key={item.id} className={`transition hover:bg-slate-50/80 ${overdue ? "bg-amber-50/40" : ""}`}>
                <td className="px-4 py-4"><p className="font-black text-slate-900">{lote ? `Lote ${lote.numero_lote}` : "Recebível"}</p><p className="mt-1 text-xs text-slate-500">{convenio?.nome_fantasia ?? "—"} · ANS {convenio?.registro_ans ?? "—"}</p><p className="mt-1 text-[11px] text-slate-400">Prot. {lote?.protocolo_operadora ?? lote?.protocolo_envio_operadora ?? "—"}</p></td>
                <td className="px-4 py-4 font-semibold text-slate-700">{item.competencia ?? "—"}</td>
                <td className={`px-4 py-4 ${overdue ? "font-black text-amber-700" : "text-slate-600"}`}>{fmtDate(item.previsao_pagamento)}{overdue ? <span className="ml-2 rounded-full bg-amber-100 px-2 py-1 text-[10px] font-black uppercase">Vencido</span> : null}</td>
                <td className="px-4 py-4 text-right text-slate-700">{brl(Number(item.valor_liquido_previsto ?? 0))}</td>
                <td className="px-4 py-4 text-right font-semibold text-emerald-700">{brl(Number(item.valor_recebido ?? 0))}</td>
                <td className={`px-4 py-4 text-right font-black ${overdue ? "text-amber-700" : "text-slate-900"}`}>{brl(saldo)}</td>
                <td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-black capitalize ${statusStyle[String(item.status)] ?? "bg-slate-100 text-slate-600"}`}>{String(item.status).replaceAll("_", " ")}</span></td>
                <td className="px-4 py-4 text-right"><Link href={`/financeiro/recebiveis/${item.id}`} className="inline-flex items-center gap-1 font-black text-brand-700 hover:underline">Abrir <ArrowRight className="size-4" /></Link></td>
              </tr>;
            }) : <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-500">Nenhum recebível encontrado.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  </SectionPage>;
}

function Kpi({ icon: Icon, label, value, detail, tone = "default" }: { icon: typeof Banknote; label: string; value: string; detail: string; tone?: "default" | "success" | "warning" }) {
  const tones = { default: "bg-brand-50 text-brand-700", success: "bg-emerald-50 text-emerald-700", warning: "bg-amber-50 text-amber-700" };
  return <div className="his-kpi"><div className="flex items-center justify-between gap-3"><span className={`grid size-10 shrink-0 place-items-center rounded-xl ${tones[tone]}`}><Icon className="size-5" /></span><span className="text-xl font-black text-slate-950">{value}</span></div><p className="mt-3 text-xs font-black uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-[11px] font-semibold text-slate-500">{detail}</p></div>;
}
