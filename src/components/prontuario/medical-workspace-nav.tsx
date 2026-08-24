import Link from "next/link";
import type { Route } from "next";
import { Activity, ClipboardCheck, HeartPulse, LayoutDashboard, Pill } from "lucide-react";

type MedicalWorkspaceNavProps = {
  atendimentoId: string;
  active: "resumo" | "clinico" | "prescricao";
};

const items = [
  { key: "resumo", label: "Resumo", icon: LayoutDashboard, path: (id: string) => `/prontuario/${id}` },
  { key: "clinico", label: "Anamnese e evolução", icon: ClipboardCheck, path: (id: string) => `/prontuario/${id}/clinico` },
  { key: "prescricao", label: "Prescrição", icon: Pill, path: (id: string) => `/prontuario/${id}/prescricao` },
] as const;

export function MedicalWorkspaceNav({ atendimentoId, active }: MedicalWorkspaceNavProps) {
  return (
    <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 hidden items-center gap-2 px-2 text-[10px] font-black uppercase tracking-[.14em] text-slate-400 md:inline-flex">
          <Activity className="size-3.5 text-brand-600" /> Atendimento médico
        </span>
        {items.map((item) => {
          const Icon = item.icon;
          const selected = active === item.key;
          return (
            <Link
              key={item.key}
              href={item.path(atendimentoId) as Route}
              aria-current={selected ? "page" : undefined}
              className={`inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-bold transition ${selected ? "bg-brand-700 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}
            >
              <Icon className="size-4" />{item.label}
            </Link>
          );
        })}
        <Link
          href={`/assistencial/urgencia?atendimento=${atendimentoId}` as Route}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-bold text-rose-700 transition hover:bg-rose-50"
        >
          <HeartPulse className="size-4" />Urgência
        </Link>
      </div>
    </div>
  );
}
