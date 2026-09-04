"use client";

import Link from "next/link";
import { FileCheck2, ShieldCheck } from "lucide-react";
import { useActionState } from "react";
import type { BackgroundActionState } from "@/lib/actions/background-action";
import {
  gerarMensagemTissFinalBackground,
  type TissFinalGenerationData,
} from "@/modules/tiss/mensagem-final-background-actions";

const initialState: BackgroundActionState<TissFinalGenerationData> = { status: "idle" };

export function TissFinalMessageForm({ loteId, disabled = false }: { loteId: string; disabled?: boolean }) {
  const action = gerarMensagemTissFinalBackground.bind(null, loteId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return <form action={formAction} className="space-y-2">
    <button type="submit" disabled={disabled || pending} className="ui-button-primary disabled:cursor-not-allowed disabled:opacity-50">
      <FileCheck2 className="size-4" />Gerar XML final ANS
    </button>
    <div aria-live="polite" className="max-w-xl text-xs font-semibold">
      {pending ? <span className="text-brand-700">Salvando… Validando no XSD ANS 04.03.00.</span> : null}
      {!pending && state.status === "error" ? <span className="text-rose-700">{state.message}</span> : null}
      {!pending && state.status === "success" ? <div className="space-y-1 text-emerald-700">
        <span className="flex items-center gap-1"><ShieldCheck className="size-3.5" />{state.message}</span>
        {state.data ? <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
          <span>{state.data.quantidadeGuias} guia(s)</span><span>{state.data.tipoGuia.replaceAll("_", " ")}</span><span>SHA-256 {state.data.hashSha256.slice(0, 12)}…</span>
          <Link href={`/api/tiss/xml/${state.data.xmlId}`} className="font-black text-brand-700 hover:underline">Baixar XML validado</Link>
        </div> : null}
      </div> : null}
    </div>
  </form>;
}
