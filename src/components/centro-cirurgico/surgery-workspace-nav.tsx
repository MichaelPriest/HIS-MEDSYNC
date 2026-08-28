"use client";

import Link from "next/link";
import type { Route } from "next";
import { Activity, Boxes, CalendarClock, ListChecks, Monitor, PackageSearch, Scissors, ShieldCheck } from "lucide-react";
import { usePathname } from "next/navigation";

type NavigationItem = {
  href: Route;
  label: string;
  icon: typeof Scissors;
  exact?: boolean;
};

export const surgeryWorkspaceItems: NavigationItem[] = [
  { href: "/assistencial/centro-cirurgico", label: "Central Cirúrgica", icon: Scissors, exact: true },
  { href: "/assistencial/centro-cirurgico/agendadas", label: "Cirurgias agendadas", icon: CalendarClock },
  { href: "/assistencial/centro-cirurgico/em-andamento", label: "Em andamento", icon: Activity },
  { href: "/assistencial/centro-cirurgico/painel-salas", label: "Painel de Salas", icon: Monitor },
  { href: "/assistencial/centro-cirurgico/procedimentos", label: "Procedimentos e Equipe", icon: ListChecks },
  { href: "/assistencial/centro-cirurgico/equipamentos", label: "Prontidão", icon: ShieldCheck },
  { href: "/assistencial/centro-cirurgico/suprimentos", label: "Suprimentos / OPME", icon: PackageSearch },
  { href: "/assistencial/centro-cirurgico/cme", label: "CME", icon: Boxes },
] as const;

export function SurgeryWorkspaceNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Bloco Cirúrgico" className="mb-5 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm print:hidden">
      <div className="flex flex-wrap gap-1.5">
        {surgeryWorkspaceItems.map((item) => {
          const selected = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          const Icon = item.icon;
          return <Link key={item.href} href={item.href} aria-current={selected ? "page" : undefined} className={`inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-bold transition ${selected ? "bg-brand-700 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}><Icon className="size-4" />{item.label}</Link>;
        })}
      </div>
    </nav>
  );
}
