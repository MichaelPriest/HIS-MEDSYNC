import type { Route } from "next";
import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";

type SectionPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  primaryActionLabel?: string;
  primaryActionHref?: Route;
  children?: React.ReactNode;
};

export function SectionPage({
  eyebrow,
  title,
  description,
  primaryActionLabel,
  primaryActionHref,
  children,
}: SectionPageProps) {
  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-900/[0.03] sm:p-7">
        <div className="absolute -right-16 -top-20 size-48 rounded-full bg-brand-100/50 blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">{eyebrow}</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">{title}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
          </div>
          {primaryActionLabel && primaryActionHref ? (
            <Link
              href={primaryActionHref}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-brand-900 hover:shadow-md"
            >
              <Plus className="size-4" />
              {primaryActionLabel}
              <ArrowRight className="size-4 opacity-70" />
            </Link>
          ) : null}
        </div>
      </section>

      {children ?? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-900/[0.03]">
          <h2 className="font-semibold text-slate-900">Estrutura preparada</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Esta tela está pronta para receber os casos de uso e dados autorizados do módulo. Nenhum dado clínico fictício é exibido.
          </p>
        </section>
      )}
    </div>
  );
}
