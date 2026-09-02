import Link from "next/link";
import { ArrowRight, Boxes, CheckCircle2, Clock3, FileWarning, Search } from "lucide-react";
import { NewTissBatchModal } from "@/components/faturamento/billing-workspace-actions";
import { SectionPage } from "@/components/painel/section-page";
import { createClient } from "@/lib/supabase/server";

function one<T>(rel: T | T[] | null): T | null {
  return Array.isArray(rel) ? rel[0] ?? null : rel;
}

function brl(value: number) {
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(value?: string | null) {
  return value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(`${value}T12:00:00-03:00`)) : "—";
}

const statusStyle: Record<string, string> = {
  aberto: "bg-blue-50 text-blue-700",
  em_montagem: "bg-blue-50 text-blue-700",
  pronto: "bg-emerald-50 text-emerald-700",
  valido: "bg-emerald-50 text-emerald-700",
  invalido: "bg-rose-50 text-rose-700",
  enviado: "bg-brand-50 text-brand-700",
  protocolado: "bg-violet-50 text-violet-700",
  recebido: "bg-emerald-50 text-emerald-700",
  cancelado: "bg-slate-100 text-slate-500",
};

export default async function LotesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; competencia?: string }>;
}) {
  const { q, status, competencia } = await searchParams;
  const supabase = await createClient();
  const [{ data: lotes }, { data: convenios }] = await Promise.all([
    supabase
      .from("tiss_lotes")
      .select("id,numero_lote,competencia,previsao_pagamento,status,quantidade_guias,valor_total,xsd_validado,protocolo_operadora,created_at,convenio:convenios(nome_fantasia,registro_ans)")
      .order("created_at", { ascending: false })
      .limit(300),
    supabase.from("convenios").select("id,nome_fantasia,registro_ans").eq("ativo", true).order("nome_fantasia"),
  ]);

  const rows = lotes ?? [];
  const query = q?.trim().toLocaleLowerCase("pt-BR") ?? "";
  const statuses = [...new Set(rows.map((item) => String(item.status)).filter(Boolean))].sort();
  const filtered = rows.filter((lote) => {
    if (status && lote.status !== status) return false;
    if (competencia && lote.competencia !== competencia) return false;
    if (!query) return true;
    const convenio = one(lote.convenio);
    const haystack = `${lote.numero_lote ?? ""} ${lote.protocolo_operadora ?? ""} ${convenio?.nome_fantasia ?? ""} ${convenio?.registro_ans ?? ""}`.toLocaleLowerCase("pt-BR");
    return haystack.includes(query);
  });

  const valorTotal = rows.reduce((sum, lote) => sum + Number(lote.valor_total ?? 0), 0);
  const guiasTotal = rows.reduce((sum, lote) => sum + Number(lote.quantidade_guias ?? 0), 0);
  const xsdPendentes = rows.filter((lote) => !lote.xsd_validado).length;
  const enviados = rows.filter((lote) => ["enviado", "protocolado", "recebido"].includes(String(lote.status))).length;

  return <SectionPage
    eyebrow="Ciclo da Receita / TISS"
    title="Central de Lotes TISS"
    description="Crie lotes por operadora e competência em modal, acompanhe validação XSD, protocolo, previsão de pagamento e continuidade financeira."
    actions={<NewTissBatchModal convenios={convenios ?? []} />}
  >
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Kpi icon={Boxes} label="Lotes" value={String(rows.length)} detail={`${guiasTotal} guia(s) · ${brl(valorTotal)}`} />
      <Kpi icon={CheckCircle2} label="Enviados / recebidos" value={String(enviados)} detail="Fluxo externo iniciado" tone="success" />
      <Kpi icon={FileWarning} label="XSD pendente" value={String(xsdPendentes)} detail="Não liberar envio eletrônico" tone={xsdPendentes ? "warning" : "success"} />
      <Kpi icon={Clock3} label="Resultado filtrado" value={String(filtered.length)} detail="Lotes na consulta atual" />
    </section>

    <section className="his-card mt-5 overflow-hidden">
      <div className="border-b border-slate-100 p-4 sm:p-5">
        <form className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_190px_auto]">
          <label className="relative"><Search className="absolute left-3 top-3 size-4 text-slate-400" /><input name="q" defaultValue={q ?? ""} className="ui-input pl-9" placeholder="Lote, protocolo, operadora ou ANS..." /></label>
          <select name="status" defaultValue={status ?? ""} className="ui-input"><option value="">Todos os status</option>{statuses.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select>
          <input name="competencia" defaultValue={competencia ?? ""} type="month" className="ui-input" aria-label="Competência" />
          <button className="ui-button-secondary">Filtrar</button>
        </form>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1180px] text-left text-sm">
          <thead className="bg-slate-50 text-[11px] font-black uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Lote / Operadora</th><th className="px-4 py-3">Competência</th><th className="px-4 py-3">Previsão</th><th className="px-4 py-3 text-center">Guias</th><th className="px-4 py-3 text-right">Valor</th><th className="px-4 py-3">XSD</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Protocolo</th><th className="px-4 py-3 text-right">Ações</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length ? filtered.map((lote) => {
              const convenio = one(lote.convenio);
              return <tr key={lote.id} className="transition hover:bg-slate-50/80">
                <td className="px-4 py-4"><p className="font-black text-slate-900">Lote {lote.numero_lote}</p><p className="mt-1 text-xs text-slate-500">{convenio?.nome_fantasia ?? "—"} · ANS {convenio?.registro_ans ?? "—"}</p></td>
                <td className="px-4 py-4 font-semibold text-slate-700">{lote.competencia ?? "—"}</td>
                <td className="px-4 py-4 text-slate-600">{fmtDate(lote.previsao_pagamento)}</td>
                <td className="px-4 py-4 text-center font-black text-slate-800">{Number(lote.quantidade_guias ?? 0)}</td>
                <td className="px-4 py-4 text-right font-black text-slate-900">{brl(Number(lote.valor_total ?? 0))}</td>
                <td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-black ${lote.xsd_validado ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{lote.xsd_validado ? "Validado" : "Pendente"}</span></td>
                <td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-black capitalize ${statusStyle[String(lote.status)] ?? "bg-slate-100 text-slate-600"}`}>{String(lote.status).replaceAll("_", " ")}</span></td>
                <td className="px-4 py-4 text-slate-600">{lote.protocolo_operadora ?? "—"}</td>
                <td className="px-4 py-4"><div className="flex justify-end gap-3"><Link href={`/faturamento/lotes/${lote.id}/financeiro`} className="text-xs font-black text-slate-600 hover:text-brand-700">Financeiro</Link><Link href={`/faturamento/lotes/${lote.id}`} className="inline-flex items-center gap-1 font-black text-brand-700 hover:underline">Abrir <ArrowRight className="size-4" /></Link></div></td>
              </tr>;
            }) : <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-500">Nenhum lote encontrado.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  </SectionPage>;
}

function Kpi({ icon: Icon, label, value, detail, tone = "default" }: { icon: typeof Boxes; label: string; value: string; detail: string; tone?: "default" | "success" | "warning" }) {
  const tones = { default: "bg-brand-50 text-brand-700", success: "bg-emerald-50 text-emerald-700", warning: "bg-amber-50 text-amber-700" };
  return <div className="his-kpi"><div className="flex items-center justify-between gap-3"><span className={`grid size-10 shrink-0 place-items-center rounded-xl ${tones[tone]}`}><Icon className="size-5" /></span><span className="text-xl font-black text-slate-950">{value}</span></div><p className="mt-3 text-xs font-black uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-[11px] font-semibold text-slate-500">{detail}</p></div>;
}
