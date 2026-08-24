import { ChevronDown, Plus } from "lucide-react";

export function ActionPanel({
  title,
  description,
  children,
  defaultOpen = false,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details open={defaultOpen} className="group his-card overflow-hidden">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-4 sm:px-5">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"><Plus className="size-4" /></span>
        <div className="min-w-0 flex-1">
          <h2 className="font-bold text-slate-900">{title}</h2>
          {description ? <p className="mt-0.5 text-xs leading-5 text-slate-500">{description}</p> : null}
        </div>
        <ChevronDown className="size-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-slate-100 bg-slate-50/35 p-4 sm:p-5">{children}</div>
    </details>
  );
}
