"use client";

import { Link2, Save } from "lucide-react";
import { useActionState, type ReactNode } from "react";
import type { BackgroundActionState } from "@/lib/actions/background-action";
import {
  atualizarContratoComercialBackground,
  atualizarNegociacaoTabelaBackground,
  vincularTabelaContratoBackground,
  type CommercialWorkspaceActionData,
} from "@/modules/comercial/workspace-background-actions";

function Feedback({ pending, state }: { pending: boolean; state: BackgroundActionState<unknown> }) {
  return <div aria-live="polite" className="min-h-5 text-xs font-semibold">
    {pending ? <span className="text-brand-700">Salvando em segundo plano…</span> : null}
    {!pending && state.status === "error" ? <span className="text-rose-700">{state.message}</span> : null}
    {!pending && state.status === "success" ? <span className="text-emerald-700">{state.message}</span> : null}
  </div>;
}

function SubmitRow({
  pending,
  state,
  label,
  icon,
}: {
  pending: boolean;
  state: BackgroundActionState<unknown>;
  label: string;
  icon: ReactNode;
}) {
  return <div className="flex flex-wrap items-center justify-between gap-3 md:col-span-2 xl:col-span-4">
    <Feedback pending={pending} state={state} />
    <button disabled={pending} className="ui-button-primary disabled:cursor-not-allowed disabled:opacity-50">
      {icon}{label}
    </button>
  </div>;
}

export function CommercialContractBackgroundForm({ children, className = "" }: { children: ReactNode; className?: string }) {
  const initialState: BackgroundActionState<CommercialWorkspaceActionData> = { status: "idle" };
  const [state, action, pending] = useActionState(atualizarContratoComercialBackground, initialState);
  return <form action={action} className={className}>
    {children}
    <SubmitRow pending={pending} state={state} label="Salvar contrato" icon={<Save className="size-4" />} />
  </form>;
}

export function CommercialTableLinkBackgroundForm({ children, className = "" }: { children: ReactNode; className?: string }) {
  const initialState: BackgroundActionState<CommercialWorkspaceActionData> = { status: "idle" };
  const [state, action, pending] = useActionState(vincularTabelaContratoBackground, initialState);
  return <form action={action} className={className}>
    {children}
    <SubmitRow pending={pending} state={state} label="Vincular tabela" icon={<Link2 className="size-4" />} />
  </form>;
}

export function CommercialNegotiationBackgroundForm({ children, className = "" }: { children: ReactNode; className?: string }) {
  const initialState: BackgroundActionState<CommercialWorkspaceActionData> = { status: "idle" };
  const [state, action, pending] = useActionState(atualizarNegociacaoTabelaBackground, initialState);
  return <form action={action} className={className}>
    {children}
    <SubmitRow pending={pending} state={state} label="Salvar negociação" icon={<Save className="size-4" />} />
  </form>;
}
