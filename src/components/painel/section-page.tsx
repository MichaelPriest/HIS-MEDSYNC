import type { Route } from "next";
import Link from "next/link";

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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-slate-500">{eyebrow}</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">{title}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
        </div>
        {primaryActionLabel && primaryActionHref ? (
          <Link
            href={primaryActionHref}
            className="inline-flex items-center justify-center rounded-lg bg-brand-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-900"
          >
            {primaryActionLabel}
          </Link>
        ) : null}
      </div>

      {children ?? (
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-slate-900">Estrutura preparada</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Esta tela está pronta para receber os casos de uso e dados autorizados do módulo. Nenhum dado clínico fictício é exibido.
          </p>
        </section>
      )}
    </div>
  );
}
