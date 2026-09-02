"use client";

import Link from "next/link";
import {
  BadgeDollarSign,
  Banknote,
  Boxes,
  CircleDollarSign,
  FileCheck2,
  LayoutDashboard,
  ReceiptText,
  ScrollText,
  WalletCards,
} from "lucide-react";
import { usePathname } from "next/navigation";

const items = [
  { href: "/faturamento", label: "Visão geral", icon: LayoutDashboard, exact: true },
  { href: "/faturamento/producao", label: "Produção", icon: ScrollText },
  { href: "/faturamento/guias", label: "Guias TISS", icon: FileCheck2 },
  { href: "/faturamento/lotes", label: "Lotes", icon: Boxes },
  { href: "/faturamento/glosas", label: "Glosas", icon: CircleDollarSign },
  { href: "/faturamento/recursos", label: "Recursos", icon: BadgeDollarSign },
  { href: "/financeiro/recebiveis", label: "Recebíveis", icon: WalletCards },
  { href: "/financeiro/notas-fiscais", label: "Notas fiscais", icon: ReceiptText },
  { href: "/financeiro", label: "Financeiro", icon: Banknote, exact: true },
] as const;

export function BillingWorkspaceNav() {
  const pathname = usePathname();

  return <div className="border-b border-slate-200 bg-white/95 backdrop-blur">
    <div className="mx-auto w-full max-w-[1680px] px-4 py-3 sm:px-6 lg:px-8">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.16em] text-brand-600">Ciclo da Receita</p>
          <p className="text-xs font-semibold text-slate-500">Faturamento · TISS · Glosas · Recebimento</p>
        </div>
        <Link href="/manual" className="text-xs font-bold text-brand-700 hover:underline">Ajuda do módulo</Link>
      </div>
      <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Navegação do ciclo da receita">
        {items.map((item) => {
          const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return <Link
            key={item.href}
            href={item.href}
            className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-black transition ${active ? "bg-brand-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-950"}`}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>;
        })}
      </nav>
    </div>
  </div>;
}
