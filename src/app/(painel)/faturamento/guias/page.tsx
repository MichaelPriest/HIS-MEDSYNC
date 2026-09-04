import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, FileCheck2, Search, ShieldAlert } from "lucide-react";
import { SectionPage } from "@/components/painel/section-page";
import { createClient } from "@/lib/supabase/server";

function one<T>(rel: T | T[] | null): T | null {
  return Array.isArray(rel) ? rel[0] ?? null : rel;
}

function brl(value: number) {
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const statusStyle: Record<string, string> = {
  rascunho: "bg-slate-100 text-slate-700",
  pronta: "bg-emerald-50 text-emerald-700",
  invalida: "bg-rose-50 text-rose-700",
  lote: "bg-blue-50 text-blue-700",
  enviada: "bg-brand-50 text-brand-700",
};

export default async function GuiasTissPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; tipo?: string }>;
}) {
  const { q, status, tipo } = await searchParams;
  const supabase = await createClient();
  const [{ data: guias }, { data: criticas }] = await Promise.all([
    supabase
      .from("tiss_guias")
      .select("id,numero_guia_prestador,numero_guia_operadora,tipo_guia,status,valor_total,validado_em,created_at,paciente:pacientes(nome_completo,ra,numero_registro),convenio:convenios(nome_fantasia,registro_ans),conta:contas_faturamento(id,competencia)")
      .order("created_at", { ascending: false })
      .limit(400),
    supabase
      .from("tiss_guia_criticas")
      .select("guia_id,severidade")
      .eq("resolvida", false)
      .limit(2000),
  ]);

  const errorByGuide = new Map<string, { erros: number; alertas: number }>();
  for (const critica of criticas ?? []) {
    const current = errorByGuide.get(critica.guia_id) ?? { erros: 0, alertas: 0 };
    if (critica.severidade === "erro") current.erros += 1;
    else current.alertas += 1;
    errorByGuide.set(critica.guia_id, current);
  }

  const rows = guias ?? [];
  const query = q?.trim().toLocaleLowerCase("pt-BR") ?? "";
  const filtered = rows.filter((guia) => {
    if (status && guia.status !== status) return false;
    if (tipo && guia.tipo_guia !== tipo) return false;
    if (!query) return true;
    const paciente = one(guia.paciente);
    const convenio = one(guia.convenio);
    const haystack = `${guia.numero_guia_prestador ?? ""} ${guia.numero_guia_operadora ?? ""} ${paciente?.nome_completo ?? ""} ${paciente?.ra ?? ""} ${paciente?.numero_registro ?? ""} ${convenio?.nome_fantasia ?? ""}`.toLocaleLowerCase("pt-BR");
    return haystack.includes(query);
  });

  const prontas = rows.filter((guia) => guia.status === "pronta").length;
  const semValidar = rows.filter((guia) => !guia.validado_em).length;
  const comBloqueio = rows.filter((guia) => (errorByGuide.get(guia.id)?.erros ?? 0) > 0).length;
  const valor = rows.reduce((sum, guia) => sum + Number(guia.valor_total ?? 0), 0);
  const tipos = [...new Set(rows.map((guia) => String(guia.tipo_guia)).filter(Boolean))].sort();
  const statuses = [...new Set(rows.map((guia) => String(guia.status)).filter(Boolean))].sort();

  return <SectionPage
    eyebrow="Ciclo da Receita / TISS"
    title="Central de Guias TISS"
    description="Localize guias por paciente, RA, operadora ou número; veja críticas antes de formar lotes e abra o detalhe somente quando precisar intervir."
    actions={<Link href="/faturamento/lotes" className="ui-button-primary">Formar lote <ArrowRight className="size-4" /></Link>}
  >
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Kpi icon={FileCheck2} label="Guias carregadas" value={String(rows.length)} detail={brl(valor)} />
      <Kpi icon={CheckCircle2} label="Prontas" value={String(prontas)} detail="Elegibilidade operacional" tone="success" />
      <Kpi icon={AlertTriangle} label="Sem validação" value={String(semValidar)} detail="Executar consistência" tone="warning" />
      <Kpi icon={ShieldAlert} label="Com bloqueios" value={String(comBloqueio)} detail="Críticas impeditivas" tone="danger" />
    </section>

    <section className="his-card mt-5 overflow-hidden">
      <div className="border-b border-slate-100 p-4 sm:p-5">
        <form className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_220px_auto]">
          <label className="relative"><Search className="absolute left-3 top-3 size-4 text-slate-400" /><input name="q" defaultValue={q ?? ""} className="ui-input pl-9" placeholder="Guia, paciente, RA, registro ou operadora..." /></label>
          <select name="status" defaultValue={status ?? ""} className="ui-input"><option value="">Todos os status</option>{statuses.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select>
          <select name="tipo" defaultValue={tipo ?? ""} className="ui-input"><option value="">Todos os tipos</option>{tipos.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select>
          <button className="ui-button-secondary">Filtrar</button>
        </form>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1050px] text-left text-sm">
          <thead className="bg-slate-50 text-[11px] font-black uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Guia / Paciente</th><th className="px-4 py-3">Operadora</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Validação</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Valor</th><th className="px-4 py-3 text-right">Ação</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length ? filtered.map((guia) => {
              const paciente = one(guia.paciente);
              const convenio = one(guia.convenio);
              const resumo = errorByGuide.get(guia.id) ?? { erros: 0, alertas: 0 };
              return <tr key={guia.id} className="transition hover:bg-slate-50/80">
                <td className="px-4 py-4"><p className="font-black text-slate-900">Guia {guia.numero_guia_prestador ?? "—"}</p><p className="mt-1 text-xs text-slate-500">{paciente?.nome_completo ?? "Paciente"} · RA {paciente?.ra ?? "—"} · Registro #{paciente?.numero_registro ?? "—"}</p>{guia.numero_guia_operadora ? <p className="mt-1 text-[11px] text-slate-400">Operadora: {guia.numero_guia_operadora}</p> : null}</td>
                <td className="px-4 py-4"><p className="font-semibold text-slate-800">{convenio?.nome_fantasia ?? "—"}</p><p className="mt-1 text-xs text-slate-400">ANS {convenio?.registro_ans ?? "—"}</p></td>
                <td className="px-4 py-4 capitalize text-slate-600">{String(guia.tipo_guia).replaceAll("_", " ")}</td>
                <td className="px-4 py-4">{!guia.validado_em ? <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-700">Pendente</span> : resumo.erros ? <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-black text-rose-700">{resumo.erros} bloqueio(s)</span> : resumo.alertas ? <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-700">{resumo.alertas} alerta(s)</span> : <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700">Sem bloqueios</span>}</td>
                <td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-black capitalize ${statusStyle[String(guia.status)] ?? "bg-slate-100 text-slate-600"}`}>{String(guia.status).replaceAll("_", " ")}</span></td>
                <td className="px-4 py-4 text-right font-black text-slate-900">{brl(Number(guia.valor_total ?? 0))}</td>
                <td className="px-4 py-4 text-right"><Link href={`/faturamento/guias/${guia.id}`} className="inline-flex items-center gap-1 font-black text-brand-700 hover:underline">Abrir <ArrowRight className="size-4" /></Link></td>
              </tr>;
            }) : <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-500">Nenhuma guia encontrada.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  </SectionPage>;
}

function Kpi({ icon: Icon, label, value, detail, tone = "default" }: { icon: typeof FileCheck2; label: string; value: string; detail: string; tone?: "default" | "success" | "warning" | "danger" }) {
  const tones = { default: "bg-brand-50 text-brand-700", success: "bg-emerald-50 text-emerald-700", warning: "bg-amber-50 text-amber-700", danger: "bg-rose-50 text-rose-700" };
  return <div className="his-kpi"><div className="flex items-center justify-between"><span className={`grid size-10 place-items-center rounded-xl ${tones[tone]}`}><Icon className="size-5" /></span><span className="text-2xl font-black text-slate-950">{value}</span></div><p className="mt-3 text-xs font-black uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-[11px] font-semibold text-slate-500">{detail}</p></div>;
}
