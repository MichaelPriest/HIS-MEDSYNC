"use client";

import { Calculator, Plus, Save } from "lucide-react";
import { useActionState, type ReactNode } from "react";
import type { BackgroundActionState } from "@/lib/actions/background-action";
import {
  atualizarGrupoAtoBackground,
  atualizarItemAtoBackground,
  criarGrupoAtoBackground,
  recalcularGrupoAtoBackground,
  type BillingActActionData,
} from "@/modules/faturamento/atos-background-actions";

type Kind = BillingActActionData["kind"];
const initialState: BackgroundActionState<BillingActActionData> = { status: "idle" };

function actionFor(kind: Kind) {
  if (kind === "create") return criarGrupoAtoBackground;
  if (kind === "update") return atualizarGrupoAtoBackground;
  if (kind === "update-item") return atualizarItemAtoBackground;
  return recalcularGrupoAtoBackground;
}

const meta = {
  create: { label: "Criar ato", icon: Plus },
  update: { label: "Salvar ato", icon: Save },
  "update-item": { label: "Salvar vínculo", icon: Save },
  reprice: { label: "Recalcular grupo", icon: Calculator },
} as const;

export function BillingActBackgroundForm({
  contaId,
  kind,
  groupId,
  itemId,
  children,
  className = "",
  disabled = false,
  submitLabel,
  buttonClassName = "ui-button-secondary",
}: {
  contaId: string;
  kind: Kind;
  groupId?: string | null;
  itemId?: string | null;
  children?: ReactNode;
  className?: string;
  disabled?: boolean;
  submitLabel?: string;
  buttonClassName?: string;
}) {
  const action = actionFor(kind).bind(null, contaId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const config = meta[kind];
  const Icon = config.icon;

  return <form action={formAction} className={className}>
    {groupId ? <input type="hidden" name="grupo_ato_id" value={groupId} /> : null}
    {itemId ? <input type="hidden" name="item_id" value={itemId} /> : null}
    {children}
    <div aria-live="polite" className="mt-2 min-h-5 text-xs font-semibold">
      {pending ? <span className="text-brand-700">Salvando…</span> : null}
      {!pending && state.status === "error" ? <span className="text-rose-700">{state.message}</span> : null}
      {!pending && state.status === "success" ? <span className="text-emerald-700">{state.message}</span> : null}
    </div>
    <div className="mt-2 flex justify-end">
      <button disabled={disabled || pending} className={`${buttonClassName} disabled:cursor-not-allowed disabled:opacity-50`}><Icon className="size-4" />{submitLabel ?? config.label}</button>
    </div>
  </form>;
}
