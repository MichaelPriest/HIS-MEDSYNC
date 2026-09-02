import Link from "next/link";
import { ArrowRight, BadgeDollarSign, CheckCircle2, Clock3, Search, ShieldAlert } from "lucide-react";
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
  rascunho: "bg-slate-100 text-slate-700",
  aberto: "bg-blue-50 text-blue-700",
  enviado: "bg-brand-50 text-brand-700",
  em_analise: "bg-amber-50 text-amber-700",
  parcial: "bg-amber-50 text-amber-700",
  concluido: "bg-emerald-50 text-emerald-700",
  deferido: "bg-emerald-50 text-emerald-700",
  indeferido: "bg-rose-50 text-rose-700",
  cancelado: "bg-slate-100 text-slate-500",
};

export default async function RecursosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q, status } = await searchParams;
  const supabase = await createClient();
  const { data: recursos } = await supabase
    .from("tiss_recursos_glosa")
    .select("id,numero_recurso,numero_lote_recurso,status,valor_total_recursado,protocolo_operadora,enviado_em,retorno_em,created_at,convenio:convenios(nome_fantasia,registro_ans),itens:tiss_recurso_itens(valor_recursado,valor_deferido,valor_indeferido,glosa:tiss_glosas(codigo_glosa,guia:tiss_guias(numero_guia_prestador,paciente:pacientes(nome_completo,ra,numero_registro))))")
    .order("created_at", { ascending: false })
    .limit(300);

  const rows = recursos ?? [];
  const query = q?.trim().toLocaleLowerCase("pt-BR") ?? "";
  const statuses = [...new Set(rows.map((item) => String(item.status)).filter(Boolean))].sort();
  const filtered = rows.filter((recurso) => {
    if (status && recurso.status !== status) return false;
    if (!query) return true;
    const convenio = one(recurso.convenio);
    const itens = Array.isArray(recurso.itens) ? recurso.itens : [];
    const glosa = itens.length ? one(itens[0]?.glosa ?? null) : null;
    const guia = glosa ? one(glosa.guia) : null;
    const paciente = guia ? one(guia.paciente) : null;
    const haystack = `${recurso.numero_recurso ?? ""} ${recurso.protocolo_operadora ?? ""} ${convenio?.nome_fantasia ?? ""} ${guia?.numero_guia_prestador ?? ""} ${paciente?.nome_completo ?? ""} ${paciente?.ra ?? ""}`.toLocaleLowerCase("pt-BR");
    return haystack.includes(query);
  });

  const totalRecursado = rows.reduce((sum, recurso) => sum + Number(recurso.valor_total_recursado ?? 0), 0);
  const totalDeferido = rows.reduce((sum, recurso) => {
    const itens = Array.isArray(recurso.itens) ? recurso.itens : [];
    return sum + itens.reduce((acc, item) => acc + Number(item.valor_deferido ?? 0), 0);
  }, 0);
  const ativos = rows.filter((recurso) => !["concluido", "deferido", "indeferido", "cancelado"].includes(String(recurso.status))).length;
  const semRetorno = rows.filter((recurso) => recurso.enviado_em && !recurso.retorno_em).length;

  return <SectionPage
    eyebrow="Ciclo da Receita / Recuperação"
    title="Central de Recursos de Glosa"
    description="Acompanhe recursos por operadora, paciente, guia e protocolo; visualize recuperação de receita sem precisar abrir cada processo."
    actions={<Link href="/faturamento/glosas" className="ui-button-primary">Ver glosas elegíveis <ArrowRight className="size-4" /></Link>}
  >
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Kpi icon={BadgeDollarSign} label="Valor recursado" value={brl(totalRecursado)} detail={`${rows.length} recurso(s)`} />
      <Kpi icon={CheckCircle2} label="Valor deferido" value={brl(totalDeferido)} detail="Recuperação registrada" tone="success" />
      <Kpi icon={Clock3} label="Recursos ativos" value={String(ativos)} detail="Em elaboração ou análise" tone="warning" />
      <Kpi icon={ShieldAlert} label="Sem retorno" value={String(semRetorno)} detail="Enviados aguardando operadora" tone={semRetorno ? "danger" : "success"} />
    </section>

    <section className="his-card mt-5 overflow-hidden">
      <div className="border-b border-slate-100 p-4 sm:p-5">
        <form className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_240px_auto]">
          <label className="relative"><Search className="absolute left-3 top-3 size-4 text-slate-400" /><input name="q" defaultValue={q ?? ""} className="ui-input pl-9" placeholder="Recurso, protocolo, guia, paciente, RA ou operadora..." /></label>
          <select name="status" defaultValue={status ?? ""} className="ui-input"><option value="">Todos os status</option>{statuses.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select>
          <button className="ui-button-secondary">Filtrar</button>
        </form>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="bg-slate-50 text-[11px] font-black uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Recurso / Paciente</th><th className="px-4 py-3">Operadora</th><th className="px-4 py-3">Protocolo</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Recursado</th><th className="px-4 py-3 text-right">Deferido</th><th className="px-4 py-3">Envio / Retorno</th><th className="px-4 py-3 text-right">Ação</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length ? filtered.map((recurso) => {
              const convenio = one(recurso.convenio);
              const itens = Array.isArray(recurso.itens) ? recurso.itens : [];
              const primeiro = itens[0];
              const glosa = primeiro ? one(primeiro.glosa) : null;
              const guia = glosa ? one(glosa.guia) : null;
              const paciente = guia ? one(guia.paciente) : null;
              const deferido = itens.reduce((sum, item) => sum + Number(item.valor_deferido ?? 0), 0);
              return <tr key={recurso.id} className="transition hover:bg-slate-50/80">
                <td className="px-4 py-4"><p className="font-black text-slate-900">{recurso.numero_recurso ?? `Recurso ${recurso.id.slice(0, 8)}`}</p><p className="mt-1 text-xs text-slate-500">{paciente?.nome_completo ?? "Paciente"} · RA {paciente?.ra ?? "—"} · Guia {guia?.numero_guia_prestador ?? "—"}</p>{glosa?.codigo_glosa ? <p className="mt-1 text-[11px] font-semibold text-rose-600">Glosa {glosa.codigo_glosa}</p> : null}</td>
                <td className="px-4 py-4"><p className="font-semibold text-slate-800">{convenio?.nome_fantasia ?? "—"}</p><p className="mt-1 text-xs text-slate-400">ANS {convenio?.registro_ans ?? "—"}</p></td>
                <td className="px-4 py-4 text-slate-600">{recurso.protocolo_operadora ?? "—"}</td>
                <td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-black capitalize ${statusStyle[String(recurso.status)] ?? "bg-slate-100 text-slate-600"}`}>{String(recurso.status).replaceAll("_", " ")}</span></td>
                <td className="px-4 py-4 text-right font-black text-slate-900">{brl(Number(recurso.valor_total_recursado ?? 0))}</td>
                <td className="px-4 py-4 text-right font-black text-emerald-700">{brl(deferido)}</td>
                <td className="px-4 py-4 text-xs text-slate-500"><p>Envio: {fmt(recurso.enviado_em)}</p><p className="mt-1">Retorno: {fmt(recurso.retorno_em)}</p></td>
                <td className="px-4 py-4 text-right"><Link href={`/faturamento/recursos/${recurso.id}`} className="inline-flex items-center gap-1 font-black text-brand-700 hover:underline">Abrir <ArrowRight className="size-4" /></Link></td>
              </tr>;
            }) : <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-500">Nenhum recurso encontrado.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  </SectionPage>;
}

function Kpi({ icon: Icon, label, value, detail, tone = "default" }: { icon: typeof BadgeDollarSign; label: string; value: string; detail: string; tone?: "default" | "success" | "warning" | "danger" }) {
  const tones = { default: "bg-brand-50 text-brand-700", success: "bg-emerald-50 text-emerald-700", warning: "bg-amber-50 text-amber-700", danger: "bg-rose-50 text-rose-700" };
  return <div className="his-kpi"><div className="flex items-center justify-between gap-3"><span className={`grid size-10 shrink-0 place-items-center rounded-xl ${tones[tone]}`}><Icon className="size-5" /></span><span className="text-xl font-black text-slate-950">{value}</span></div><p className="mt-3 text-xs font-black uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-[11px] font-semibold text-slate-500">{detail}</p></div>;
}
