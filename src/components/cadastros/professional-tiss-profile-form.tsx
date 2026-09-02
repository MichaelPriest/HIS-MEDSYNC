"use client";

import { Save, ShieldCheck } from "lucide-react";
import { useActionState } from "react";
import type { BackgroundActionState } from "@/lib/actions/background-action";
import {
  salvarHabilitacaoTissProfissional,
  type ProfessionalTissProfileData,
} from "@/modules/profissionais/tiss-background-actions";

const initialState: BackgroundActionState<ProfessionalTissProfileData> = { status: "idle" };

export function ProfessionalTissProfileForm({
  profissionalId,
  conselho,
  numeroConselho,
  ufConselho,
  especialidade,
  cbo,
}: {
  profissionalId: string;
  conselho: string | null;
  numeroConselho: string | null;
  ufConselho: string | null;
  especialidade: string | null;
  cbo: string | null;
}) {
  const action = salvarHabilitacaoTissProfissional.bind(null, profissionalId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const ready = state.status === "success" ? state.data?.ready === true : Boolean(conselho && numeroConselho && ufConselho && cbo);

  return <form action={formAction} className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${ready ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}><ShieldCheck className="size-4" /></span>
        <div><h3 className="font-black text-slate-900">Habilitação para TISS</h3><p className="mt-1 text-xs leading-5 text-slate-500">Preencha estes campos somente quando o profissional atuar como solicitante/executante regulatório. Perfis administrativos podem permanecer sem conselho/CBO.</p></div>
      </div>
      <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${ready ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{ready ? "Pronto TISS" : "Revisar"}</span>
    </div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <label className="space-y-1 text-xs font-semibold text-slate-600"><span>Conselho</span><input name="conselho" defaultValue={conselho ?? ""} className="ui-input uppercase" placeholder="Ex.: CRM" /></label>
      <label className="space-y-1 text-xs font-semibold text-slate-600"><span>Número do conselho</span><input name="numero_conselho" defaultValue={numeroConselho ?? ""} className="ui-input" /></label>
      <label className="space-y-1 text-xs font-semibold text-slate-600"><span>UF do conselho</span><input name="uf_conselho" maxLength={2} defaultValue={ufConselho ?? ""} className="ui-input uppercase" placeholder="SP" /></label>
      <label className="space-y-1 text-xs font-semibold text-slate-600"><span>CBO</span><input name="cbo" inputMode="numeric" maxLength={6} defaultValue={cbo ?? ""} className="ui-input" placeholder="6 dígitos" /></label>
      <label className="space-y-1 text-xs font-semibold text-slate-600 sm:col-span-2 xl:col-span-1"><span>Especialidade</span><input name="especialidade" defaultValue={especialidade ?? ""} className="ui-input" /></label>
    </div>
    <div aria-live="polite" className="mt-3 min-h-5 text-xs font-semibold">
      {pending ? <span className="text-brand-700">Salvando…</span> : null}
      {!pending && state.status === "error" ? <span className="text-rose-700">{state.message}</span> : null}
      {!pending && state.status === "success" ? <span className="text-emerald-700">{state.message}</span> : null}
    </div>
    <div className="mt-3 flex justify-end"><button disabled={pending} className="ui-button-primary disabled:cursor-not-allowed disabled:opacity-60"><Save className="size-4" />Salvar habilitação</button></div>
  </form>;
}
