"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

export function PlanSections() {
  const [items, setItems] = useState([{ id: 0 }]);
  const [nextId, setNextId] = useState(1);

  return <div className="space-y-4">
    <div><h3 className="font-semibold text-slate-900">Planos da operadora</h3><p className="mt-1 text-sm text-slate-500">Cadastre os planos que poderão ser selecionados na admissão do paciente.</p></div>
    {items.map((item, index) => <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
      <div className="mb-3 flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Plano {index + 1}</span><button type="button" disabled={items.length === 1} onClick={() => setItems((current) => current.filter((row) => row.id !== item.id))} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"><Trash2 className="size-4" /></button></div>
      <div className="grid gap-4 md:grid-cols-3">
        <label className="space-y-2 text-sm font-medium text-slate-700"><span>Nome do plano {index === 0 ? "*" : ""}</span><input name={`planos[${item.id}].nome`} className="ui-input" /></label>
        <label className="space-y-2 text-sm font-medium text-slate-700"><span>Código</span><input name={`planos[${item.id}].codigo`} className="ui-input" /></label>
        <label className="space-y-2 text-sm font-medium text-slate-700"><span>Acomodação</span><input name={`planos[${item.id}].acomodacao`} className="ui-input" placeholder="Enfermaria, apartamento..." /></label>
      </div>
    </div>)}
    <button type="button" onClick={() => { setItems((current) => [...current, { id: nextId }]); setNextId((value) => value + 1); }} className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:text-brand-900"><Plus className="size-4" /> Adicionar plano</button>
  </div>;
}
