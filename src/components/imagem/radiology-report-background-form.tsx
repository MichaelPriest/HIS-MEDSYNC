"use client";

import type { Route } from "next";
import type { ReactNode } from "react";
import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, CircleAlert, Loader2 } from "lucide-react";
import {
  abrirLaudoImagemBackground,
  abrirRetificacaoLaudoImagemBackground,
  liberarLaudoImagemBackground,
  registrarCriticidadeLaudoImagemBackground,
  salvarLaudoImagemBackground,
  type RadiologyReportActionState,
} from "@/modules/assistencial/imagem-laudo-background-actions";

type ReportActionKind = "save" | "critical" | "release" | "rectify";

type Props = {
  kind: ReportActionKind;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
};

const INITIAL_STATE: RadiologyReportActionState = { status: "idle" };
const actions = {
  save: salvarLaudoImagemBackground,
  critical: registrarCriticidadeLaudoImagemBackground,
  release: liberarLaudoImagemBackground,
  rectify: abrirRetificacaoLaudoImagemBackground,
} as const;

type ReportServerAction = (
  state: RadiologyReportActionState,
  formData: FormData,
) => Promise<RadiologyReportActionState>;

export function RadiologyReportBackgroundForm({ kind, children, className, resetOnSuccess = false }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const action: ReportServerAction = actions[kind];
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);

  useEffect(() => {
    if (resetOnSuccess && state.status === "success") formRef.current?.reset();
  }, [resetOnSuccess, state.status]);

  return (
    <form ref={formRef} action={formAction} className={className} aria-busy={pending}>
      <div className={pending ? "pointer-events-none opacity-75" : undefined}>{children}</div>
      <ReportFeedback state={state} pending={pending} />
    </form>
  );
}

export function OpenRadiologyReportForm({ children, className }: { children: ReactNode; className?: string }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(abrirLaudoImagemBackground, INITIAL_STATE);

  useEffect(() => {
    const redirectTo = state.status === "success" ? state.data?.redirectTo : undefined;
    if (redirectTo) router.push(redirectTo as Route);
  }, [router, state]);

  return (
    <form action={formAction} className={className} aria-busy={pending}>
      <div className={pending ? "pointer-events-none opacity-75" : undefined}>{children}</div>
      <ReportFeedback state={state} pending={pending} compact />
    </form>
  );
}

function ReportFeedback({ state, pending, compact = false }: { state: RadiologyReportActionState; pending: boolean; compact?: boolean }) {
  const spacing = compact ? "mt-2" : "mt-3";
  if (pending) {
    return (
      <div className={`${spacing} flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-900`} aria-live="polite">
        <Loader2 className="size-4 animate-spin" /> Salvando…
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div className={`${spacing} flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800`} aria-live="polite">
        <CircleAlert className="mt-0.5 size-4 shrink-0" />
        <span>{state.message}{state.detail ? <span className="mt-1 block font-normal">{state.detail}</span> : null}</span>
      </div>
    );
  }
  if (state.status === "success") {
    return (
      <div className={`${spacing} flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800`} aria-live="polite">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
        <span>{state.message ?? "Operação concluída."}</span>
      </div>
    );
  }
  return null;
}
