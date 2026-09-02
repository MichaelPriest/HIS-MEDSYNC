"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  salvarCicloCmeBackground,
  type CmeActionState,
} from "@/modules/centro-cirurgico/cme-background-actions";

export type CmeCycleInitialData = {
  id: string;
  codigo_ciclo: string;
  equipamento: string | null;
  metodo: string | null;
  carga: string | null;
  indicadores: Record<string, unknown> | null;
  resultado: string | null;
  status: string;
  observacoes: string | null;
};

const initialState: CmeActionState = { status: "idle" };

export function CmeBackgroundForm({ ciclo }: { ciclo?: CmeCycleInitialData }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(salvarCicloCmeBackground, initialState);
  const indicador = ciclo?.indicadores ?? {};
  const released = state.status === "success" && state.data?.status === "liberado";

  useEffect(() => {
    if (!ciclo && state.status === "success" && state.data?.action === "create") {
      formRef.current?.reset();
    }
  }, [ciclo, state]);

  return <form ref={formRef} action={formAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
    <fieldset disabled={pending || released} className="contents">
      {ciclo ? <input type="hidden" name="ciclo_id" value={ciclo.id} /> : null}
      <input name="codigo_ciclo" defaultValue={ciclo?.codigo_ciclo ?? ""} required={!ciclo} className="ui-input" placeholder="Código do ciclo *" />
      <input name="equipamento" defaultValue={ciclo?.equipamento ?? ""} className="ui-input" placeholder="Autoclave / equipamento" />
      <select name="metodo" defaultValue={ciclo?.metodo ?? ""} className="ui-input"><option value="">Método</option><option value="vapor">Vapor saturado</option><option value="eto">Óxido de etileno</option><option value="peroxido">Peróxido de hidrogênio</option><option value="baixa_temperatura">Baixa temperatura</option><option value="outro">Outro</option></select>
      <input name="carga" defaultValue={ciclo?.carga ?? ""} className="ui-input" placeholder="Carga / lote processado" />
      <select name="status" defaultValue={ciclo?.status ?? "em_processamento"} className="ui-input"><option value="em_processamento">Em processamento</option><option value="concluido">Concluído</option><option value="reprovado">Reprovado</option></select>
      <input name="resultado" defaultValue={ciclo?.resultado ?? ""} className="ui-input lg:col-span-2" placeholder="Resultado técnico" />
      <input name="indicador_observacao" defaultValue={String(indicador.observacao ?? "")} className="ui-input" placeholder="Observação dos indicadores" />
      <div className="rounded-xl border border-slate-200 p-3 sm:col-span-2 lg:col-span-4"><p className="mb-2 text-sm font-black text-slate-800">Indicadores de esterilização</p><div className="flex flex-wrap gap-4 text-sm"><label className="flex items-center gap-2"><input type="checkbox" name="indicador_quimico" defaultChecked={Boolean(indicador.quimico)} />Químico conforme</label><label className="flex items-center gap-2"><input type="checkbox" name="indicador_biologico" defaultChecked={Boolean(indicador.biologico)} />Biológico conforme</label><label className="flex items-center gap-2"><input type="checkbox" name="indicador_fisico" defaultChecked={Boolean(indicador.fisico)} />Físico conforme</label></div></div>
      <textarea name="observacoes" defaultValue={ciclo?.observacoes ?? ""} className="ui-input min-h-20 sm:col-span-2 lg:col-span-3" placeholder="Observações do ciclo" />
      <div className="flex flex-col justify-end gap-2"><label className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-black text-emerald-800"><input type="checkbox" name="liberar" />Liberar ciclo definitivamente</label><button className="ui-button-primary">Salvar ciclo CME</button></div>
    </fieldset>

    <div className="sm:col-span-2 lg:col-span-4" aria-live="polite">
      {pending ? <p className="mt-2 text-xs font-black text-brand-700">Salvando…</p> : null}
      {!pending && state.status === "success" ? <p className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">{state.message}{state.data?.liberadoEm ? ` Liberação registrada em ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(state.data.liberadoEm))}.` : ""}</p> : null}
      {!pending && state.status === "error" ? <p className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{state.message}{state.detail ? <span className="ml-1 font-normal text-rose-500">({state.detail})</span> : null}</p> : null}
    </div>
  </form>;
}
