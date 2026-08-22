"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

type AtendimentoOption = {
  id: string;
  numero_atendimento: number | null;
  data_abertura: string;
  paciente: {
    nome_completo: string;
    cpf: string | null;
    ra: string;
    numero_registro: number;
  } | null;
};

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function AtendimentoPicker({ name = "atendimento_id", atendimentos }: { name?: string; atendimentos: AtendimentoOption[] }) {
  const [query, setQuery] = useState("");
  const [value, setValue] = useState("");

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return atendimentos.slice(0, 30);
    return atendimentos.filter((item) => {
      const paciente = item.paciente;
      const text = [
        item.numero_atendimento ? String(item.numero_atendimento) : "",
        paciente?.nome_completo ?? "",
        paciente?.cpf ?? "",
        paciente?.ra ?? "",
        paciente?.numero_registro ? String(paciente.numero_registro) : "",
      ].join(" ");
      return normalize(text).includes(q);
    }).slice(0, 30);
  }, [atendimentos, query]);

  const selected = atendimentos.find((item) => item.id === value) ?? null;

  return <div className="space-y-3">
    <input type="hidden" name={name} value={value} />
    <label className="space-y-2 text-sm font-medium text-slate-700">
      <span>Atendimento *</span>
      <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="ui-input pl-9" placeholder="Buscar por nº atendimento, nome, CPF, RA ou registro..." /></div>
    </label>
    <div className="max-h-64 overflow-y-auto rounded-2xl border border-slate-200 bg-white">
      {filtered.length ? filtered.map((item) => {
        const paciente = item.paciente;
        const active = value === item.id;
        return <button key={item.id} type="button" onClick={() => { setValue(item.id); setQuery(paciente?.nome_completo ?? ""); }} className={`block w-full border-b border-slate-100 px-4 py-3 text-left last:border-b-0 ${active ? "bg-brand-50" : "hover:bg-slate-50"}`}>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1"><span className="font-semibold text-slate-900">{paciente?.nome_completo ?? "Paciente"}</span><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">Atend. #{item.numero_atendimento ?? "—"}</span></div>
          <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-slate-500"><span>Registro #{paciente?.numero_registro ?? "—"}</span><span>{paciente?.ra ?? "—"}</span><span>{new Date(item.data_abertura).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span></div>
        </button>;
      }) : <p className="p-4 text-sm text-slate-500">Nenhum atendimento localizado.</p>}
    </div>
    {selected ? <div className="rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-brand-950">Selecionado: <strong>{selected.paciente?.nome_completo ?? "Paciente"}</strong> · Atendimento #{selected.numero_atendimento ?? "—"} · {selected.paciente?.ra ?? "—"}</div> : null}
  </div>;
}
