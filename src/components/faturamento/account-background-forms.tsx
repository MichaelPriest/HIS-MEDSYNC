"use client";

import { Calculator, RefreshCcw, Save, ShieldCheck, Trash2 } from "lucide-react";
import { useActionState, type ReactNode } from "react";
import type { BackgroundActionState } from "@/lib/actions/background-action";
import {
  atualizarResumoContaBackground,
  excluirLancamentoContaBackground,
  recalcularPrecosContaBackground,
  sincronizarProducaoContaBackground,
  validarContaTissBackground,
  type BillingAccountActionData,
} from "@/modules/faturamento/conta-background-actions";

type AccountActionKind = "summary" | "sync" | "reprice" | "validate";

const initialState: BackgroundActionState<BillingAccountActionData> = { status: "idle" };

function Feedback({ state, pending }: { state: BackgroundActionState<BillingAccountActionData>; pending: boolean }) {
  return <div aria-live="polite" className="min-h-5 text-xs font-semibold">
    {pending ? <span className="text-brand-700">Salvando…</span> : null}
    {!pending && state.status === "error" ? <span className="text-rose-700">{state.message}</span> : null}
    {!pending && state.status === "success" ? <span className="text-emerald-700">{state.message}</span> : null}
  </div>;
}

function actionFor(kind: AccountActionKind) {
  if (kind === "summary") return atualizarResumoContaBackground;
  if (kind === "sync") return sincronizarProducaoContaBackground;
  if (kind === "reprice") return recalcularPrecosContaBackground;
  return validarContaTissBackground;
}

const meta = {
  summary: { label: "Salvar", icon: Save, className: "ui-button-secondary" },
  sync: { label: "Sincronizar produção", icon: RefreshCcw, className: "ui-button-secondary" },
  reprice: { label: "Recalcular contrato", icon: Calculator, className: "ui-button-secondary" },
  validate: { label: "Validar conta TISS", icon: ShieldCheck, className: "ui-button-primary" },
} as const;

export function AccountBackgroundForm({
  contaId,
  kind,
  children,
  className = "",
  buttonClassName,
}: {
  contaId: string;
  kind: AccountActionKind;
  children?: ReactNode;
  className?: string;
  buttonClassName?: string;
}) {
  const action = actionFor(kind).bind(null, contaId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const config = meta[kind];
  const Icon = config.icon;

  return <form action={formAction} className={className}>
    {children}
    <div className={children ? "mt-3" : ""}><Feedback state={state} pending={pending} /></div>
    <button disabled={pending} className={`${buttonClassName ?? config.className} disabled:cursor-not-allowed disabled:opacity-60`}>
      <Icon className="size-4" />{config.label}
    </button>
  </form>;
}

export function AccountItemDeleteButton({ contaId }: { contaId: string }) {
  const action = excluirLancamentoContaBackground.bind(null, contaId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return <div className="flex flex-col items-end gap-1">
    <button
      type="submit"
      formAction={formAction}
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <Trash2 className="size-4" />Excluir
    </button>
    <Feedback state={state} pending={pending} />
  </div>;
}
