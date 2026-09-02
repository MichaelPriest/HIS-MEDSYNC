"use client";

import { useActionState } from "react";
import { CircleAlert, ClipboardCheck, Loader2, Waypoints } from "lucide-react";
import { INITIAL_BACKGROUND_ACTION_STATE } from "@/lib/actions/background-action";
import { finalizarAtendimentoMedico } from "@/modules/prontuario-medico/encerramento-actions";

export function AltaMedicaBackgroundForm({
  atendimentoId,
  encaminhamentosBloqueantes = 0,
}: {
  atendimentoId: string;
  encaminhamentosBloqueantes?: number;
}) {
  const [state, formAction, pending] = useActionState(
    finalizarAtendimentoMedico,
    INITIAL_BACKGROUND_ACTION_STATE,
  );

  const concluida = state.status === "success";
  const bloqueadaPorEncaminhamento = encaminhamentosBloqueantes > 0;

  return (
    <form action={formAction} className="mt-5 space-y-4">
      <input type="hidden" name="atendimento_id" value={atendimentoId} />

      <div>
        <label className="ui-label" htmlFor="desfecho">Desfecho *</label>
        <select
          id="desfecho"
          name="desfecho"
          required
          defaultValue="alta"
          className="ui-input mt-1"
          disabled={pending || concluida}
        >
          <option value="alta">Alta médica</option>
          <option value="alta_com_retorno">Alta com retorno programado</option>
          <option value="encaminhamento_externo">Alta com encaminhamento externo</option>
        </select>
      </div>

      <div>
        <label className="ui-label" htmlFor="orientacoes">Orientações de alta *</label>
        <textarea
          id="orientacoes"
          name="orientacoes"
          required
          rows={6}
          className="ui-input mt-1 min-h-36"
          placeholder="Orientações ao paciente, sinais de alerta, retorno, cuidados e encaminhamentos após a alta."
          disabled={pending || concluida}
        />
      </div>

      {bloqueadaPorEncaminhamento ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <Waypoints className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-black">Alta temporariamente bloqueada</p>
            <p className="mt-1">Resolva {encaminhamentosBloqueantes} encaminhamento(s) assistencial(is) destacado(s) acima. As orientações podem ser preenchidas normalmente; o botão será liberado quando a pendência sair do episódio.</p>
          </div>
        </div>
      ) : null}

      <div aria-live="polite" aria-atomic="true">
        {state.status === "error" ? (
          <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            <CircleAlert className="mt-0.5 size-5 shrink-0" />
            <div>
              <p className="font-black">Alta não concluída</p>
              <p className="mt-1">{state.message}</p>
              {state.detail ? (
                <p className="mt-2 rounded-lg bg-white/70 px-3 py-2 font-semibold">Pendências: {state.detail}</p>
              ) : null}
            </div>
          </div>
        ) : null}

        {state.status === "success" ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
            {state.message}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-4">
        <p className="max-w-2xl text-xs text-slate-500">
          O salvamento ocorre em segundo plano. O sistema valida rascunhos, administrações pendentes, filas e encaminhamentos sem recarregar a página. Registros assinados permanecem imutáveis para auditoria.
        </p>
        <button
          className="ui-button-primary px-5 py-3"
          type="submit"
          disabled={pending || concluida || bloqueadaPorEncaminhamento}
          aria-busy={pending}
          title={bloqueadaPorEncaminhamento ? "Resolva os encaminhamentos assistenciais antes de concluir a alta." : undefined}
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <ClipboardCheck className="size-4" />}
          {pending ? "Salvando…" : concluida ? "Alta concluída" : bloqueadaPorEncaminhamento ? "Resolver pendências para concluir" : "Concluir atendimento e assinar alta"}
        </button>
      </div>
    </form>
  );
}
