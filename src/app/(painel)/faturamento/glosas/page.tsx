import Link from "next/link";
import { ArrowRight, BadgeDollarSign, CircleDollarSign, Search, ShieldAlert } from "lucide-react";
import { GlosaAppealModal } from "@/components/faturamento/billing-workspace-actions";
import { SectionPage } from "@/components/painel/section-page";
import { createClient } from "@/lib/supabase/server";

function one<T>(rel: T | T[] | null): T | null {
  return Array.isArray(rel) ? rel[0] ?? null : rel;
}

function brl(value: number) {
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmt(value?: string | null) {
  return value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value)) : "—";
}

const statusStyle: Record<string, string> = {
  aberta: "bg-rose-50 text-rose-700",
  em_recurso: "bg-amber-50 text-amber-700",
  recursada: "bg-amber-50 text-amber-700",
  deferida: "bg-emerald-50 text-emerald-700",
  indeferida: "bg-rose-50 text-rose-700",
  encerrada: "bg-slate-100 text-slate-600",
};

export default async function GlosasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q, status } = await searchParams;
  const supabase = await createClient();
  const { data: glosas } = await supabase
    .from("tiss_glosas")
    .select("id,codigo_glosa,descricao_glosa,valor_glosado,status,created_at,guia:tiss_guias(numero_guia_prestador,numero_guia_operadora,paciente:pacientes(nome_completo,ra,numero_registro)),lote:tiss_lotes(id,numero_lote,convenio:convenios(nome_fantasia,registro_ans))")
    .order("created_at", { ascending: false })
    .limit(400);

  const rows = glosas ?? [];
  const query = q?.trim().toLocaleLowerCase("pt-BR") ?? "";
  const statuses = [...new Set(rows.map((item) => String(item.status)).filter(Boolean))].sort();
  const filtered = rows.filter((glosa) => {
    if (status && glosa.status !== status) return false;
    if (!query) return true;
    const guia = one(glosa.guia);
    const paciente = guia ? one(guia.paciente) : null;
    const lote = one(glosa.lote);
    const convenio = lote ? one(lote.convenio) : null;
    const haystack = `${glosa.codigo_glosa ?? ""} ${glosa.descricao_glosa ?? ""} ${guia?.numero_guia_prestador ?? ""} ${guia?.numero_guia_operadora ?? ""} ${paciente?.nome_completo ?? ""} ${paciente?.ra ?? ""} ${paciente?.numero_registro ?? ""} ${lote?.numero_lote ?? ""} ${convenio?.nome_fantasia ?? ""}`.toLocaleLowerCase("pt-BR");
    return haystack.includes(query);
  });

  const abertas = rows.filter((item) => item.status === "aberta");
  const emRecurso = rows.filter((item) => ["em_recurso", "recursada"].includes(String(item.status)));
  const valorTotal = rows.reduce((sum, item) => sum + Number(item.valor_glosado ?? 0), 0);
  const valorAberto = abertas.reduce((sum, item) => sum + Number(item.valor_glosado ?? 0), 0);

  return <SectionPage
    eyebrow="Ciclo da Receita / Recuperação"
    title="Central de Glosas"
    description="Concentre análise, priorização e abertura de recursos. A justificativa deixou de ocupar a grade e agora é registrada em modal no contexto da glosa."
    actions={<Link href="/faturamento/recursos" className="ui-button-primary">Acompanhar recursos <ArrowRight className="size-4" /></Link>}
  >
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Kpi icon={CircleDollarSign} label="Valor glosado" value={brl(valorTotal)} detail={`${rows.length} ocorrência(s)`} tone="danger" />
      <Kpi icon={ShieldAlert} label="Glosas abertas" value={String(abertas.length)} detail={brl(valorAberto)} tone={abertas.length ? "danger" : "success"} />
      <Kpi icon={BadgeDollarSign} label="Em recurso" value={String(emRecurso.length)} detail="Recuperação em andamento" tone="warning" />
      <Kpi icon={CircleDollarSign} label="Filtradas" value={String(filtered.length)} detail="Resultado da consulta" />
    </section>

    <section className="his-card mt-5 overflow-hidden">
      <div className="border-b border-slate-100 p-4 sm:p-5">
        <form className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_240px_auto]">
          <label className="relative"><Search className="absolute left-3 top-3 size-4 text-slate-400" /><input name="q" defaultValue={q ?? ""} className="ui-input pl-9" placeholder="Paciente, RA, guia, lote, operadora, código ou descrição..." /></label>
          <select name="status" defaultValue={status ?? ""} className="ui-input"><option value="">Todos os status</option>{statuses.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select>
          <button className="ui-button-secondary">Filtrar</button>
        </form>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1120px] text-left text-sm">
          <thead className="bg-slate-50 text-[11px] font-black uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Paciente / Guia</th><th className="px-4 py-3">Glosa</th><th className="px-4 py-3">Lote / Operadora</th><th className="px-4 py-3">Data</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Valor</th><th className="px-4 py-3 text-right">Ação</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length ? filtered.map((glosa) => {
              const guia = one(glosa.guia);
              const paciente = guia ? one(guia.paciente) : null;
              const lote = one(glosa.lote);
              const convenio = lote ? one(lote.convenio) : null;
              const valor = Number(glosa.valor_glosado ?? 0);
              return <tr key={glosa.id} className="align-top transition hover:bg-slate-50/80">
                <td className="px-4 py-4"><p className="font-black text-slate-900">{paciente?.nome_completo ?? "Paciente"}</p><p className="mt-1 text-xs text-slate-500">RA {paciente?.ra ?? "—"} · Registro #{paciente?.numero_registro ?? "—"}</p><p className="mt-1 text-[11px] font-semibold text-brand-700">Guia {guia?.numero_guia_prestador ?? "—"}{guia?.numero_guia_operadora ? ` · Operadora ${guia.numero_guia_operadora}` : ""}</p></td>
                <td className="px-4 py-4"><p className="font-black text-rose-700">Código {glosa.codigo_glosa ?? "—"}</p><p className="mt-1 max-w-md text-xs leading-5 text-slate-600">{glosa.descricao_glosa ?? "Sem descrição informada."}</p></td>
                <td className="px-4 py-4"><p className="font-semibold text-slate-800">Lote {lote?.numero_lote ?? "—"}</p><p className="mt-1 text-xs text-slate-500">{convenio?.nome_fantasia ?? "Convênio"} · ANS {convenio?.registro_ans ?? "—"}</p>{lote?.id ? <Link href={`/faturamento/lotes/${lote.id}`} className="mt-1 inline-flex text-[11px] font-bold text-brand-700 hover:underline">Abrir lote</Link> : null}</td>
                <td className="px-4 py-4 text-slate-500">{fmt(glosa.created_at)}</td>
                <td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-black capitalize ${statusStyle[String(glosa.status)] ?? "bg-slate-100 text-slate-600"}`}>{String(glosa.status).replaceAll("_", " ")}</span></td>
                <td className="px-4 py-4 text-right text-lg font-black text-rose-700">{brl(valor)}</td>
                <td className="px-4 py-4 text-right">{glosa.status === "aberta" ? <GlosaAppealModal glosaId={glosa.id} valorGlosado={valor} /> : <Link href="/faturamento/recursos" className="inline-flex items-center gap-1 font-black text-brand-700 hover:underline">Ver recursos <ArrowRight className="size-4" /></Link>}</td>
              </tr>;
            }) : <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-500">Nenhuma glosa encontrada.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  </SectionPage>;
}

function Kpi({ icon: Icon, label, value, detail, tone = "default" }: { icon: typeof CircleDollarSign; label: string; value: string; detail: string; tone?: "default" | "success" | "warning" | "danger" }) {
  const tones = { default: "bg-brand-50 text-brand-700", success: "bg-emerald-50 text-emerald-700", warning: "bg-amber-50 text-amber-700", danger: "bg-rose-50 text-rose-700" };
  return <div className="his-kpi"><div className="flex items-center justify-between gap-3"><span className={`grid size-10 shrink-0 place-items-center rounded-xl ${tones[tone]}`}><Icon className="size-5" /></span><span className="text-xl font-black text-slate-950">{value}</span></div><p className="mt-3 text-xs font-black uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-[11px] font-semibold text-slate-500">{detail}</p></div>;
}
