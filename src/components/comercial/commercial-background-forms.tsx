"use client";

import { PackagePlus, Plus, Save } from "lucide-react";
import { useActionState, type ReactNode } from "react";
import type { BackgroundActionState } from "@/lib/actions/background-action";
import {
  adicionarItemPacoteBackground,
  salvarPacoteContratoBackground,
  salvarRegraFaturamentoBackground,
  type ComercialPackageActionData,
  type ComercialPackageItemActionData,
  type ComercialRuleActionData,
} from "@/modules/comercial/regras-actions";

function ActionFeedback({
  pending,
  state,
}: {
  pending: boolean;
  state: BackgroundActionState<unknown>;
}) {
  return <div aria-live="polite" className="min-h-5 text-xs font-semibold">
    {pending ? <span className="text-brand-700">Salvando em segundo plano…</span> : null}
    {!pending && state.status === "error" ? <span className="text-rose-700">{state.message}</span> : null}
    {!pending && state.status === "success" ? <span className="text-emerald-700">{state.message}</span> : null}
  </div>;
}

export function CommercialRuleBackgroundForm({
  children,
  className = "",
  ruleId,
}: {
  children: ReactNode;
  className?: string;
  ruleId?: string | null;
}) {
  const initialState: BackgroundActionState<ComercialRuleActionData> = { status: "idle" };
  const [state, formAction, pending] = useActionState(salvarRegraFaturamentoBackground, initialState);
  const editing = Boolean(ruleId);
  const Icon = editing ? Save : Plus;

  return <form action={formAction} className={className}>
    {ruleId ? <input type="hidden" name="regra_id" value={ruleId} /> : null}
    {children}
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
      <ActionFeedback pending={pending} state={state} />
      <button disabled={pending} className="ui-button-primary disabled:cursor-not-allowed disabled:opacity-50">
        <Icon className="size-4" />{editing ? "Salvar regra" : "Criar regra"}
      </button>
    </div>
  </form>;
}

export function CommercialPackageBackgroundForm({
  children,
  className = "",
  packageId,
}: {
  children: ReactNode;
  className?: string;
  packageId?: string | null;
}) {
  const initialState: BackgroundActionState<ComercialPackageActionData> = { status: "idle" };
  const [state, formAction, pending] = useActionState(salvarPacoteContratoBackground, initialState);
  const editing = Boolean(packageId);

  return <form action={formAction} className={className}>
    {packageId ? <input type="hidden" name="pacote_id" value={packageId} /> : null}
    {children}
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
      <ActionFeedback pending={pending} state={state} />
      <button disabled={pending} className="ui-button-primary disabled:cursor-not-allowed disabled:opacity-50">
        <PackagePlus className="size-4" />{editing ? "Salvar pacote" : "Criar pacote"}
      </button>
    </div>
  </form>;
}

export function CommercialPackageItemBackgroundForm({
  children,
  className = "",
  itemId,
}: {
  children: ReactNode;
  className?: string;
  itemId?: string | null;
}) {
  const initialState: BackgroundActionState<ComercialPackageItemActionData> = { status: "idle" };
  const [state, formAction, pending] = useActionState(adicionarItemPacoteBackground, initialState);
  const editing = Boolean(itemId);

  return <form action={formAction} className={className}>
    {itemId ? <input type="hidden" name="item_id" value={itemId} /> : null}
    {children}
    <div className="flex flex-wrap items-center justify-between gap-2 md:col-span-full">
      <ActionFeedback pending={pending} state={state} />
      <button disabled={pending} className="ui-button-primary disabled:cursor-not-allowed disabled:opacity-50">
        {editing ? <Save className="size-4" /> : <Plus className="size-4" />}{editing ? "Salvar item" : "Adicionar item"}
      </button>
    </div>
  </form>;
}
