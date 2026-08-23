"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";

type Encounter = {
  id: string;
  numero_atendimento: string | number | null;
  data_abertura?: string | null;
  paciente: {
    nome_completo: string;
    cpf?: string | null;
    ra?: string | null;
    numero_registro?: string | number | null;
  };
};

type EncounterPickerProps = {
  encounters: Encounter[];
  name: string;
  required?: boolean;
  defaultValue?: string;
};

function normalize(value: string | number | null | undefined) {
  return String(value ?? "").toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function formatCpf(value?: string | null) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length !== 11) return value || "—";
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

export function EncounterPicker({ encounters, name, required = true, defaultValue = "" }: EncounterPickerProps) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(defaultValue);

  const filtered = useMemo(() => {
    const term = normalize(query).trim();
    if (!term) return encounters.slice(0, 40);
    return encounters.filter((item) => {
      const p = item.paciente;
      const haystack = [p.nome_completo, p.cpf, p.ra, p.numero_registro, item.numero_atendimento].map(normalize).join(" ");
      return haystack.includes(term);
    }).slice(0, 40);
  }, [encounters, query]);

  const selected = encounters.find((item) => item.id === selectedId) ?? null;

  return <div className="space-y-3">
    <input type="hidden" name={name} value={selectedId} required={required} />
    <label className="block text-sm font-medium text-slate-700">
      <span>Atendimento {required ? "*" : ""}</span>
      <div className="relative mt-2">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar por nome, CPF, RA, registro ou nº atendimento"
          className="ui-input pl-9"
          autoComplete="off"
        />
      </div>
    </label>

    {selected ? <div className="rounded-xl border border-brand-200 bg-brand-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-brand-950">{selected.paciente.nome_completo}</p>
          <p className="mt-1 text-xs text-brand-800">Atendimento #{selected.numero_atendimento ?? "—"} · RA {selected.paciente.ra ?? "—"} · Registro #{selected.paciente.numero_registro ?? "—"}</p>
          <p className="mt-1 text-xs text-brand-700">CPF {formatCpf(selected.paciente.cpf)}</p>
        </div>
        <button type="button" onClick={() => setSelectedId("")} className="rounded-lg border border-brand-200 bg-white px-3 py-1.5 text-xs font-semibold text-brand-800 hover:bg-brand-100">Trocar</button>
      </div>
    </div> : <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white">
      {filtered.length ? filtered.map((item) => <button
        key={item.id}
        type="button"
        onClick={() => { setSelectedId(item.id); setQuery(""); }}
        className="block w-full border-b border-slate-100 px-4 py-3 text-left transition last:border-b-0 hover:bg-slate-50"
      >
        <p className="font-medium text-slate-900">{item.paciente.nome_completo}</p>
        <p className="mt-1 text-xs text-slate-500">Atend. #{item.numero_atendimento ?? "—"} · RA {item.paciente.ra ?? "—"} · Registro #{item.paciente.numero_registro ?? "—"} · CPF {formatCpf(item.paciente.cpf)}</p>
      </button>) : <p className="p-4 text-sm text-slate-500">Nenhum atendimento encontrado.</p>}
    </div>}
  </div>;
}
