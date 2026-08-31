"use client";

import { useActionState, useEffect, useRef } from "react";
import { CircleAlert, Loader2, Stethoscope } from "lucide-react";
import { INITIAL_BACKGROUND_ACTION_STATE } from "@/lib/actions/background-action";
import { solicitarAvaliacaoMedicaAction } from "@/modules/prontuario-medico/avaliacao-medica-actions";

export function AvaliacaoMedicaBackgroundForm({
  atendimentoId,
  especialidades,
}: {
  atendimentoId: string;
  especialidades: string[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    solicitarAvaliacaoMedicaAction,
    INITIAL_BACKGROUND_ACTION_STATE,
  );

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state.status]);

  return (
    <form ref={formRef} action={formAction} className="his-card p-6">
      <input type="hidden" name="atendimento_id" value={atendimentoId} />
      <div className="mb-4 flex items-center gap-3">
        <Stethoscope className="size-5 text-brand-700" />
        <div>
          <h2 className="font-black">Solicitar avaliação médica</h2>
          <p className="text-sm text-slate-500">A solicitação permanece dentro deste episódio e é salva sem recarregar a página.</p>
        </div>
      </div>

      <div className="grid gap-3">
        <label className="text-sm font-bold">
          Especialidade
          <select name="especialidade" required defaultValue="" className="ui-input mt-1 w-full" disabled={pending}>
            <option value="">Selecione</option>
            {especialidades.map((especialidade) => <option key={especialidade} value={especialidade}>{especialidade}</option>)}
          </select>
        </label>
        <label className="text-sm font-bold">
          Prioridade
          <select name="prioridade" className="ui-input mt-1 w-full" defaultValue="rotina" disabled={pending}>
            <option value="rotina">Rotina</option>
            <option value="urgente">Urgente</option>
            <option value="emergencia">Emergência</option>
          </select>
        </label>
        <label className="text-sm font-bold">
          Motivo
          <textarea name="motivo" required rows={4} className="ui-input mt-1 w-full" placeholder="Descreva objetivamente a razão da avaliação." disabled={pending} />
        </label>
        <label className="text-sm font-bold">
          Observações
          <textarea name="observacoes" rows={3} className="ui-input mt-1 w-full" placeholder="Informações adicionais, hipótese, exames ou condutas já realizadas." disabled={pending} />
        </label>

        <div aria-live="polite" aria-atomic="true">
          {state.status === "error" ? (
            <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-800">
              <CircleAlert className="mt-0.5 size-4 shrink-0" />
              <span>{state.message}</span>
            </div>
          ) : null}
          {state.status === "success" ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
              {state.message}
            </div>
          ) : null}
        </div>

        <button className="ui-button-primary justify-self-end" type="submit" disabled={pending} aria-busy={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Stethoscope className="size-4" />}
          {pending ? "Salvando…" : "Solicitar avaliação"}
        </button>
      </div>
    </form>
  );
}
