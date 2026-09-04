"use client";

import { Plus, Save } from "lucide-react";
import { useActionState, type ReactNode } from "react";
import type { BackgroundActionState } from "@/lib/actions/background-action";
import {
  salvarDeparaTussBackground,
  type ComercialDeparaActionData,
} from "@/modules/comercial/depara-actions";

export function CommercialDeparaBackgroundForm({
  children,
  className = "",
  deparaId,
}: {
  children: ReactNode;
  className?: string;
  deparaId?: string | null;
}) {
  const initialState: BackgroundActionState<ComercialDeparaActionData> = { status: "idle" };
  const [state, formAction, pending] = useActionState(salvarDeparaTussBackground, initialState);
  const editing = Boolean(deparaId);

  return <form action={formAction} className={className}>
    {deparaId ? <input type="hidden" name="depara_id" value={deparaId} /> : null}
    {children}
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 md:col-span-full">
      <div aria-live="polite" className="min-h-5 text-xs font-semibold">
        {pending ? <span className="text-brand-700">Salvando em segundo plano…</span> : null}
        {!pending && state.status === "error" ? <span className="text-rose-700">{state.message}</span> : null}
        {!pending && state.status === "success" ? <span className="text-emerald-700">{state.message}</span> : null}
      </div>
      <button disabled={pending} className="ui-button-primary disabled:cursor-not-allowed disabled:opacity-50">
        {editing ? <Save className="size-4" /> : <Plus className="size-4" />}
        {editing ? "Salvar DePara" : "Versionar DePara"}
      </button>
    </div>
  </form>;
}
