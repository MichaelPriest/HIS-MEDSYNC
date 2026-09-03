"use client";

import { FileCheck2 } from "lucide-react";
import { useActionState } from "react";
import type { BackgroundActionState } from "@/lib/actions/background-action";
import { registrarEmissaoManualNfseBackground } from "@/modules/nfse/background-actions";

const initialState: BackgroundActionState = { status: "idle" };

export function NfseManualBackgroundForm({
  notaId,
  numeroNfse,
  codigoVerificacao,
  protocoloPrefeitura,
}: {
  notaId: string;
  numeroNfse: string | null;
  codigoVerificacao: string | null;
  protocoloPrefeitura: string | null;
}) {
  const action = registrarEmissaoManualNfseBackground.bind(null, notaId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return <form action={formAction} className="ui-card p-5">
    <div className="flex items-center gap-3">
      <FileCheck2 className="size-5 text-emerald-600" />
      <div>
        <h2 className="font-semibold text-slate-900">Emissão manual pelo portal</h2>
        <p className="text-sm text-slate-500">Após emitir no portal da prefeitura, registre os dados oficiais sem sair desta tela.</p>
      </div>
    </div>
    <div className="mt-4 grid gap-3 md:grid-cols-2">
      <input name="numero_nfse" defaultValue={numeroNfse ?? ""} required placeholder="Número NFS-e" className="ui-input" />
      <input name="codigo_verificacao" defaultValue={codigoVerificacao ?? ""} placeholder="Código de verificação" className="ui-input" />
      <input name="protocolo_prefeitura" defaultValue={protocoloPrefeitura ?? ""} placeholder="Protocolo prefeitura" className="ui-input" />
      <input name="data_emissao" type="datetime-local" className="ui-input" />
    </div>
    <div aria-live="polite" className="mt-3 min-h-6 text-xs font-semibold">
      {pending ? <span className="text-brand-700">Salvando…</span> : null}
      {!pending && state.status === "error" ? <span className="text-rose-700">{state.message}</span> : null}
      {!pending && state.status === "success" ? <span className="text-emerald-700">{state.message}</span> : null}
    </div>
    <button disabled={pending} className="ui-button-primary mt-2 disabled:cursor-not-allowed disabled:opacity-60">
      <FileCheck2 className="size-4" />Registrar NFS-e emitida
    </button>
  </form>;
}
