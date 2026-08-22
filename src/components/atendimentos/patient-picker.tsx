"use client";

import { Search, UserRound } from "lucide-react";
import { useMemo, useState } from "react";

type PatientOption = {
  id: string;
  nome_completo: string;
  cpf: string | null;
  ra: string;
  numero_registro: number;
};

export function PatientPicker({
  patients,
  name,
  value,
  onChange,
}: {
  patients: PatientOption[];
  name: string;
  value: string;
  onChange: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!normalized) return patients.slice(0, 30);
    const digits = normalized.replace(/\D/g, "");
    return patients.filter((item) => {
      return item.nome_completo.toLowerCase().includes(normalized)
        || item.ra.toLowerCase().includes(normalized)
        || String(item.numero_registro).includes(normalized)
        || Boolean(digits && item.cpf?.includes(digits));
    }).slice(0, 50);
  }, [patients, normalized]);

  const selected = patients.find((item) => item.id === value) ?? null;

  return <div className="space-y-3">
    <input type="hidden" name={name} value={value} />
    <label className="space-y-2 text-sm font-medium text-slate-700">
      <span>Localizar paciente *</span>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} className="ui-input pl-9" placeholder="Digite nome, CPF, RA ou registro..." />
      </div>
    </label>
    {selected ? <div className="flex items-center gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-3"><span className="grid size-10 place-items-center rounded-xl bg-white text-brand-700"><UserRound className="size-5" /></span><div className="min-w-0"><div className="truncate text-sm font-semibold text-slate-900">{selected.nome_completo}</div><div className="text-xs text-slate-500">{selected.ra} · Registro #{selected.numero_registro}{selected.cpf ? ` · CPF ${selected.cpf}` : ""}</div></div></div> : null}
    <div className="max-h-64 overflow-y-auto rounded-2xl border border-slate-200 bg-white">
      {filtered.length ? filtered.map((item) => <button key={item.id} type="button" onClick={() => { onChange(item.id); setQuery(item.nome_completo); }} className={`flex w-full items-start gap-3 border-b border-slate-100 px-4 py-3 text-left last:border-b-0 hover:bg-slate-50 ${value === item.id ? "bg-brand-50" : ""}`}><span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500"><UserRound className="size-4" /></span><span className="min-w-0"><span className="block truncate text-sm font-medium text-slate-900">{item.nome_completo}</span><span className="block text-xs text-slate-500">{item.ra} · Registro #{item.numero_registro}{item.cpf ? ` · CPF ${item.cpf}` : ""}</span></span></button>) : <div className="p-5 text-center text-sm text-slate-500">Nenhum paciente localizado.</div>}
    </div>
  </div>;
}
