"use client";

import type { ReactNode } from "react";
import { useActionState, useEffect, useRef } from "react";
import { CheckCircle2, CircleAlert, Loader2 } from "lucide-react";
import type { BackgroundActionState } from "@/lib/actions/background-action";
import { registrarEvolucaoEnfermagemAction } from "@/modules/enfermagem/actions";

const INITIAL_STATE: BackgroundActionState = { status: "idle" };

function Feedback({ state, pending }: { state: BackgroundActionState; pending: boolean }) {
  if (pending) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-900" aria-live="polite">
        <Loader2 className="size-4 animate-spin" />
        Salvando…
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800" aria-live="polite">
        <CircleAlert className="mt-0.5 size-4 shrink-0" />
        <span>
          {state.message ?? "Não foi possível assinar a evolução."}
          {state.detail ? <span className="mt-1 block font-normal">{state.detail}</span> : null}
        </span>
      </div>
    );
  }

  if (state.status === "success" && state.message) {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800" aria-live="polite">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
        <span>{state.message}</span>
      </div>
    );
  }

  return null;
}

export function NursingEvolutionBackgroundForm({
  atendimentoId,
  children,
  className = "grid gap-3 border-t p-4 md:grid-cols-2",
  submitLabel = "Assinar evolução",
}: {
  atendimentoId: string;
  children: ReactNode;
  className?: string;
  submitLabel?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    registrarEvolucaoEnfermagemAction,
    INITIAL_STATE,
  );

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className={className} aria-busy={pending}>
      <input type="hidden" name="atendimento_id" value={atendimentoId} />
      <div className="md:col-span-2">
        <Feedback state={state} pending={pending} />
      </div>
      <fieldset disabled={pending} className="contents disabled:opacity-70">
        {children}
      </fieldset>
      <button className="ui-button-primary md:col-span-2 md:justify-self-end" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        {pending ? "Salvando…" : submitLabel}
      </button>
    </form>
  );
}
