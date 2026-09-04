"use client";

import type { Route } from "next";
import Link from "next/link";
import {
  BadgeDollarSign,
  Banknote,
  Boxes,
  CircleDollarSign,
  FileCheck2,
  LayoutDashboard,
  ListChecks,
  ReceiptText,
  ScrollText,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { usePathname } from "next/navigation";

type BillingWorkspaceItem = {
  href: Route;
  label: string;
  detail: string;
  icon: LucideIcon;
  exact?: boolean;
};

const items: BillingWorkspaceItem[] = [
  { href: "/faturamento", label: "Central", detail: "Pendências e indicadores", icon: LayoutDashboard, exact: true },
  { href: "/faturamento/contas", label: "Contas", detail: "Relação e filtros", icon: ListChecks },
  { href: "/faturamento/producao", label: "Produção", detail: "Fatos assistenciais", icon: ScrollText },
  { href: "/faturamento/guias", label: "Guias TISS", detail: "Validação e envio", icon: FileCheck2 },
  { href: "/faturamento/lotes", label: "Lotes", detail: "Fechamento TISS", icon: Boxes },
  { href: "/faturamento/glosas", label: "Glosas", detail: "Análise de perdas", icon: CircleDollarSign },
  { href: "/faturamento/recursos", label: "Recursos", detail: "Recuperação de receita", icon: BadgeDollarSign },
  { href: "/financeiro/recebiveis", label: "Recebíveis", detail: "Previsão e baixa", icon: WalletCards },
  { href: "/financeiro/notas-fiscais", label: "Notas fiscais", detail: "NFS-e e documentos", icon: ReceiptText },
  { href: "/financeiro", label: "Financeiro", detail: "Conciliação e caixa", icon: Banknote, exact: true },
];

export function BillingWorkspaceNav() {
  const pathname = usePathname();

  return <div className="border-b border-slate-200 bg-white/95 backdrop-blur">
    <div className="mx-auto w-full max-w-[1680px] px-4 py-3 sm:px-6 lg:px-8">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.16em] text-brand-600">Ciclo da Receita</p>
          <p className="mt-0.5 text-sm font-black text-slate-900">Faturamento hospitalar</p>
          <p className="text-xs font-semibold text-slate-500">Conta → produção → TISS → glosa → recebimento</p>
        </div>
        <Link href="/manual" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-brand-700 shadow-sm transition hover:border-brand-200 hover:bg-brand-50">Ajuda do módulo</Link>
      </div>
      <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Navegação do ciclo da receita">
        {items.map((item) => {
          const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return <Link
            key={item.href}
            href={item.href}
            className={`group flex min-w-[142px] shrink-0 items-center gap-2.5 rounded-2xl border px-3 py-2.5 transition ${active ? "border-brand-600 bg-brand-600 text-white shadow-sm" : "border-slate-200 bg-white text-slate-700 hover:border-brand-200 hover:bg-brand-50/60"}`}
          >
            <span className={`grid size-8 shrink-0 place-items-center rounded-xl ${active ? "bg-white/15" : "bg-slate-100 text-slate-600 group-hover:bg-brand-100 group-hover:text-brand-700"}`}><Icon className="size-4" /></span>
            <span className="min-w-0"><strong className="block truncate text-xs">{item.label}</strong><span className={`mt-0.5 block truncate text-[10px] font-semibold ${active ? "text-white/75" : "text-slate-400"}`}>{item.detail}</span></span>
          </Link>;
        })}
      </nav>
    </div>
  </div>;
}
