"use client";

import type { ReactNode } from "react";
import { useActionState } from "react";
import { CheckCircle2, CircleAlert, Loader2 } from "lucide-react";
import {
  assinarDocumentoGedBackground,
  atualizarStatusDocumentoGedBackground,
  type GedActionState,
} from "@/modules/ged/background-actions";

type GedGovernanceActionKind = "sign" | "status";

type Props = {
  kind: GedGovernanceActionKind;
  children: ReactNode;
  className?: string;
};

const INITIAL_STATE: GedActionState = { status: "idle" };
const actions = {
  sign: assinarDocumentoGedBackground,
  status: atualizarStatusDocumentoGedBackground,
} as const;

type GedServerAction = (
  state: GedActionState,
  formData: FormData,
) => Promise<GedActionState>;

export function GedGovernanceBackgroundForm({ kind, children, className }: Props) {
  const action: GedServerAction = actions[kind];
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);

  return (
    <form action={formAction} className={className} aria-busy={pending}>
      <div className={pending ? "pointer-events-none opacity-75" : undefined}>{children}</div>
      <GedGovernanceFeedback state={state} pending={pending} />
    </form>
  );
}

function GedGovernanceFeedback({ state, pending }: { state: GedActionState; pending: boolean }) {
  if (pending) {
    return (
      <div className="mt-2 flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-900" aria-live="polite">
        <Loader2 className="size-4 animate-spin" />
        Salvando…
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="mt-2 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800" aria-live="polite">
        <CircleAlert className="mt-0.5 size-4 shrink-0" />
        <span>
          {state.message}
          {state.detail ? <span className="mt-1 block font-normal">{state.detail}</span> : null}
        </span>
      </div>
    );
  }

  if (state.status === "success") {
    return (
      <div className="mt-2 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800" aria-live="polite">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
        <span>{state.message ?? "Operação concluída."}</span>
      </div>
    );
  }

  return null;
}
