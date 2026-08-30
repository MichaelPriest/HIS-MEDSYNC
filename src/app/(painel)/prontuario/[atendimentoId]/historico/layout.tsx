"use client";

import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

export default function HistoricoLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ atendimentoId: string }>;
}) {
  const pathname = usePathname();
  const match = pathname.match(/\/prontuario\/([^/]+)\/historico/);
  const atendimentoId = match?.[1] ?? "";
  const base = `/prontuario/${atendimentoId}/historico`;
  const sla = `${base}/sla`;

  return (
    <div className="space-y-4">
      <nav aria-label="Histórico longitudinal" className="flex flex-wrap gap-2 px-1 print:hidden">
        <Link
          href={base as Route}
          className={`rounded-lg border px-3 py-2 text-sm font-semibold ${pathname === base ? "border-brand-700 bg-brand-50 text-brand-800" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
        >
          Histórico clínico
        </Link>
        <Link
          href={sla as Route}
          className={`rounded-lg border px-3 py-2 text-sm font-semibold ${pathname.startsWith(sla) ? "border-brand-700 bg-brand-50 text-brand-800" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
        >
          SLA da Urgência
        </Link>
      </nav>
      {children}
    </div>
  );
}
