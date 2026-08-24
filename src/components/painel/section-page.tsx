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
    <div className="ui-page-enter space-y-6">
      <section className="relative overflow-hidden rounded-[22px] border border-[#e4eaf2] bg-white px-5 py-5 shadow-his-card sm:px-6 sm:py-6">
        <div className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-cyan-400 via-brand-500 to-brand-700" />
        <div className="pointer-events-none absolute -right-20 -top-24 size-56 rounded-full bg-brand-100/55 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 right-28 size-44 rounded-full bg-cyan-100/45 blur-3xl" />

        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 ui-fade-up">
            <div className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-cyan-500" />
              <p className="his-eyebrow">{eyebrow}</p>
            </div>
            <h1 className="his-title mt-2">{title}</h1>
            <p className="his-muted mt-2 max-w-3xl text-sm leading-6">{description}</p>
          </div>

          {primaryActionLabel && primaryActionHref ? (
            <Link
              href={primaryActionHref}
              className="group inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-900 to-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-900/10 transition hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0 active:scale-[.985]"
            >
              <Plus className="size-4" />
              {primaryActionLabel}
              <ArrowRight className="size-4 opacity-70 transition-transform group-hover:translate-x-0.5" />
            </Link>
          ) : null}
        </div>
      </section>

      <div className="ui-stagger">
        {children ?? (
          <section className="his-card p-6">
            <h2 className="font-semibold text-slate-900">Estrutura preparada</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Esta tela está pronta para receber os casos de uso e dados autorizados do módulo.</p>
          </section>
        )}
      </div>
    </div>
  );
}
