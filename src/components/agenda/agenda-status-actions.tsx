"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { CheckCircle2, Loader2, Stethoscope, UserCheck, UserX, XCircle } from "lucide-react";
import { INITIAL_BACKGROUND_ACTION_STATE } from "@/lib/actions/background-action";
import { atualizarStatusAgendamento } from "@/modules/agenda/actions";

type AgendaStatusItem = {
  id: string;
  status: string;
  cirurgiaEletiva: boolean;
};

export function AgendaStatusActions({ item }: { item: AgendaStatusItem }) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [activeStatus, setActiveStatus] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState(
    atualizarStatusAgendamento,
    INITIAL_BACKGROUND_ACTION_STATE,
  );

  useEffect(() => {
    if (!pending) setActiveStatus(null);
    if (state.status === "success" && detailsRef.current) {
      detailsRef.current.open = false;
    }
  }, [pending, state.status]);

  const actions: React.ReactNode[] = [];

  if (item.status === "agendado") {
    actions.push(
      <StatusForm
        key="confirmar"
        id={item.id}
        status="confirmado"
        label="Confirmar"
        icon={CheckCircle2}
        formAction={formAction}
        pending={pending}
        activeStatus={activeStatus}
        onSubmit={setActiveStatus}
      />,
    );
  }

  if (["agendado", "confirmado"].includes(item.status)) {
    actions.push(
      <StatusForm
        key="checkin"
        id={item.id}
        status="checkin"
        label={item.cirurgiaEletiva ? "Pré-admissão" : "Check-in"}
        icon={UserCheck}
        formAction={formAction}
        pending={pending}
        activeStatus={activeStatus}
        onSubmit={setActiveStatus}
      />,
    );
  }

  if (item.status === "checkin") {
    actions.push(
      <StatusForm
        key="atendido"
        id={item.id}
        status="atendido"
        label="Atendido"
        icon={Stethoscope}
        formAction={formAction}
        pending={pending}
        activeStatus={activeStatus}
        onSubmit={setActiveStatus}
      />,
    );
  }

  if (["agendado", "confirmado"].includes(item.status)) {
    actions.push(
      <StatusForm
        key="faltou"
        id={item.id}
        status="faltou"
        label="Faltou"
        icon={UserX}
        formAction={formAction}
        pending={pending}
        activeStatus={activeStatus}
        onSubmit={setActiveStatus}
      />,
    );
  }

  if (["agendado", "confirmado", "checkin"].includes(item.status)) {
    actions.push(
      <details key="cancelar" ref={detailsRef} className="relative">
        <summary className="btn-secondary flex h-9 cursor-pointer list-none items-center gap-1.5 text-xs text-rose-700">
          <XCircle className="size-3.5" />
          Cancelar
        </summary>
        <form
          action={formAction}
          onSubmit={() => setActiveStatus("cancelado")}
          className="absolute right-0 z-20 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl"
        >
          <input type="hidden" name="agendamento_id" value={item.id} />
          <input type="hidden" name="status" value="cancelado" />
          <label className="text-xs font-semibold text-slate-600">
            Motivo do cancelamento
            <textarea name="motivo" required rows={3} className="ui-input mt-2" disabled={pending} />
          </label>
          <button
            type="submit"
            disabled={pending}
            aria-busy={pending && activeStatus === "cancelado"}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending && activeStatus === "cancelado" ? <Loader2 className="size-3.5 animate-spin" /> : null}
            {pending && activeStatus === "cancelado" ? "Salvando…" : "Confirmar cancelamento"}
          </button>
        </form>
      </details>,
    );
  }

  if (item.cirurgiaEletiva && item.status === "checkin") {
    actions.push(
      <Link
        key="cirurgia"
        href={`/assistencial/centro-cirurgico?agendamento=${item.id}`}
        className="btn-secondary h-9 text-xs text-violet-700"
      >
        Centro cirúrgico
      </Link>,
    );
  }

  return (
    <div className="flex min-w-[250px] flex-wrap justify-end gap-2">
      {actions}
      <div className="basis-full text-right" aria-live="polite" aria-atomic="true">
        {state.status === "error" ? (
          <span className="text-xs font-semibold text-rose-700">{state.message}</span>
        ) : null}
        {state.status === "success" ? (
          <span className="text-xs font-semibold text-emerald-700">{state.message}</span>
        ) : null}
      </div>
    </div>
  );
}

function StatusForm({
  id,
  status,
  label,
  icon: Icon,
  formAction,
  pending,
  activeStatus,
  onSubmit,
}: {
  id: string;
  status: string;
  label: string;
  icon: LucideIcon;
  formAction: (payload: FormData) => void;
  pending: boolean;
  activeStatus: string | null;
  onSubmit: (status: string) => void;
}) {
  const active = pending && activeStatus === status;
  return (
    <form action={formAction} onSubmit={() => onSubmit(status)}>
      <input type="hidden" name="agendamento_id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button
        type="submit"
        disabled={pending}
        aria-busy={active}
        className="btn-secondary h-9 text-xs disabled:cursor-not-allowed disabled:opacity-60"
      >
        {active ? <Loader2 className="size-3.5 animate-spin" /> : <Icon className="size-3.5" />}
        {active ? "Salvando…" : label}
      </button>
    </form>
  );
}
