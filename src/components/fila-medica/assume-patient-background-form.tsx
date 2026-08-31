"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { BellRing, MapPin } from "lucide-react";
import type { BackgroundActionState } from "@/lib/actions/background-action";
import { assumirPaciente } from "@/modules/fila-medica/actions";

type StateData = { redirectTo?: string };

const INITIAL_STATE: BackgroundActionState<StateData> = { status: "idle" };

export function AssumePatientBackgroundForm({
  encaminhamentoId,
  filaSetor,
  pontoPadrao,
}: {
  encaminhamentoId: string;
  filaSetor: string;
  pontoPadrao: string;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(assumirPaciente, INITIAL_STATE);

  useEffect(() => {
    if (state.status === "success" && state.data?.redirectTo) {
      router.push(state.data.redirectTo as Route);
    }
  }, [router, state]);

  return (
    <form action={formAction} className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[330px]">
      <input type="hidden" name="encaminhamento_id" value={encaminhamentoId} />
      <input type="hidden" name="fila_setor" value={filaSetor} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="relative min-w-0 flex-1">
          <MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            name="ponto_atendimento"
            defaultValue={pontoPadrao}
            required
            maxLength={80}
            className="ui-input h-10 w-full pl-9"
            aria-label="Ponto de atendimento da chamada"
          />
        </label>
        <button disabled={pending} className="ui-button-primary h-10 whitespace-nowrap disabled:cursor-wait disabled:opacity-70">
          <BellRing className="size-4" /> {pending ? "Salvando…" : "Chamar e assumir"}
        </button>
      </div>
      <div aria-live="polite" className="min-h-5 text-xs">
        {state.status === "error" ? <p className="font-medium text-rose-700">{state.message}</p> : null}
        {state.status === "success" ? <p className="font-medium text-emerald-700">{state.message}</p> : null}
      </div>
    </form>
  );
}
