"use client";

import Link from "next/link";
import type { Route } from "next";
import {
  ArrowUpRight,
  BookOpenCheck,
  Building2,
  CalendarClock,
  ClipboardList,
  HeartPulse,
  Stethoscope,
  TicketCheck,
  UsersRound,
} from "lucide-react";

type Metric = {
  label: string;
  value: number | null;
  helper: string;
  icon: "atendimentos" | "senhas" | "pacientes" | "profissionais";
};

type RecentAtendimento = {
  id: string;
  numero: number | string;
  paciente: string;
  tipo: string;
  status: string;
  data: string;
};

const metricStyle = {
  atendimentos: { Icon: HeartPulse, wrap: "bg-blue-50 text-blue-700", line: "from-blue-500 to-cyan-400" },
  senhas: { Icon: TicketCheck, wrap: "bg-violet-50 text-violet-700", line: "from-violet-500 to-fuchsia-400" },
  pacientes: { Icon: UsersRound, wrap: "bg-cyan-50 text-cyan-700", line: "from-cyan-500 to-sky-400" },
  profissionais: { Icon: Stethoscope, wrap: "bg-emerald-50 text-emerald-700", line: "from-emerald-500 to-teal-400" },
};

function statusClass(status: string) {
  if (status === "em_atendimento") return "bg-blue-50 text-blue-700 ring-blue-600/10";
  if (status === "em_espera") return "bg-amber-50 text-amber-700 ring-amber-600/10";
  if (status === "alta") return "bg-emerald-50 text-emerald-700 ring-emerald-600/10";
  if (status === "cancelado") return "bg-rose-50 text-rose-700 ring-rose-600/10";
  return "bg-slate-100 text-slate-600 ring-slate-500/10";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function DashboardTabs({
  metrics,
  recentAtendimentos,
  convenios,
  catalogos,
}: {
  metrics: Metric[];
  recentAtendimentos: RecentAtendimento[];
  convenios: number | null;
  catalogos: number | null;
}) {
  return (
    <div className="space-y-5">
      <section className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4 ui-stagger">
        {metrics.map((metric) => {
          const style = metricStyle[metric.icon];
          const Icon = style.Icon;
          return (
            <article key={metric.label} className="his-kpi group relative overflow-hidden">
              <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${style.line}`} />
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-slate-500">{metric.label}</p>
                  <p className="mt-2.5 text-[32px] font-bold leading-none tracking-tight text-slate-950">{metric.value ?? "—"}</p>
                </div>
                <span className={`grid size-11 shrink-0 place-items-center rounded-2xl ${style.wrap}`}><Icon className="size-5" /></span>
              </div>
              <p className="mt-4 text-xs leading-5 text-slate-500">{metric.value === null ? "Dado indisponível para este perfil." : metric.helper}</p>
            </article>
          );
        })}
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,.55fr)]">
        <article className="his-card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4.5 sm:px-6">
            <div>
              <p className="his-eyebrow">Operação assistencial</p>
              <h2 className="mt-1 text-lg font-bold text-slate-900">Atendimentos recentes</h2>
            </div>
            <Link href={"/atendimentos" as Route} className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-600 hover:text-brand-700">Ver todos <ArrowUpRight className="size-3.5" /></Link>
          </div>

          {recentAtendimentos.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead><tr><th className="px-5 py-3.5 sm:px-6">Atendimento</th><th className="px-5 py-3.5">Paciente</th><th className="px-5 py-3.5">Tipo</th><th className="px-5 py-3.5">Status</th><th className="px-5 py-3.5">Data</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {recentAtendimentos.map((item) => (
                    <tr key={item.id}>
                      <td className="px-5 py-4 font-bold text-brand-900 sm:px-6">#{item.numero}</td>
                      <td className="max-w-56 truncate px-5 py-4 font-semibold text-slate-800">{item.paciente}</td>
                      <td className="px-5 py-4 text-slate-500">{item.tipo}</td>
                      <td className="px-5 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ring-1 ring-inset ${statusClass(item.status)}`}>{item.status.replaceAll("_", " ")}</span></td>
                      <td className="whitespace-nowrap px-5 py-4 text-slate-500">{formatDate(item.data)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="p-10 text-center text-sm text-slate-500">Nenhum atendimento recente no escopo atual.</div>}
        </article>

        <aside className="space-y-5">
          <article className="his-card p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3"><div><p className="his-eyebrow">Base operacional</p><h2 className="mt-1 text-lg font-bold text-slate-900">Cadastros ativos</h2></div><span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700"><BookOpenCheck className="size-5" /></span></div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/70 p-4"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-white text-brand-700 shadow-sm"><Building2 className="size-4" /></span><span className="text-sm font-semibold text-slate-700">Convênios</span></div><strong className="text-lg text-slate-950">{convenios ?? "—"}</strong></div>
              <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/70 p-4"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-white text-cyan-700 shadow-sm"><BookOpenCheck className="size-4" /></span><span className="text-sm font-semibold text-slate-700">Catálogos</span></div><strong className="text-lg text-slate-950">{catalogos ?? "—"}</strong></div>
            </div>
          </article>

          <article className="overflow-hidden rounded-[20px] bg-[linear-gradient(145deg,#0b1f44_0%,#173273_100%)] p-5 text-white shadow-his-card sm:p-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-200/65">Acesso rápido</p>
            <h2 className="mt-1 text-lg font-bold">Fluxo operacional</h2>
            <div className="mt-5 grid grid-cols-2 gap-2.5">
              {[
                ["/senhas", "Recepção", TicketCheck],
                ["/atendimentos", "Atendimentos", ClipboardList],
                ["/agenda", "Agenda", CalendarClock],
                ["/pacientes", "Pacientes", UsersRound],
              ].map(([href, label, Icon]) => (
                <Link key={String(href)} href={href as Route} className="group rounded-2xl border border-white/10 bg-white/[0.065] p-3.5 hover:bg-white/[0.11]">
                  <Icon className="size-4.5 text-cyan-300" />
                  <p className="mt-3 text-xs font-semibold text-white/90">{String(label)}</p>
                  <ArrowUpRight className="mt-2 size-3.5 text-white/30 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-white/60" />
                </Link>
              ))}
            </div>
          </article>
        </aside>
      </section>
    </div>
  );
}
