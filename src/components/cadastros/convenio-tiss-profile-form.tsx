"use client";

import { Save, ShieldCheck } from "lucide-react";
import { useActionState } from "react";
import type { BackgroundActionState } from "@/lib/actions/background-action";
import { salvarIdentificacaoTissConvenio, type ConvenioTissProfileData } from "@/modules/convenios/tiss-background-actions";

const initialState: BackgroundActionState<ConvenioTissProfileData> = { status: "idle" };
const onlyDigits = (value: string | null) => String(value ?? "").replace(/\D/g, "");

export function ConvenioTissProfileForm({ convenioId, registroAns, cnpj }: { convenioId: string; registroAns: string | null; cnpj: string | null }) {
  const action = salvarIdentificacaoTissConvenio.bind(null, convenioId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const ready = state.status === "success" ? state.data?.ready === true : onlyDigits(registroAns).length === 6;
  return <form action={formAction} className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3"><span className={`grid size-9 shrink-0 place-items-center rounded-xl ${ready ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}><ShieldCheck className="size-4" /></span><div><h3 className="font-black text-slate-900">Identificação TISS da operadora</h3><p className="mt-1 text-xs text-slate-500">Use o registro ANS da operadora. Não substitua por código interno, contrato ou CNPJ.</p></div></div>
      <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${ready ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{ready ? "Pronto TISS" : "Revisar"}</span>
    </div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <label className="space-y-1 text-xs font-semibold text-slate-600"><span>Registro ANS *</span><input name="registro_ans" inputMode="numeric" maxLength={6} required defaultValue={registroAns ?? ""} className="ui-input" placeholder="6 dígitos" /></label>
      <label className="space-y-1 text-xs font-semibold text-slate-600"><span>CNPJ</span><input name="cnpj" inputMode="numeric" defaultValue={cnpj ?? ""} className="ui-input" /></label>
    </div>
    <div aria-live="polite" className="mt-3 min-h-5 text-xs font-semibold">{pending ? <span className="text-brand-700">Salvando…</span> : state.status === "error" ? <span className="text-rose-700">{state.message}</span> : state.status === "success" ? <span className="text-emerald-700">{state.message}</span> : null}</div>
    <div className="mt-3 flex justify-end"><button disabled={pending} className="ui-button-primary disabled:opacity-60"><Save className="size-4" />Salvar identificação</button></div>
  </form>;
}
