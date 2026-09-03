"use client";

import { AlertTriangle, ClipboardCheck } from "lucide-react";
import { useState } from "react";
import { concluirAltaSegura } from "@/modules/internacao/alta-actions";

type Reason = { codigo: string; display: string };

export function DischargeFinalizationForm({ internacaoId, reasons }: { internacaoId: string; reasons: Reason[] }) {
  const [reason, setReason] = useState("");
  const declarationRequired = reason === "41";
  const externalDocumentRequired = reason === "42" || reason === "43";
  const selected = reasons.find((item) => item.codigo === reason) ?? null;

  return <form action={concluirAltaSegura} className="space-y-5">
    <input type="hidden" name="internacao_id" value={internacaoId} />
    <div className="grid gap-4 md:grid-cols-2">
      <label className="space-y-1.5 text-sm font-semibold text-slate-700 md:col-span-2">
        <span>Motivo do encerramento *</span>
        <select name="motivo_codigo" value={reason} onChange={(event) => setReason(event.target.value)} required className="ui-input">
          <option value="">Selecione</option>
          {reasons.map((item) => <option key={item.codigo} value={item.codigo}>{item.display}</option>)}
        </select>
      </label>

      {declarationRequired ? <label className="space-y-1.5 text-sm font-semibold text-slate-700 md:col-span-2">
        <span>Número da Declaração de Óbito *</span>
        <input name="declaracao_obito_numero" required className="ui-input" autoComplete="off" />
      </label> : <input type="hidden" name="declaracao_obito_numero" value="" />}

      {externalDocumentRequired ? <label className="space-y-1.5 text-sm font-semibold text-slate-700 md:col-span-2">
        <span>{reason === "43" ? "Número do documento do SVO" : "Número do documento do IML"} *</span>
        <input name="documento_svo_iml_numero" required className="ui-input" autoComplete="off" />
      </label> : <input type="hidden" name="documento_svo_iml_numero" value="" />}

      <label className="space-y-1.5 text-sm font-semibold text-slate-700 md:col-span-2">
        <span>Observações do encerramento</span>
        <textarea name="observacao_encerramento" rows={3} className="ui-input" placeholder="Opcional" />
      </label>
    </div>

    {selected ? <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
      <strong className="text-slate-950">Motivo selecionado:</strong> {selected.display}
      {declarationRequired || externalDocumentRequired ? <p className="mt-2 flex items-start gap-2 text-xs font-semibold text-amber-800"><AlertTriangle className="mt-0.5 size-4 shrink-0" />O documento exigido deve ser conferido antes de concluir. O número será preservado no registro da internação e no faturamento.</p> : null}
    </div> : null}

    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
      Ao confirmar, a internação e o atendimento serão encerrados, o leito seguirá para higienização e a conta final será preparada. Períodos parciais já fechados permanecem separados e não serão reabertos.
    </div>

    <div className="flex justify-end">
      <button disabled={!reason} className="ui-button-primary disabled:cursor-not-allowed disabled:opacity-40"><ClipboardCheck className="size-4" />Confirmar encerramento da internação</button>
    </div>
  </form>;
}
