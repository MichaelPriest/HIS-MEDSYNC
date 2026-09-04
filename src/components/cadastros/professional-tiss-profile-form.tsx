"use client";

import { Save, ShieldCheck } from "lucide-react";
import { useActionState } from "react";
import { ProfessionalRegulatoryFields } from "@/components/cadastros/professional-regulatory-fields";
import type { BackgroundActionState } from "@/lib/actions/background-action";
import type { RegulatoryOption } from "@/modules/cadastros/regulatory-domains";
import {
  salvarHabilitacaoTissProfissional,
  type ProfessionalTissProfileData,
} from "@/modules/profissionais/tiss-background-actions";

const initialState: BackgroundActionState<ProfessionalTissProfileData> = { status: "idle" };

export function ProfessionalTissProfileForm({
  profissionalId,
  numeroConselho,
  ufConselho,
  cbo,
  codigoConselhoAns,
  habilitadoTiss,
  cboOptions,
  councilOptions,
  sourceVersion,
}: {
  profissionalId: string;
  numeroConselho: string | null;
  ufConselho: string | null;
  cbo: string | null;
  codigoConselhoAns: string | null;
  habilitadoTiss: boolean;
  cboOptions: RegulatoryOption[];
  councilOptions: RegulatoryOption[];
  sourceVersion: string;
}) {
  const action = salvarHabilitacaoTissProfissional.bind(null, profissionalId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const ready = state.status === "success" ? state.data?.ready === true : habilitadoTiss;

  return <form action={formAction} className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${ready ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}><ShieldCheck className="size-4" /></span>
        <div><h3 className="font-black text-slate-900">Habilitação para TISS</h3><p className="mt-1 text-xs leading-5 text-slate-500">CBO, conselho e UF usam domínios padronizados. A especialidade/ocupação é derivada do CBO oficial e não precisa ser digitada.</p></div>
      </div>
      <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${ready ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{ready ? "Pronto TISS" : "Não habilitado"}</span>
    </div>

    <ProfessionalRegulatoryFields
      cboOptions={cboOptions}
      councilOptions={councilOptions}
      defaultEnabled={habilitadoTiss}
      defaultCbo={cbo}
      defaultCouncilCode={codigoConselhoAns}
      defaultCouncilNumber={numeroConselho}
      defaultUf={ufConselho}
      disabled={pending}
      sourceVersion={sourceVersion}
    />

    <div aria-live="polite" className="mt-3 min-h-5 text-xs font-semibold">
      {pending ? <span className="text-brand-700">Salvando…</span> : null}
      {!pending && state.status === "error" ? <span className="text-rose-700">{state.message}</span> : null}
      {!pending && state.status === "success" ? <span className="text-emerald-700">{state.message}</span> : null}
    </div>
    <div className="mt-3 flex justify-end"><button disabled={pending} className="ui-button-primary disabled:cursor-not-allowed disabled:opacity-60"><Save className="size-4" />Salvar habilitação</button></div>
  </form>;
}
