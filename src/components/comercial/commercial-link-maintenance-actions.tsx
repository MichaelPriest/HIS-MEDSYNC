"use client";

import { RefreshCw, RotateCcw, Unlink } from "lucide-react";
import { useActionState } from "react";
import type { BackgroundActionState } from "@/lib/actions/background-action";
import {
  desvincularTabelaComercialBackground,
  reativarTabelaComercialBackground,
  sincronizarDeparaVinculoBackground,
  type CommercialLinkMaintenanceData,
} from "@/modules/comercial/link-maintenance-actions";

function Feedback({ state, pending }: { state: BackgroundActionState<CommercialLinkMaintenanceData>; pending: boolean }) {
  if (pending) return <p className="text-xs font-semibold text-brand-700">Processando em segundo plano…</p>;
  if (state.status === "error") return <p className="text-xs font-semibold text-rose-700">{state.message}</p>;
  if (state.status === "success") return <p className="text-xs font-semibold text-emerald-700">{state.message}</p>;
  return <span />;
}

export function CommercialLinkMaintenanceActions({ vinculoId, ativo }: { vinculoId: string; ativo: boolean }) {
  const initial: BackgroundActionState<CommercialLinkMaintenanceData> = { status: "idle" };
  const [syncState, syncAction, syncPending] = useActionState(sincronizarDeparaVinculoBackground, initial);
  const [unlinkState, unlinkAction, unlinkPending] = useActionState(desvincularTabelaComercialBackground, initial);
  const [reactivateState, reactivateAction, reactivatePending] = useActionState(reativarTabelaComercialBackground, initial);

  return <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
    {ativo ? <>
      <form action={syncAction} className="flex flex-wrap items-center justify-between gap-3">
        <input type="hidden" name="vinculo_id" value={vinculoId} />
        <div>
          <p className="text-sm font-black text-slate-900">DePara TUSS automático</p>
          <p className="text-xs text-slate-500">Usa código TUSS do item ou equivalência explícita cadastrada. Nunca infere mapeamentos.</p>
        </div>
        <button disabled={syncPending} className="ui-button-secondary disabled:opacity-50">
          <RefreshCw className="size-4" />Sincronizar DePara
        </button>
      </form>
      <Feedback state={syncState} pending={syncPending} />

      <form action={unlinkAction} className="grid gap-2 border-t border-slate-200 pt-3 md:grid-cols-[1fr_auto] md:items-end">
        <input type="hidden" name="vinculo_id" value={vinculoId} />
        <label className="grid gap-1 text-xs font-bold text-slate-600">
          Motivo do desvínculo
          <input name="motivo" required className="ui-input" placeholder="Ex.: nova negociação, tabela substituída, contrato revisado" />
        </label>
        <button disabled={unlinkPending} className="ui-button-secondary border-rose-200 text-rose-700 hover:bg-rose-50 disabled:opacity-50">
          <Unlink className="size-4" />Desvincular tabela
        </button>
      </form>
      <Feedback state={unlinkState} pending={unlinkPending} />
    </> : <>
      <form action={reactivateAction} className="flex flex-wrap items-center justify-between gap-3">
        <input type="hidden" name="vinculo_id" value={vinculoId} />
        <div>
          <p className="text-sm font-black text-slate-900">Reativar configuração histórica</p>
          <p className="text-xs text-slate-500">Reutiliza os valores salvos e dispara nova sincronização automática do DePara.</p>
        </div>
        <button disabled={reactivatePending} className="ui-button-secondary disabled:opacity-50">
          <RotateCcw className="size-4" />Reativar vínculo
        </button>
      </form>
      <Feedback state={reactivateState} pending={reactivatePending} />
    </>}
  </div>;
}
