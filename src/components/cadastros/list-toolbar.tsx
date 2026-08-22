import { Search } from "lucide-react";

export function ListToolbar({ query, placeholder }: { query?: string; placeholder: string }) {
  return (
    <form method="get" className="flex w-full flex-col gap-2 sm:max-w-xl sm:flex-row">
      <label className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <input name="q" defaultValue={query} placeholder={placeholder} className="ui-input pl-9" />
      </label>
      <button type="submit" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Buscar</button>
      {query ? <a href="?" className="rounded-xl px-3 py-2.5 text-center text-sm font-medium text-slate-500 hover:bg-slate-50">Limpar</a> : null}
    </form>
  );
}

export function Pagination({ basePath, page, totalPages, query }: { basePath: string; page: number; totalPages: number; query?: string }) {
  if (totalPages <= 1) return null;
  const href = (target: number) => `${basePath}?${new URLSearchParams({ ...(query ? { q: query } : {}), page: String(target) }).toString()}`;

  return (
    <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4 text-sm">
      <span className="text-slate-500">Página {page} de {totalPages}</span>
      <div className="flex gap-2">
        {page > 1 ? <a href={href(page - 1)} className="rounded-xl border border-slate-200 px-3 py-2 font-medium text-slate-600 hover:bg-slate-50">Anterior</a> : null}
        {page < totalPages ? <a href={href(page + 1)} className="rounded-xl border border-slate-200 px-3 py-2 font-medium text-slate-600 hover:bg-slate-50">Próxima</a> : null}
      </div>
    </div>
  );
}
