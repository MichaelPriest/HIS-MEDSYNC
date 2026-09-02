"use client";

import { useActionState } from "react";
import type { ReactNode } from "react";
import {
  consumirSuprimentoCirurgicoBackground,
  estornarConsumoCirurgicoBackground,
  receberSuprimentosCirurgicosBackground,
  requisitarSuprimentosCirurgicosBackground,
  type SurgicalSupplyActionState,
} from "@/modules/centro-cirurgico/suprimentos-background-actions";

type SurgicalSupplyKind = "request" | "receive" | "consume" | "reverse";

type Props = {
  kind: SurgicalSupplyKind;
  className?: string;
  children: ReactNode;
};

const initialState: SurgicalSupplyActionState = { status: "idle" };

const actions = {
  request: requisitarSuprimentosCirurgicosBackground,
  receive: receberSuprimentosCirurgicosBackground,
  consume: consumirSuprimentoCirurgicoBackground,
  reverse: estornarConsumoCirurgicoBackground,
} satisfies Record<SurgicalSupplyKind, (previousState: SurgicalSupplyActionState, formData: FormData) => Promise<SurgicalSupplyActionState>>;

export function SurgicalSupplyBackgroundForm({ kind, className, children }: Props) {
  const [state, formAction, pending] = useActionState(actions[kind], initialState);

  return <form action={formAction} className={className}>
    <fieldset disabled={pending} className="contents">
      {children}
    </fieldset>
    <div className="col-span-full basis-full" aria-live="polite">
      {pending ? <p className="mt-2 text-xs font-black text-brand-700">Salvando…</p> : null}
      {!pending && state.status === "success" ? <p className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">{state.message}</p> : null}
      {!pending && state.status === "error" ? <p className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{state.message}{state.detail ? <span className="ml-1 font-normal text-rose-500">({state.detail})</span> : null}</p> : null}
    </div>
  </form>;
}
