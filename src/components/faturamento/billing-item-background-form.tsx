"use client";

import { Plus, Save } from "lucide-react";
import { useActionState, type ReactNode } from "react";
import { AccountItemDeleteButton } from "@/components/faturamento/account-background-forms";
import type { BackgroundActionState } from "@/lib/actions/background-action";
import {
  salvarLancamentoContaBackground,
  type BillingItemActionData,
} from "@/modules/faturamento/conta-item-background-actions";

const initialState: BackgroundActionState<BillingItemActionData> = { status: "idle" };

export function BillingItemBackgroundForm({
  contaId,
  itemId,
  children,
  className = "",
  submitLabel,
  disabled = false,
  showDelete = false,
}: {
  contaId: string;
  itemId?: string | null;
  children: ReactNode;
  className?: string;
  submitLabel?: string;
  disabled?: boolean;
  showDelete?: boolean;
}) {
  const action = salvarLancamentoContaBackground.bind(null, contaId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const editing = Boolean(itemId);
  const Icon = editing ? Save : Plus;

  return <form action={formAction} className={className}>
    {itemId ? <input type="hidden" name="item_id" value={itemId} /> : null}
    {children}
    <div aria-live="polite" className="mt-3 min-h-5 text-xs font-semibold">
      {pending ? <span className="text-brand-700">Salvando…</span> : null}
      {!pending && state.status === "error" ? <span className="text-rose-700">{state.message}</span> : null}
      {!pending && state.status === "success" ? <span className="text-emerald-700">{state.message}</span> : null}
    </div>
    <div className="mt-3 flex flex-wrap justify-end gap-2">
      <button disabled={disabled || pending} className="ui-button-primary disabled:cursor-not-allowed disabled:opacity-50">
        <Icon className="size-4" />{submitLabel ?? (editing ? "Salvar lançamento" : "Adicionar à conta")}
      </button>
      {editing && showDelete && !disabled ? <AccountItemDeleteButton contaId={contaId} /> : null}
    </div>
  </form>;
}
