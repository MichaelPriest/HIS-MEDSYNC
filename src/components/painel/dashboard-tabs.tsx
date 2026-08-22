"use client";

import { useState } from "react";
import { BookOpenCheck, Building2, CircleCheck, Database, ShieldCheck, Stethoscope, UsersRound } from "lucide-react";

type Metric = {
  label: string;
  value: number | null;
  helper: string;
  icon: "pacientes" | "profissionais" | "convenios" | "catalogos";
};

const icons = {
  pacientes: UsersRound,
  profissionais: Stethoscope,
  convenios: Building2,
  catalogos: BookOpenCheck,
};

export function DashboardTabs({ metrics }: { metrics: Metric[] }) {
  const [tab, setTab] = useState<"resumo" | "implantacao">("resumo");

  return (
    <div className="space-y-5">
      <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm" role="tablist" aria-label="Visões do dashboard">
        <button
          role="tab"
          aria-selected={tab === "resumo"}
          onClick={() => setTab("resumo")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${tab === "resumo" ? "bg-brand-950 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"}`}
        >
          Resumo
        </button>
        <button
          role="tab"
          aria-selected={tab === "implantacao"}
          onClick={() => setTab("implantacao")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${tab === "implantacao" ? "bg-brand-950 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"}`}
        >
          Implantação
        </button>
      </div>

      {tab === "resumo" ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => {
              const Icon = icons[metric.icon];
              return (
                <article key={metric.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/[0.03] transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-slate-500">{metric.label}</p>
                      <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{metric.value ?? "—"}</p>
                    </div>
                    <span className="grid size-11 place-items-center rounded-2xl bg-brand-50 text-brand-700">
                      <Icon className="size-5" />
                    </span>
                  </div>
                  <p className="mt-4 text-xs leading-5 text-slate-500">{metric.value === null ? "Dados indisponíveis para este usuário ou migration ainda não aplicada." : metric.helper}</p>
                </article>
              );
            })}
          </section>

          <section className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/[0.03]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">Cadastros mestres</p>
                  <h2 className="mt-1 text-lg font-semibold text-slate-950">Fundação administrativa do HIS</h2>
                </div>
                <Database className="size-5 text-slate-400" />
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {[
                  ["Pacientes", "Identificação, documentos e contatos"],
                  ["Profissionais", "Conselhos, CBO e especialidades"],
                  ["Convênios", "Operadoras e registro ANS"],
                  ["Catálogos", "Domínios assistenciais centralizados"],
                ].map(([title, description]) => (
                  <div key={title} className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-800"><CircleCheck className="size-4 text-emerald-600" />{title}</div>
                    <p className="mt-1 pl-6 text-xs leading-5 text-slate-500">{description}</p>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-gradient-to-br from-brand-950 to-brand-800 p-5 text-white shadow-sm">
              <span className="grid size-10 place-items-center rounded-xl bg-white/10"><ShieldCheck className="size-5" /></span>
              <h2 className="mt-5 text-lg font-semibold">Segurança por padrão</h2>
              <p className="mt-2 text-sm leading-6 text-white/65">As telas continuam respeitando autenticação, vínculos de empresa e políticas RLS definidas no Supabase.</p>
              <div className="mt-5 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/60">Nenhum indicador clínico fictício é exibido no painel.</div>
            </article>
          </section>
        </>
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-900/[0.03]">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">Roadmap</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">Próximas frentes da implantação</h2>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {["Atendimento / ADT", "Agenda e recepção", "Triagem", "Prontuário"].map((item, index) => (
              <div key={item} className="rounded-xl border border-slate-200 p-4">
                <span className="text-xs font-semibold text-slate-400">0{index + 1}</span>
                <p className="mt-3 text-sm font-semibold text-slate-800">{item}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">Módulo previsto para os próximos marcos funcionais do HIS.</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
