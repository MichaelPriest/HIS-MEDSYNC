"use client";

import { CheckCircle2, X } from "lucide-react";
import { useActionState, useMemo, useState } from "react";
import type { BackgroundActionState } from "@/lib/actions/background-action";
import {
  registrarRetornoRecursoBackground,
  type RecursoRetornoActionData,
} from "@/modules/tiss/recurso-background-actions";

const initialState: BackgroundActionState<RecursoRetornoActionData> = { status: "idle" };

export type RecursoRetornoItem = {
  id: string;
  label: string;
  valorRecursado: number;
  valorDeferido: number;
  valorIndeferido: number;
};

function brl(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function RecursoRetornoModal({ recursoId, items }: { recursoId: string; items: RecursoRetornoItem[] }) {
  const [open, setOpen] = useState(false);
  const itemIds = useMemo(() => items.map((item) => item.id), [items]);
  const action = registrarRetornoRecursoBackground.bind(null, recursoId, itemIds);
  const [state, formAction, pending] = useActionState(action, initialState);
  const defaultDate = new Date().toISOString().slice(0, 16);

  return <>
    <button type="button" onClick={() => setOpen(true)} className="ui-button-primary">
      <CheckCircle2 className="size-4" />Registrar retorno
    </button>

    {open ? <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) setOpen(false); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="recurso-retorno-title" className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white px-5 py-4">
          <div><h2 id="recurso-retorno-title" className="text-lg font-black text-slate-950">Registrar retorno da operadora</h2><p className="mt-1 text-sm text-slate-500">Informe somente os valores efetivamente analisados. O saldo restante continua pendente.</p></div>
          <button type="button" disabled={pending} onClick={() => setOpen(false)} className="grid size-9 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50" aria-label="Fechar"><X className="size-4" /></button>
        </div>

        <form action={formAction} className="space-y-5 p-5">
          <div className="grid gap-3 md:grid-cols-3">
            <label className="space-y-1 text-xs font-semibold text-slate-500"><span>Data/hora do retorno</span><input type="datetime-local" name="retorno_em" defaultValue={defaultDate} className="ui-input" /></label>
            <label className="space-y-1 text-xs font-semibold text-slate-500 md:col-span-2"><span>Protocolo da operadora</span><input name="protocolo_operadora" className="ui-input" placeholder="Número/protocolo do retorno" /></label>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-[820px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Item</th><th className="px-4 py-3 text-right">Recursado</th><th className="px-4 py-3 text-right">Já analisado</th><th className="px-4 py-3 text-right">Saldo</th><th className="px-4 py-3">Deferido agora</th><th className="px-4 py-3">Indeferido agora</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{items.map((item) => { const analisado=item.valorDeferido+item.valorIndeferido; const saldo=Math.max(item.valorRecursado-analisado,0); return <tr key={item.id} className="align-middle"><td className="px-4 py-3"><p className="font-semibold text-slate-900">{item.label}</p></td><td className="px-4 py-3 text-right">{brl(item.valorRecursado)}</td><td className="px-4 py-3 text-right">{brl(analisado)}</td><td className="px-4 py-3 text-right font-bold text-amber-700">{brl(saldo)}</td><td className="px-4 py-3"><input name={`deferido_${item.id}`} inputMode="decimal" defaultValue="0,00" className="ui-input min-w-28" aria-label={`Valor deferido ${item.label}`} /></td><td className="px-4 py-3"><input name={`indeferido_${item.id}`} inputMode="decimal" defaultValue="0,00" className="ui-input min-w-28" aria-label={`Valor indeferido ${item.label}`} /></td></tr>; })}</tbody>
            </table>
          </div>

          <label className="block space-y-1 text-xs font-semibold text-slate-500"><span>Observação</span><textarea name="observacao" className="ui-input min-h-24" placeholder="Motivo, referência do demonstrativo ou observação operacional" /></label>

          <div aria-live="polite" className="min-h-6 text-sm font-semibold">
            {pending ? <span className="text-brand-700">Registrando retorno…</span> : null}
            {!pending && state.status === "error" ? <span className="text-rose-700">{state.message}</span> : null}
            {!pending && state.status === "success" ? <span className="text-emerald-700">{state.message}</span> : null}
          </div>

          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" disabled={pending} onClick={() => setOpen(false)} className="ui-button-secondary disabled:opacity-50">Cancelar</button>
            <button disabled={pending} className="ui-button-primary disabled:cursor-not-allowed disabled:opacity-60"><CheckCircle2 className="size-4" />Confirmar retorno</button>
          </div>
        </form>
      </section>
    </div> : null}
  </>;
}
