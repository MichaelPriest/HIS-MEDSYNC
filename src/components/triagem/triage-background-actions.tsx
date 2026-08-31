"use client";

import type { ReactNode } from "react";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BellRing, CheckCircle2, CircleAlert, Loader2 } from "lucide-react";
import type { BackgroundActionState } from "@/lib/actions/background-action";
import {
  chamarPacienteTriagem,
  registrarTriagem,
} from "@/modules/triagem/actions";

type TriageActionData = { redirectTo?: string };
type TriageActionState = BackgroundActionState<TriageActionData>;

const INITIAL_TRIAGE_STATE: TriageActionState = { status: "idle" };

function Feedback({ state, pending }: { state: TriageActionState; pending: boolean }) {
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
          {state.message ?? "Não foi possível concluir a operação."}
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

export function TriageCallAction({
  atendimentoId,
  chamado,
}: {
  atendimentoId: string;
  chamado: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    chamarPacienteTriagem,
    INITIAL_TRIAGE_STATE,
  );

  return (
    <form action={formAction} className="space-y-2" aria-busy={pending}>
      <input type="hidden" name="atendimento_id" value={atendimentoId} />
      <input type="hidden" name="ponto_atendimento" value="Sala de Triagem" />
      <button
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-bold text-sky-700 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={pending}
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <BellRing className="size-4" />}
        {pending ? "Chamando…" : chamado ? "Rechamar no painel" : "Chamar no painel"}
      </button>
      <Feedback state={state} pending={false} />
    </form>
  );
}

export function TriageBackgroundForm({
  atendimentoId,
  children,
}: {
  atendimentoId: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    registrarTriagem,
    INITIAL_TRIAGE_STATE,
  );

  useEffect(() => {
    if (state.status === "success" && state.data?.redirectTo) {
      router.push(state.data.redirectTo as never);
    }
  }, [router, state]);

  return (
    <form action={formAction} className="ui-card p-6" aria-busy={pending}>
      <input type="hidden" name="atendimento_id" value={atendimentoId} />
      <div className="mb-4">
        <Feedback state={state} pending={pending} />
      </div>
      <div className={pending ? "pointer-events-none opacity-80" : undefined}>
        {children}
      </div>
      <div className="mt-6 flex justify-end border-t border-slate-100 pt-5">
        <button className="ui-button-primary" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          {pending ? "Salvando…" : "Concluir triagem e encaminhar"}
        </button>
      </div>
    </form>
  );
}
