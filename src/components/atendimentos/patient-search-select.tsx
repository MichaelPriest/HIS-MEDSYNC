"use client";

import { Search, UserRound } from "lucide-react";
import { useMemo, useState } from "react";

type Patient = { id: string; nome_completo: string; cpf: string | null; numero_registro: number; ra: string };

export function PatientSearchSelect({ patients }: { patients: Patient[] }) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [open, setOpen] = useState(false);
  const selected = patients.find((p) => p.id === selectedId);
  const normalized = query.trim().toLowerCase().replace(/\D/g, "");
  const results = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return patients.slice(0, 20);
    return patients.filter((p) => {
      const cpf = p.cpf?.replace(/\D/g, "") ?? "";
      return p.nome_completo.toLowerCase().includes(text) || p.ra.toLowerCase().includes(text) || String(p.numero_registro).includes(text) || (!!normalized && cpf.includes(normalized));
    }).slice(0, 30);
  }, [patients, query, normalized]);

  return <div className="relative md:col-span-2">
    <label className="space-y-2 text-sm font-medium text-slate-700"><span>Paciente *</span><div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input value={selected ? `${selected.nome_completo} · ${selected.ra} · Reg. ${selected.numero_registro}` : query} onFocus={() => { setOpen(true); if (selected) { setSelectedId(""); setQuery(""); } }} onChange={(e) => { setQuery(e.target.value); setSelectedId(""); setOpen(true); }} placeholder="Digite nome, CPF, RA ou número de registro" className="ui-input pl-9" autoComplete="off" /></div></label>
    <input type="hidden" name="paciente_id" value={selectedId} />
    {open ? <div className="absolute z-30 mt-2 max-h-72 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl"><div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{results.length} resultado(s)</div>{results.map((p) => <button key={p.id} type="button" onClick={() => { setSelectedId(p.id); setQuery(""); setOpen(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-slate-50"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"><UserRound className="size-4" /></span><span className="min-w-0"><strong className="block truncate text-sm text-slate-800">{p.nome_completo}</strong><span className="block text-xs text-slate-500">{p.ra} · Registro #{p.numero_registro}{p.cpf ? ` · CPF ${p.cpf}` : ""}</span></span></button>)}{!results.length ? <p className="px-3 py-5 text-center text-sm text-slate-500">Nenhum paciente encontrado.</p> : null}</div> : null}
  </div>;
}
