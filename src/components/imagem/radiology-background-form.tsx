"use client";

import type { ReactNode } from "react";
import { useActionState, useEffect, useRef } from "react";
import { CheckCircle2, CircleAlert, Loader2 } from "lucide-react";
import {
  agendarImagemBackground,
  atualizarAgendaImagemBackground,
  concluirExecucaoImagemBackground,
  iniciarExecucaoImagemBackground,
  registrarContrasteImagemBackground,
  registrarDoseImagemBackground,
  type RadiologyActionState,
} from "@/modules/assistencial/imagem-background-actions";

type RadiologyActionKind = "schedule" | "schedule-status" | "start" | "finish" | "contrast" | "dose";

type Props = {
  kind: RadiologyActionKind;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
};

const INITIAL_STATE: RadiologyActionState = { status: "idle" };
const actions = {
  schedule: agendarImagemBackground,
  "schedule-status": atualizarAgendaImagemBackground,
  start: iniciarExecucaoImagemBackground,
  finish: concluirExecucaoImagemBackground,
  contrast: registrarContrasteImagemBackground,
  dose: registrarDoseImagemBackground,
} as const;

type RadiologyServerAction = (
  state: RadiologyActionState,
  formData: FormData,
) => Promise<RadiologyActionState>;

export function RadiologyBackgroundForm({ kind, children, className, resetOnSuccess = false }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const action: RadiologyServerAction = actions[kind];
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);

  useEffect(() => {
    if (resetOnSuccess && state.status === "success") formRef.current?.reset();
  }, [resetOnSuccess, state]);

  return (
    <form ref={formRef} action={formAction} className={className} aria-busy={pending}>
      <div className={pending ? "pointer-events-none opacity-75" : undefined}>{children}</div>
      <RadiologyActionFeedback state={state} pending={pending} />
    </form>
  );
}

function RadiologyActionFeedback({ state, pending }: { state: RadiologyActionState; pending: boolean }) {
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
        <span>{state.message}{state.detail ? <span className="mt-1 block font-normal">{state.detail}</span> : null}</span>
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
