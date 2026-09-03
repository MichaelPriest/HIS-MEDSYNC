import type { Route } from "next";
import Link from "next/link";
import {
  Building2,
  CalendarDays,
  CircleDollarSign,
  FileSearch,
  Filter,
  Hospital,
  Search,
  Stethoscope,
  WalletCards,
} from "lucide-react";
import { SectionPage } from "@/components/painel/section-page";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Rel<T> = T | T[] | null;
type Paciente = { nome_completo: string | null; ra: string | null; numero_registro: string | number | null };
type Atendimento = { numero_atendimento: string | number | null; tipo_atendimento: string | null; data_abertura: string | null; data_fechamento: string | null; status: string | null };
type Convenio = { id: string; nome_fantasia: string | null };
type Plano = { id: string; nome: string | null };
type Conta = {
  id: string;
  convenio_id: string | null;
  plano_id: string | null;
  competencia: string | null;
  tipo_cobranca: string | null;
  status: string;
  valor_bruto: number | string | null;
  valor_desconto: number | string | null;
  valor_liquido: number | string | null;
  updated_at: string | null;
  paciente: Rel<Paciente>;
  atendimento: Rel<Atendimento>;
  convenio: Rel<Convenio>;
  plano: Rel<Plano>;
};
type SearchParams = {
  q?: string;
  convenio?: string;
  plano?: string;
  competencia?: string;
  tipo?: string;
  status?: string;
  inicio?: string;
  fim?: string;
};

function one<T>(value: Rel<T>): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function money(value: number | string | null | undefined) {
  return Number(value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function date(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value));
}

function clean(value: string | undefined, max = 100) {
  return (value ?? "").replace(/[<>]/g, "").trim().slice(0, max);
}

function bucket(tipo: string | null | undefined) {
  const value = (tipo ?? "").toLocaleLowerCase("pt-BR");
  if (value.includes("intern")) return "internacao";
  if (value.includes("pronto") || value.includes("urg") || value.includes("emerg")) return "ps";
  return "ambulatorio";
}

function statusClass(status: string) {
  if (status === "com_criticas") return "bg-rose-50 text-rose-700";
  if (status === "pronta") return "bg-emerald-50 text-emerald-700";
  if (status === "faturada") return "bg-brand-50 text-brand-700";
  if (status === "cancelada") return "bg-slate-100 text-slate-500";
  if (status === "pre_faturamento") return "bg-blue-50 text-blue-700";
  return "bg-amber-50 text-amber-700";
}

function uniq<T extends { id: string; label: string }>(items: T[]) {
  const map = new Map<string, T>();
  for (const item of items) if (!map.has(item.id)) map.set(item.id, item);
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
}

export default async function RelacaoContasPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const qs = await searchParams;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contas_faturamento")
    .select("id,convenio_id,plano_id,competencia,tipo_cobranca,status,valor_bruto,valor_desconto,valor_liquido,updated_at,paciente:pacientes(nome_completo,ra,numero_registro),atendimento:atendimentos(numero_atendimento,tipo_atendimento,data_abertura,data_fechamento,status),convenio:convenios(id,nome_fantasia),plano:convenio_planos(id,nome)")
    .order("updated_at", { ascending: false })
    .limit(1000);

  if (error) console.error("[faturamento-contas] falha ao carregar contas", { code: error.code });
  const contas = (data ?? []) as unknown as Conta[];
  const q = clean(qs.q).toLocaleLowerCase("pt-BR");
  const convenioFiltro = clean(qs.convenio, 64);
  const planoFiltro = clean(qs.plano, 64);
  const competenciaFiltro = clean(qs.competencia, 7);
  const tipoFiltro = ["internacao", "ambulatorio", "ps"].includes(qs.tipo ?? "") ? qs.tipo ?? "" : "";
  const statusFiltro = clean(qs.status, 40);
  const inicio = /^\d{4}-\d{2}-\d{2}$/.test(qs.inicio ?? "") ? qs.inicio ?? "" : "";
  const fim = /^\d{4}-\d{2}-\d{2}$/.test(qs.fim ?? "") ? qs.fim ?? "" : "";

  const convenios = uniq(contas.flatMap((conta) => {
    const convenio = one(conta.convenio);
    return convenio ? [{ id: convenio.id, label: convenio.nome_fantasia ?? "Convênio" }] : [];
  }));
  const planos = uniq(contas.flatMap((conta) => {
    const plano = one(conta.plano);
    return plano ? [{ id: plano.id, label: plano.nome ?? "Plano" }] : [];
  }));
  const competencias = [...new Set(contas.map((conta) => conta.competencia).filter((value): value is string => Boolean(value)))].sort().reverse();
  const statuses = [...new Set(contas.map((conta) => conta.status))].sort();

  const filtradas = contas.filter((conta) => {
    const paciente = one(conta.paciente);
    const atendimento = one(conta.atendimento);
    const convenio = one(conta.convenio);
    const plano = one(conta.plano);
    const abertura = atendimento?.data_abertura?.slice(0, 10) ?? "";
    if (convenioFiltro && conta.convenio_id !== convenioFiltro) return false;
    if (planoFiltro && conta.plano_id !== planoFiltro) return false;
    if (competenciaFiltro && conta.competencia !== competenciaFiltro) return false;
    if (tipoFiltro && bucket(atendimento?.tipo_atendimento) !== tipoFiltro) return false;
    if (statusFiltro && conta.status !== statusFiltro) return false;
    if (inicio && abertura < inicio) return false;
    if (fim && abertura > fim) return false;
    if (!q) return true;
    const text = `${paciente?.nome_completo ?? ""} ${paciente?.ra ?? ""} ${paciente?.numero_registro ?? ""} ${atendimento?.numero_atendimento ?? ""} ${convenio?.nome_fantasia ?? ""} ${plano?.nome ?? ""} ${conta.competencia ?? ""}`.toLocaleLowerCase("pt-BR");
    return text.includes(q);
  });

  const totalBruto = filtradas.reduce((sum, conta) => sum + Number(conta.valor_bruto ?? 0), 0);
  const totalDesconto = filtradas.reduce((sum, conta) => sum + Number(conta.valor_desconto ?? 0), 0);
  const totalLiquido = filtradas.reduce((sum, conta) => sum + Number(conta.valor_liquido ?? 0), 0);
  const criticas = filtradas.filter((conta) => conta.status === "com_criticas").length;
  const grupos = (["internacao", "ambulatorio", "ps"] as const).map((tipo) => {
    const rows = filtradas.filter((conta) => bucket(one(conta.atendimento)?.tipo_atendimento) === tipo);
    return { tipo, count: rows.length, total: rows.reduce((sum, conta) => sum + Number(conta.valor_liquido ?? 0), 0) };
  });

  return <SectionPage
    eyebrow="Ciclo da Receita / Faturamento"
    title="Relação de contas"
    description="Consulta operacional densa para localizar, conferir e abrir contas por convênio, plano, competência, período e tipo de atendimento."
    actions={<Link href="/faturamento" className="ui-button-secondary">Voltar à central</Link>}
  >
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <Metric icon={FileSearch} label="Contas filtradas" value={String(filtradas.length)} detail={`${contas.length} carregadas`} />
      <Metric icon={CircleDollarSign} label="Valor bruto" value={money(totalBruto)} detail="Antes dos descontos" />
      <Metric icon={WalletCards} label="Descontos" value={money(totalDesconto)} detail="Descontos da conta" />
      <Metric icon={CircleDollarSign} label="Valor líquido" value={money(totalLiquido)} detail="Resultado da seleção" />
      <Metric icon={Filter} label="Com críticas" value={String(criticas)} detail="Exigem revisão" tone={criticas ? "danger" : "default"} />
    </section>

    <section className="his-card mt-5 overflow-hidden">
      <div className="border-b border-slate-100 p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div><p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-400">Filtros avançados</p><h2 className="mt-1 font-black text-slate-950">Localizar contas sem abrir telas em sequência</h2></div>
          <span className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600">Filtros preservam o histórico; nenhuma conta é alterada nesta tela.</span>
        </div>
        <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
          <label className="relative md:col-span-2"><Search className="absolute left-3 top-3 size-4 text-slate-400" /><input name="q" defaultValue={qs.q ?? ""} className="ui-input pl-9" placeholder="Paciente, RA, registro ou atendimento" /></label>
          <select name="convenio" defaultValue={convenioFiltro} className="ui-input"><option value="">Todos os convênios</option>{convenios.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
          <select name="plano" defaultValue={planoFiltro} className="ui-input"><option value="">Todos os planos</option>{planos.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
          <select name="competencia" defaultValue={competenciaFiltro} className="ui-input"><option value="">Todas as competências</option>{competencias.map((item) => <option key={item} value={item}>{item}</option>)}</select>
          <select name="tipo" defaultValue={tipoFiltro} className="ui-input"><option value="">Todos os atendimentos</option><option value="internacao">Internação</option><option value="ambulatorio">Ambulatório</option><option value="ps">Pronto-socorro / Urgência</option></select>
          <select name="status" defaultValue={statusFiltro} className="ui-input"><option value="">Todos os status</option>{statuses.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</select>
          <div className="grid grid-cols-2 gap-2"><input type="date" name="inicio" defaultValue={inicio} className="ui-input" title="Início do atendimento" /><input type="date" name="fim" defaultValue={fim} className="ui-input" title="Fim do atendimento" /></div>
          <div className="flex gap-2 md:col-span-2 2xl:col-span-8 2xl:justify-end"><Link href="/faturamento/contas" className="ui-button-secondary">Limpar</Link><button className="ui-button-primary"><Filter className="size-4" />Aplicar filtros</button></div>
        </form>
      </div>

      <div className="grid gap-px border-b border-slate-100 bg-slate-100 sm:grid-cols-3">
        {grupos.map((grupo) => <div key={grupo.tipo} className="bg-white px-5 py-4"><div className="flex items-center gap-2">{grupo.tipo === "internacao" ? <Hospital className="size-4 text-brand-700" /> : grupo.tipo === "ps" ? <Stethoscope className="size-4 text-rose-600" /> : <Building2 className="size-4 text-sky-700" />}<p className="text-xs font-black uppercase tracking-wide text-slate-500">{grupo.tipo === "internacao" ? "Internação" : grupo.tipo === "ps" ? "Pronto-socorro" : "Ambulatório"}</p></div><div className="mt-2 flex items-end justify-between gap-3"><strong className="text-xl text-slate-950">{grupo.count}</strong><span className="text-sm font-black text-slate-700">{money(grupo.total)}</span></div></div>)}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[1420px] w-full text-left text-xs">
          <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wide text-slate-500"><tr>
            <th className="px-4 py-3">Conta / paciente</th><th className="px-4 py-3">Atendimento</th><th className="px-4 py-3">Convênio / plano</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Competência</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Bruto</th><th className="px-4 py-3 text-right">Desconto</th><th className="px-4 py-3 text-right">Líquido</th><th className="px-4 py-3">Atualização</th><th className="px-4 py-3"></th>
          </tr></thead>
          <tbody className="divide-y divide-slate-100">
            {filtradas.length ? filtradas.map((conta) => {
              const paciente = one(conta.paciente);
              const atendimento = one(conta.atendimento);
              const convenio = one(conta.convenio);
              const plano = one(conta.plano);
              return <tr key={conta.id} className="align-top transition hover:bg-brand-50/35">
                <td className="px-4 py-3"><p className="font-black text-slate-950">{paciente?.nome_completo ?? "Paciente"}</p><p className="mt-1 text-[11px] text-slate-500">RA {paciente?.ra ?? "—"} · Registro {paciente?.numero_registro ?? "—"}</p></td>
                <td className="px-4 py-3"><p className="font-bold text-slate-800">#{atendimento?.numero_atendimento ?? "—"}</p><p className="mt-1 text-[11px] text-slate-500">{date(atendimento?.data_abertura)} → {date(atendimento?.data_fechamento)}</p></td>
                <td className="px-4 py-3"><p className="font-bold text-slate-800">{convenio?.nome_fantasia ?? (conta.tipo_cobranca === "particular" ? "Particular" : "Convênio")}</p><p className="mt-1 text-[11px] text-slate-500">{plano?.nome ?? "Sem plano"}</p></td>
                <td className="px-4 py-3 font-semibold text-slate-700">{atendimento?.tipo_atendimento ?? "—"}</td>
                <td className="px-4 py-3 font-mono font-bold text-slate-700">{conta.competencia ?? "—"}</td>
                <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${statusClass(conta.status)}`}>{conta.status.replaceAll("_", " ")}</span></td>
                <td className="px-4 py-3 text-right font-semibold text-slate-700">{money(conta.valor_bruto)}</td>
                <td className="px-4 py-3 text-right font-semibold text-slate-600">{money(conta.valor_desconto)}</td>
                <td className="px-4 py-3 text-right font-black text-slate-950">{money(conta.valor_liquido)}</td>
                <td className="px-4 py-3 text-slate-500"><span className="inline-flex items-center gap-1"><CalendarDays className="size-3.5" />{date(conta.updated_at)}</span></td>
                <td className="px-4 py-3 text-right"><Link href={`/faturamento/${conta.id}` as Route} className="ui-button-secondary">Abrir conta</Link></td>
              </tr>;
            }) : <tr><td colSpan={11} className="p-10 text-center text-sm text-slate-500">Nenhuma conta corresponde aos filtros selecionados.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  </SectionPage>;
}

function Metric({ icon: Icon, label, value, detail, tone = "default" }: { icon: typeof FileSearch; label: string; value: string; detail: string; tone?: "default" | "danger" }) {
  return <div className={`rounded-2xl border bg-white p-4 shadow-sm ${tone === "danger" ? "border-rose-200" : "border-slate-200"}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</p><p className="mt-2 truncate text-xl font-black text-slate-950">{value}</p><p className="mt-1 truncate text-[11px] font-semibold text-slate-500">{detail}</p></div><span className={`grid size-9 shrink-0 place-items-center rounded-xl ${tone === "danger" ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-700"}`}><Icon className="size-4" /></span></div></div>;
}
