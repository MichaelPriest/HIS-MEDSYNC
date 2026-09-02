"use client";

import { RefreshCw } from "lucide-react";
import { useActionState } from "react";
import type { BackgroundActionState } from "@/lib/actions/background-action";
import {
  validarGuiaTissBackground,
  type GuideValidationActionData,
} from "@/modules/tiss/guia-background-actions";

const initialState: BackgroundActionState<GuideValidationActionData> = { status: "idle" };

export function GuideValidationBackgroundForm({ guiaId, disabled = false }: { guiaId: string; disabled?: boolean }) {
  const action = validarGuiaTissBackground.bind(null, guiaId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return <form action={formAction} className="space-y-1">
    <button
      type="submit"
      disabled={disabled || pending}
      className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
    >
      <RefreshCw className="size-4" />Revalidar guia
    </button>
    <div aria-live="polite" className="max-w-72 text-xs font-semibold">
      {pending ? <span className="text-brand-700">Salvando…</span> : null}
      {!pending && state.status === "error" ? <span className="text-rose-700">{state.message}</span> : null}
      {!pending && state.status === "success" ? <span className="text-emerald-700">{state.message}</span> : null}
    </div>
  </form>;
}
