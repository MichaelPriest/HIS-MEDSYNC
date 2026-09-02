"use client";

import type { ReactNode } from "react";
import { useActionState, useEffect, useRef } from "react";
import { CheckCircle2, CircleAlert, Loader2 } from "lucide-react";
import {
  acionarProcedimentoCirurgicoBackground,
  movimentarPosOperatorioParaAlaBackground,
  registrarOpmeBackground,
  salvarChecklistCirurgicoBackground,
  transicionarCirurgiaBackground,
  vincularCicloCmeBackground,
  type SurgicalActionState,
} from "@/modules/centro-cirurgico/background-actions";

type SurgicalActionKind = "transition" | "checklist" | "opme" | "cme-link" | "move" | "procedure-action";

type Props = {
  kind: SurgicalActionKind;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
};

const INITIAL_STATE: SurgicalActionState = { status: "idle" };
const actions = {
  transition: transicionarCirurgiaBackground,
  checklist: salvarChecklistCirurgicoBackground,
  opme: registrarOpmeBackground,
  "cme-link": vincularCicloCmeBackground,
  move: movimentarPosOperatorioParaAlaBackground,
  "procedure-action": acionarProcedimentoCirurgicoBackground,
} as const;

type SurgicalServerAction = (
  state: SurgicalActionState,
  formData: FormData,
) => Promise<SurgicalActionState>;

export function SurgicalBackgroundForm({ kind, children, className, resetOnSuccess = false }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const action: SurgicalServerAction = actions[kind];
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);

  useEffect(() => {
    if (resetOnSuccess && state.status === "success") formRef.current?.reset();
  }, [resetOnSuccess, state.status]);

  return (
    <form ref={formRef} action={formAction} className={className} aria-busy={pending}>
      <div className={pending ? "pointer-events-none opacity-75" : undefined}>{children}</div>
      <SurgicalActionFeedback state={state} pending={pending} />
    </form>
  );
}

export function SurgicalActionFeedback({ state, pending }: { state: SurgicalActionState; pending: boolean }) {
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
