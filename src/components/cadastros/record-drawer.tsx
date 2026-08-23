"use client";

import { MoreHorizontal, X } from "lucide-react";
import { useState } from "react";

type Field = { label: string; value?: string | null };

export function RecordDrawer({
  title,
  subtitle,
  photoUrl,
  fields,
}: {
  title: string;
  subtitle?: string | null;
  photoUrl?: string | null;
  fields: Field[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={`Ver detalhes de ${title}`} className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition hover:-translate-y-0.5 hover:bg-slate-50 hover:text-slate-800 hover:shadow-sm active:translate-y-0 active:scale-95">
        <MoreHorizontal className="size-4" />
      </button>
      {open ? (
        <div className="fixed inset-0 z-[60]">
          <button type="button" aria-label="Fechar detalhes" onClick={() => setOpen(false)} className="ui-backdrop-enter absolute inset-0 bg-slate-950/35 backdrop-blur-[2px]" />
          <aside className="ui-slide-in-right absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto border-l border-slate-200 bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur">
              <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">Detalhes</p><h2 className="mt-1 font-semibold text-slate-950">Cadastro</h2></div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-xl p-2 text-slate-500 transition hover:rotate-90 hover:bg-slate-100"><X className="size-5" /></button>
            </div>
            <div className="ui-stagger p-5">
              <div className="flex items-center gap-4 rounded-2xl bg-slate-50 p-4">
                <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-brand-100 text-xl font-semibold text-brand-800" style={photoUrl ? { backgroundImage: `url(${photoUrl})`, backgroundPosition: "center", backgroundSize: "cover" } : undefined}>{photoUrl ? null : title.slice(0, 1).toUpperCase()}</span>
                <div className="min-w-0"><h3 className="truncate text-lg font-semibold text-slate-950">{title}</h3>{subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}<span className="mt-2 inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">Ativo</span></div>
              </div>
              <dl className="mt-5 divide-y divide-slate-100 rounded-2xl border border-slate-200">
                {fields.map((field) => <div key={field.label} className="grid grid-cols-[8rem_1fr] gap-3 px-4 py-3 transition hover:bg-slate-50"><dt className="text-xs font-medium text-slate-400">{field.label}</dt><dd className="break-words text-sm text-slate-700">{field.value || "—"}</dd></div>)}
              </dl>
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-800">Edição e inativação serão conectadas a este drawer na próxima etapa, mantendo o histórico e a auditoria do cadastro.</div>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
