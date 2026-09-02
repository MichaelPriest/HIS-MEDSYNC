import Link from "next/link";
import { AlertTriangle, ArrowRight, Banknote, CalendarClock, CircleDollarSign, ReceiptText, WalletCards } from "lucide-react";
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

export default async function FinanceiroPage() {
  const { supabase } = await requireAnyPermission(["financeiro.visualizar", "financeiro.receber", "financeiro.conciliar", "financeiro.gerenciar"]);
  const [{ data: recebiveis }, { data: notas }] = await Promise.all([
    supabase
      .from("financeiro_recebiveis")
      .select("id,competencia,previsao_pagamento,data_pagamento,valor_bruto,valor_glosa,valor_liquido_previsto,valor_recebido,status,lote:tiss_lotes(id,numero_lote,protocolo_envio_operadora,protocolo_operadora),convenio:convenios(nome_fantasia)")
      .order("previsao_pagamento", { ascending: true })
      .limit(500),
    supabase
      .from("notas_fiscais_servico")
      .select("id,status,valor_liquido")
      .neq("status", "cancelada")
      .limit(500),
  ]);

  const rows = recebiveis ?? [];
  const totalPrev = rows.reduce((sum, item) => sum + Number(item.valor_liquido_previsto ?? 0), 0);
  const recebido = rows.reduce((sum, item) => sum + Number(item.valor_recebido ?? 0), 0);
  const glosa = rows.reduce((sum, item) => sum + Number(item.valor_glosa ?? 0), 0);
  const saldo = rows.reduce((sum, item) => sum + Math.max(0, Number(item.valor_liquido_previsto ?? 0) - Number(item.valor_recebido ?? 0)), 0);
  const hoje = today();
  const vencidos = rows.filter((item) => item.previsao_pagamento && item.previsao_pagamento < hoje && !["recebido", "cancelado"].includes(String(item.status)) && Number(item.valor_recebido ?? 0) < Number(item.valor_liquido_previsto ?? 0) - 0.01);
  const valorVencido = vencidos.reduce((sum, item) => sum + Math.max(0, Number(item.valor_liquido_previsto ?? 0) - Number(item.valor_recebido ?? 0)), 0);
  const notasAtivas = notas ?? [];
  const notasEmitidas = notasAtivas.filter((nota) => nota.status === "emitida").length;
  const valorNf = notasAtivas.reduce((sum, nota) => sum + Number(nota.valor_liquido ?? 0), 0);
  const proximos = [...rows].sort((a, b) => String(a.previsao_pagamento ?? "9999").localeCompare(String(b.previsao_pagamento ?? "9999"))).slice(0, 8);

  return <SectionPage
    eyebrow="Ciclo da Receita / Financeiro"
    title="Resumo Financeiro do Faturamento"
    description="Acompanhe previsão, recebimento, glosa, vencimentos e documentos fiscais sem perder o vínculo com lote TISS e operadora."
    actions={(
      <div className="flex flex-wrap gap-2">
        <Link href="/financeiro/recebiveis" className="ui-button-primary">Central de recebíveis <ArrowRight className="size-4" /></Link>
        <Link href="/financeiro/notas-fiscais" className="ui-button-secondary">Notas fiscais</Link>
      </div>
    )}
  >
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      <Kpi icon={CalendarClock} label="Líquido previsto" value={brl(totalPrev)} detail={`${rows.length} título(s)`} />
      <Kpi icon={Banknote} label="Recebido" value={brl(recebido)} detail="Baixas registradas" tone="success" />
      <Kpi icon={WalletCards} label="Saldo em aberto" value={brl(saldo)} detail="A receber" />
      <Kpi icon={AlertTriangle} label="Vencido" value={brl(valorVencido)} detail={`${vencidos.length} título(s)`} tone={vencidos.length ? "warning" : "success"} />
      <Kpi icon={CircleDollarSign} label="Glosas" value={brl(glosa)} detail="Impacto financeiro" tone={glosa > 0 ? "danger" : "success"} />
      <Kpi icon={ReceiptText} label="NFS-e emitidas" value={String(notasEmitidas)} detail={brl(valorNf)} />
    </section>

    <section className="mt-5 grid gap-4 xl:grid-cols-[.72fr_1.28fr]">
      <div className="his-card p-5">
        <p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-400">Prioridades</p>
        <h2 className="mt-1 font-black text-slate-950">Ações financeiras</h2>
        <div className="mt-4 space-y-3">
          <Priority href="/financeiro/recebiveis?vencidos=1" icon={AlertTriangle} title="Cobranças vencidas" value={vencidos.length} detail={brl(valorVencido)} tone="warning" />
          <Priority href="/faturamento/glosas" icon={CircleDollarSign} title="Glosas e recuperação" value={rows.filter((item) => Number(item.valor_glosa ?? 0) > 0).length} detail={brl(glosa)} tone="danger" />
          <Priority href="/financeiro/notas-fiscais" icon={ReceiptText} title="Documentos fiscais" value={notasAtivas.length} detail={`${notasEmitidas} emitida(s)`} tone="default" />
        </div>
      </div>

      <div className="his-card overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4"><div><p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-400">Agenda financeira</p><h2 className="mt-1 font-black text-slate-950">Próximos recebíveis</h2></div><Link href="/financeiro/recebiveis" className="text-xs font-black text-brand-700 hover:underline">Ver todos</Link></div>
        <div className="divide-y divide-slate-100">
          {proximos.length ? proximos.map((item) => {
            const lote = one(item.lote);
            const convenio = one(item.convenio);
            const restante = Math.max(0, Number(item.valor_liquido_previsto ?? 0) - Number(item.valor_recebido ?? 0));
            const overdue = Boolean(item.previsao_pagamento && item.previsao_pagamento < hoje && restante > 0.01 && !["recebido", "cancelado"].includes(String(item.status)));
            return <Link key={item.id} href={`/financeiro/recebiveis/${item.id}`} className={`grid gap-3 px-5 py-4 transition hover:bg-slate-50 sm:grid-cols-[1fr_auto_auto] sm:items-center ${overdue ? "bg-amber-50/40" : ""}`}>
              <div><p className="font-black text-slate-900">{lote ? `Lote ${lote.numero_lote}` : "Recebível"}</p><p className="mt-1 text-xs text-slate-500">{convenio?.nome_fantasia ?? "—"} · Comp. {item.competencia ?? "—"}</p></div>
              <div className="text-left sm:text-right"><p className={`text-xs font-black ${overdue ? "text-amber-700" : "text-slate-500"}`}>{fmtDate(item.previsao_pagamento)}</p><p className="mt-1 text-[10px] uppercase text-slate-400">Previsão</p></div>
              <div className="text-left sm:min-w-32 sm:text-right"><p className={`font-black ${overdue ? "text-amber-700" : "text-slate-900"}`}>{brl(restante)}</p><p className="mt-1 text-[10px] uppercase text-slate-400">Saldo</p></div>
            </Link>;
          }) : <p className="px-5 py-10 text-sm text-slate-500">Nenhum recebível disponível.</p>}
        </div>
      </div>
    </section>
  </SectionPage>;
}

function Kpi({ icon: Icon, label, value, detail, tone = "default" }: { icon: typeof Banknote; label: string; value: string; detail: string; tone?: "default" | "success" | "warning" | "danger" }) {
  const tones = { default: "bg-brand-50 text-brand-700", success: "bg-emerald-50 text-emerald-700", warning: "bg-amber-50 text-amber-700", danger: "bg-rose-50 text-rose-700" };
  return <div className="his-kpi"><div className="flex items-center justify-between gap-3"><span className={`grid size-10 shrink-0 place-items-center rounded-xl ${tones[tone]}`}><Icon className="size-5" /></span><span className="text-lg font-black text-slate-950">{value}</span></div><p className="mt-3 text-xs font-black uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-[11px] font-semibold text-slate-500">{detail}</p></div>;
}

function Priority({ href, icon: Icon, title, value, detail, tone }: { href: string; icon: typeof Banknote; title: string; value: number; detail: string; tone: "default" | "warning" | "danger" }) {
  const tones = { default: "bg-brand-50 text-brand-700", warning: "bg-amber-50 text-amber-700", danger: "bg-rose-50 text-rose-700" };
  return <Link href={href} className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3 transition hover:border-brand-200 hover:bg-slate-50"><span className={`grid size-10 shrink-0 place-items-center rounded-xl ${tones[tone]}`}><Icon className="size-5" /></span><span className="min-w-0 flex-1"><strong className="block text-sm text-slate-900">{title}</strong><span className="mt-0.5 block text-xs text-slate-500">{detail}</span></span><span className="text-xl font-black text-slate-950">{value}</span></Link>;
}
