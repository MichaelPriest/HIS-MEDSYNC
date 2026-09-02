"use client";

import { Save } from "lucide-react";
import { useActionState } from "react";
import type { BackgroundActionState } from "@/lib/actions/background-action";
import {
  salvarItemComplementoTissBackground,
  type TissGuideCommunicationData,
} from "@/modules/tiss/guia-complement-background-actions";

const initialState: BackgroundActionState<TissGuideCommunicationData> = { status: "idle" };

export function TissItemComplementForm({
  guiaId,
  itemId,
  unidade,
  disabled = false,
}: {
  guiaId: string;
  itemId: string;
  unidade?: string | null;
  disabled?: boolean;
}) {
  const action = salvarItemComplementoTissBackground.bind(null, guiaId, itemId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return <form action={formAction} className="flex min-w-48 flex-col items-end gap-1">
    <div className="flex items-center gap-2">
      <input
        name="unidade_medida_tiss"
        defaultValue={unidade ?? ""}
        maxLength={3}
        inputMode="numeric"
        placeholder="Unid. TISS"
        aria-label="Unidade de medida TISS"
        disabled={disabled || pending}
        className="ui-input w-28"
      />
      <button type="submit" disabled={disabled || pending} className="ui-button-secondary disabled:opacity-50"><Save className="size-4" />Salvar</button>
    </div>
    <div aria-live="polite" className="max-w-64 text-right text-[11px] font-semibold">
      {pending ? <span className="text-brand-700">Salvando…</span> : null}
      {!pending && state.status === "error" ? <span className="text-rose-700">{state.message}</span> : null}
      {!pending && state.status === "success" ? <span className="text-emerald-700">{state.message}</span> : null}
    </div>
  </form>;
}
