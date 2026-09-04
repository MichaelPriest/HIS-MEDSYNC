"use client";

import { Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Result = { item_id: string; tabela: string; codigo: string; descricao: string; categoria: string };

export function TussProcedurePicker({
  empresaId,
  suggestedCode = null,
  suggestedDescription = null,
}: {
  empresaId: string;
  suggestedCode?: string | null;
  suggestedDescription?: string | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [selected, setSelected] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const term = query.trim();
    if (selected || term.length < 2) {
      setResults([]);
      return;
    }
    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      const { data } = await supabase.rpc("buscar_tuss_admissao", { p_empresa: empresaId, p_busca: term, p_limite: 30 });
      if (!active) return;
      setLoading(false);
      setResults((Array.isArray(data) ? data : []) as Result[]);
    }, 260);
    return () => { active = false; window.clearTimeout(timer); };
  }, [empresaId, query, selected, supabase]);

  const code = selected?.codigo ?? suggestedCode ?? "";
  const description = selected?.descricao ?? suggestedDescription ?? "";
  const table = selected?.tabela ?? (code ? "22" : "");

  return (
    <div className="space-y-2 md:col-span-2 xl:col-span-3">
      <input type="hidden" name="codigo_tuss_principal" value={code} />
      <input type="hidden" name="descricao_tuss_principal" value={description} />
      <input type="hidden" name="tabela_tiss_principal" value={table} />
      <input type="hidden" name="item_assistencial_id_principal" value={selected?.item_id ?? ""} />
      <label className="space-y-2 text-sm font-medium text-slate-700">
        <span>Buscar procedimento</span>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(event)=>{setQuery(event.target.value);setSelected(null);}} className="ui-input pl-9" placeholder="Digite o código ou nome do procedimento" autoComplete="off" />
        </div>
      </label>
      {selected ? <div className="flex items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm"><div><strong className="text-emerald-900">{selected.codigo}</strong><span className="ml-2 text-xs text-emerald-700">Tabela {selected.tabela}</span><p className="mt-1 text-emerald-800">{selected.descricao}</p></div><button type="button" onClick={()=>{setSelected(null);setQuery("");}} className="rounded-lg p-1.5 text-emerald-700 hover:bg-white"><X className="size-4" /></button></div> : code ? <div className="rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm text-brand-900"><strong>{code}</strong><p className="mt-1 text-brand-800">{description || "Código padrão sugerido para o regime selecionado."}</p><p className="mt-1 text-xs text-brand-600">Pode ser substituído por item contratado ou pacote na resolução contratual.</p></div> : null}
      {!selected && query.trim().length >= 2 ? <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-sm">{loading ? <p className="p-3 text-xs text-slate-500">Pesquisando…</p> : results.map((item)=><button key={`${item.item_id}-${item.codigo}`} type="button" onClick={()=>{setSelected(item);setQuery("");setResults([]);}} className="block w-full rounded-lg px-3 py-2 text-left hover:bg-slate-50"><strong className="text-sm text-slate-800">{item.codigo}</strong><span className="ml-2 text-xs text-slate-400">Tabela {item.tabela}</span><span className="block text-xs text-slate-600">{item.descricao}</span></button>)}{!loading && !results.length ? <p className="p-3 text-xs text-slate-500">Nenhum item cadastrado encontrado.</p> : null}</div> : null}
    </div>
  );
}
