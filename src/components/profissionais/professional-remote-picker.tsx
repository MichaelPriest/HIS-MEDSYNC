"use client";

import { Search, Stethoscope, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type ProfessionalSearchResult = {
  id: string;
  nome_completo: string;
  conselho: string | null;
  numero_conselho: string | null;
  uf_conselho: string | null;
  especialidade: string | null;
  cbo: string | null;
  cpf_mascarado: string | null;
};

type Props = {
  empresaId: string;
  name: string;
  label?: string;
  required?: boolean;
  placeholder?: string;
  value?: ProfessionalSearchResult | null;
  onChange?: (value: ProfessionalSearchResult | null) => void;
};

function conselhoLabel(item: ProfessionalSearchResult) {
  return [item.conselho, item.numero_conselho, item.uf_conselho].filter(Boolean).join(" ") || "Conselho não informado";
}

export function ProfessionalRemotePicker({
  empresaId,
  name,
  label = "Profissional",
  required = false,
  placeholder = "Buscar por nome, CPF, conselho, nº do conselho, especialidade ou CBO",
  value,
  onChange,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [selected, setSelected] = useState<ProfessionalSearchResult | null>(value ?? null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProfessionalSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSelected(value ?? null);
  }, [value]);

  useEffect(() => {
    if (selected) return;
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }

    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      const { data, error: searchError } = await supabase.rpc("buscar_profissionais_operacionais", {
        p_empresa: empresaId,
        p_busca: term,
        p_limite: 30,
      });
      if (!active) return;
      setLoading(false);
      if (searchError) {
        setResults([]);
        setError("Não foi possível pesquisar profissionais agora.");
        return;
      }
      setResults((Array.isArray(data) ? data : []) as ProfessionalSearchResult[]);
    }, 260);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [empresaId, query, selected, supabase]);

  function choose(item: ProfessionalSearchResult) {
    setSelected(item);
    setQuery("");
    setResults([]);
    onChange?.(item);
  }

  function clear() {
    setSelected(null);
    setQuery("");
    setResults([]);
    onChange?.(null);
  }

  return <div className="relative space-y-2">
    <input type="hidden" name={name} value={selected?.id ?? ""} required={required} />
    <label className="block text-sm font-medium text-slate-700">
      <span>{label}{required ? " *" : ""}</span>
      {selected ? (
        <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-emerald-700 shadow-sm"><Stethoscope className="size-4" /></span>
              <div className="min-w-0">
                <strong className="block truncate text-sm text-slate-900">{selected.nome_completo}</strong>
                <p className="mt-1 text-xs text-slate-600">{conselhoLabel(selected)}{selected.especialidade ? ` · ${selected.especialidade}` : ""}</p>
                <p className="mt-1 text-xs text-slate-500">{selected.cbo ? `CBO ${selected.cbo}` : "CBO não informado"}{selected.cpf_mascarado ? ` · CPF ${selected.cpf_mascarado}` : ""}</p>
              </div>
            </div>
            <button type="button" onClick={clear} className="rounded-lg border border-emerald-200 bg-white p-2 text-emerald-700 hover:bg-emerald-100" aria-label={`Trocar ${label.toLowerCase()}`}><X className="size-3.5" /></button>
          </div>
        </div>
      ) : (
        <div className="relative mt-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={placeholder} className="ui-input pl-9" autoComplete="off" />
        </div>
      )}
    </label>

    {!selected ? <p className="text-xs text-slate-400">Pesquise com pelo menos 2 caracteres. CPF é usado apenas para localizar e aparece mascarado.</p> : null}
    {loading ? <p className="text-xs font-medium text-brand-600">Pesquisando profissionais…</p> : null}
    {error ? <p className="text-xs font-medium text-rose-600">{error}</p> : null}

    {!selected && query.trim().length >= 2 && !loading ? <div className="absolute z-40 mt-1 max-h-80 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
      <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{results.length} resultado(s)</div>
      {results.map((item) => <button key={item.id} type="button" onClick={() => choose(item)} className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left hover:bg-slate-50">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"><Stethoscope className="size-4" /></span>
        <span className="min-w-0">
          <strong className="block truncate text-sm text-slate-900">{item.nome_completo}</strong>
          <span className="mt-1 block text-xs text-slate-600">{conselhoLabel(item)}{item.especialidade ? ` · ${item.especialidade}` : ""}</span>
          <span className="mt-1 block text-xs text-slate-500">{item.cbo ? `CBO ${item.cbo}` : "CBO não informado"}{item.cpf_mascarado ? ` · CPF ${item.cpf_mascarado}` : ""}</span>
        </span>
      </button>)}
      {!results.length ? <p className="px-3 py-5 text-center text-sm text-slate-500">Nenhum profissional encontrado.</p> : null}
    </div> : null}
  </div>;
}
