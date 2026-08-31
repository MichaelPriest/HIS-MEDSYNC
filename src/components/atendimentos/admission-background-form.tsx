"use client";

import type { ComponentProps } from "react";
import { useActionState } from "react";
import { CircleAlert, Loader2 } from "lucide-react";
import { AdmissionForm } from "@/components/atendimentos/admission-form";
import {
  INITIAL_BACKGROUND_ACTION_STATE,
  type BackgroundActionState,
} from "@/lib/actions/background-action";

type AdmissionAction = (
  previousState: BackgroundActionState,
  formData: FormData,
) => Promise<BackgroundActionState>;

type Props = Omit<ComponentProps<typeof AdmissionForm>, "action"> & {
  action: AdmissionAction;
};

export function AdmissionBackgroundForm({ action, ...props }: Props) {
  const [state, formAction, pending] = useActionState(
    action,
    INITIAL_BACKGROUND_ACTION_STATE,
  );

  return (
    <div className="space-y-3" aria-busy={pending}>
      <div aria-live="polite" aria-atomic="true">
        {pending ? (
          <div className="flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-900">
            <Loader2 className="size-4 animate-spin" />
            Salvando…
          </div>
        ) : null}
        {!pending && state.status === "error" ? (
          <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
            <CircleAlert className="mt-0.5 size-4 shrink-0" />
            <span>{state.message ?? "Não foi possível concluir a admissão."}</span>
          </div>
        ) : null}
      </div>

      <div className={pending ? "pointer-events-none opacity-80" : undefined}>
        <AdmissionForm action={formAction} {...props} />
      </div>
    </div>
  );
}
