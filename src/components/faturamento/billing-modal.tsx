"use client";

import { X } from "lucide-react";
import { useEffect, useId, useState, type ReactNode } from "react";

type BillingModalProps = {
  title: string;
  description?: string;
  trigger: ReactNode;
  triggerClassName?: string;
  children: ReactNode;
  size?: "md" | "lg" | "xl";
};

const widths = {
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

export function BillingModal({
  title,
  description,
  trigger,
  triggerClassName = "ui-button-primary",
  children,
  size = "lg",
}: BillingModalProps) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return <>
    <button type="button" className={triggerClassName} onClick={() => setOpen(true)}>{trigger}</button>
    {open ? (
      <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm" onMouseDown={() => setOpen(false)}>
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description ? descriptionId : undefined}
          className={`max-h-[90vh] w-full overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl ${widths[size]}`}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
            <div>
              <h2 id={titleId} className="text-lg font-black text-slate-950">{title}</h2>
              {description ? <p id={descriptionId} className="mt-1 text-sm text-slate-500">{description}</p> : null}
            </div>
            <button type="button" onClick={() => setOpen(false)} className="grid size-9 shrink-0 place-items-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900" aria-label="Fechar modal">
              <X className="size-5" />
            </button>
          </header>
          <div className="max-h-[calc(90vh-82px)] overflow-y-auto p-5 sm:p-6">{children}</div>
        </section>
      </div>
    ) : null}
  </>;
}
