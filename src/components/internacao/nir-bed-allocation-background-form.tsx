"use client";

import { useActionState } from "react";
import {
  alocarLeitoNir,
  type NirBedAllocationState,
} from "@/modules/internacao/nir-actions";

type BedOption = {
  id: string;
  label: string;
};

type Props = {
  internacaoId: string;
  beds: BedOption[];
};

const initialState: NirBedAllocationState = { status: "idle" };

export function NirBedAllocationBackgroundForm({ internacaoId, beds }: Props) {
  const [state, formAction, pending] = useActionState(alocarLeitoNir, initialState);

  return <form action={formAction} className="mt-4 grid gap-2">
    <fieldset disabled={pending} className="contents">
      <input type="hidden" name="internacao_id" value={internacaoId} />
      <select name="leito_id" required defaultValue="" className="ui-input">
        <option value="">Selecione o leito...</option>
        {beds.map((bed) => <option key={bed.id} value={bed.id}>{bed.label}</option>)}
      </select>
      <input name="motivo" className="ui-input" placeholder="Justificativa / observação do NIR" />
      <button disabled={!beds.length || pending} className="ui-button-primary disabled:cursor-not-allowed disabled:opacity-50">
        {pending ? "Salvando…" : "Alocar leito"}
      </button>
    </fieldset>

    <div aria-live="polite">
      {!pending && state.status === "success" ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">{state.message}</p> : null}
      {!pending && state.status === "error" ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{state.message}{state.detail ? <span className="ml-1 font-normal text-rose-500">({state.detail})</span> : null}</p> : null}
    </div>
  </form>;
}
