"use client";

import { Banknote, CheckCircle2, RotateCcw } from "lucide-react";
import { useActionState } from "react";
import type { BackgroundActionState } from "@/lib/actions/background-action";
import {
  conciliarRecebimentoFinanceiroBackground,
  estornarRecebimentoFinanceiroBackground,
  registrarRecebimentoFinanceiroBackground,
  type ReceivableActionData,
} from "@/modules/financeiro/background-actions";

const initialState: BackgroundActionState<ReceivableActionData> = { status: "idle" };

function Feedback({ state, pending }: { state: BackgroundActionState<ReceivableActionData>; pending: boolean }) {
  return <div aria-live="polite" className="min-h-6 text-xs font-semibold">
    {pending ? <span className="text-brand-700">Salvando…</span> : null}
    {!pending && state.status === "error" ? <span className="text-rose-700">{state.message}</span> : null}
    {!pending && state.status === "success" ? <span className="text-emerald-700">{state.message}</span> : null}
  </div>;
}

export function ReceivablePaymentForm({
  recebivelId,
  saldo,
  defaultDate,
}: {
  recebivelId: string;
  saldo: number;
  defaultDate: string;
}) {
  const action = registrarRecebimentoFinanceiroBackground.bind(null, recebivelId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return <form action={formAction} className="mt-4 grid gap-3 sm:grid-cols-2">
    <label className="space-y-1 text-xs font-semibold text-slate-500"><span>Data *</span><input type="date" name="data_recebimento" required defaultValue={defaultDate} className="ui-input" /></label>
    <label className="space-y-1 text-xs font-semibold text-slate-500"><span>Valor da baixa *</span><input name="valor_baixado" inputMode="decimal" required defaultValue={saldo.toFixed(2).replace(".", ",")} className="ui-input" /></label>
    <label className="space-y-1 text-xs font-semibold text-slate-500"><span>Retenções</span><input name="valor_retencoes" inputMode="decimal" defaultValue="0,00" className="ui-input" /></label>
    <label className="space-y-1 text-xs font-semibold text-slate-500"><span>Tarifas</span><input name="valor_tarifas" inputMode="decimal" defaultValue="0,00" className="ui-input" /></label>
    <label className="space-y-1 text-xs font-semibold text-slate-500"><span>Valor creditado</span><input name="valor_creditado" inputMode="decimal" placeholder="Calculado se vazio" className="ui-input" /></label>
    <label className="space-y-1 text-xs font-semibold text-slate-500"><span>Forma</span><select name="forma_recebimento" defaultValue="credito_bancario" className="ui-input"><option value="credito_bancario">Crédito bancário</option><option value="pix">PIX</option><option value="ted">TED</option><option value="boleto">Boleto</option><option value="cheque">Cheque</option><option value="dinheiro">Dinheiro</option><option value="outro">Outro</option></select></label>
    <input name="referencia_bancaria" placeholder="Referência / ID bancário" className="ui-input" />
    <input name="documento_operadora" placeholder="Documento da operadora" className="ui-input" />
    <textarea name="observacoes" placeholder="Observações" className="ui-input min-h-20 sm:col-span-2" />
    <div className="sm:col-span-2"><Feedback state={state} pending={pending} /></div>
    <button disabled={pending} className="ui-button-primary sm:col-span-2 disabled:cursor-not-allowed disabled:opacity-60"><Banknote className="size-4" />Registrar baixa</button>
  </form>;
}

export function ReceivableLedgerActions({
  recebimentoId,
  recebivelId,
  referenciaBancaria,
  canConciliate,
  canManage,
  status,
}: {
  recebimentoId: string;
  recebivelId: string;
  referenciaBancaria: string | null;
  canConciliate: boolean;
  canManage: boolean;
  status: string;
}) {
  const reconcile = conciliarRecebimentoFinanceiroBackground.bind(null, recebimentoId, recebivelId);
  const reverse = estornarRecebimentoFinanceiroBackground.bind(null, recebimentoId, recebivelId);
  const [reconcileState, reconcileAction, reconciling] = useActionState(reconcile, initialState);
  const [reverseState, reverseAction, reversing] = useActionState(reverse, initialState);

  return <div className="mt-4 space-y-3">
    {status === "registrado" && canConciliate ? <form action={reconcileAction} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
      <input name="referencia_bancaria" defaultValue={referenciaBancaria ?? ""} placeholder="Referência bancária" className="ui-input" />
      <input name="observacoes" placeholder="Observação da conciliação" className="ui-input" />
      <button disabled={reconciling} className="ui-button-secondary disabled:opacity-60"><CheckCircle2 className="size-4" />Conciliar</button>
      <div className="sm:col-span-3"><Feedback state={reconcileState} pending={reconciling} /></div>
    </form> : null}

    {status !== "estornado" && canManage ? <form action={reverseAction} className="grid gap-2 sm:grid-cols-[1fr_auto]">
      <input name="motivo" required placeholder="Motivo obrigatório do estorno" className="ui-input" />
      <button disabled={reversing} className="ui-button-secondary disabled:opacity-60"><RotateCcw className="size-4" />Estornar</button>
      <div className="sm:col-span-2"><Feedback state={reverseState} pending={reversing} /></div>
    </form> : null}
  </div>;
}
